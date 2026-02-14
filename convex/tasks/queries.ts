import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import { taskSchedulingModeValidator } from "../hours/shared";
import type { ListTasksArgs, TaskStatus } from "./taskTypes";

const taskStatusValidator = v.union(
	v.literal("backlog"),
	v.literal("queued"),
	v.literal("scheduled"),
	v.literal("in_progress"),
	v.literal("done"),
);

const taskPriorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
	v.literal("blocker"),
);
const taskVisibilityPreferenceValidator = v.union(v.literal("default"), v.literal("private"));

const taskDtoValidator = v.object({
	_id: v.id("tasks"),
	_creationTime: v.number(),
	userId: v.string(),
	title: v.string(),
	description: v.optional(v.string()),
	priority: taskPriorityValidator,
	status: taskStatusValidator,
	estimatedMinutes: v.number(),
	deadline: v.optional(v.number()),
	scheduleAfter: v.optional(v.number()),
	scheduledStart: v.optional(v.number()),
	scheduledEnd: v.optional(v.number()),
	completedAt: v.optional(v.number()),
	sortOrder: v.number(),
	splitAllowed: v.optional(v.boolean()),
	minChunkMinutes: v.optional(v.number()),
	maxChunkMinutes: v.optional(v.number()),
	restMinutes: v.optional(v.number()),
	travelMinutes: v.optional(v.number()),
	location: v.optional(v.string()),
	sendToUpNext: v.optional(v.boolean()),
	hoursSetId: v.optional(v.id("hoursSets")),
	schedulingMode: v.optional(taskSchedulingModeValidator),
	effectiveSchedulingMode: taskSchedulingModeValidator,
	visibilityPreference: v.optional(taskVisibilityPreferenceValidator),
	preferredCalendarId: v.optional(v.string()),
	color: v.optional(v.string()),
	categoryId: v.optional(v.id("taskCategories")),
	effectiveColor: v.string(),
});

const statusOrder: Record<TaskStatus, number> = {
	backlog: 0,
	queued: 1,
	scheduled: 2,
	in_progress: 3,
	done: 4,
};

const sanitizeTaskSchedulingMode = (
	mode: string | undefined,
): "fastest" | "balanced" | "packed" => {
	if (mode === "fastest" || mode === "balanced" || mode === "packed") {
		return mode;
	}
	return "fastest";
};

const resolveDisplayStatus = (
	task: {
		status: TaskStatus;
		scheduledStart?: number;
		completedAt?: number;
	},
	now: number,
): TaskStatus => {
	if (task.completedAt !== undefined || task.status === "done") return "done";
	if (task.status === "backlog") return "backlog";
	if (task.status === "queued") {
		if (task.scheduledStart === undefined) return "queued";
		return now >= task.scheduledStart ? "in_progress" : "scheduled";
	}
	if (task.status === "scheduled" || task.status === "in_progress") {
		if (task.scheduledStart === undefined) return "queued";
		return now >= task.scheduledStart ? "in_progress" : "scheduled";
	}
	return task.status;
};

export const getTask = query({
	args: {
		id: v.id("tasks"),
	},
	returns: v.union(taskDtoValidator, v.null()),
	handler: withQueryAuth(async (ctx, args: { id: string }) => {
		const { userId } = ctx;
		const task = await ctx.db.get(args.id as Id<"tasks">);
		if (!task || task.userId !== userId) return null;
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique();
		const now = Date.now();
		const defaultMode = sanitizeTaskSchedulingMode(settings?.defaultTaskSchedulingMode);
		const category = task.categoryId ? await ctx.db.get(task.categoryId) : null;
		const effectiveColor = task.color ?? category?.color ?? "#f59e0b";
		return {
			...task,
			status: resolveDisplayStatus(task, now),
			schedulingMode: task.schedulingMode
				? sanitizeTaskSchedulingMode(task.schedulingMode)
				: undefined,
			effectiveSchedulingMode: task.schedulingMode
				? sanitizeTaskSchedulingMode(task.schedulingMode)
				: defaultMode,
			effectiveColor,
		};
	}),
});

export const listTasks = query({
	args: {
		statusFilter: v.optional(v.array(taskStatusValidator)),
	},
	returns: v.array(taskDtoValidator),
	handler: withQueryAuth(async (ctx, args: ListTasksArgs) => {
		const { userId } = ctx;
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique();
		const now = Date.now();
		const defaultTaskSchedulingMode = sanitizeTaskSchedulingMode(
			settings?.defaultTaskSchedulingMode,
		);
		const statuses = args.statusFilter;
		const byStatus = statuses?.length
			? await Promise.all(
					statuses.map((status) =>
						ctx.db
							.query("tasks")
							.withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", status))
							.collect(),
					),
				)
			: null;

		const tasks = byStatus
			? byStatus.flat()
			: await ctx.db
					.query("tasks")
					.withIndex("by_userId", (q) => q.eq("userId", userId))
					.collect();

		// Batch-load all unique categories for effective color resolution
		const uniqueCategoryIds = [
			...new Set(tasks.map((t) => t.categoryId).filter((id): id is Id<"taskCategories"> => !!id)),
		];
		const categories = await Promise.all(uniqueCategoryIds.map((id) => ctx.db.get(id)));
		const categoryMap = new Map(uniqueCategoryIds.map((id, i) => [id, categories[i]]));

		return [...tasks]
			.sort((a, b) => {
				if (statusOrder[a.status] !== statusOrder[b.status]) {
					return statusOrder[a.status] - statusOrder[b.status];
				}
				if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
				return a._creationTime - b._creationTime;
			})
			.map((task) => {
				const category = task.categoryId ? (categoryMap.get(task.categoryId) ?? null) : null;
				return {
					...task,
					status: resolveDisplayStatus(task, now),
					schedulingMode: task.schedulingMode
						? sanitizeTaskSchedulingMode(task.schedulingMode)
						: undefined,
					effectiveSchedulingMode: task.schedulingMode
						? sanitizeTaskSchedulingMode(task.schedulingMode)
						: defaultTaskSchedulingMode,
					effectiveColor: task.color ?? category?.color ?? "#f59e0b",
				};
			});
	}),
});
