"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { withActionAuth } from "../auth";
import {
	acquireFeatureLock,
	assertFeatureAvailable,
	buildOperationKey,
	commitFeatureReservation,
	makeBillingLockToken,
	releaseFeatureLock,
	rollbackFeatureReservation,
	startFeatureReservation,
	trackFeatureUsage,
} from "../billing";
import { taskSchedulingModeValidator } from "../hours/shared";

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
});

type TaskCreateInput = {
	title: string;
	description?: string;
	priority?: "low" | "medium" | "high" | "critical" | "blocker";
	status?: "backlog" | "queued";
	estimatedMinutes: number;
	deadline?: number;
	scheduleAfter?: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	restMinutes?: number;
	travelMinutes?: number;
	location?: string;
	sendToUpNext?: boolean;
	hoursSetId?: Id<"hoursSets">;
	schedulingMode?: "fastest" | "balanced" | "packed";
	visibilityPreference?: "default" | "private";
	preferredCalendarId?: string;
	color?: string;
};
type CreateTaskArgs = {
	requestId: string;
	input: TaskCreateInput;
};

const toErrorMessage = (error: unknown) => {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string") return error;
	return "Unknown billing failure";
};

export const createTask = action({
	args: {
		requestId: v.string(),
		input: taskCreateInputValidator,
	},
	returns: v.id("tasks"),
	handler: withActionAuth(async (ctx, args: CreateTaskArgs): Promise<Id<"tasks">> => {
		const featureId = "tasks" as const;
		const operationKey = buildOperationKey({
			userId: ctx.userId,
			featureId,
			requestId: args.requestId,
		});
		const lockToken = makeBillingLockToken(operationKey);
		await acquireFeatureLock(ctx, {
			userId: ctx.userId,
			featureId,
			lockToken,
		});

		try {
			await ctx.runMutation(internal.hours.mutations.internalBootstrapHoursSetsForUser, {
				userId: ctx.userId,
			});

			const existingReservation = await ctx.runQuery(
				internal.billing.internalGetReservationByOperationKey,
				{
					operationKey,
				},
			);
			if (existingReservation?.status === "committed" && existingReservation.entityId) {
				return existingReservation.entityId as Id<"tasks">;
			}

			if (
				!existingReservation ||
				existingReservation.status === "rolled_back" ||
				existingReservation.status === "rollback_failed"
			) {
				await assertFeatureAvailable(ctx, featureId);
				await startFeatureReservation(ctx, {
					operationKey,
					userId: ctx.userId,
					featureId,
					entityType: "task",
				});
			}

			const taskId = await ctx.runMutation(
				internal.tasks.mutations.internalCreateTaskForUserWithOperation,
				{
					userId: ctx.userId,
					operationKey,
					input: args.input,
				},
			);

			try {
				await trackFeatureUsage(ctx, { featureId, operationKey });
				await commitFeatureReservation(ctx, {
					operationKey,
					entityId: String(taskId),
				});
				return taskId;
			} catch (trackError) {
				const trackMessage = toErrorMessage(trackError);
				let rollbackStatus: "rolled_back" | "rollback_failed" = "rolled_back";
				let rollbackError = trackMessage;
				try {
					const rollbackResult = await ctx.runMutation(
						internal.tasks.mutations.internalRollbackTaskCreateForReservation,
						{
							operationKey,
							userId: ctx.userId,
						},
					);
					if (!rollbackResult.rolledBack) {
						rollbackStatus = "rollback_failed";
						rollbackError = `${trackMessage}; rollback did not remove task`;
					}
				} catch (rollbackFailure) {
					rollbackStatus = "rollback_failed";
					rollbackError = `${trackMessage}; rollback error: ${toErrorMessage(rollbackFailure)}`;
				}

				await rollbackFeatureReservation(ctx, {
					operationKey,
					status: rollbackStatus,
					error: rollbackError,
				});
				throw new ConvexError({
					code: "BILLING_TRACK_FAILED",
					message: "Failed to finalize task billing usage.",
				});
			}
		} finally {
			await releaseFeatureLock(ctx, {
				userId: ctx.userId,
				featureId,
				lockToken,
			});
		}
	}),
});
