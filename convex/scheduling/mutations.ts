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
			}),
		),
	},
	returns: v.object({
		tasksScheduled: v.number(),
		habitsScheduled: v.number(),
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
		for (const event of existing) {
			if (event.source !== "task" && event.source !== "habit") continue;
			await ctx.db.delete(event._id);
		}

		const tasksById = new Map<string, { starts: number[]; ends: number[] }>();
		let tasksScheduled = 0;
		let habitsScheduled = 0;
		for (const block of args.blocks) {
			if (block.start >= block.end) continue;
			await ctx.db.insert("calendarEvents", {
				userId: args.userId,
				title: block.title,
				start: block.start,
				end: block.end,
				allDay: false,
				updatedAt: Date.now(),
				source: block.source,
				sourceId: block.sourceId,
				calendarId: block.calendarId,
				busyStatus: "busy",
				color: block.color,
			});
			if (block.source === "task") {
				tasksScheduled += 1;
				const existingTask = tasksById.get(block.sourceId) ?? { starts: [], ends: [] };
				existingTask.starts.push(block.start);
				existingTask.ends.push(block.end);
				tasksById.set(block.sourceId, existingTask);
			} else {
				habitsScheduled += 1;
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
			});
		}

		return {
			tasksScheduled,
			habitsScheduled,
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
