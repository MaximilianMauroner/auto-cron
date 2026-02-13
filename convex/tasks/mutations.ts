import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import {
	ensureHoursSetOwnership,
	getDefaultHoursSet,
	taskSchedulingModeValidator,
} from "../hours/shared";

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

const taskCreateInputValidator = v.object({
	title: v.string(),
	description: v.optional(v.string()),
	priority: v.optional(taskPriorityValidator),
	status: v.optional(v.union(v.literal("backlog"), v.literal("queued"))),
	estimatedMinutes: v.number(),
	deadline: v.optional(v.number()),
	scheduleAfter: v.optional(v.number()),
	splitAllowed: v.optional(v.boolean()),
	minChunkMinutes: v.optional(v.number()),
	maxChunkMinutes: v.optional(v.number()),
	sendToUpNext: v.optional(v.boolean()),
	hoursSetId: v.optional(v.id("hoursSets")),
	schedulingMode: v.optional(taskSchedulingModeValidator),
	visibilityPreference: v.optional(taskVisibilityPreferenceValidator),
	preferredCalendarId: v.optional(v.string()),
	color: v.optional(v.string()),
});

const taskUpdatePatchValidator = v.object({
	title: v.optional(v.string()),
	description: v.optional(v.union(v.string(), v.null())),
	priority: v.optional(taskPriorityValidator),
	status: v.optional(taskStatusValidator),
	estimatedMinutes: v.optional(v.number()),
	deadline: v.optional(v.union(v.number(), v.null())),
	scheduleAfter: v.optional(v.union(v.number(), v.null())),
	scheduledStart: v.optional(v.union(v.number(), v.null())),
	scheduledEnd: v.optional(v.union(v.number(), v.null())),
	completedAt: v.optional(v.union(v.number(), v.null())),
	sortOrder: v.optional(v.number()),
	splitAllowed: v.optional(v.union(v.boolean(), v.null())),
	minChunkMinutes: v.optional(v.union(v.number(), v.null())),
	maxChunkMinutes: v.optional(v.union(v.number(), v.null())),
	sendToUpNext: v.optional(v.union(v.boolean(), v.null())),
	hoursSetId: v.optional(v.union(v.id("hoursSets"), v.null())),
	schedulingMode: v.optional(v.union(taskSchedulingModeValidator, v.null())),
	visibilityPreference: v.optional(v.union(taskVisibilityPreferenceValidator, v.null())),
	preferredCalendarId: v.optional(v.union(v.string(), v.null())),
	color: v.optional(v.union(v.string(), v.null())),
});

type TaskStatus = "backlog" | "queued" | "scheduled" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "critical" | "blocker";
type TaskCreateInput = {
	title: string;
	description?: string;
	priority?: TaskPriority;
	status?: "backlog" | "queued";
	estimatedMinutes: number;
	deadline?: number;
	scheduleAfter?: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	sendToUpNext?: boolean;
	hoursSetId?: Id<"hoursSets">;
	schedulingMode?: "fastest" | "backfacing" | "parallel";
	visibilityPreference?: "default" | "private";
	preferredCalendarId?: string;
	color?: string;
};
type TaskUpdatePatch = {
	title?: string;
	description?: string | null;
	priority?: TaskPriority;
	status?: TaskStatus;
	estimatedMinutes?: number;
	deadline?: number | null;
	scheduleAfter?: number | null;
	scheduledStart?: number | null;
	scheduledEnd?: number | null;
	completedAt?: number | null;
	sortOrder?: number;
	splitAllowed?: boolean | null;
	minChunkMinutes?: number | null;
	maxChunkMinutes?: number | null;
	sendToUpNext?: boolean | null;
	hoursSetId?: Id<"hoursSets"> | null;
	schedulingMode?: "fastest" | "backfacing" | "parallel" | null;
	visibilityPreference?: "default" | "private" | null;
	preferredCalendarId?: string | null;
	color?: string | null;
};
type UpdateTaskArgs = {
	id: Id<"tasks">;
	patch: TaskUpdatePatch;
};
type DeleteTaskArgs = {
	id: Id<"tasks">;
};
type ReorderTasksArgs = {
	items: Array<{
		id: Id<"tasks">;
		sortOrder: number;
		status: TaskStatus;
	}>;
};
type InternalCreateTaskArgs = {
	userId: string;
	operationKey: string;
	input: TaskCreateInput;
};
type InternalRollbackTaskArgs = {
	operationKey: string;
	userId: string;
};

const notFoundError = () =>
	new ConvexError({
		code: "NOT_FOUND",
		message: "Task not found.",
	});

const resolveNextSortOrder = async (ctx: MutationCtx, userId: string, status: TaskStatus) => {
	const tasksInStatus = await ctx.db
		.query("tasks")
		.withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", status))
		.collect();
	const maxSort = tasksInStatus.reduce((max, task) => {
		return task.sortOrder > max ? task.sortOrder : max;
	}, -1);
	return maxSort + 1;
};

const resolveHoursSetForTask = async (
	ctx: MutationCtx,
	userId: string,
	hoursSetId: Id<"hoursSets"> | undefined,
) => {
	if (hoursSetId) {
		const ownedHoursSet = await ensureHoursSetOwnership(ctx, hoursSetId, userId);
		if (!ownedHoursSet) {
			throw new ConvexError({
				code: "INVALID_HOURS_SET",
				message: "The selected hours set does not exist.",
			});
		}
		return ownedHoursSet._id;
	}
	const defaultHoursSet = await getDefaultHoursSet(ctx, userId);
	if (!defaultHoursSet) {
		throw new ConvexError({
			code: "DEFAULT_HOURS_SET_REQUIRED",
			message: "No default hours set configured for this user.",
		});
	}
	return defaultHoursSet._id;
};

export const updateTask = mutation({
	args: {
		id: v.id("tasks"),
		patch: taskUpdatePatchValidator,
	},
	returns: v.id("tasks"),
	handler: withMutationAuth(async (ctx, args: UpdateTaskArgs): Promise<Id<"tasks">> => {
		const task = await ctx.db.get(args.id);
		if (!task || task.userId !== ctx.userId) {
			throw notFoundError();
		}

		const nextPatch: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(args.patch)) {
			nextPatch[key] = value === null ? undefined : value;
		}
		if (args.patch.hoursSetId !== undefined && args.patch.hoursSetId !== null) {
			await resolveHoursSetForTask(ctx, ctx.userId, args.patch.hoursSetId);
		}

		if (args.patch.status !== undefined && args.patch.completedAt === undefined) {
			if (args.patch.status === "done") {
				nextPatch.completedAt = Date.now();
			}
		}
		await ctx.db.patch(args.id, nextPatch as Partial<typeof task>);
		return args.id;
	}),
});

export const deleteTask = mutation({
	args: {
		id: v.id("tasks"),
	},
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: DeleteTaskArgs): Promise<null> => {
		const task = await ctx.db.get(args.id);
		if (!task || task.userId !== ctx.userId) {
			throw notFoundError();
		}
		await ctx.db.delete(args.id);
		return null;
	}),
});

export const reorderTasks = mutation({
	args: {
		items: v.array(
			v.object({
				id: v.id("tasks"),
				sortOrder: v.number(),
				status: taskStatusValidator,
			}),
		),
	},
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: ReorderTasksArgs): Promise<null> => {
		for (const item of args.items) {
			const task = await ctx.db.get(item.id);
			if (!task || task.userId !== ctx.userId) {
				throw notFoundError();
			}
		}

		await Promise.all(
			args.items.map((item) =>
				ctx.db.patch(item.id, {
					sortOrder: item.sortOrder,
					status: item.status,
				}),
			),
		);
		return null;
	}),
});

export const internalCreateTaskForUserWithOperation = internalMutation({
	args: {
		userId: v.string(),
		operationKey: v.string(),
		input: taskCreateInputValidator,
	},
	returns: v.id("tasks"),
	handler: async (ctx, args: InternalCreateTaskArgs): Promise<Id<"tasks">> => {
		const reservation = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (reservation?.entityId) {
			const existingTask = await ctx.db.get(reservation.entityId as Id<"tasks">);
			if (existingTask && existingTask.userId === args.userId) {
				return existingTask._id;
			}
		}

		const status = args.input.sendToUpNext ? "queued" : (args.input.status ?? "backlog");
		const sortOrder = await resolveNextSortOrder(ctx, args.userId, status);
		const hoursSetId = await resolveHoursSetForTask(ctx, args.userId, args.input.hoursSetId);
		const insertedId = await ctx.db.insert("tasks", {
			userId: args.userId,
			title: args.input.title,
			description: args.input.description,
			priority: args.input.priority ?? "medium",
			status,
			estimatedMinutes: args.input.estimatedMinutes,
			deadline: args.input.deadline,
			scheduleAfter: args.input.scheduleAfter,
			scheduledStart: undefined,
			scheduledEnd: undefined,
			completedAt: undefined,
			sortOrder,
			splitAllowed: args.input.splitAllowed,
			minChunkMinutes: args.input.minChunkMinutes,
			maxChunkMinutes: args.input.maxChunkMinutes,
			sendToUpNext: args.input.sendToUpNext,
			hoursSetId,
			schedulingMode: args.input.schedulingMode,
			visibilityPreference: args.input.visibilityPreference,
			preferredCalendarId: args.input.preferredCalendarId,
			color: args.input.color,
		});

		if (reservation) {
			await ctx.db.patch(reservation._id, {
				entityId: String(insertedId),
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("billingReservations", {
				operationKey: args.operationKey,
				userId: args.userId,
				featureId: "tasks",
				entityType: "task",
				entityId: String(insertedId),
				status: "reserved",
				error: undefined,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}

		return insertedId;
	},
});

export const internalRollbackTaskCreateForReservation = internalMutation({
	args: {
		operationKey: v.string(),
		userId: v.string(),
	},
	returns: v.object({
		rolledBack: v.boolean(),
	}),
	handler: async (ctx, args: InternalRollbackTaskArgs): Promise<{ rolledBack: boolean }> => {
		const reservation = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (!reservation || reservation.entityType !== "task" || !reservation.entityId) {
			return { rolledBack: false };
		}

		const taskId = reservation.entityId as Id<"tasks">;
		const task = await ctx.db.get(taskId);
		if (!task || task.userId !== args.userId) {
			return { rolledBack: false };
		}

		await ctx.db.delete(taskId);
		return { rolledBack: true };
	},
});
