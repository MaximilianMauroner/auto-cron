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

const habitFrequencyValidator = v.union(
	v.literal("daily"),
	v.literal("weekly"),
	v.literal("biweekly"),
	v.literal("monthly"),
);

const habitPriorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
);
const habitRecoveryPolicyValidator = v.union(v.literal("skip"), v.literal("recover"));
const habitVisibilityPreferenceValidator = v.union(
	v.literal("default"),
	v.literal("public"),
	v.literal("private"),
);
const habitTimeDefenseModeValidator = v.union(
	v.literal("always_free"),
	v.literal("auto"),
	v.literal("always_busy"),
);
const habitReminderModeValidator = v.union(
	v.literal("default"),
	v.literal("custom"),
	v.literal("none"),
);
const habitUnscheduledBehaviorValidator = v.union(
	v.literal("leave_on_calendar"),
	v.literal("remove_from_calendar"),
);

const habitCreateInputValidator = v.object({
	title: v.string(),
	description: v.optional(v.string()),
	priority: v.optional(habitPriorityValidator),
	categoryId: v.id("taskCategories"),
	recurrenceRule: v.optional(v.string()),
	recoveryPolicy: v.optional(habitRecoveryPolicyValidator),
	frequency: v.optional(habitFrequencyValidator),
	durationMinutes: v.number(),
	minDurationMinutes: v.optional(v.number()),
	maxDurationMinutes: v.optional(v.number()),
	repeatsPerPeriod: v.optional(v.number()),
	idealTime: v.optional(v.string()),
	preferredWindowStart: v.optional(v.string()),
	preferredWindowEnd: v.optional(v.string()),
	preferredDays: v.optional(v.array(v.number())),
	hoursSetId: v.optional(v.id("hoursSets")),
	preferredCalendarId: v.optional(v.string()),
	color: v.optional(v.string()),
	location: v.optional(v.string()),
	startDate: v.optional(v.number()),
	endDate: v.optional(v.number()),
	visibilityPreference: v.optional(habitVisibilityPreferenceValidator),
	timeDefenseMode: v.optional(habitTimeDefenseModeValidator),
	reminderMode: v.optional(habitReminderModeValidator),
	customReminderMinutes: v.optional(v.number()),
	unscheduledBehavior: v.optional(habitUnscheduledBehaviorValidator),
	autoDeclineInvites: v.optional(v.boolean()),
	ccEmails: v.optional(v.array(v.string())),
	duplicateAvoidKeywords: v.optional(v.array(v.string())),
	dependencyNote: v.optional(v.string()),
	publicDescription: v.optional(v.string()),
	isActive: v.optional(v.boolean()),
});

type HabitCreateInput = {
	title: string;
	description?: string;
	priority?: "low" | "medium" | "high" | "critical";
	categoryId: Id<"taskCategories">;
	recurrenceRule?: string;
	recoveryPolicy?: "skip" | "recover";
	frequency?: "daily" | "weekly" | "biweekly" | "monthly";
	durationMinutes: number;
	minDurationMinutes?: number;
	maxDurationMinutes?: number;
	repeatsPerPeriod?: number;
	idealTime?: string;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	hoursSetId?: Id<"hoursSets">;
	preferredCalendarId?: string;
	color?: string;
	location?: string;
	startDate?: number;
	endDate?: number;
	visibilityPreference?: "default" | "public" | "private";
	timeDefenseMode?: "always_free" | "auto" | "always_busy";
	reminderMode?: "default" | "custom" | "none";
	customReminderMinutes?: number;
	unscheduledBehavior?: "leave_on_calendar" | "remove_from_calendar";
	autoDeclineInvites?: boolean;
	ccEmails?: string[];
	duplicateAvoidKeywords?: string[];
	dependencyNote?: string;
	publicDescription?: string;
	isActive?: boolean;
};
type CreateHabitArgs = {
	requestId: string;
	input: HabitCreateInput;
};

const toErrorMessage = (error: unknown) => {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string") return error;
	return "Unknown billing failure";
};

export const createHabit = action({
	args: {
		requestId: v.string(),
		input: habitCreateInputValidator,
	},
	returns: v.id("habits"),
	handler: withActionAuth(async (ctx, args: CreateHabitArgs): Promise<Id<"habits">> => {
		const featureId = "habits" as const;
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
				return existingReservation.entityId as Id<"habits">;
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
					entityType: "habit",
				});
			}

			const habitId = await ctx.runMutation(
				internal.habits.mutations.internalCreateHabitForUserWithOperation,
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
					entityId: String(habitId),
				});
				return habitId;
			} catch (trackError) {
				const trackMessage = toErrorMessage(trackError);
				let rollbackStatus: "rolled_back" | "rollback_failed" = "rolled_back";
				let rollbackError = trackMessage;
				try {
					const rollbackResult = await ctx.runMutation(
						internal.habits.mutations.internalRollbackHabitCreateForReservation,
						{
							operationKey,
							userId: ctx.userId,
						},
					);
					if (!rollbackResult.rolledBack) {
						rollbackStatus = "rollback_failed";
						rollbackError = `${trackMessage}; rollback did not remove habit`;
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
					message: "Failed to finalize habit billing usage.",
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
