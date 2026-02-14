import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { GOOGLE_CALENDAR_COLORS } from "../categories/shared";
import { enqueueSchedulingRunFromMutation } from "./enqueue";
import { isRunNewer } from "./run_order";

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

type SchedulingBlock = {
	source: "task" | "habit";
	sourceId: string;
	title: string;
	start: number;
	end: number;
	priority: "low" | "medium" | "high" | "critical" | "blocker";
	calendarId?: string;
	color?: string;
	location?: string;
};

const blockGroupKey = (block: Pick<SchedulingBlock, "source" | "sourceId">) =>
	`${block.source}:${block.sourceId}`;

const buildTravelSourceId = (
	taskId: string,
	placementStart: number,
	placementEnd: number,
	segment: "before" | "after",
) => `task:${taskId}:travel:${segment}:${placementStart}:${placementEnd}`;

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
		const [latestPending, latestRunning] = await Promise.all([
			ctx.db
				.query("schedulingRuns")
				.withIndex("by_userId_status_startedAt", (q) =>
					q.eq("userId", args.userId).eq("status", "pending"),
				)
				.order("desc")
				.take(1),
			ctx.db
				.query("schedulingRuns")
				.withIndex("by_userId_status_startedAt", (q) =>
					q.eq("userId", args.userId).eq("status", "running"),
				)
				.order("desc")
				.take(1),
		]);
		const latestCandidates = [latestPending[0], latestRunning[0]].filter(
			(run) => run !== undefined,
		);
		let superseded = latestCandidates.some(
			(run) => run._id !== args.runId && run.startedAt > currentRun.startedAt,
		);

		if (!superseded) {
			const needTieCheck = latestCandidates.some((run) => run.startedAt === currentRun.startedAt);
			if (needTieCheck) {
				const tiedRuns = await ctx.db
					.query("schedulingRuns")
					.withIndex("by_userId_startedAt", (q) =>
						q.eq("userId", args.userId).eq("startedAt", currentRun.startedAt),
					)
					.collect();
				superseded = tiedRuns.some(
					(run) =>
						(run.status === "pending" || run.status === "running") &&
						run._id !== args.runId &&
						isRunNewer(run, currentRun),
				);
			}
		}
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
			.withIndex("by_userId_name", (q) => q.eq("userId", args.userId).eq("name", "Travel"))
			.unique();
		const resolvedTravelColor = travelCategory?.color ?? GOOGLE_CALENDAR_COLORS[7];
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		const tasksBySourceId = new Map(tasks.map((task) => [String(task._id), task] as const));

		for (const event of existingScheduledEvents) {
			if (
				event.source !== "task" ||
				event.pinned !== true ||
				!event.sourceId ||
				event.sourceId.includes(":travel:")
			) {
				continue;
			}
			const task = tasksBySourceId.get(event.sourceId);
			if (!task) {
				continue;
			}
			const hasLocation = Boolean(task.location?.trim());
			if (!hasLocation) {
				continue;
			}
			const travelMinutes = Math.max(0, Math.round(task.travelMinutes ?? 0));
			if (travelMinutes <= 0) {
				continue;
			}
			const travelDurationMs = travelMinutes * 60 * 1000;
			const beforeStart = Math.max(args.horizonStart, event.start - travelDurationMs);
			const afterEnd = Math.min(args.horizonEnd, event.end + travelDurationMs);

			if (beforeStart < event.start) {
				const sourceId = buildTravelSourceId(event.sourceId, event.start, event.end, "before");
				const key = blockGroupKey({ source: "task", sourceId });
				const group = groupedBlocks.get(key) ?? [];
				if (!group.some((block) => block.start === beforeStart && block.end === event.start)) {
					group.push({
						source: "task",
						sourceId,
						title: `Travel: ${task.title}`,
						start: beforeStart,
						end: event.start,
						priority:
							task.priority === "low" ||
							task.priority === "medium" ||
							task.priority === "high" ||
							task.priority === "critical" ||
							task.priority === "blocker"
								? task.priority
								: "medium",
						calendarId: event.calendarId ?? task.preferredCalendarId,
						color: resolvedTravelColor,
						location: task.location,
					});
					group.sort((a, b) => {
						if (a.start !== b.start) return a.start - b.start;
						return a.end - b.end;
					});
					groupedBlocks.set(key, group);
				}
			}

			if (event.end < afterEnd) {
				const sourceId = buildTravelSourceId(event.sourceId, event.start, event.end, "after");
				const key = blockGroupKey({ source: "task", sourceId });
				const group = groupedBlocks.get(key) ?? [];
				if (!group.some((block) => block.start === event.end && block.end === afterEnd)) {
					group.push({
						source: "task",
						sourceId,
						title: `Travel: ${task.title}`,
						start: event.end,
						end: afterEnd,
						priority:
							task.priority === "low" ||
							task.priority === "medium" ||
							task.priority === "high" ||
							task.priority === "critical" ||
							task.priority === "blocker"
								? task.priority
								: "medium",
						calendarId: event.calendarId ?? task.preferredCalendarId,
						color: resolvedTravelColor,
						location: task.location,
					});
					group.sort((a, b) => {
						if (a.start !== b.start) return a.start - b.start;
						return a.end - b.end;
					});
					groupedBlocks.set(key, group);
				}
			}
		}

		const tasksById = new Map<string, { starts: number[]; ends: number[] }>();
		let tasksScheduled = 0;
		let habitsScheduled = 0;
		const removedGoogleEvents: Array<{ googleEventId: string; calendarId: string }> = [];
		const now = Date.now();
		for (const orphanEvent of orphanScheduledEvents) {
			if (orphanEvent.googleEventId) {
				removedGoogleEvents.push({
					googleEventId: orphanEvent.googleEventId,
					calendarId: orphanEvent.calendarId ?? "primary",
				});
			}
			await ctx.db.delete(orphanEvent._id);
		}
		for (const [key, blocks] of groupedBlocks) {
			const existingGroup = groupedExisting.get(key) ?? [];
			// Separate pinned events — they survive the commit cycle untouched
			const pinnedExisting = existingGroup.filter((e) => e.pinned);
			const unpinnedExisting = existingGroup.filter((e) => !e.pinned);
			const pairCount = Math.min(unpinnedExisting.length, blocks.length);

			console.log("[scheduling:apply]", {
				groupKey: key,
				existingCount: existingGroup.length,
				pinnedCount: pinnedExisting.length,
				unpinnedCount: unpinnedExisting.length,
				blocksCount: blocks.length,
				pairCount,
				existing: existingGroup.map((e) => ({
					id: String(e._id),
					start: e.start,
					end: e.end,
					pinned: e.pinned,
					googleEventId: e.googleEventId,
					calendarId: e.calendarId,
					source: e.source,
				})),
			});

			for (let index = 0; index < pairCount; index += 1) {
				const block = blocks[index];
				const current = unpinnedExisting[index];
				if (!block || !current) continue;
				const isTravelBlock = block.source === "task" && block.sourceId.includes(":travel:");
				const resolvedBlockColor = isTravelBlock ? resolvedTravelColor : block.color;
				console.log("[scheduling:apply] patch", {
					eventId: String(current._id),
					oldStart: current.start,
					oldEnd: current.end,
					newStart: block.start,
					newEnd: block.end,
					blockCalendarId: block.calendarId,
					currentCalendarId: current.calendarId,
					resolvedCalendarId: block.calendarId ?? current.calendarId,
					googleEventId: current.googleEventId,
				});
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
				const isTravelBlock = block.source === "task" && block.sourceId.includes(":travel:");
				const resolvedBlockColor = isTravelBlock ? resolvedTravelColor : block.color;
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
				if (staleEvent.googleEventId) {
					removedGoogleEvents.push({
						googleEventId: staleEvent.googleEventId,
						calendarId: staleEvent.calendarId ?? "primary",
					});
				}
				await ctx.db.delete(staleEvent._id);
			}

			for (const block of blocks) {
				if (block.source === "task") {
					const isTravelBlock = block.sourceId.includes(":travel:");
					if (!isTravelBlock) {
						tasksScheduled += 1;
						const existingTask = tasksById.get(block.sourceId) ?? { starts: [], ends: [] };
						existingTask.starts.push(block.start);
						existingTask.ends.push(block.end);
						tasksById.set(block.sourceId, existingTask);
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
				if (staleEvent.googleEventId) {
					removedGoogleEvents.push({
						googleEventId: staleEvent.googleEventId,
						calendarId: staleEvent.calendarId ?? "primary",
					});
				}
				await ctx.db.delete(staleEvent._id);
			}
		}

		// Include pinned event times in task placement calculations
		for (const event of existing) {
			if (
				event.source === "task" &&
				event.pinned === true &&
				event.sourceId &&
				!event.sourceId.includes(":travel:")
			) {
				const existingTask = tasksById.get(event.sourceId) ?? { starts: [], ends: [] };
				existingTask.starts.push(event.start);
				existingTask.ends.push(event.end);
				tasksById.set(event.sourceId, existingTask);
			}
		}

		for (const task of tasks) {
			const placements = tasksById.get(String(task._id));
			if (!placements) {
				if (task.scheduledStart !== undefined || task.scheduledEnd !== undefined) {
					await ctx.db.patch(task._id, {
						scheduledStart: undefined,
						scheduledEnd: undefined,
					});
				}
				continue;
			}
			const scheduledStart = Math.min(...placements.starts);
			const scheduledEnd = Math.max(...placements.ends);
			await ctx.db.patch(task._id, {
				scheduledStart,
				scheduledEnd,
				status: task.status === "queued" ? "scheduled" : task.status,
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
