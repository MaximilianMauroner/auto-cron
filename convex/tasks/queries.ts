import { v } from "convex/values";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import { taskSchedulingModeValidator } from "../hours/shared";

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
	sendToUpNext: v.optional(v.boolean()),
	hoursSetId: v.optional(v.id("hoursSets")),
	schedulingMode: v.optional(taskSchedulingModeValidator),
	effectiveSchedulingMode: taskSchedulingModeValidator,
	visibilityPreference: v.optional(taskVisibilityPreferenceValidator),
	preferredCalendarId: v.optional(v.string()),
	color: v.optional(v.string()),
});

type TaskStatus = "backlog" | "queued" | "scheduled" | "in_progress" | "done";

type ListTasksArgs = {
	statusFilter?: TaskStatus[];
};

const statusOrder: Record<TaskStatus, number> = {
	backlog: 0,
	queued: 1,
	scheduled: 2,
	in_progress: 3,
	done: 4,
};

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
		const defaultTaskSchedulingMode = settings?.defaultTaskSchedulingMode ?? "fastest";
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

		return [...tasks]
			.sort((a, b) => {
				if (statusOrder[a.status] !== statusOrder[b.status]) {
					return statusOrder[a.status] - statusOrder[b.status];
				}
				if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
				return a._creationTime - b._creationTime;
			})
			.map((task) => ({
				...task,
				effectiveSchedulingMode: task.schedulingMode ?? defaultTaskSchedulingMode,
			}));
	}),
});
