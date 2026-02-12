import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import { ensureHoursSetOwnership, getDefaultHoursSet } from "../hours/shared";

const habitFrequencyValidator = v.union(
	v.literal("daily"),
	v.literal("weekly"),
	v.literal("biweekly"),
	v.literal("monthly"),
);

const habitCategoryValidator = v.union(
	v.literal("health"),
	v.literal("fitness"),
	v.literal("learning"),
	v.literal("mindfulness"),
	v.literal("productivity"),
	v.literal("social"),
	v.literal("other"),
);

const habitPriorityValidator = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
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
	category: habitCategoryValidator,
	frequency: habitFrequencyValidator,
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
	category: v.optional(habitCategoryValidator),
	frequency: v.optional(habitFrequencyValidator),
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

type HabitFrequency = "daily" | "weekly" | "biweekly" | "monthly";
type HabitCategory =
	| "health"
	| "fitness"
	| "learning"
	| "mindfulness"
	| "productivity"
	| "social"
	| "other";
type HabitCreateInput = {
	title: string;
	description?: string;
	priority?: "low" | "medium" | "high";
	category: HabitCategory;
	frequency: HabitFrequency;
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
type HabitUpdatePatch = {
	title?: string;
	description?: string | null;
	priority?: "low" | "medium" | "high" | null;
	category?: HabitCategory;
	frequency?: HabitFrequency;
	durationMinutes?: number;
	minDurationMinutes?: number | null;
	maxDurationMinutes?: number | null;
	repeatsPerPeriod?: number | null;
	idealTime?: string | null;
	preferredWindowStart?: string | null;
	preferredWindowEnd?: string | null;
	preferredDays?: number[] | null;
	hoursSetId?: Id<"hoursSets"> | null;
	preferredCalendarId?: string | null;
	color?: string | null;
	location?: string | null;
	startDate?: number | null;
	endDate?: number | null;
	visibilityPreference?: "default" | "public" | "private" | null;
	timeDefenseMode?: "always_free" | "auto" | "always_busy" | null;
	reminderMode?: "default" | "custom" | "none" | null;
	customReminderMinutes?: number | null;
	unscheduledBehavior?: "leave_on_calendar" | "remove_from_calendar" | null;
	autoDeclineInvites?: boolean | null;
	ccEmails?: string[] | null;
	duplicateAvoidKeywords?: string[] | null;
	dependencyNote?: string | null;
	publicDescription?: string | null;
	isActive?: boolean;
};
type UpdateHabitArgs = {
	id: Id<"habits">;
	patch: HabitUpdatePatch;
};
type DeleteHabitArgs = {
	id: Id<"habits">;
};
type ToggleHabitArgs = {
	id: Id<"habits">;
	isActive: boolean;
};
type InternalCreateHabitArgs = {
	userId: string;
	operationKey: string;
	input: HabitCreateInput;
};
type InternalRollbackHabitArgs = {
	operationKey: string;
	userId: string;
};

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

		const nextPatch: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(args.patch)) {
			nextPatch[key] = value === null ? undefined : value;
		}
		if (args.patch.hoursSetId !== undefined && args.patch.hoursSetId !== null) {
			await resolveHoursSetForHabit(ctx, ctx.userId, args.patch.hoursSetId);
		}
		await ctx.db.patch(args.id, nextPatch as Partial<typeof habit>);
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
		const insertedId = await ctx.db.insert("habits", {
			userId: args.userId,
			title: args.input.title,
			description: args.input.description,
			priority: args.input.priority ?? "medium",
			category: args.input.category,
			frequency: args.input.frequency,
			durationMinutes: args.input.durationMinutes,
			minDurationMinutes: args.input.minDurationMinutes,
			maxDurationMinutes: args.input.maxDurationMinutes,
			repeatsPerPeriod: args.input.repeatsPerPeriod,
			idealTime: args.input.idealTime,
			preferredWindowStart: args.input.preferredWindowStart,
			preferredWindowEnd: args.input.preferredWindowEnd,
			preferredDays: args.input.preferredDays,
			hoursSetId,
			preferredCalendarId: args.input.preferredCalendarId,
			color: args.input.color,
			location: args.input.location,
			startDate: args.input.startDate,
			endDate: args.input.endDate,
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
				featureId: "habits",
				entityType: "habit",
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
