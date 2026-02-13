import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
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
		const pending = await ctx.db
			.query("schedulingRuns")
			.withIndex("by_userId_status_startedAt", (q) =>
				q.eq("userId", args.userId).eq("status", "pending"),
			)
			.collect();
		const running = await ctx.db
			.query("schedulingRuns")
			.withIndex("by_userId_status_startedAt", (q) =>
				q.eq("userId", args.userId).eq("status", "running"),
			)
			.collect();
		const superseded = [...pending, ...running].some(
			(run) => run._id !== args.runId && isRunNewer(run, currentRun),
		);
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
			const pairCount = Math.min(existingGroup.length, blocks.length);

			for (let index = 0; index < pairCount; index += 1) {
				const block = blocks[index];
				const current = existingGroup[index];
				if (!block || !current) continue;
				await ctx.db.patch(current._id, {
					title: block.title,
					start: block.start,
					end: block.end,
					allDay: false,
					updatedAt: now,
					source: block.source,
					sourceId: block.sourceId,
					calendarId: block.calendarId,
					busyStatus: "busy",
					color: block.color,
					location: block.location,
				});
			}

			for (const block of blocks.slice(pairCount)) {
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
					color: block.color,
					location: block.location,
				});
			}

			for (const staleEvent of existingGroup.slice(pairCount)) {
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
				if (staleEvent.googleEventId) {
					removedGoogleEvents.push({
						googleEventId: staleEvent.googleEventId,
						calendarId: staleEvent.calendarId ?? "primary",
					});
				}
				await ctx.db.delete(staleEvent._id);
			}
		}

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
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

export const clearExpiredPinnedTasks = internalMutation({
	args: {
		taskIds: v.array(v.id("tasks")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		for (const taskId of args.taskIds) {
			const task = await ctx.db.get(taskId);
			if (task && task.pinnedStart !== undefined) {
				await ctx.db.patch(taskId, {
					pinnedStart: undefined,
					pinnedEnd: undefined,
				});
			}
		}
		return null;
	},
});
