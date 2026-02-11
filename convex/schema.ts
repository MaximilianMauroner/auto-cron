import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	userSettings: defineTable({
		userId: v.string(),
		timezone: v.string(),
		workingHoursStart: v.string(), // "09:00"
		workingHoursEnd: v.string(), // "17:00"
		workingDays: v.array(v.number()), // 0=Sun, 1=Mon, ... 6=Sat
		googleRefreshToken: v.optional(v.string()),
		googleSyncToken: v.optional(v.string()),
		googleCalendarSyncTokens: v.optional(
			v.array(
				v.object({
					calendarId: v.string(),
					syncToken: v.string(),
				}),
			),
		),
		googleConnectedCalendars: v.optional(
			v.array(
				v.object({
					calendarId: v.string(),
					name: v.string(),
					primary: v.boolean(),
					color: v.optional(v.string()),
					accessRole: v.optional(
						v.union(
							v.literal("owner"),
							v.literal("writer"),
							v.literal("reader"),
							v.literal("freeBusyReader"),
						),
					),
					isExternal: v.optional(v.boolean()),
				}),
			),
		),
		schedulingHorizonDays: v.number(), // default: 75
	})
		.index("by_userId", ["userId"])
		.index("by_googleRefreshToken_userId", ["googleRefreshToken", "userId"]),

	tasks: defineTable({
		userId: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		priority: v.union(
			v.literal("low"),
			v.literal("medium"),
			v.literal("high"),
			v.literal("critical"),
			v.literal("blocker"),
		),
		status: v.union(
			v.literal("backlog"),
			v.literal("queued"),
			v.literal("scheduled"),
			v.literal("in_progress"),
			v.literal("done"),
		),
		estimatedMinutes: v.number(),
		deadline: v.optional(v.number()), // timestamp
		scheduledStart: v.optional(v.number()),
		scheduledEnd: v.optional(v.number()),
		completedAt: v.optional(v.number()),
		sortOrder: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_status", ["userId", "status"]),

	habits: defineTable({
		userId: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		category: v.union(
			v.literal("health"),
			v.literal("fitness"),
			v.literal("learning"),
			v.literal("mindfulness"),
			v.literal("productivity"),
			v.literal("social"),
			v.literal("other"),
		),
		frequency: v.union(
			v.literal("daily"),
			v.literal("weekly"),
			v.literal("biweekly"),
			v.literal("monthly"),
		),
		durationMinutes: v.number(),
		preferredWindowStart: v.optional(v.string()), // "06:00"
		preferredWindowEnd: v.optional(v.string()), // "08:00"
		preferredDays: v.optional(v.array(v.number())),
		isActive: v.boolean(),
	}).index("by_userId", ["userId"]),

	calendarEvents: defineTable({
		userId: v.string(),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		start: v.number(), // timestamp
		end: v.number(),
		allDay: v.optional(v.boolean()),
		updatedAt: v.number(),
		source: v.union(
			v.literal("manual"),
			v.literal("google"),
			v.literal("task"),
			v.literal("habit"),
		),
		sourceId: v.optional(v.string()), // taskId, habitId, or Google event ID
		calendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		recurrenceRule: v.optional(v.string()),
		recurringEventId: v.optional(v.string()),
		originalStartTime: v.optional(v.number()),
		seriesId: v.optional(v.id("calendarEventSeries")),
		occurrenceStart: v.optional(v.number()),
		status: v.optional(
			v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
		),
		etag: v.optional(v.string()),
		lastSyncedAt: v.optional(v.number()),
		busyStatus: v.optional(v.union(v.literal("free"), v.literal("busy"), v.literal("tentative"))),
		color: v.optional(v.string()),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_start", ["userId", "start"])
		.index("by_userId_timeRange", ["userId", "start", "end"])
		.index("by_googleEventId", ["googleEventId"])
		.index("by_userId_googleEventId", ["userId", "googleEventId"])
		.index("by_userId_calendarId_googleEventId", ["userId", "calendarId", "googleEventId"])
		.index("by_userId_recurringEventId", ["userId", "recurringEventId"])
		.index("by_userId_seriesId_occurrenceStart", ["userId", "seriesId", "occurrenceStart"]),

	calendarEventSeries: defineTable({
		userId: v.string(),
		source: v.union(
			v.literal("manual"),
			v.literal("google"),
			v.literal("task"),
			v.literal("habit"),
		),
		sourceId: v.optional(v.string()),
		calendarId: v.optional(v.string()),
		googleSeriesId: v.optional(v.string()),
		title: v.string(),
		description: v.optional(v.string()),
		allDay: v.boolean(),
		recurrenceRule: v.optional(v.string()),
		status: v.optional(
			v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
		),
		busyStatus: v.union(v.literal("free"), v.literal("busy"), v.literal("tentative")),
		color: v.optional(v.string()),
		etag: v.optional(v.string()),
		lastSyncedAt: v.optional(v.number()),
		updatedAt: v.number(),
		isRecurring: v.boolean(),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_source_googleSeriesId", ["userId", "source", "googleSeriesId"])
		.index("by_userId_calendarId_googleSeriesId", ["userId", "calendarId", "googleSeriesId"]),

	schedulingRuns: defineTable({
		userId: v.string(),
		triggeredBy: v.string(), // "manual" | "task_change" | "cron"
		status: v.union(
			v.literal("pending"),
			v.literal("running"),
			v.literal("completed"),
			v.literal("failed"),
		),
		startedAt: v.number(),
		completedAt: v.optional(v.number()),
		tasksScheduled: v.number(),
		habitsScheduled: v.number(),
		error: v.optional(v.string()),
	}).index("by_userId", ["userId"]),
});
