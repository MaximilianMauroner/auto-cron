import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	userSettings: defineTable({
		userId: v.string(),
		timezone: v.string(),
		timeFormatPreference: v.optional(v.union(v.literal("12h"), v.literal("24h"))),
		defaultTaskSchedulingMode: v.union(
			v.literal("fastest"),
			v.literal("balanced"),
			v.literal("packed"),
		),
		taskQuickCreatePriority: v.optional(
			v.union(
				v.literal("low"),
				v.literal("medium"),
				v.literal("high"),
				v.literal("critical"),
				v.literal("blocker"),
			),
		),
		taskQuickCreateStatus: v.optional(v.union(v.literal("backlog"), v.literal("queued"))),
		taskQuickCreateEstimatedMinutes: v.optional(v.number()),
		taskQuickCreateSplitAllowed: v.optional(v.boolean()),
		taskQuickCreateMinChunkMinutes: v.optional(v.number()),
		taskQuickCreateMaxChunkMinutes: v.optional(v.number()),
		taskQuickCreateRestMinutes: v.optional(v.number()),
		taskQuickCreateTravelMinutes: v.optional(v.number()),
		taskQuickCreateSendToUpNext: v.optional(v.boolean()),
		taskQuickCreateVisibilityPreference: v.optional(
			v.union(v.literal("default"), v.literal("private")),
		),
		taskQuickCreateColor: v.optional(v.string()),
		habitQuickCreatePriority: v.optional(
			v.union(
				v.literal("low"),
				v.literal("medium"),
				v.literal("high"),
				v.literal("critical"),
				v.literal("blocker"),
			),
		),
		habitQuickCreateDurationMinutes: v.optional(v.number()),
		habitQuickCreateFrequency: v.optional(
			v.union(v.literal("daily"), v.literal("weekly"), v.literal("biweekly"), v.literal("monthly")),
		),
		habitQuickCreateRecoveryPolicy: v.optional(v.union(v.literal("skip"), v.literal("recover"))),
		habitQuickCreateVisibilityPreference: v.optional(
			v.union(v.literal("default"), v.literal("private")),
		),
		habitQuickCreateColor: v.optional(v.string()),
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
		schedulingDowntimeMinutes: v.optional(v.number()),
		schedulingStepMinutes: v.optional(v.union(v.literal(15), v.literal(30), v.literal(60))),
		weekStartsOn: v.optional(
			v.union(
				v.literal(0),
				v.literal(1),
				v.literal(2),
				v.literal(3),
				v.literal(4),
				v.literal(5),
				v.literal(6),
			),
		),
		dateFormat: v.optional(
			v.union(v.literal("MM/DD/YYYY"), v.literal("DD/MM/YYYY"), v.literal("YYYY-MM-DD")),
		),
	})
		.index("by_userId", ["userId"])
		.index("by_googleRefreshToken_userId", ["googleRefreshToken", "userId"]),

	taskCategories: defineTable({
		userId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		color: v.string(),
		isSystem: v.boolean(),
		isDefault: v.boolean(),
		sortOrder: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_isSystem", ["userId", "isSystem"])
		.index("by_userId_isDefault", ["userId", "isDefault"])
		.index("by_userId_name", ["userId", "name"]),

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
		scheduleAfter: v.optional(v.number()),
		scheduledStart: v.optional(v.number()),
		scheduledEnd: v.optional(v.number()),
		completedAt: v.optional(v.number()),
		sortOrder: v.number(),
		splitAllowed: v.optional(v.boolean()),
		minChunkMinutes: v.optional(v.number()),
		maxChunkMinutes: v.optional(v.number()),
		restMinutes: v.optional(v.number()),
		travelMinutes: v.optional(v.number()),
		location: v.optional(v.string()),
		sendToUpNext: v.optional(v.boolean()),
		hoursSetId: v.optional(v.id("hoursSets")),
		schedulingMode: v.optional(
			v.union(v.literal("fastest"), v.literal("balanced"), v.literal("packed")),
		),
		visibilityPreference: v.optional(v.union(v.literal("default"), v.literal("private"))),
		preferredCalendarId: v.optional(v.string()),
		color: v.optional(v.string()),
		categoryId: v.optional(v.id("taskCategories")),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_status", ["userId", "status"])
		.index("by_userId_hoursSetId", ["userId", "hoursSetId"])
		.index("by_userId_categoryId", ["userId", "categoryId"]),

	habits: defineTable({
		userId: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		priority: v.optional(
			v.union(
				v.literal("low"),
				v.literal("medium"),
				v.literal("high"),
				v.literal("critical"),
				v.literal("blocker"),
			),
		),
		categoryId: v.id("taskCategories"),
		recurrenceRule: v.optional(v.string()),
		recoveryPolicy: v.optional(v.union(v.literal("skip"), v.literal("recover"))),
		frequency: v.optional(
			v.union(v.literal("daily"), v.literal("weekly"), v.literal("biweekly"), v.literal("monthly")),
		),
		durationMinutes: v.number(),
		minDurationMinutes: v.optional(v.number()),
		maxDurationMinutes: v.optional(v.number()),
		repeatsPerPeriod: v.optional(v.number()),
		idealTime: v.optional(v.string()),
		preferredWindowStart: v.optional(v.string()), // "06:00"
		preferredWindowEnd: v.optional(v.string()), // "08:00"
		preferredDays: v.optional(v.array(v.number())),
		hoursSetId: v.optional(v.id("hoursSets")),
		preferredCalendarId: v.optional(v.string()),
		color: v.optional(v.string()),
		location: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		visibilityPreference: v.optional(
			v.union(v.literal("default"), v.literal("public"), v.literal("private")),
		),
		timeDefenseMode: v.optional(
			v.union(v.literal("always_free"), v.literal("auto"), v.literal("always_busy")),
		),
		reminderMode: v.optional(v.union(v.literal("default"), v.literal("custom"), v.literal("none"))),
		customReminderMinutes: v.optional(v.number()),
		unscheduledBehavior: v.optional(
			v.union(v.literal("leave_on_calendar"), v.literal("remove_from_calendar")),
		),
		autoDeclineInvites: v.optional(v.boolean()),
		ccEmails: v.optional(v.array(v.string())),
		duplicateAvoidKeywords: v.optional(v.array(v.string())),
		dependencyNote: v.optional(v.string()),
		publicDescription: v.optional(v.string()),
		isActive: v.boolean(),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_hoursSetId", ["userId", "hoursSetId"])
		.index("by_userId_categoryId", ["userId", "categoryId"]),

	hoursSets: defineTable({
		userId: v.string(),
		name: v.string(),
		isDefault: v.boolean(),
		isSystem: v.boolean(),
		windows: v.array(
			v.object({
				day: v.union(
					v.literal(0),
					v.literal(1),
					v.literal(2),
					v.literal(3),
					v.literal(4),
					v.literal(5),
					v.literal(6),
				),
				startMinute: v.number(),
				endMinute: v.number(),
			}),
		),
		defaultCalendarId: v.optional(v.string()),
		updatedAt: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_isDefault", ["userId", "isDefault"])
		.index("by_userId_name", ["userId", "name"]),

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
		visibility: v.optional(
			v.union(
				v.literal("default"),
				v.literal("public"),
				v.literal("private"),
				v.literal("confidential"),
			),
		),
		location: v.optional(v.string()),
		color: v.optional(v.string()),
		pinned: v.optional(v.boolean()),
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
		visibility: v.optional(
			v.union(
				v.literal("default"),
				v.literal("public"),
				v.literal("private"),
				v.literal("confidential"),
			),
		),
		location: v.optional(v.string()),
		color: v.optional(v.string()),
		etag: v.optional(v.string()),
		lastSyncedAt: v.optional(v.number()),
		updatedAt: v.number(),
		isRecurring: v.boolean(),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_source_googleSeriesId", ["userId", "source", "googleSeriesId"])
		.index("by_userId_calendarId_googleSeriesId", ["userId", "calendarId", "googleSeriesId"]),

	googleCalendarWatchChannels: defineTable({
		userId: v.string(),
		calendarId: v.string(),
		channelId: v.string(),
		resourceId: v.string(),
		resourceUri: v.optional(v.string()),
		channelTokenHash: v.string(),
		expirationAt: v.number(),
		status: v.union(v.literal("active"), v.literal("expired"), v.literal("stopped")),
		lastNotifiedAt: v.optional(v.number()),
		lastMessageNumber: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_channelId", ["channelId"])
		.index("by_userId", ["userId"])
		.index("by_userId_calendarId", ["userId", "calendarId"])
		.index("by_expirationAt", ["expirationAt"]),

	googleSyncRuns: defineTable({
		userId: v.string(),
		triggeredBy: v.union(
			v.literal("webhook"),
			v.literal("cron"),
			v.literal("manual"),
			v.literal("oauth_connect"),
		),
		status: v.union(
			v.literal("pending"),
			v.literal("running"),
			v.literal("completed"),
			v.literal("failed"),
		),
		startedAt: v.number(),
		completedAt: v.optional(v.number()),
		imported: v.optional(v.number()),
		deleted: v.optional(v.number()),
		error: v.optional(v.string()),
	})
		.index("by_userId_status_startedAt", ["userId", "status", "startedAt"])
		.index("by_userId_startedAt", ["userId", "startedAt"]),

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
		feasibleOnTime: v.optional(v.boolean()),
		horizonStart: v.optional(v.number()),
		horizonEnd: v.optional(v.number()),
		objectiveScore: v.optional(v.number()),
		lateTasks: v.optional(
			v.array(
				v.object({
					taskId: v.id("tasks"),
					dueDate: v.optional(v.number()),
					completionEnd: v.number(),
					tardinessSlots: v.number(),
					priority: v.union(
						v.literal("low"),
						v.literal("medium"),
						v.literal("high"),
						v.literal("critical"),
						v.literal("blocker"),
					),
					blocker: v.boolean(),
					reason: v.optional(v.string()),
				}),
			),
		),
		habitShortfalls: v.optional(
			v.array(
				v.object({
					habitId: v.id("habits"),
					periodStart: v.number(),
					periodEnd: v.number(),
					targetCount: v.number(),
					scheduledCount: v.number(),
					shortfall: v.number(),
					recoveryPolicy: v.union(v.literal("skip"), v.literal("recover")),
				}),
			),
		),
		dropSummary: v.optional(
			v.array(
				v.object({
					habitId: v.id("habits"),
					recoveryPolicy: v.union(v.literal("skip"), v.literal("recover")),
					priority: v.union(
						v.literal("low"),
						v.literal("medium"),
						v.literal("high"),
						v.literal("critical"),
						v.literal("blocker"),
					),
					reason: v.string(),
				}),
			),
		),
		reasonCode: v.optional(v.string()),
		error: v.optional(v.string()),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_status_startedAt", ["userId", "status", "startedAt"])
		.index("by_userId_startedAt", ["userId", "startedAt"]),

	billingReservations: defineTable({
		operationKey: v.string(),
		userId: v.string(),
		featureId: v.union(v.literal("tasks"), v.literal("habits")),
		entityType: v.union(v.literal("task"), v.literal("habit")),
		entityId: v.optional(v.string()),
		status: v.union(
			v.literal("reserved"),
			v.literal("committed"),
			v.literal("rolled_back"),
			v.literal("rollback_failed"),
		),
		error: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_operationKey", ["operationKey"])
		.index("by_userId_featureId", ["userId", "featureId"])
		.index("by_status", ["status"]),

	billingLocks: defineTable({
		userId: v.string(),
		featureId: v.union(v.literal("tasks"), v.literal("habits")),
		lockToken: v.string(),
		expiresAt: v.number(),
		updatedAt: v.number(),
	}).index("by_userId_featureId", ["userId", "featureId"]),

	feedback: defineTable({
		userId: v.optional(v.string()),
		category: v.union(v.literal("bug"), v.literal("idea"), v.literal("general")),
		subject: v.optional(v.string()),
		message: v.string(),
		page: v.optional(v.string()),
		timezone: v.optional(v.string()),
		userAgent: v.optional(v.string()),
		status: v.union(v.literal("new"), v.literal("reviewed"), v.literal("resolved")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_createdAt", ["createdAt"])
		.index("by_userId_createdAt", ["userId", "createdAt"]),
});
