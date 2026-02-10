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
		schedulingHorizonDays: v.number(), // default: 75
	}).index("by_userId", ["userId"]),

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
		title: v.string(),
		description: v.optional(v.string()),
		start: v.number(), // timestamp
		end: v.number(),
		allDay: v.boolean(),
		source: v.union(
			v.literal("manual"),
			v.literal("google"),
			v.literal("task"),
			v.literal("habit"),
		),
		sourceId: v.optional(v.string()), // taskId, habitId, or Google event ID
		googleEventId: v.optional(v.string()),
		busyStatus: v.union(v.literal("free"), v.literal("busy"), v.literal("tentative")),
		color: v.optional(v.string()),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_timeRange", ["userId", "start", "end"])
		.index("by_googleEventId", ["googleEventId"]),

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
