import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import {
	defaultSchedulingStepMinutes,
	defaultTaskQuickCreateSettings,
	normalizeSchedulingDowntimeMinutes,
	normalizeSchedulingStepMinutes,
	normalizeTimeFormatPreference,
	normalizeTimeZone,
} from "../hours/shared";
import type { RecurrenceEditScope } from "../providers/calendar/types";
import { enqueueSchedulingRunFromMutation } from "../scheduling/enqueue";

const MINUTE_MS = 60 * 1000;
const normalizeToMinute = (timestamp: number) => Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
const sanitizeTaskSchedulingMode = (
	mode: string | undefined,
): "fastest" | "balanced" | "packed" => {
	if (mode === "fastest" || mode === "balanced" || mode === "packed") {
		return mode;
	}
	return "fastest";
};
const normalizedTimeFormatPreferenceFromSettings = (settings: {
	timeFormatPreference?: string;
}) => normalizeTimeFormatPreference(settings.timeFormatPreference) ?? undefined;
const normalizedSchedulingStepMinutesFromSettings = (settings: {
	schedulingStepMinutes?: number;
}) => normalizeSchedulingStepMinutes(settings.schedulingStepMinutes);

const normalizeTaskQuickCreateDefaultsForSettings = (settings: {
	taskQuickCreatePriority?: string;
	taskQuickCreateStatus?: string;
	taskQuickCreateEstimatedMinutes?: number;
	taskQuickCreateSplitAllowed?: boolean;
	taskQuickCreateMinChunkMinutes?: number;
	taskQuickCreateMaxChunkMinutes?: number;
	taskQuickCreateRestMinutes?: number;
	taskQuickCreateTravelMinutes?: number;
	taskQuickCreateSendToUpNext?: boolean;
	taskQuickCreateVisibilityPreference?: string;
	taskQuickCreateColor?: string;
}): {
	taskQuickCreatePriority: "low" | "medium" | "high" | "critical" | "blocker";
	taskQuickCreateStatus: "backlog" | "queued";
	taskQuickCreateEstimatedMinutes: number;
	taskQuickCreateSplitAllowed: boolean;
	taskQuickCreateMinChunkMinutes: number;
	taskQuickCreateMaxChunkMinutes: number;
	taskQuickCreateRestMinutes: number;
	taskQuickCreateTravelMinutes: number;
	taskQuickCreateSendToUpNext: boolean;
	taskQuickCreateVisibilityPreference: "default" | "private";
	taskQuickCreateColor: string;
} => {
	const priority =
		settings.taskQuickCreatePriority === "low" ||
		settings.taskQuickCreatePriority === "medium" ||
		settings.taskQuickCreatePriority === "high" ||
		settings.taskQuickCreatePriority === "critical" ||
		settings.taskQuickCreatePriority === "blocker"
			? settings.taskQuickCreatePriority
			: defaultTaskQuickCreateSettings.priority;
	const status =
		settings.taskQuickCreateStatus === "queued" || settings.taskQuickCreateStatus === "backlog"
			? settings.taskQuickCreateStatus
			: defaultTaskQuickCreateSettings.status;
	const estimatedMinutes = Math.max(
		15,
		Number.isFinite(settings.taskQuickCreateEstimatedMinutes)
			? Math.round(
					settings.taskQuickCreateEstimatedMinutes ??
						defaultTaskQuickCreateSettings.estimatedMinutes,
				)
			: defaultTaskQuickCreateSettings.estimatedMinutes,
	);
	const splitAllowed =
		settings.taskQuickCreateSplitAllowed ?? defaultTaskQuickCreateSettings.splitAllowed;
	const minChunkMinutes = Math.max(
		15,
		Number.isFinite(settings.taskQuickCreateMinChunkMinutes)
			? Math.round(
					settings.taskQuickCreateMinChunkMinutes ?? defaultTaskQuickCreateSettings.minChunkMinutes,
				)
			: defaultTaskQuickCreateSettings.minChunkMinutes,
	);
	const maxChunkMinutes = Math.max(
		minChunkMinutes,
		Number.isFinite(settings.taskQuickCreateMaxChunkMinutes)
			? Math.round(
					settings.taskQuickCreateMaxChunkMinutes ?? defaultTaskQuickCreateSettings.maxChunkMinutes,
				)
			: defaultTaskQuickCreateSettings.maxChunkMinutes,
	);
	const restMinutes = Math.max(
		0,
		Number.isFinite(settings.taskQuickCreateRestMinutes)
			? Math.round(
					settings.taskQuickCreateRestMinutes ?? defaultTaskQuickCreateSettings.restMinutes,
				)
			: defaultTaskQuickCreateSettings.restMinutes,
	);
	const travelMinutes = Math.max(
		0,
		Number.isFinite(settings.taskQuickCreateTravelMinutes)
			? Math.round(
					settings.taskQuickCreateTravelMinutes ?? defaultTaskQuickCreateSettings.travelMinutes,
				)
			: defaultTaskQuickCreateSettings.travelMinutes,
	);
	const visibilityPreference =
		settings.taskQuickCreateVisibilityPreference === "default" ||
		settings.taskQuickCreateVisibilityPreference === "private"
			? settings.taskQuickCreateVisibilityPreference
			: defaultTaskQuickCreateSettings.visibilityPreference;
	const color = settings.taskQuickCreateColor?.trim() || defaultTaskQuickCreateSettings.color;

	return {
		taskQuickCreatePriority: priority,
		taskQuickCreateStatus: status,
		taskQuickCreateEstimatedMinutes: estimatedMinutes,
		taskQuickCreateSplitAllowed: splitAllowed,
		taskQuickCreateMinChunkMinutes: minChunkMinutes,
		taskQuickCreateMaxChunkMinutes: maxChunkMinutes,
		taskQuickCreateRestMinutes: restMinutes,
		taskQuickCreateTravelMinutes: travelMinutes,
		taskQuickCreateSendToUpNext:
			settings.taskQuickCreateSendToUpNext ?? defaultTaskQuickCreateSettings.sendToUpNext,
		taskQuickCreateVisibilityPreference: visibilityPreference,
		taskQuickCreateColor: color,
	};
};

const recurrenceScopeValidator = v.union(
	v.literal("single"),
	v.literal("following"),
	v.literal("series"),
);

const recencyScore = (event: Doc<"calendarEvents">) =>
	Math.max(event.lastSyncedAt ?? 0, event.updatedAt ?? 0, event._creationTime ?? 0);

const syncEventValidator = v.object({
	googleEventId: v.string(),
	title: v.string(),
	description: v.optional(v.string()),
	start: v.number(),
	end: v.number(),
	allDay: v.boolean(),
	calendarId: v.string(),
	recurrenceRule: v.optional(v.string()),
	recurringEventId: v.optional(v.string()),
	originalStartTime: v.optional(v.number()),
	status: v.optional(
		v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
	),
	etag: v.optional(v.string()),
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
	lastSyncedAt: v.number(),
});

const syncDeletedEventValidator = v.object({
	googleEventId: v.string(),
	calendarId: v.string(),
	originalStartTime: v.optional(v.number()),
	lastSyncedAt: v.number(),
});

const syncTokenValidator = v.object({
	calendarId: v.string(),
	syncToken: v.string(),
});

const connectedCalendarValidator = v.object({
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
});

const syncArgsValidator = {
	resetCalendars: v.optional(v.array(v.string())),
	events: v.array(syncEventValidator),
	deletedEvents: v.optional(v.array(syncDeletedEventValidator)),
	nextSyncToken: v.optional(v.string()),
	syncTokens: v.optional(v.array(syncTokenValidator)),
	connectedCalendars: v.optional(v.array(connectedCalendarValidator)),
};

type SyncEventInput = {
	googleEventId: string;
	title: string;
	description?: string;
	start: number;
	end: number;
	allDay: boolean;
	calendarId: string;
	recurrenceRule?: string;
	recurringEventId?: string;
	originalStartTime?: number;
	status?: "confirmed" | "tentative" | "cancelled";
	etag?: string;
	busyStatus: "free" | "busy" | "tentative";
	visibility?: "default" | "public" | "private" | "confidential";
	location?: string;
	color?: string;
	lastSyncedAt: number;
};

type BusyStatus = "free" | "busy" | "tentative";
type Visibility = "default" | "public" | "private" | "confidential";

type UpsertGoogleTokensArgs = {
	refreshToken: string;
	syncToken?: string;
};

type CreateEventArgs = {
	input: {
		title: string;
		description?: string;
		start: number;
		end: number;
		allDay?: boolean;
		recurrenceRule?: string;
		calendarId?: string;
		busyStatus?: BusyStatus;
		visibility?: Visibility;
		location?: string;
		color?: string;
	};
};

type UpdateEventPatch = {
	title?: string;
	description?: string;
	start?: number;
	end?: number;
	allDay?: boolean;
	recurrenceRule?: string;
	calendarId?: string;
	busyStatus?: BusyStatus;
	visibility?: Visibility;
	location?: string;
	color?: string;
};

type UpdateEventArgs = {
	id: Id<"calendarEvents">;
	patch: UpdateEventPatch;
	scope?: RecurrenceEditScope;
};

type DeleteEventArgs = {
	id: Id<"calendarEvents">;
	scope?: RecurrenceEditScope;
};

type MoveResizeEventArgs = {
	id: Id<"calendarEvents">;
	start: number;
	end: number;
	scope?: RecurrenceEditScope;
};

const googleSyncRunTriggerValidator = v.union(
	v.literal("webhook"),
	v.literal("cron"),
	v.literal("manual"),
	v.literal("oauth_connect"),
);

const watchChannelStatusValidator = v.union(
	v.literal("active"),
	v.literal("expired"),
	v.literal("stopped"),
);

const isTestRuntime = () => process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const enqueueGoogleSyncRun = internalMutation({
	args: {
		userId: v.string(),
		triggeredBy: googleSyncRunTriggerValidator,
		force: v.optional(v.boolean()),
	},
	returns: v.object({
		enqueued: v.boolean(),
		runId: v.id("googleSyncRuns"),
	}),
	handler: async (ctx, args) => {
		const pending = await ctx.db
			.query("googleSyncRuns")
			.withIndex("by_userId_status_startedAt", (q) =>
				q.eq("userId", args.userId).eq("status", "pending"),
			)
			.collect();
		const latestPending = pending.sort((a, b) => b.startedAt - a.startedAt)[0];
		if (latestPending && !args.force) {
			return {
				enqueued: false,
				runId: latestPending._id,
			};
		}

		const runId = await ctx.db.insert("googleSyncRuns", {
			userId: args.userId,
			triggeredBy: args.triggeredBy,
			status: "pending",
			startedAt: Date.now(),
		});

		if (!isTestRuntime()) {
			await ctx.scheduler.runAfter(0, internal.calendar.actions.syncFromGoogleForUser, {
				runId,
				userId: args.userId,
				triggeredBy: args.triggeredBy,
			});
		}

		return {
			enqueued: true,
			runId,
		};
	},
});

export const markGoogleSyncRunRunning = internalMutation({
	args: {
		runId: v.id("googleSyncRuns"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.runId);
		if (!run || run.status !== "pending") return null;
		await ctx.db.patch(args.runId, {
			status: "running",
		});
		return null;
	},
});

export const completeGoogleSyncRun = internalMutation({
	args: {
		runId: v.id("googleSyncRuns"),
		imported: v.number(),
		deleted: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.runId);
		if (!run) return null;
		await ctx.db.patch(args.runId, {
			status: "completed",
			completedAt: Date.now(),
			imported: args.imported,
			deleted: args.deleted,
			error: undefined,
		});
		return null;
	},
});

export const failGoogleSyncRun = internalMutation({
	args: {
		runId: v.id("googleSyncRuns"),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.runId);
		if (!run) return null;
		await ctx.db.patch(args.runId, {
			status: "failed",
			completedAt: Date.now(),
			error: args.error,
		});
		return null;
	},
});

export const upsertWatchChannel = internalMutation({
	args: {
		userId: v.string(),
		calendarId: v.string(),
		channelId: v.string(),
		resourceId: v.string(),
		resourceUri: v.optional(v.string()),
		channelTokenHash: v.string(),
		expirationAt: v.number(),
	},
	returns: v.id("googleCalendarWatchChannels"),
	handler: async (ctx, args) => {
		const existingByChannelId = await ctx.db
			.query("googleCalendarWatchChannels")
			.withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
			.unique();
		const now = Date.now();
		if (existingByChannelId) {
			await ctx.db.patch(existingByChannelId._id, {
				userId: args.userId,
				calendarId: args.calendarId,
				channelId: args.channelId,
				resourceId: args.resourceId,
				resourceUri: args.resourceUri,
				channelTokenHash: args.channelTokenHash,
				expirationAt: args.expirationAt,
				status: "active",
				updatedAt: now,
			});
			return existingByChannelId._id;
		}

		const existingByCalendar = await ctx.db
			.query("googleCalendarWatchChannels")
			.withIndex("by_userId_calendarId", (q) =>
				q.eq("userId", args.userId).eq("calendarId", args.calendarId),
			)
			.collect();
		const latestForCalendar = existingByCalendar.sort((a, b) => b.updatedAt - a.updatedAt)[0];
		if (latestForCalendar) {
			await ctx.db.patch(latestForCalendar._id, {
				channelId: args.channelId,
				resourceId: args.resourceId,
				resourceUri: args.resourceUri,
				channelTokenHash: args.channelTokenHash,
				expirationAt: args.expirationAt,
				status: "active",
				updatedAt: now,
			});
			return latestForCalendar._id;
		}

		return await ctx.db.insert("googleCalendarWatchChannels", {
			userId: args.userId,
			calendarId: args.calendarId,
			channelId: args.channelId,
			resourceId: args.resourceId,
			resourceUri: args.resourceUri,
			channelTokenHash: args.channelTokenHash,
			expirationAt: args.expirationAt,
			status: "active",
			lastNotifiedAt: undefined,
			lastMessageNumber: undefined,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const deactivateWatchChannel = internalMutation({
	args: {
		watchChannelId: v.optional(v.id("googleCalendarWatchChannels")),
		channelId: v.optional(v.string()),
		status: v.optional(watchChannelStatusValidator),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const status = args.status ?? "stopped";
		let targetId = args.watchChannelId;
		if (!targetId && args.channelId) {
			const byChannelId = await ctx.db
				.query("googleCalendarWatchChannels")
				.withIndex("by_channelId", (q) => q.eq("channelId", args.channelId ?? ""))
				.unique();
			targetId = byChannelId?._id;
		}
		if (!targetId) return null;
		const existing = await ctx.db.get(targetId);
		if (!existing) return null;
		await ctx.db.patch(targetId, {
			status,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const recordWatchNotification = internalMutation({
	args: {
		watchChannelId: v.id("googleCalendarWatchChannels"),
		lastNotifiedAt: v.number(),
		lastMessageNumber: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const channel = await ctx.db.get(args.watchChannelId);
		if (!channel) return null;
		const currentMessageNumber = channel.lastMessageNumber ?? -1;
		const nextMessageNumber =
			typeof args.lastMessageNumber === "number"
				? Math.max(currentMessageNumber, args.lastMessageNumber)
				: channel.lastMessageNumber;
		await ctx.db.patch(args.watchChannelId, {
			lastNotifiedAt: args.lastNotifiedAt,
			lastMessageNumber: nextMessageNumber,
			updatedAt: Date.now(),
		});
		return null;
	},
});

const upsertSeriesForGoogleEvent = async (
	ctx: MutationCtx,
	userId: string,
	event: SyncEventInput,
	now: number,
	seriesCache: Map<string, Doc<"calendarEventSeries">>,
) => {
	const googleSeriesId = event.recurringEventId ?? event.googleEventId;
	const seriesCacheKey = `${event.calendarId}:${googleSeriesId}`;
	const cached = seriesCache.get(seriesCacheKey);
	if (cached) {
		return cached;
	}

	const existing = await ctx.db
		.query("calendarEventSeries")
		.withIndex("by_userId_calendarId_googleSeriesId", (q) =>
			q
				.eq("userId", userId)
				.eq("calendarId", event.calendarId)
				.eq("googleSeriesId", googleSeriesId),
		)
		.unique();

	const patch = {
		source: "google" as const,
		sourceId: event.googleEventId,
		calendarId: event.calendarId,
		googleSeriesId,
		title: event.title,
		description: event.description,
		allDay: event.allDay,
		recurrenceRule: event.recurrenceRule ?? existing?.recurrenceRule,
		status: event.status,
		busyStatus: event.busyStatus,
		visibility: event.visibility,
		location: event.location,
		color: event.color,
		etag: event.etag,
		lastSyncedAt: event.lastSyncedAt,
		updatedAt: now,
		isRecurring: Boolean(event.recurringEventId || event.recurrenceRule),
	};

	let series: Doc<"calendarEventSeries"> | null;
	if (existing) {
		await ctx.db.patch(existing._id, patch);
		series = await ctx.db.get(existing._id);
	} else {
		const insertedId = await ctx.db.insert("calendarEventSeries", {
			userId,
			...patch,
		});
		series = await ctx.db.get(insertedId);
	}

	if (!series) {
		throw new ConvexError({
			code: "SERIES_UPSERT_FAILED",
			message: "Unable to persist calendar event series.",
		});
	}

	seriesCache.set(seriesCacheKey, series);
	return series;
};

const performUpsertSyncedEventsForUser = async (
	ctx: MutationCtx,
	userId: string,
	args: {
		resetCalendars?: string[];
		events: Array<{
			googleEventId: string;
			title: string;
			description?: string;
			start: number;
			end: number;
			allDay: boolean;
			calendarId: string;
			recurrenceRule?: string;
			recurringEventId?: string;
			originalStartTime?: number;
			status?: "confirmed" | "tentative" | "cancelled";
			etag?: string;
			busyStatus: "free" | "busy" | "tentative";
			visibility?: "default" | "public" | "private" | "confidential";
			location?: string;
			color?: string;
			lastSyncedAt: number;
		}>;
		deletedEvents?: Array<{
			googleEventId: string;
			calendarId: string;
			originalStartTime?: number;
			lastSyncedAt: number;
		}>;
		nextSyncToken?: string;
		syncTokens?: Array<{ calendarId: string; syncToken: string }>;
		connectedCalendars?: Array<{
			calendarId: string;
			name: string;
			primary: boolean;
			color?: string;
			accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
			isExternal?: boolean;
		}>;
	},
) => {
	const now = Date.now();
	const seriesCache = new Map<string, Doc<"calendarEventSeries">>();

	if (args.resetCalendars?.length) {
		const resetCalendarIds = new Set(args.resetCalendars);
		const existingEvents = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
		for (const event of existingEvents) {
			if (event.source !== "google") continue;
			if (!resetCalendarIds.has(event.calendarId ?? "primary")) continue;
			await ctx.db.delete(event._id);
		}

		const existingSeries = await ctx.db
			.query("calendarEventSeries")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
		for (const series of existingSeries) {
			if (series.source !== "google") continue;
			if (!resetCalendarIds.has(series.calendarId ?? "primary")) continue;
			await ctx.db.delete(series._id);
		}
	}

	for (const event of args.events) {
		const series = await upsertSeriesForGoogleEvent(ctx, userId, event, now, seriesCache);
		const occurrenceStart = normalizeToMinute(event.originalStartTime ?? event.start);
		const isRecurringInstance = Boolean(event.recurringEventId);

		const seriesMatches = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_seriesId_occurrenceStart", (q) =>
				q
					.eq("userId", userId)
					.eq("seriesId", series._id as Id<"calendarEventSeries">)
					.eq("occurrenceStart", occurrenceStart),
			)
			.collect();
		const legacyMatches = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_calendarId_googleEventId", (q) =>
				q
					.eq("userId", userId)
					.eq("calendarId", event.calendarId)
					.eq("googleEventId", event.googleEventId),
			)
			.collect();
		const allMatches = [...seriesMatches, ...legacyMatches];
		const uniqueMatchesById = new Map<string, Doc<"calendarEvents">>();
		for (const match of allMatches) {
			uniqueMatchesById.set(String(match._id), match);
		}
		const orderedMatches = Array.from(uniqueMatchesById.values()).sort(
			(a, b) => recencyScore(b) - recencyScore(a),
		);
		const primary = orderedMatches[0];

		const isProtectedSource =
			primary && (primary.source === "task" || primary.source === "habit") && primary.sourceId;

		const occurrencePatch = {
			// For task/habit events, preserve identity fields (title, description, color)
			// so the task/habit remains the source of truth for these values.
			title: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.title,
			description: isProtectedSource
				? undefined
				: isRecurringInstance
					? undefined
					: event.description,
			start: event.start,
			end: event.end,
			allDay: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.allDay,
			updatedAt: now,
			// Preserve original source for task/habit events so scheduler continues to manage them.
			source: isProtectedSource ? (primary.source as "task" | "habit") : ("google" as const),
			sourceId: isProtectedSource ? primary.sourceId : event.googleEventId,
			calendarId: event.calendarId,
			googleEventId: event.googleEventId,
			recurrenceRule: isRecurringInstance ? undefined : event.recurrenceRule,
			recurringEventId: event.recurringEventId,
			originalStartTime: event.originalStartTime,
			seriesId: series._id,
			occurrenceStart,
			status: event.status,
			etag: event.etag,
			lastSyncedAt: event.lastSyncedAt,
			// Persist busy status on occurrences so scheduling can evaluate blocking events directly.
			busyStatus: event.busyStatus,
			visibility: isProtectedSource
				? undefined
				: isRecurringInstance
					? undefined
					: event.visibility,
			location: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.location,
			color: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.color,
		};

		if (primary) {
			// Detect move/resize for task events → pin to Google's new time
			if (primary.source === "task" && primary.sourceId) {
				const startChanged = primary.start !== event.start;
				const endChanged = primary.end !== event.end;
				if ((startChanged || endChanged) && !primary.sourceId.includes(":travel:")) {
					await ctx.db.patch(primary._id, { pinned: true });
				}
			}
			// Last-write-wins: if local was modified more recently than Google's update,
			// preserve local content and only update sync metadata.
			const localUpdatedAt = primary.updatedAt ?? primary._creationTime ?? 0;
			if (!isProtectedSource && localUpdatedAt > event.lastSyncedAt) {
				await ctx.db.patch(primary._id, {
					googleEventId: event.googleEventId,
					etag: event.etag,
					lastSyncedAt: event.lastSyncedAt,
					seriesId: series._id,
					occurrenceStart,
				});
			} else {
				await ctx.db.patch(primary._id, occurrencePatch);
			}
			for (const duplicate of orderedMatches.slice(1)) {
				await ctx.db.delete(duplicate._id);
			}
		} else {
			await ctx.db.insert("calendarEvents", {
				userId,
				...occurrencePatch,
			});
		}
	}

	let needsReschedule = false;
	for (const deletedEvent of args.deletedEvents ?? []) {
		const existingMatches = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_calendarId_googleEventId", (q) =>
				q
					.eq("userId", userId)
					.eq("calendarId", deletedEvent.calendarId)
					.eq("googleEventId", deletedEvent.googleEventId),
			)
			.collect();

		for (const existingEvent of existingMatches) {
			if (
				deletedEvent.originalStartTime !== undefined &&
				(existingEvent.originalStartTime ?? existingEvent.start) !== deletedEvent.originalStartTime
			) {
				continue;
			}

			if (
				(existingEvent.source === "task" || existingEvent.source === "habit") &&
				existingEvent.sourceId
			) {
				// Task/habit event deleted in Google → unlink from Google, trigger reschedule.
				// The scheduler will create a new event at the next available time.
				await ctx.db.patch(existingEvent._id, {
					googleEventId: undefined,
					etag: undefined,
					lastSyncedAt: undefined,
					status: "cancelled",
					updatedAt: now,
				});
				needsReschedule = true;
			} else {
				// Manual or Google-originated event → delete locally
				await ctx.db.delete(existingEvent._id);
			}
		}
	}

	if (needsReschedule) {
		await enqueueSchedulingRunFromMutation(ctx, {
			userId,
			triggeredBy: "calendar_change",
		});
	}

	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();

	if (settings) {
		const resetCalendarIds = new Set(args.resetCalendars ?? []);
		const existingSyncTokens = (settings.googleCalendarSyncTokens ?? []).filter(
			(token) => !resetCalendarIds.has(token.calendarId),
		);
		const mergedSyncTokensByCalendarId = new Map(
			existingSyncTokens.map((token) => [token.calendarId, token] as const),
		);
		for (const token of args.syncTokens ?? []) {
			mergedSyncTokensByCalendarId.set(token.calendarId, token);
		}
		const nextSyncTokens = Array.from(mergedSyncTokensByCalendarId.values());
		const nextPrimaryToken =
			args.nextSyncToken ??
			mergedSyncTokensByCalendarId.get("primary")?.syncToken ??
			(resetCalendarIds.has("primary") ? undefined : settings.googleSyncToken);

		const defaultTaskSchedulingMode = sanitizeTaskSchedulingMode(
			(settings as { defaultTaskSchedulingMode?: string }).defaultTaskSchedulingMode,
		);
		const taskQuickCreateDefaults = normalizeTaskQuickCreateDefaultsForSettings(settings);
		await ctx.db.replace(settings._id, {
			userId: settings.userId,
			timezone: normalizeTimeZone(settings.timezone),
			timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(settings),
			defaultTaskSchedulingMode,
			...taskQuickCreateDefaults,
			schedulingHorizonDays: settings.schedulingHorizonDays ?? 75,
			schedulingDowntimeMinutes: normalizeSchedulingDowntimeMinutes(
				settings.schedulingDowntimeMinutes,
			),
			schedulingStepMinutes: normalizedSchedulingStepMinutesFromSettings(settings),
			schedulingModelVersion: settings.schedulingModelVersion,
			hoursBootstrapped: settings.hoursBootstrapped,
			googleRefreshToken: settings.googleRefreshToken,
			googleSyncToken: nextPrimaryToken,
			googleCalendarSyncTokens: nextSyncTokens,
			googleConnectedCalendars: args.connectedCalendars ?? settings.googleConnectedCalendars,
		});
	}

	return { upserted: args.events.length };
};

export const upsertGoogleTokens = mutation({
	args: {
		refreshToken: v.string(),
		syncToken: v.optional(v.string()),
	},
	returns: v.id("userSettings"),
	handler: withMutationAuth(async (ctx, args: UpsertGoogleTokensArgs) => {
		const { userId } = ctx;
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique();

		if (existing) {
			const nextCalendarSyncTokens = args.syncToken
				? (() => {
						const tokensByCalendarId = new Map(
							(existing.googleCalendarSyncTokens ?? []).map(
								(token) => [token.calendarId, token] as const,
							),
						);
						tokensByCalendarId.set("primary", {
							calendarId: "primary",
							syncToken: args.syncToken,
						});
						return Array.from(tokensByCalendarId.values());
					})()
				: (existing.googleCalendarSyncTokens ?? []);
			const defaultTaskSchedulingMode = sanitizeTaskSchedulingMode(
				(existing as { defaultTaskSchedulingMode?: string }).defaultTaskSchedulingMode,
			);
			await ctx.db.replace(existing._id, {
				userId: existing.userId,
				timezone: normalizeTimeZone(existing.timezone),
				timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(existing),
				defaultTaskSchedulingMode,
				...normalizeTaskQuickCreateDefaultsForSettings(existing),
				schedulingHorizonDays: existing.schedulingHorizonDays ?? 75,
				schedulingDowntimeMinutes: normalizeSchedulingDowntimeMinutes(
					existing.schedulingDowntimeMinutes,
				),
				schedulingStepMinutes: normalizedSchedulingStepMinutesFromSettings(existing),
				schedulingModelVersion: existing.schedulingModelVersion,
				hoursBootstrapped: existing.hoursBootstrapped,
				googleRefreshToken: args.refreshToken,
				googleSyncToken: args.syncToken ?? existing.googleSyncToken,
				googleCalendarSyncTokens: nextCalendarSyncTokens,
				googleConnectedCalendars: existing.googleConnectedCalendars,
			});
			await ctx.scheduler.runAfter(0, internal.calendar.mutations.enqueueGoogleSyncRun, {
				userId,
				triggeredBy: "oauth_connect",
			});
			await ctx.scheduler.runAfter(0, internal.calendar.actions.ensureWatchChannelsForUser, {
				userId,
			});
			return existing._id;
		}

		const insertedId = await ctx.db.insert("userSettings", {
			userId,
			timezone: normalizeTimeZone(undefined),
			timeFormatPreference: normalizedTimeFormatPreferenceFromSettings({}),
			defaultTaskSchedulingMode: "fastest",
			...normalizeTaskQuickCreateDefaultsForSettings({}),
			schedulingHorizonDays: 75,
			schedulingDowntimeMinutes: normalizeSchedulingDowntimeMinutes(undefined),
			schedulingStepMinutes: defaultSchedulingStepMinutes,
			googleRefreshToken: args.refreshToken,
			googleSyncToken: args.syncToken,
			googleCalendarSyncTokens: [],
		});
		await ctx.scheduler.runAfter(0, internal.calendar.mutations.enqueueGoogleSyncRun, {
			userId,
			triggeredBy: "oauth_connect",
		});
		await ctx.scheduler.runAfter(0, internal.calendar.actions.ensureWatchChannelsForUser, {
			userId,
		});
		return insertedId;
	}),
});

export const createEvent = mutation({
	args: {
		input: v.object({
			title: v.string(),
			description: v.optional(v.string()),
			start: v.number(),
			end: v.number(),
			allDay: v.optional(v.boolean()),
			recurrenceRule: v.optional(v.string()),
			calendarId: v.optional(v.string()),
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
		}),
	},
	returns: v.id("calendarEvents"),
	handler: withMutationAuth(async (ctx, args: CreateEventArgs) => {
		const { userId } = ctx;
		const now = Date.now();
		const allDay = args.input.allDay ?? false;
		const calendarId = args.input.calendarId ?? "primary";
		const busyStatus = args.input.busyStatus ?? "busy";
		const visibility = args.input.visibility ?? "default";

		const seriesId = await ctx.db.insert("calendarEventSeries", {
			userId,
			source: "manual",
			sourceId: undefined,
			calendarId,
			googleSeriesId: undefined,
			title: args.input.title,
			description: args.input.description,
			allDay,
			recurrenceRule: args.input.recurrenceRule,
			status: "confirmed",
			busyStatus,
			visibility,
			location: args.input.location,
			color: args.input.color,
			etag: undefined,
			lastSyncedAt: undefined,
			updatedAt: now,
			isRecurring: Boolean(args.input.recurrenceRule),
		});

		const eventId = await ctx.db.insert("calendarEvents", {
			userId,
			title: undefined,
			description: undefined,
			start: args.input.start,
			end: args.input.end,
			allDay: undefined,
			updatedAt: now,
			source: "manual",
			sourceId: undefined,
			googleEventId: undefined,
			calendarId,
			recurrenceRule: undefined,
			recurringEventId: undefined,
			originalStartTime: undefined,
			seriesId,
			occurrenceStart: normalizeToMinute(args.input.start),
			status: "confirmed",
			etag: undefined,
			lastSyncedAt: undefined,
			busyStatus,
			visibility: undefined,
			location: undefined,
			color: undefined,
		});
		await enqueueSchedulingRunFromMutation(ctx, {
			userId,
			triggeredBy: "calendar_change",
		});
		return eventId;
	}),
});

export const updateEvent = mutation({
	args: {
		id: v.id("calendarEvents"),
		patch: v.object({
			title: v.optional(v.string()),
			description: v.optional(v.string()),
			start: v.optional(v.number()),
			end: v.optional(v.number()),
			allDay: v.optional(v.boolean()),
			recurrenceRule: v.optional(v.string()),
			calendarId: v.optional(v.string()),
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
		}),
		scope: v.optional(recurrenceScopeValidator),
	},
	returns: v.object({
		id: v.id("calendarEvents"),
		scope: recurrenceScopeValidator,
	}),
	handler: withMutationAuth(async (ctx, args: UpdateEventArgs) => {
		const { userId } = ctx;
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Event not found.",
			});
		}

		const scope = (args.scope ?? "single") as RecurrenceEditScope;
		const series = event.seriesId ? await ctx.db.get(event.seriesId) : null;
		const now = Date.now();

		if (series && scope !== "single") {
			await ctx.db.patch(series._id, {
				title: args.patch.title ?? series.title,
				description: args.patch.description ?? series.description,
				allDay: args.patch.allDay ?? series.allDay,
				recurrenceRule: args.patch.recurrenceRule ?? series.recurrenceRule,
				calendarId: args.patch.calendarId ?? series.calendarId,
				busyStatus: args.patch.busyStatus ?? series.busyStatus,
				visibility: args.patch.visibility ?? series.visibility,
				location: args.patch.location ?? series.location,
				color: args.patch.color ?? series.color,
				updatedAt: now,
			});
		}

		const nextStart = args.patch.start ?? event.start;
		const occurrencePatch: Partial<Doc<"calendarEvents">> = {
			start: nextStart,
			end: args.patch.end ?? event.end,
			updatedAt: now,
			occurrenceStart: normalizeToMinute(nextStart),
		};

		if (scope === "single" || !series) {
			if (args.patch.title !== undefined) occurrencePatch.title = args.patch.title;
			if (args.patch.description !== undefined)
				occurrencePatch.description = args.patch.description;
			if (args.patch.allDay !== undefined) occurrencePatch.allDay = args.patch.allDay;
			if (args.patch.recurrenceRule !== undefined) {
				occurrencePatch.recurrenceRule = args.patch.recurrenceRule;
			}
			if (args.patch.calendarId !== undefined) occurrencePatch.calendarId = args.patch.calendarId;
			if (args.patch.busyStatus !== undefined) occurrencePatch.busyStatus = args.patch.busyStatus;
			if (args.patch.visibility !== undefined) occurrencePatch.visibility = args.patch.visibility;
			if (args.patch.location !== undefined) occurrencePatch.location = args.patch.location;
			if (args.patch.color !== undefined) occurrencePatch.color = args.patch.color;
		}

		await ctx.db.patch(args.id, occurrencePatch);

		if (series && scope !== "single" && args.patch.calendarId !== undefined) {
			const baseOccurrenceStart = event.occurrenceStart ?? normalizeToMinute(event.start);
			const seriesEvents = await ctx.db
				.query("calendarEvents")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.filter((q) => q.eq(q.field("seriesId"), event.seriesId))
				.collect();

			for (const seriesEvent of seriesEvents) {
				const seriesOccurrenceStart =
					seriesEvent.occurrenceStart ?? normalizeToMinute(seriesEvent.start);
				if (scope === "following" && seriesOccurrenceStart < baseOccurrenceStart) {
					continue;
				}
				if (seriesEvent._id === args.id) continue;
				await ctx.db.patch(seriesEvent._id, {
					calendarId: args.patch.calendarId,
					updatedAt: now,
				});
			}
		}
		await enqueueSchedulingRunFromMutation(ctx, {
			userId,
			triggeredBy: "calendar_change",
		});
		return { id: args.id, scope };
	}),
});

export const deleteEvent = mutation({
	args: {
		id: v.id("calendarEvents"),
		scope: v.optional(recurrenceScopeValidator),
	},
	returns: v.object({
		scope: recurrenceScopeValidator,
	}),
	handler: withMutationAuth(async (ctx, args: DeleteEventArgs) => {
		const { userId } = ctx;
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Event not found.",
			});
		}

		await ctx.db.delete(args.id);
		await enqueueSchedulingRunFromMutation(ctx, {
			userId,
			triggeredBy: "calendar_change",
		});
		return { scope: (args.scope ?? "single") as RecurrenceEditScope };
	}),
});

export const moveResizeEvent = mutation({
	args: {
		id: v.id("calendarEvents"),
		start: v.number(),
		end: v.number(),
		scope: v.optional(recurrenceScopeValidator),
	},
	returns: v.object({
		id: v.id("calendarEvents"),
		scope: recurrenceScopeValidator,
	}),
	handler: withMutationAuth(async (ctx, args: MoveResizeEventArgs) => {
		const { userId } = ctx;
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Event not found.",
			});
		}

		const scope = (args.scope ?? "single") as RecurrenceEditScope;
		const now = Date.now();
		if (scope === "single" || !event.seriesId) {
			await ctx.db.patch(args.id, {
				start: args.start,
				end: args.end,
				updatedAt: now,
				occurrenceStart: normalizeToMinute(args.start),
			});
			// Auto-pin task event when dragged locally
			if (event.source === "task" && event.sourceId && !event.sourceId.includes(":travel:")) {
				await ctx.db.patch(args.id, { pinned: true });
			}
			await enqueueSchedulingRunFromMutation(ctx, {
				userId,
				triggeredBy: "calendar_change",
			});
			return { id: args.id, scope };
		}

		const baseOccurrenceStart = event.occurrenceStart ?? normalizeToMinute(event.start);
		const deltaStart = args.start - event.start;
		const deltaEnd = args.end - event.end;
		const seriesEvents = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("seriesId"), event.seriesId))
			.collect();

		for (const seriesEvent of seriesEvents) {
			const seriesOccurrenceStart =
				seriesEvent.occurrenceStart ?? normalizeToMinute(seriesEvent.start);
			if (scope === "following" && seriesOccurrenceStart < baseOccurrenceStart) {
				continue;
			}

			const nextStart = seriesEvent.start + deltaStart;
			const nextEnd = seriesEvent.end + deltaEnd;
			await ctx.db.patch(seriesEvent._id, {
				start: nextStart,
				end: nextEnd,
				updatedAt: now,
				occurrenceStart: normalizeToMinute(nextStart),
			});
		}

		const series = await ctx.db.get(event.seriesId);
		if (series) {
			await ctx.db.patch(series._id, {
				updatedAt: now,
			});
		}
		await enqueueSchedulingRunFromMutation(ctx, {
			userId,
			triggeredBy: "calendar_change",
		});

		return { id: args.id, scope };
	}),
});

export const upsertSyncedEventsForUser = internalMutation({
	args: {
		userId: v.string(),
		...syncArgsValidator,
	},
	returns: v.object({
		upserted: v.number(),
	}),
	handler: async (ctx, args) => {
		const result = await performUpsertSyncedEventsForUser(ctx, args.userId, args);
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: args.userId,
			triggeredBy: "calendar_change",
		});
		return result;
	},
});

/**
 * Lightweight batch mutation that only upserts a subset of events.
 * Called from actions that split large syncs into smaller transactions
 * to avoid OCC (Optimistic Concurrency Control) failures.
 */
export const upsertSyncedEventsBatch = internalMutation({
	args: {
		userId: v.string(),
		events: v.array(syncEventValidator),
	},
	returns: v.object({ upserted: v.number() }),
	handler: async (ctx, args) => {
		const now = Date.now();
		const seriesCache = new Map<string, Doc<"calendarEventSeries">>();

		for (const event of args.events) {
			const series = await upsertSeriesForGoogleEvent(ctx, args.userId, event, now, seriesCache);
			const occurrenceStart = normalizeToMinute(event.originalStartTime ?? event.start);
			const isRecurringInstance = Boolean(event.recurringEventId);

			const seriesMatches = await ctx.db
				.query("calendarEvents")
				.withIndex("by_userId_seriesId_occurrenceStart", (q) =>
					q
						.eq("userId", args.userId)
						.eq("seriesId", series._id as Id<"calendarEventSeries">)
						.eq("occurrenceStart", occurrenceStart),
				)
				.collect();
			const legacyMatches = await ctx.db
				.query("calendarEvents")
				.withIndex("by_userId_calendarId_googleEventId", (q) =>
					q
						.eq("userId", args.userId)
						.eq("calendarId", event.calendarId)
						.eq("googleEventId", event.googleEventId),
				)
				.collect();
			const allMatches = [...seriesMatches, ...legacyMatches];
			const uniqueMatchesById = new Map<string, Doc<"calendarEvents">>();
			for (const match of allMatches) {
				uniqueMatchesById.set(String(match._id), match);
			}
			const orderedMatches = Array.from(uniqueMatchesById.values()).sort(
				(a, b) => recencyScore(b) - recencyScore(a),
			);
			const primary = orderedMatches[0];

			const isProtectedSource =
				primary && (primary.source === "task" || primary.source === "habit") && primary.sourceId;

			const occurrencePatch = {
				title: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.title,
				description: isProtectedSource
					? undefined
					: isRecurringInstance
						? undefined
						: event.description,
				start: event.start,
				end: event.end,
				allDay: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.allDay,
				updatedAt: now,
				source: isProtectedSource ? (primary.source as "task" | "habit") : ("google" as const),
				sourceId: isProtectedSource ? primary.sourceId : event.googleEventId,
				calendarId: event.calendarId,
				googleEventId: event.googleEventId,
				recurrenceRule: isRecurringInstance ? undefined : event.recurrenceRule,
				recurringEventId: event.recurringEventId,
				originalStartTime: event.originalStartTime,
				seriesId: series._id,
				occurrenceStart,
				status: event.status,
				etag: event.etag,
				lastSyncedAt: event.lastSyncedAt,
				busyStatus: event.busyStatus,
				visibility: isProtectedSource
					? undefined
					: isRecurringInstance
						? undefined
						: event.visibility,
				location: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.location,
				color: isProtectedSource ? undefined : isRecurringInstance ? undefined : event.color,
			};

			if (primary) {
				// Detect move/resize for task events → pin to Google's new time
				if (primary.source === "task" && primary.sourceId) {
					const startChanged = primary.start !== event.start;
					const endChanged = primary.end !== event.end;
					if ((startChanged || endChanged) && !primary.sourceId.includes(":travel:")) {
						await ctx.db.patch(primary._id, { pinned: true });
					}
				}
				const localUpdatedAt = primary.updatedAt ?? primary._creationTime ?? 0;
				if (!isProtectedSource && localUpdatedAt > event.lastSyncedAt) {
					await ctx.db.patch(primary._id, {
						googleEventId: event.googleEventId,
						etag: event.etag,
						lastSyncedAt: event.lastSyncedAt,
						seriesId: series._id,
						occurrenceStart,
					});
				} else {
					await ctx.db.patch(primary._id, occurrencePatch);
				}
				for (const duplicate of orderedMatches.slice(1)) {
					await ctx.db.delete(duplicate._id);
				}
			} else {
				await ctx.db.insert("calendarEvents", {
					userId: args.userId,
					...occurrencePatch,
				});
			}
		}

		return { upserted: args.events.length };
	},
});

export const setEventPinned = mutation({
	args: {
		id: v.id("calendarEvents"),
		pinned: v.boolean(),
	},
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: { id: Id<"calendarEvents">; pinned: boolean }) => {
		const { userId } = ctx;
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Event not found." });
		}
		if (event.source !== "task" && event.source !== "habit") {
			throw new ConvexError({
				code: "INVALID_SOURCE",
				message: "Only task or habit events can be pinned.",
			});
		}
		if (event.sourceId?.includes(":travel:")) {
			throw new ConvexError({
				code: "INVALID_SOURCE",
				message: "Travel blocks cannot be pinned directly.",
			});
		}
		await ctx.db.patch(args.id, { pinned: args.pinned, updatedAt: Date.now() });
		await enqueueSchedulingRunFromMutation(ctx, {
			userId,
			triggeredBy: "calendar_change",
		});
		return null;
	}),
});

export const pinAllTaskEvents = mutation({
	args: {
		taskId: v.string(),
		pinned: v.boolean(),
	},
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: { taskId: string; pinned: boolean }) => {
		const { userId } = ctx;
		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_source_sourceId", (q) =>
				q.eq("userId", userId).eq("source", "task").eq("sourceId", args.taskId),
			)
			.collect();

		const now = Date.now();
		for (const event of events) {
			if (event.sourceId?.includes(":travel:")) continue;
			if (event.status === "cancelled") continue;
			await ctx.db.patch(event._id, { pinned: args.pinned, updatedAt: now });
		}

		await enqueueSchedulingRunFromMutation(ctx, {
			userId,
			triggeredBy: "calendar_change",
		});
		return null;
	}),
});
