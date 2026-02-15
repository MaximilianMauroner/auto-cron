import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import type { ListHabitOccurrencesArgs, ListHabitsArgs } from "./habitTypes";

const habitPriorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
);
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
const habitRecoveryPolicyValidator = v.union(v.literal("skip"), v.literal("recover"));
const habitFrequencyValidator = v.union(
	v.literal("daily"),
	v.literal("weekly"),
	v.literal("biweekly"),
	v.literal("monthly"),
);

const habitDtoValidator = v.object({
	_id: v.id("habits"),
	_creationTime: v.number(),
	userId: v.string(),
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
	isActive: v.boolean(),
	recurrencePatternId: v.id("recurrencePatterns"),
	seriesId: v.optional(v.id("workItemSeries")),
	effectiveColor: v.string(),
});

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

		// Batch-load all unique categories for effective color resolution
		const uniqueCategoryIds = [...new Set(filtered.map((h) => h.categoryId))];
		const categories = await Promise.all(uniqueCategoryIds.map((id) => ctx.db.get(id)));
		const categoryMap = new Map(uniqueCategoryIds.map((id, i) => [id, categories[i]]));
		const recurrencePatternIds = [...new Set(filtered.map((h) => String(h.recurrencePatternId)))];
		const recurrencePatterns = await Promise.all(
			recurrencePatternIds.map((id) =>
				ctx.db.get(id as (typeof filtered)[number]["recurrencePatternId"]),
			),
		);
		const recurrencePatternMap = new Map(
			recurrencePatternIds.map((id, i) => [id, recurrencePatterns[i] ?? null] as const),
		);

		return filtered
			.map((habit) => {
				const category = categoryMap.get(habit.categoryId) ?? null;
				const recurrencePattern =
					recurrencePatternMap.get(String(habit.recurrencePatternId)) ?? null;
				return {
					...habit,
					recurrenceRule: recurrencePattern?.recurrenceRule,
					recoveryPolicy: recurrencePattern?.recoveryPolicy,
					frequency: recurrencePattern?.frequency,
					repeatsPerPeriod: recurrencePattern?.repeatsPerPeriod,
					preferredWindowStart: recurrencePattern?.preferredWindowStart,
					preferredWindowEnd: recurrencePattern?.preferredWindowEnd,
					preferredDays: recurrencePattern?.preferredDays,
					startDate: recurrencePattern?.startDate,
					endDate: recurrencePattern?.endDate,
					effectiveColor: habit.color ?? category?.color ?? "#f59e0b",
				};
			})
			.sort((a, b) => a.title.localeCompare(b.title));
	}),
});

export const getHabit = query({
	args: {
		id: v.id("habits"),
	},
	returns: v.union(habitDtoValidator, v.null()),
	handler: withQueryAuth(async (ctx, args: { id: Id<"habits"> }) => {
		const habit = await ctx.db.get(args.id);
		if (!habit || habit.userId !== ctx.userId) {
			return null;
		}
		const category = await ctx.db.get(habit.categoryId);
		const recurrencePattern = await ctx.db.get(habit.recurrencePatternId);
		return {
			...habit,
			recurrenceRule: recurrencePattern?.recurrenceRule,
			recoveryPolicy: recurrencePattern?.recoveryPolicy,
			frequency: recurrencePattern?.frequency,
			repeatsPerPeriod: recurrencePattern?.repeatsPerPeriod,
			preferredWindowStart: recurrencePattern?.preferredWindowStart,
			preferredWindowEnd: recurrencePattern?.preferredWindowEnd,
			preferredDays: recurrencePattern?.preferredDays,
			startDate: recurrencePattern?.startDate,
			endDate: recurrencePattern?.endDate,
			effectiveColor: habit.color ?? category?.color ?? "#f59e0b",
		};
	}),
});

const habitOccurrenceValidator = v.object({
	id: v.id("calendarEvents"),
	start: v.number(),
	end: v.number(),
	status: v.optional(
		v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
	),
	calendarId: v.optional(v.string()),
	pinned: v.optional(v.boolean()),
});

export const listHabitOccurrences = query({
	args: {
		habitId: v.id("habits"),
		limit: v.optional(v.number()),
	},
	returns: v.array(habitOccurrenceValidator),
	handler: withQueryAuth(async (ctx, args: ListHabitOccurrencesArgs) => {
		const habit = await ctx.db.get(args.habitId);
		if (!habit || habit.userId !== ctx.userId) {
			return [];
		}

		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_source_sourceId", (q) =>
				q.eq("userId", ctx.userId).eq("source", "habit").eq("sourceId", String(args.habitId)),
			)
			.collect();

		const normalizedLimit = Number.isFinite(args.limit)
			? Math.max(1, Math.min(Math.floor(args.limit as number), 500))
			: 250;

		return events
			.filter((event) => event.status !== "cancelled")
			.sort((a, b) => a.start - b.start)
			.slice(-normalizedLimit)
			.map((event) => ({
				id: event._id,
				start: event.start,
				end: event.end,
				status: event.status,
				calendarId: event.calendarId,
				pinned: event.pinned,
			}));
	}),
});
