import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import { ensureCategoryOwnership, ensureDefaultCategories } from "../categories/shared";
import {
	ensureHoursSetOwnership,
	getDefaultHoursSet,
	taskSchedulingModeValidator,
} from "../hours/shared";
import { enqueueSchedulingRunFromMutation } from "../scheduling/enqueue";
import type {
	DeleteTaskArgs,
	InternalCreateTaskArgs,
	InternalRollbackTaskArgs,
	ReorderTasksArgs,
	TaskCreateInput,
	TaskStatus,
	TaskUpdatePatch,
	UpdateTaskArgs,
} from "./taskTypes";

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
	restMinutes: v.optional(v.number()),
	travelMinutes: v.optional(v.number()),
	location: v.optional(v.string()),
	sendToUpNext: v.optional(v.boolean()),
	hoursSetId: v.optional(v.id("hoursSets")),
	schedulingMode: v.optional(taskSchedulingModeValidator),
	visibilityPreference: v.optional(taskVisibilityPreferenceValidator),
	preferredCalendarId: v.optional(v.string()),
	color: v.optional(v.string()),
	categoryId: v.optional(v.id("taskCategories")),
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
	restMinutes: v.optional(v.union(v.number(), v.null())),
	travelMinutes: v.optional(v.union(v.number(), v.null())),
	location: v.optional(v.union(v.string(), v.null())),
	sendToUpNext: v.optional(v.union(v.boolean(), v.null())),
	hoursSetId: v.optional(v.union(v.id("hoursSets"), v.null())),
	schedulingMode: v.optional(v.union(taskSchedulingModeValidator, v.null())),
	visibilityPreference: v.optional(v.union(taskVisibilityPreferenceValidator, v.null())),
	preferredCalendarId: v.optional(v.union(v.string(), v.null())),
	color: v.optional(v.union(v.string(), v.null())),
	categoryId: v.optional(v.id("taskCategories")),
});

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

const normalizeOptionalNonNegativeMinutes = (value: number | null | undefined) => {
	if (value === null || value === undefined) return undefined;
	if (!Number.isFinite(value) || value < 0) {
		throw new ConvexError({
			code: "INVALID_DURATION",
			message: "Duration values must be 0 or greater.",
		});
	}
	return Math.round(value);
};

const isTaskOrTravelSourceId = (sourceId: string | undefined, taskId: string): boolean => {
	if (typeof sourceId !== "string") return false;
	if (sourceId === taskId) return true;
	// Match both legacy format (${taskId}:travel:) and current format (task:${taskId}:travel:)
	if (sourceId.startsWith(`${taskId}:travel:`)) return true;
	if (sourceId.startsWith(`task:${taskId}:travel:`)) return true;
	return false;
};

const clearPinnedTaskCalendarEvents = async (
	ctx: MutationCtx,
	userId: string,
	taskId: Id<"tasks">,
) => {
	const taskSourceId = String(taskId);
	const events = await ctx.db
		.query("calendarEvents")
		.withIndex("by_userId_source_sourceId", (q) => q.eq("userId", userId).eq("source", "task"))
		.collect();
	const matchingPinnedEvents = events.filter(
		(event) => event.pinned === true && isTaskOrTravelSourceId(event.sourceId, taskSourceId),
	);
	if (matchingPinnedEvents.length === 0) {
		return;
	}
	const now = Date.now();
	await Promise.all(
		matchingPinnedEvents.map((event) =>
			ctx.db.patch(event._id, {
				pinned: false,
				updatedAt: now,
			}),
		),
	);
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
		if (args.patch.restMinutes !== undefined) {
			nextPatch.restMinutes = normalizeOptionalNonNegativeMinutes(args.patch.restMinutes);
		}
		if (args.patch.travelMinutes !== undefined) {
			nextPatch.travelMinutes = normalizeOptionalNonNegativeMinutes(args.patch.travelMinutes);
		}
		if (args.patch.location !== undefined) {
			const normalizedLocation = args.patch.location?.trim();
			nextPatch.location =
				normalizedLocation && normalizedLocation.length > 0 ? normalizedLocation : undefined;
		}
		if (args.patch.hoursSetId !== undefined && args.patch.hoursSetId !== null) {
			await resolveHoursSetForTask(ctx, ctx.userId, args.patch.hoursSetId);
		}
		if (args.patch.categoryId) {
			await ensureCategoryOwnership(ctx, args.patch.categoryId, ctx.userId);
		}

		if (args.patch.status !== undefined && args.patch.completedAt === undefined) {
			if (args.patch.status === "done") {
				nextPatch.completedAt = Date.now();
			}
		}
		if (args.patch.status === "backlog") {
			await clearPinnedTaskCalendarEvents(ctx, ctx.userId, args.id);
		}
		await ctx.db.patch(args.id, nextPatch as Partial<typeof task>);
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "task_change",
		});
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
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "task_change",
		});
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
		for (const item of args.items) {
			if (item.status === "backlog") {
				await clearPinnedTaskCalendarEvents(ctx, ctx.userId, item.id);
			}
		}
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "task_change",
		});
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
		const restMinutes = normalizeOptionalNonNegativeMinutes(args.input.restMinutes);
		const travelMinutes = normalizeOptionalNonNegativeMinutes(args.input.travelMinutes);
		const location = args.input.location?.trim();
		// Ensure default categories exist, then resolve categoryId
		const { personalId: defaultCategoryId } = await ensureDefaultCategories(ctx, args.userId);
		const categoryId = args.input.categoryId ?? defaultCategoryId;

		await ensureCategoryOwnership(ctx, categoryId, args.userId);

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
			restMinutes,
			travelMinutes,
			location: location && location.length > 0 ? location : undefined,
			sendToUpNext: args.input.sendToUpNext,
			hoursSetId,
			schedulingMode: args.input.schedulingMode,
			visibilityPreference: args.input.visibilityPreference,
			preferredCalendarId: args.input.preferredCalendarId,
			color: args.input.color,
			categoryId,
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

		await enqueueSchedulingRunFromMutation(ctx, {
			userId: args.userId,
			triggeredBy: "task_change",
		});

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
