import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { GOOGLE_CALENDAR_COLORS } from "../categories/shared";
import { enqueueSchedulingRunFromMutation } from "./enqueue";
import {
	DEFAULT_TRAVEL_COLOR_INDEX,
	MINUTES_TO_MS,
	type SchedulingBlock,
	TRAVEL_CATEGORY_NAME,
	appendRemovedGoogleEvent,
	blockGroupKey,
	createTravelBlock,
	isRunSuperseded,
	isTravelBufferCandidate,
	isTravelSourceId,
	listLatestRunCandidates,
	recordTaskPlacement,
	resolveBlockColor,
	resolveScheduledTaskStatus,
	resolveTravelMinutes,
	resolveTravelWindow,
	upsertGroupedBlock,
} from "./mutationHelpers";

const triggerValidator = v.union(
	v.literal("manual"),
	v.literal("task_change"),
	v.literal("habit_change"),
	v.literal("hours_change"),
	v.literal("calendar_change"),
	v.literal("cron"),
);

const priorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
	v.literal("blocker"),
);
const habitPriorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
);

const recoveryPolicyValidator = v.union(v.literal("skip"), v.literal("recover"));

export const enqueueSchedulingRun = internalMutation({
	args: {
		userId: v.string(),
		triggeredBy: triggerValidator,
		force: v.optional(v.boolean()),
	},
	returns: v.object({
		enqueued: v.boolean(),
		runId: v.id("schedulingRuns"),
	}),
	handler: async (ctx, args) => {
		return enqueueSchedulingRunFromMutation(ctx, args);
	},
});

export const markRunRunning = internalMutation({
	args: {
		runId: v.id("schedulingRuns"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.runId);
		if (!run) return null;
		if (run.status !== "pending") return null;
		await ctx.db.patch(args.runId, {
			status: "running",
		});
		return null;
	},
});

export const applySchedulingBlocks = internalMutation({
	args: {
		runId: v.id("schedulingRuns"),
		userId: v.string(),
		horizonStart: v.number(),
		horizonEnd: v.number(),
		blocks: v.array(
			v.object({
				source: v.union(v.literal("task"), v.literal("habit")),
				sourceId: v.string(),
				title: v.string(),
				start: v.number(),
				end: v.number(),
				priority: priorityValidator,
				calendarId: v.optional(v.string()),
				color: v.optional(v.string()),
				location: v.optional(v.string()),
			}),
		),
	},
	returns: v.object({
		tasksScheduled: v.number(),
		habitsScheduled: v.number(),
		removedGoogleEvents: v.array(
			v.object({
				googleEventId: v.string(),
				calendarId: v.string(),
			}),
		),
	}),
	handler: async (ctx, args) => {
		const currentRun = await ctx.db.get(args.runId);
		if (!currentRun || currentRun.userId !== args.userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Scheduling run not found.",
			});
		}
		const latestCandidates = await listLatestRunCandidates(ctx, args.userId);
		const superseded = await isRunSuperseded({
			ctx,
			userId: args.userId,
			currentRun,
			latestCandidates,
		});
		if (superseded) {
			throw new ConvexError({
				code: "SUPERSEDED_BY_NEWER_RUN",
				message: "A newer scheduling run is queued for this user.",
			});
		}

		const existing = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_start", (q) =>
				q.eq("userId", args.userId).lte("start", args.horizonEnd),
			)
			.filter((q) => q.gte(q.field("end"), args.horizonStart))
			.collect();
		const existingScheduledEvents = existing
			.filter((event) => event.source === "task" || event.source === "habit")
			.sort((a, b) => {
				const aKey = `${a.source}:${a.sourceId ?? ""}`;
				const bKey = `${b.source}:${b.sourceId ?? ""}`;
				if (aKey !== bKey) return aKey.localeCompare(bKey);
				if (a.start !== b.start) return a.start - b.start;
				return a.end - b.end;
			});
		const orphanScheduledEvents = existingScheduledEvents.filter((event) => !event.sourceId);

		const groupedExisting = new Map<string, typeof existingScheduledEvents>();
		for (const event of existingScheduledEvents) {
			if (!event.sourceId) continue;
			const key = blockGroupKey({
				source: event.source as "task" | "habit",
				sourceId: event.sourceId,
			});
			const group = groupedExisting.get(key) ?? [];
			group.push(event);
			groupedExisting.set(key, group);
		}

		const validBlocks: SchedulingBlock[] = args.blocks
			.filter((block): block is SchedulingBlock => block.start < block.end)
			.sort((a, b) => {
				const aKey = blockGroupKey(a);
				const bKey = blockGroupKey(b);
				if (aKey !== bKey) return aKey.localeCompare(bKey);
				if (a.start !== b.start) return a.start - b.start;
				return a.end - b.end;
			});

		const groupedBlocks = new Map<string, SchedulingBlock[]>();
		for (const block of validBlocks) {
			const key = blockGroupKey(block);
			const group = groupedBlocks.get(key) ?? [];
			group.push(block);
			groupedBlocks.set(key, group);
		}

		const travelCategory = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_name", (q) =>
				q.eq("userId", args.userId).eq("name", TRAVEL_CATEGORY_NAME),
			)
			.unique();
		const resolvedTravelColor =
			travelCategory?.color ?? GOOGLE_CALENDAR_COLORS[DEFAULT_TRAVEL_COLOR_INDEX];
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		const tasksBySourceId = new Map(tasks.map((task) => [String(task._id), task] as const));

		for (const event of existingScheduledEvents) {
			if (!isTravelBufferCandidate(event)) continue;
			const task = tasksBySourceId.get(event.sourceId);
			if (!task) continue;
			if (!task.location?.trim()) continue;
			const travelMinutes = resolveTravelMinutes(task.travelMinutes);
			if (travelMinutes <= 0) continue;
			const travelDurationMs = travelMinutes * MINUTES_TO_MS;
			const { beforeStart, afterEnd } = resolveTravelWindow(
				args.horizonStart,
				args.horizonEnd,
				event.start,
				event.end,
				travelDurationMs,
			);

			if (beforeStart < event.start) {
				const { key, block } = createTravelBlock({
					task,
					event,
					segment: "before",
					start: beforeStart,
					end: event.start,
					travelColor: resolvedTravelColor,
				});
				upsertGroupedBlock(groupedBlocks, key, block);
			}

			if (event.end < afterEnd) {
				const { key, block } = createTravelBlock({
					task,
					event,
					segment: "after",
					start: event.end,
					end: afterEnd,
					travelColor: resolvedTravelColor,
				});
				upsertGroupedBlock(groupedBlocks, key, block);
			}
		}

		const tasksById = new Map<string, { starts: number[]; ends: number[] }>();
		let tasksScheduled = 0;
		let habitsScheduled = 0;
		const removedGoogleEvents: Array<{ googleEventId: string; calendarId: string }> = [];
		const now = Date.now();
		for (const orphanEvent of orphanScheduledEvents) {
			appendRemovedGoogleEvent(removedGoogleEvents, orphanEvent);
			await ctx.db.delete(orphanEvent._id);
		}
		for (const [key, blocks] of groupedBlocks) {
			const existingGroup = groupedExisting.get(key) ?? [];
			// Separate pinned events — they survive the commit cycle untouched
			const pinnedExisting = existingGroup.filter((e) => e.pinned);
			const unpinnedExisting = existingGroup.filter((e) => !e.pinned);
			const pairCount = Math.min(unpinnedExisting.length, blocks.length);

			for (let index = 0; index < pairCount; index += 1) {
				const block = blocks[index];
				const current = unpinnedExisting[index];
				if (!block || !current) continue;
				const resolvedBlockColor = resolveBlockColor(block, resolvedTravelColor);
				await ctx.db.patch(current._id, {
					title: block.title,
					start: block.start,
					end: block.end,
					allDay: false,
					updatedAt: now,
					source: block.source,
					sourceId: block.sourceId,
					calendarId: block.calendarId ?? current.calendarId,
					busyStatus: "busy",
					color: resolvedBlockColor,
					location: block.location,
				});
			}

			for (const block of blocks.slice(pairCount)) {
				const resolvedBlockColor = resolveBlockColor(block, resolvedTravelColor);
				await ctx.db.insert("calendarEvents", {
					userId: args.userId,
					title: block.title,
					start: block.start,
					end: block.end,
					allDay: false,
					updatedAt: now,
					source: block.source,
					sourceId: block.sourceId,
					calendarId: block.calendarId,
					busyStatus: "busy",
					color: resolvedBlockColor,
					location: block.location,
				});
			}

			for (const pinnedEvent of pinnedExisting) {
				if (
					pinnedEvent.source === "task" &&
					pinnedEvent.sourceId?.includes(":travel:") &&
					pinnedEvent.color !== resolvedTravelColor
				) {
					await ctx.db.patch(pinnedEvent._id, {
						color: resolvedTravelColor,
						updatedAt: now,
					});
				}
			}

			for (const staleEvent of unpinnedExisting.slice(pairCount)) {
				appendRemovedGoogleEvent(removedGoogleEvents, staleEvent);
				await ctx.db.delete(staleEvent._id);
			}

			for (const block of blocks) {
				if (block.source === "task") {
					const isTravelBlock = isTravelSourceId(block.sourceId);
					if (!isTravelBlock) {
						tasksScheduled += 1;
						recordTaskPlacement(tasksById, block.sourceId, block.start, block.end);
					}
				} else {
					habitsScheduled += 1;
				}
			}
		}

		for (const [key, staleGroup] of groupedExisting) {
			if (groupedBlocks.has(key)) continue;
			for (const staleEvent of staleGroup) {
				if (staleEvent.pinned) continue; // preserve pinned events
				appendRemovedGoogleEvent(removedGoogleEvents, staleEvent);
				await ctx.db.delete(staleEvent._id);
			}
		}

		// Include pinned event times in task placement calculations
		for (const event of existing) {
			if (
				event.source === "task" &&
				event.pinned === true &&
				event.sourceId &&
				!isTravelSourceId(event.sourceId)
			) {
				recordTaskPlacement(tasksById, event.sourceId, event.start, event.end);
			}
		}

		for (const task of tasks) {
			const placements = tasksById.get(String(task._id));
			if (!placements) {
				const shouldResetStatus = task.status === "scheduled" || task.status === "in_progress";
				if (
					task.scheduledStart !== undefined ||
					task.scheduledEnd !== undefined ||
					shouldResetStatus
				) {
					await ctx.db.patch(task._id, {
						scheduledStart: undefined,
						scheduledEnd: undefined,
						...(shouldResetStatus ? { status: "queued" as const } : {}),
					});
				}
				continue;
			}
			const scheduledStart = Math.min(...placements.starts);
			const scheduledEnd = Math.max(...placements.ends);
			await ctx.db.patch(task._id, {
				scheduledStart,
				scheduledEnd,
				status: resolveScheduledTaskStatus(task.status, scheduledStart, now),
			});
		}

		return {
			tasksScheduled,
			habitsScheduled,
			removedGoogleEvents,
		};
	},
});

export const completeRun = internalMutation({
	args: {
		runId: v.id("schedulingRuns"),
		tasksScheduled: v.number(),
		habitsScheduled: v.number(),
		feasibleOnTime: v.boolean(),
		horizonStart: v.number(),
		horizonEnd: v.number(),
		objectiveScore: v.number(),
		lateTasks: v.array(
			v.object({
				taskId: v.id("tasks"),
				dueDate: v.optional(v.number()),
				completionEnd: v.number(),
				tardinessSlots: v.number(),
				priority: priorityValidator,
				blocker: v.boolean(),
				reason: v.optional(v.string()),
			}),
		),
		habitShortfalls: v.array(
			v.object({
				habitId: v.id("habits"),
				periodStart: v.number(),
				periodEnd: v.number(),
				targetCount: v.number(),
				scheduledCount: v.number(),
				shortfall: v.number(),
				recoveryPolicy: recoveryPolicyValidator,
			}),
		),
		dropSummary: v.array(
			v.object({
				habitId: v.id("habits"),
				recoveryPolicy: recoveryPolicyValidator,
				priority: habitPriorityValidator,
				reason: v.string(),
			}),
		),
		reasonCode: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.runId);
		if (!run) throw new ConvexError({ code: "NOT_FOUND", message: "Scheduling run not found." });
		await ctx.db.patch(args.runId, {
			status: "completed",
			completedAt: Date.now(),
			tasksScheduled: args.tasksScheduled,
			habitsScheduled: args.habitsScheduled,
			feasibleOnTime: args.feasibleOnTime,
			horizonStart: args.horizonStart,
			horizonEnd: args.horizonEnd,
			objectiveScore: args.objectiveScore,
			lateTasks: args.lateTasks,
			habitShortfalls: args.habitShortfalls,
			dropSummary: args.dropSummary,
			reasonCode: args.reasonCode,
			error: undefined,
		});
		return null;
	},
});

export const failRun = internalMutation({
	args: {
		runId: v.id("schedulingRuns"),
		error: v.string(),
		reasonCode: v.optional(v.string()),
		feasibleOnTime: v.optional(v.boolean()),
		horizonStart: v.optional(v.number()),
		horizonEnd: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.runId);
		if (!run) return null;
		await ctx.db.patch(args.runId, {
			status: "failed",
			completedAt: Date.now(),
			error: args.error,
			reasonCode: args.reasonCode,
			feasibleOnTime: args.feasibleOnTime,
			horizonStart: args.horizonStart,
			horizonEnd: args.horizonEnd,
		});
		return null;
	},
});

// clearExpiredPinnedTasks removed — pinning is now per-event, not per-task
