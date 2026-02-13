import { v } from "convex/values";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";

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

const habitDtoValidator = v.object({
	_id: v.id("habits"),
	_creationTime: v.number(),
	userId: v.string(),
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
	isActive: v.boolean(),
});

type ListHabitsArgs = {
	activeOnly?: boolean;
};

export const listHabits = query({
	args: {
		activeOnly: v.optional(v.boolean()),
	},
	returns: v.array(habitDtoValidator),
	handler: withQueryAuth(async (ctx, args: ListHabitsArgs) => {
		const allHabits = await ctx.db
			.query("habits")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.collect();

		const filtered = args.activeOnly ? allHabits.filter((habit) => habit.isActive) : allHabits;
		return filtered.sort((a, b) => a.title.localeCompare(b.title));
	}),
});
