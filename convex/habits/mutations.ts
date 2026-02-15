import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import { ensureCategoryOwnership } from "../categories/shared";
import { insertChangeLog } from "../changeLogs/shared";
import { ensureHoursSetOwnership, getDefaultHoursSet } from "../hours/shared";
import { enqueueSchedulingRunFromMutation } from "../scheduling/enqueue";
import { recurrenceFromLegacyFrequency } from "../scheduling/rrule";
import type {
	DeleteHabitArgs,
	HabitCreateInput,
	HabitUpdatePatch,
	InternalCreateHabitArgs,
	InternalRollbackHabitArgs,
	ToggleHabitArgs,
	UpdateHabitArgs,
} from "./habitTypes";
import { ensureHabitSeries, upsertRecurrencePattern } from "./recurrence";

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

const habitUpdatePatchValidator = v.object({
	title: v.optional(v.string()),
	description: v.optional(v.union(v.string(), v.null())),
	priority: v.optional(v.union(habitPriorityValidator, v.null())),
	categoryId: v.optional(v.id("taskCategories")),
	recurrenceRule: v.optional(v.union(v.string(), v.null())),
	recoveryPolicy: v.optional(v.union(habitRecoveryPolicyValidator, v.null())),
	frequency: v.optional(v.union(habitFrequencyValidator, v.null())),
	durationMinutes: v.optional(v.number()),
	minDurationMinutes: v.optional(v.union(v.number(), v.null())),
	maxDurationMinutes: v.optional(v.union(v.number(), v.null())),
	repeatsPerPeriod: v.optional(v.union(v.number(), v.null())),
	idealTime: v.optional(v.union(v.string(), v.null())),
	preferredWindowStart: v.optional(v.union(v.string(), v.null())),
	preferredWindowEnd: v.optional(v.union(v.string(), v.null())),
	preferredDays: v.optional(v.union(v.array(v.number()), v.null())),
	hoursSetId: v.optional(v.union(v.id("hoursSets"), v.null())),
	preferredCalendarId: v.optional(v.union(v.string(), v.null())),
	color: v.optional(v.union(v.string(), v.null())),
	location: v.optional(v.union(v.string(), v.null())),
	startDate: v.optional(v.union(v.number(), v.null())),
	endDate: v.optional(v.union(v.number(), v.null())),
	visibilityPreference: v.optional(v.union(habitVisibilityPreferenceValidator, v.null())),
	timeDefenseMode: v.optional(v.union(habitTimeDefenseModeValidator, v.null())),
	reminderMode: v.optional(v.union(habitReminderModeValidator, v.null())),
	customReminderMinutes: v.optional(v.union(v.number(), v.null())),
	unscheduledBehavior: v.optional(v.union(habitUnscheduledBehaviorValidator, v.null())),
	autoDeclineInvites: v.optional(v.union(v.boolean(), v.null())),
	ccEmails: v.optional(v.union(v.array(v.string()), v.null())),
	duplicateAvoidKeywords: v.optional(v.union(v.array(v.string()), v.null())),
	dependencyNote: v.optional(v.union(v.string(), v.null())),
	publicDescription: v.optional(v.union(v.string(), v.null())),
	isActive: v.optional(v.boolean()),
});

const recurrencePatchKeys = [
	"recurrenceRule",
	"recoveryPolicy",
	"frequency",
	"repeatsPerPeriod",
	"preferredWindowStart",
	"preferredWindowEnd",
	"preferredDays",
	"startDate",
	"endDate",
] as const;

const notFoundError = () =>
	new ConvexError({
		code: "NOT_FOUND",
		message: "Habit not found.",
	});

const resolveHoursSetForHabit = async (
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

export const updateHabit = mutation({
	args: {
		id: v.id("habits"),
		patch: habitUpdatePatchValidator,
	},
	returns: v.id("habits"),
	handler: withMutationAuth(async (ctx, args: UpdateHabitArgs): Promise<Id<"habits">> => {
		const habit = await ctx.db.get(args.id);
		if (!habit || habit.userId !== ctx.userId) {
			throw notFoundError();
		}
		const recurrencePattern = await ctx.db.get(habit.recurrencePatternId);
		if (!recurrencePattern || recurrencePattern.userId !== ctx.userId) {
			throw new ConvexError({
				code: "INVALID_RECURRENCE_PATTERN",
				message: "Recurrence pattern not found for habit.",
			});
		}

		const nextPatch: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(args.patch)) {
			nextPatch[key] = value === null ? undefined : value;
		}
		const patchHasKey = (key: keyof HabitUpdatePatch) =>
			Object.prototype.hasOwnProperty.call(args.patch, key);

		const hasRecurrencePatch = recurrencePatchKeys.some((key) => patchHasKey(key));
		if (hasRecurrencePatch) {
			const nextFrequency =
				patchHasKey("frequency") && args.patch.frequency === null
					? undefined
					: typeof nextPatch.frequency === "string"
						? (nextPatch.frequency as "daily" | "weekly" | "biweekly" | "monthly")
						: recurrencePattern.frequency;
			const recurrenceRuleFromPatch = patchHasKey("recurrenceRule")
				? args.patch.recurrenceRule === null
					? recurrenceFromLegacyFrequency(nextFrequency)
					: typeof nextPatch.recurrenceRule === "string"
						? (nextPatch.recurrenceRule as string)
						: undefined
				: undefined;
			const recurrenceRule =
				recurrenceRuleFromPatch ??
				recurrencePattern.recurrenceRule ??
				recurrenceFromLegacyFrequency(nextFrequency);
			if (!recurrenceRule) {
				throw new ConvexError({
					code: "INVALID_RECURRENCE_RULE",
					message: "A recurrence rule is required.",
				});
			}

			const nextRecurrencePatternId = await upsertRecurrencePattern(ctx, {
				userId: ctx.userId,
				pattern: {
					recurrenceRule,
					recoveryPolicy:
						patchHasKey("recoveryPolicy") && args.patch.recoveryPolicy === null
							? undefined
							: typeof nextPatch.recoveryPolicy === "string"
								? (nextPatch.recoveryPolicy as "skip" | "recover")
								: recurrencePattern.recoveryPolicy,
					frequency: nextFrequency,
					repeatsPerPeriod:
						patchHasKey("repeatsPerPeriod") && args.patch.repeatsPerPeriod === null
							? undefined
							: typeof nextPatch.repeatsPerPeriod === "number"
								? (nextPatch.repeatsPerPeriod as number)
								: recurrencePattern.repeatsPerPeriod,
					startDate:
						patchHasKey("startDate") && args.patch.startDate === null
							? undefined
							: typeof nextPatch.startDate === "number"
								? (nextPatch.startDate as number)
								: recurrencePattern.startDate,
					endDate:
						patchHasKey("endDate") && args.patch.endDate === null
							? undefined
							: typeof nextPatch.endDate === "number"
								? (nextPatch.endDate as number)
								: recurrencePattern.endDate,
					preferredWindowStart:
						patchHasKey("preferredWindowStart") && args.patch.preferredWindowStart === null
							? undefined
							: typeof nextPatch.preferredWindowStart === "string"
								? (nextPatch.preferredWindowStart as string)
								: recurrencePattern.preferredWindowStart,
					preferredWindowEnd:
						patchHasKey("preferredWindowEnd") && args.patch.preferredWindowEnd === null
							? undefined
							: typeof nextPatch.preferredWindowEnd === "string"
								? (nextPatch.preferredWindowEnd as string)
								: recurrencePattern.preferredWindowEnd,
					preferredDays:
						patchHasKey("preferredDays") && args.patch.preferredDays === null
							? undefined
							: Array.isArray(nextPatch.preferredDays)
								? (nextPatch.preferredDays as number[])
								: recurrencePattern.preferredDays,
					timezone: recurrencePattern.timezone,
				},
			});
			nextPatch.recurrencePatternId = nextRecurrencePatternId;
		}
		const filteredPatchEntries = Object.entries(nextPatch).filter(
			([key]) => !recurrencePatchKeys.includes(key as (typeof recurrencePatchKeys)[number]),
		);
		const habitPatch = Object.fromEntries(filteredPatchEntries) as Partial<typeof habit>;
		if (args.patch.hoursSetId !== undefined && args.patch.hoursSetId !== null) {
			await resolveHoursSetForHabit(ctx, ctx.userId, args.patch.hoursSetId);
		}
		if (args.patch.categoryId) {
			await ensureCategoryOwnership(ctx, args.patch.categoryId, ctx.userId);
		}
		await ctx.db.patch(args.id, habitPatch);
		const changedFields = Object.keys(habitPatch);
		const action = changedFields.includes("isActive")
			? "habit_active_state_changed"
			: changedFields.includes("priority")
				? "habit_priority_changed"
				: "habit_updated";
		await insertChangeLog(ctx, {
			userId: ctx.userId,
			entityType: "habit",
			entityId: String(args.id),
			action,
			metadata: {
				changedFields,
			},
		});
		const latestHabit = (await ctx.db.get(args.id)) ?? habit;
		await ensureHabitSeries(ctx, {
			userId: ctx.userId,
			habitId: args.id,
			recurrencePatternId: latestHabit.recurrencePatternId,
			isActive: latestHabit.isActive,
		});
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "habit_change",
		});
		return args.id;
	}),
});

export const deleteHabit = mutation({
	args: {
		id: v.id("habits"),
	},
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: DeleteHabitArgs): Promise<null> => {
		const habit = await ctx.db.get(args.id);
		if (!habit || habit.userId !== ctx.userId) {
			throw notFoundError();
		}
		await ctx.db.delete(args.id);
		await insertChangeLog(ctx, {
			userId: ctx.userId,
			entityType: "habit",
			entityId: String(args.id),
			action: "habit_deleted",
			metadata: {
				title: habit.title,
			},
		});
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "habit_change",
		});
		return null;
	}),
});

export const toggleHabitActive = mutation({
	args: {
		id: v.id("habits"),
		isActive: v.boolean(),
	},
	returns: v.id("habits"),
	handler: withMutationAuth(async (ctx, args: ToggleHabitArgs): Promise<Id<"habits">> => {
		const habit = await ctx.db.get(args.id);
		if (!habit || habit.userId !== ctx.userId) {
			throw notFoundError();
		}
		await ctx.db.patch(args.id, { isActive: args.isActive });
		await insertChangeLog(ctx, {
			userId: ctx.userId,
			entityType: "habit",
			entityId: String(args.id),
			action: args.isActive ? "habit_resumed" : "habit_paused",
			metadata: {
				isActive: args.isActive,
			},
		});
		await ensureHabitSeries(ctx, {
			userId: ctx.userId,
			habitId: args.id,
			recurrencePatternId: habit.recurrencePatternId,
			isActive: args.isActive,
		});
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "habit_change",
		});
		return args.id;
	}),
});

export const internalCreateHabitForUserWithOperation = internalMutation({
	args: {
		userId: v.string(),
		operationKey: v.string(),
		input: habitCreateInputValidator,
	},
	returns: v.id("habits"),
	handler: async (ctx, args: InternalCreateHabitArgs): Promise<Id<"habits">> => {
		const reservation = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (reservation?.entityId) {
			const existingHabit = await ctx.db.get(reservation.entityId as Id<"habits">);
			if (existingHabit && existingHabit.userId === args.userId) {
				return existingHabit._id;
			}
		}

		const hoursSetId = await resolveHoursSetForHabit(ctx, args.userId, args.input.hoursSetId);
		await ensureCategoryOwnership(ctx, args.input.categoryId, args.userId);
		const recurrenceRule =
			args.input.recurrenceRule ?? recurrenceFromLegacyFrequency(args.input.frequency);
		const recurrencePatternId = await upsertRecurrencePattern(ctx, {
			userId: args.userId,
			pattern: {
				recurrenceRule,
				recoveryPolicy: args.input.recoveryPolicy,
				frequency: args.input.frequency,
				repeatsPerPeriod: args.input.repeatsPerPeriod,
				startDate: args.input.startDate,
				endDate: args.input.endDate,
				preferredWindowStart: args.input.preferredWindowStart,
				preferredWindowEnd: args.input.preferredWindowEnd,
				preferredDays: args.input.preferredDays,
			},
		});
		const insertedId = await ctx.db.insert("habits", {
			userId: args.userId,
			title: args.input.title,
			description: args.input.description,
			priority: args.input.priority ?? "medium",
			categoryId: args.input.categoryId,
			durationMinutes: args.input.durationMinutes,
			minDurationMinutes: args.input.minDurationMinutes,
			maxDurationMinutes: args.input.maxDurationMinutes,
			idealTime: args.input.idealTime,
			hoursSetId,
			preferredCalendarId: args.input.preferredCalendarId,
			color: args.input.color,
			location: args.input.location,
			visibilityPreference: args.input.visibilityPreference,
			timeDefenseMode: args.input.timeDefenseMode,
			reminderMode: args.input.reminderMode,
			customReminderMinutes: args.input.customReminderMinutes,
			unscheduledBehavior: args.input.unscheduledBehavior,
			autoDeclineInvites: args.input.autoDeclineInvites,
			ccEmails: args.input.ccEmails,
			duplicateAvoidKeywords: args.input.duplicateAvoidKeywords,
			dependencyNote: args.input.dependencyNote,
			publicDescription: args.input.publicDescription,
			isActive: args.input.isActive ?? true,
			recurrencePatternId,
			seriesId: undefined,
		});

		const seriesId = await ensureHabitSeries(ctx, {
			userId: args.userId,
			habitId: insertedId,
			recurrencePatternId,
			isActive: args.input.isActive ?? true,
		});
		await ctx.db.patch(insertedId, { seriesId });

		if (reservation) {
			await ctx.db.patch(reservation._id, {
				entityId: String(insertedId),
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("billingReservations", {
				operationKey: args.operationKey,
				userId: args.userId,
				featureId: "habits",
				entityType: "habit",
				entityId: String(insertedId),
				status: "reserved",
				error: undefined,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}

		await enqueueSchedulingRunFromMutation(ctx, {
			userId: args.userId,
			triggeredBy: "habit_change",
		});

		return insertedId;
	},
});

export const internalRollbackHabitCreateForReservation = internalMutation({
	args: {
		operationKey: v.string(),
		userId: v.string(),
	},
	returns: v.object({
		rolledBack: v.boolean(),
	}),
	handler: async (ctx, args: InternalRollbackHabitArgs): Promise<{ rolledBack: boolean }> => {
		const reservation = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (!reservation || reservation.entityType !== "habit" || !reservation.entityId) {
			return { rolledBack: false };
		}

		const habitId = reservation.entityId as Id<"habits">;
		const habit = await ctx.db.get(habitId);
		if (!habit || habit.userId !== args.userId) {
			return { rolledBack: false };
		}

		await ctx.db.delete(habitId);
		return { rolledBack: true };
	},
});
