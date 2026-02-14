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
import { shouldDispatchBackgroundWork } from "../runtime";
import { enqueueSchedulingRunFromMutation } from "../scheduling/enqueue";
import type {
	BusyStatus,
	CreateEventArgs,
	DeleteEventArgs,
	MoveResizeEventArgs,
	SyncEventInput,
	UpdateEventArgs,
	UpdateEventPatch,
	UpsertGoogleTokensArgs,
	UpsertMatchContext,
	Visibility,
} from "./mutationTypes";

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

/**
 * Computes event recency for deterministic upsert/dedupe ordering.
 */
const recencyScore = (event: Doc<"calendarEvents">) =>
	Math.max(event.lastSyncedAt ?? 0, event.updatedAt ?? 0, event._creationTime ?? 0);

/**
 * Normalizes optional calendar ids into a concrete local key.
 */
const resolvePrimaryCalendarId = (calendarId: string | undefined) => calendarId ?? "primary";

/**
 * Builds all known aliases for the user's primary calendar.
 */
const buildPrimaryCalendarAliases = (
	connectedCalendars?: Array<{
		calendarId: string;
		primary: boolean;
	}>,
) => {
	const aliases = new Set<string>(["primary"]);
	for (const calendar of connectedCalendars ?? []) {
		if (!calendar.primary) continue;
		if (!calendar.calendarId) continue;
		aliases.add(calendar.calendarId);
	}
	return aliases;
};

/**
 * Resolves matching calendar ids while respecting primary-alias equivalence.
 */
const resolveMatchCalendarIds = (calendarId: string, primaryCalendarAliases: Set<string>) => {
	if (!calendarId) return ["primary"];
	if (primaryCalendarAliases.has(calendarId)) {
		return Array.from(primaryCalendarAliases);
	}
	return [calendarId];
};

const findLegacyMatches = async (
	ctx: MutationCtx,
	userId: string,
	calendarId: string,
	googleEventId: string,
	primaryCalendarAliases: Set<string>,
) => {
	const matchCalendarIds = resolveMatchCalendarIds(calendarId, primaryCalendarAliases);
	const matchesByCalendar = await Promise.all(
		matchCalendarIds.map((matchCalendarId) =>
			ctx.db
				.query("calendarEvents")
				.withIndex("by_userId_calendarId_googleEventId", (q) =>
					q
						.eq("userId", userId)
						.eq("calendarId", matchCalendarId)
						.eq("googleEventId", googleEventId),
				)
				.collect(),
		),
	);
	return matchesByCalendar.flat();
};

const isProtectedSourceEvent = (event: Doc<"calendarEvents">) =>
	(event.source === "task" || event.source === "habit") && Boolean(event.sourceId);

const sortUpsertMatches = (a: Doc<"calendarEvents">, b: Doc<"calendarEvents">) => {
	const aProtected = isProtectedSourceEvent(a) ? 1 : 0;
	const bProtected = isProtectedSourceEvent(b) ? 1 : 0;
	if (aProtected !== bProtected) {
		return bProtected - aProtected;
	}
	return recencyScore(b) - recencyScore(a);
};

const findProtectedFingerprintMatches = async (
	ctx: MutationCtx,
	userId: string,
	event: {
		title: string;
		start: number;
		end: number;
		allDay: boolean;
		calendarId: string;
	},
	primaryCalendarAliases: Set<string>,
) => {
	const matchCalendarIds = new Set(
		resolveMatchCalendarIds(event.calendarId, primaryCalendarAliases),
	);
	const [taskCandidates, habitCandidates] = await Promise.all([
		ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_start_source", (q) =>
				q.eq("userId", userId).eq("start", event.start).eq("source", "task"),
			)
			.collect(),
		ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_start_source", (q) =>
				q.eq("userId", userId).eq("start", event.start).eq("source", "habit"),
			)
			.collect(),
	]);
	const candidates = [...taskCandidates, ...habitCandidates];
	return candidates.filter((candidate) => {
		if (!isProtectedSourceEvent(candidate)) return false;
		if (candidate.end !== event.end) return false;
		if (candidate.title !== event.title) return false;
		if (Boolean(candidate.allDay) !== event.allDay) return false;
		const candidateCalendarId = resolvePrimaryCalendarId(candidate.calendarId);
		return matchCalendarIds.has(candidateCalendarId);
	});
};

const findProtectedSourceIdMatches = async (
	ctx: MutationCtx,
	userId: string,
	appSourceKey?: string,
) => {
	if (!appSourceKey) return [];
	const [taskMatches, habitMatches] = await Promise.all([
		ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_source_sourceId", (q) =>
				q.eq("userId", userId).eq("source", "task").eq("sourceId", appSourceKey),
			)
			.collect(),
		ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_source_sourceId", (q) =>
				q.eq("userId", userId).eq("source", "habit").eq("sourceId", appSourceKey),
			)
			.collect(),
	]);
	return [...taskMatches, ...habitMatches].filter(isProtectedSourceEvent);
};

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
	appSourceKey: v.optional(v.string()),
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
const GOOGLE_SYNC_DEBOUNCE_WINDOW_MS = 15 * 1000;

export const enqueueGoogleSyncRun = internalMutation({
	args: {
		userId: v.string(),
		triggeredBy: googleSyncRunTriggerValidator,
		force: v.optional(v.boolean()),
	},
	returns: v.object({
		enqueued: v.boolean(),
		runId: v.id("googleSyncRuns"),
		reason: v.union(
			v.literal("enqueued"),
			v.literal("already_pending"),
			v.literal("debounced_running"),
		),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		enqueued: boolean;
		runId: Id<"googleSyncRuns">;
		reason: "enqueued" | "already_pending" | "debounced_running";
	}> => {
		const now = Date.now();
		const latestPending = (
			await ctx.db
				.query("googleSyncRuns")
				.withIndex("by_userId_status_startedAt", (q) =>
					q.eq("userId", args.userId).eq("status", "pending"),
				)
				.order("desc")
				.take(1)
		)[0];
		if (latestPending && !args.force) {
			return {
				enqueued: false,
				runId: latestPending._id,
				reason: "already_pending",
			};
		}

		const latestRunning = (
			await ctx.db
				.query("googleSyncRuns")
				.withIndex("by_userId_status_startedAt", (q) =>
					q
						.eq("userId", args.userId)
						.eq("status", "running")
						.gte("startedAt", now - GOOGLE_SYNC_DEBOUNCE_WINDOW_MS),
				)
				.order("desc")
				.take(1)
		)[0];
		if (
			latestRunning &&
			latestRunning.triggeredBy === args.triggeredBy &&
			now - latestRunning.startedAt < GOOGLE_SYNC_DEBOUNCE_WINDOW_MS &&
			!args.force
		) {
			return {
				enqueued: false,
				runId: latestRunning._id,
				reason: "debounced_running",
			};
		}

		const runId = await ctx.db.insert("googleSyncRuns", {
			userId: args.userId,
			triggeredBy: args.triggeredBy,
			status: "pending",
			startedAt: now,
		});

		if (shouldDispatchBackgroundWork()) {
			await ctx.scheduler.runAfter(0, internal.calendar.actions.syncFromGoogleForUser, {
				runId,
				userId: args.userId,
				triggeredBy: args.triggeredBy,
			});
		}

		return {
			enqueued: true,
			runId,
			reason: "enqueued",
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
	returns: v.object({
		shouldEnqueue: v.boolean(),
		reason: v.union(v.literal("accepted"), v.literal("duplicate_message")),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		shouldEnqueue: boolean;
		reason: "accepted" | "duplicate_message";
	}> => {
		const channel = await ctx.db.get(args.watchChannelId);
		if (!channel) {
			return {
				shouldEnqueue: false,
				reason: "duplicate_message",
			};
		}
		const currentMessageNumber = channel.lastMessageNumber ?? -1;
		if (
			typeof args.lastMessageNumber === "number" &&
			args.lastMessageNumber <= currentMessageNumber
		) {
			return {
				shouldEnqueue: false,
				reason: "duplicate_message",
			};
		}
		const nextMessageNumber =
			typeof args.lastMessageNumber === "number"
				? Math.max(currentMessageNumber, args.lastMessageNumber)
				: channel.lastMessageNumber;
		await ctx.db.patch(args.watchChannelId, {
			lastNotifiedAt: args.lastNotifiedAt,
			lastMessageNumber: nextMessageNumber,
			updatedAt: Date.now(),
		});
		return {
			shouldEnqueue: true,
			reason: "accepted",
		};
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

const collectUpsertMatchContext = async (
	ctx: MutationCtx,
	userId: string,
	event: SyncEventInput,
	seriesId: Id<"calendarEventSeries">,
	occurrenceStart: number,
	primaryCalendarAliases: Set<string>,
): Promise<UpsertMatchContext> => {
	const seriesMatches = await ctx.db
		.query("calendarEvents")
		.withIndex("by_userId_seriesId_occurrenceStart", (q) =>
			q.eq("userId", userId).eq("seriesId", seriesId).eq("occurrenceStart", occurrenceStart),
		)
		.collect();
	const legacyMatches = await findLegacyMatches(
		ctx,
		userId,
		event.calendarId,
		event.googleEventId,
		primaryCalendarAliases,
	);
	const protectedFingerprintMatches = await findProtectedFingerprintMatches(
		ctx,
		userId,
		event,
		primaryCalendarAliases,
	);
	const protectedSourceIdMatches = await findProtectedSourceIdMatches(
		ctx,
		userId,
		event.appSourceKey,
	);

	const uniqueMatchesById = new Map<string, Doc<"calendarEvents">>();
	for (const match of [
		...seriesMatches,
		...legacyMatches,
		...protectedFingerprintMatches,
		...protectedSourceIdMatches,
	]) {
		uniqueMatchesById.set(String(match._id), match);
	}

	const orderedMatches = Array.from(uniqueMatchesById.values()).sort(sortUpsertMatches);
	const primary = orderedMatches[0];
	const primaryId = primary ? String(primary._id) : null;

	return {
		seriesMatches,
		legacyMatches,
		protectedFingerprintMatches,
		protectedSourceIdMatches,
		orderedMatches,
		primary,
		matchedPrimaryBySeries:
			primaryId !== null && seriesMatches.some((match) => String(match._id) === primaryId),
		matchedPrimaryByLegacy:
			primaryId !== null && legacyMatches.some((match) => String(match._id) === primaryId),
		matchedPrimaryByProtectedFingerprint:
			primaryId !== null &&
			protectedFingerprintMatches.some((match) => String(match._id) === primaryId),
		matchedPrimaryByProtectedSourceId:
			primaryId !== null &&
			protectedSourceIdMatches.some((match) => String(match._id) === primaryId),
	};
};

const resolveGoogleEventIdForUpsert = (
	primary: Doc<"calendarEvents"> | undefined,
	event: SyncEventInput,
	matchedPrimaryBySeries: boolean,
	matchedPrimaryByLegacy: boolean,
	matchedPrimaryByProtectedFingerprint: boolean,
	matchedPrimaryByProtectedSourceId: boolean,
) => {
	const isProtectedSource = Boolean(
		primary && (primary.source === "task" || primary.source === "habit") && primary.sourceId,
	);
	const preserveProtectedGoogleEventId = Boolean(
		isProtectedSource &&
			primary?.googleEventId &&
			primary.googleEventId !== event.googleEventId &&
			!matchedPrimaryBySeries &&
			!matchedPrimaryByLegacy &&
			(matchedPrimaryByProtectedFingerprint || matchedPrimaryByProtectedSourceId),
	);

	return {
		isProtectedSource,
		preserveProtectedGoogleEventId,
		resolvedGoogleEventId: preserveProtectedGoogleEventId
			? primary?.googleEventId
			: event.googleEventId,
	};
};

/**
 * Resolves occurrence fields using protected-source precedence and recurring-instance sparsity.
 */
const resolveProtectedOrRecurringValue = <T>({
	isProtectedSource,
	protectedValue,
	isRecurringInstance,
	eventValue,
}: {
	isProtectedSource: boolean;
	protectedValue: T | undefined;
	isRecurringInstance: boolean;
	eventValue: T | undefined;
}): T | undefined => {
	if (isProtectedSource) return protectedValue;
	if (isRecurringInstance) return undefined;
	return eventValue;
};

const buildOccurrencePatch = ({
	event,
	primary,
	seriesId,
	occurrenceStart,
	now,
	isProtectedSource,
}: {
	event: SyncEventInput;
	primary: Doc<"calendarEvents"> | undefined;
	seriesId: Id<"calendarEventSeries">;
	occurrenceStart: number;
	now: number;
	isProtectedSource: boolean;
}) => {
	const isRecurringInstance = Boolean(event.recurringEventId);
	const source: "task" | "habit" | "google" =
		isProtectedSource && primary && (primary.source === "task" || primary.source === "habit")
			? primary.source
			: "google";
	return {
		title: resolveProtectedOrRecurringValue({
			isProtectedSource,
			protectedValue: primary?.title,
			isRecurringInstance,
			eventValue: event.title,
		}),
		description: resolveProtectedOrRecurringValue({
			isProtectedSource,
			protectedValue: primary?.description,
			isRecurringInstance,
			eventValue: event.description,
		}),
		start: event.start,
		end: event.end,
		allDay: resolveProtectedOrRecurringValue({
			isProtectedSource,
			protectedValue: primary?.allDay,
			isRecurringInstance,
			eventValue: event.allDay,
		}),
		updatedAt: now,
		source,
		sourceId: isProtectedSource ? primary?.sourceId : event.googleEventId,
		calendarId: event.calendarId,
		recurrenceRule: isProtectedSource
			? undefined
			: resolveProtectedOrRecurringValue({
					isProtectedSource,
					protectedValue: primary?.recurrenceRule,
					isRecurringInstance,
					eventValue: event.recurrenceRule,
				}),
		recurringEventId: isProtectedSource ? undefined : event.recurringEventId,
		originalStartTime: isProtectedSource ? undefined : event.originalStartTime,
		seriesId: isProtectedSource ? undefined : seriesId,
		occurrenceStart,
		status: event.status,
		etag: event.etag,
		lastSyncedAt: event.lastSyncedAt,
		busyStatus: event.busyStatus,
		visibility: resolveProtectedOrRecurringValue({
			isProtectedSource,
			protectedValue: primary?.visibility,
			isRecurringInstance,
			eventValue: event.visibility,
		}),
		location: resolveProtectedOrRecurringValue({
			isProtectedSource,
			protectedValue: primary?.location,
			isRecurringInstance,
			eventValue: event.location,
		}),
		color: resolveProtectedOrRecurringValue({
			isProtectedSource,
			protectedValue: primary?.color,
			isRecurringInstance,
			eventValue: event.color,
		}),
	};
};

const upsertSingleSyncedEvent = async ({
	ctx,
	userId,
	event,
	now,
	seriesCache,
	primaryCalendarAliases,
	log,
}: {
	ctx: MutationCtx;
	userId: string;
	event: SyncEventInput;
	now: number;
	seriesCache: Map<string, Doc<"calendarEventSeries">>;
	primaryCalendarAliases: Set<string>;
	log?: (tag: string, payload: Record<string, unknown>) => void;
}): Promise<{ scheduleImpact: boolean }> => {
	const series = await upsertSeriesForGoogleEvent(ctx, userId, event, now, seriesCache);
	const occurrenceStart = normalizeToMinute(event.originalStartTime ?? event.start);
	const matchContext = await collectUpsertMatchContext(
		ctx,
		userId,
		event,
		series._id,
		occurrenceStart,
		primaryCalendarAliases,
	);
	const {
		seriesMatches,
		legacyMatches,
		protectedFingerprintMatches,
		protectedSourceIdMatches,
		orderedMatches,
		primary,
		matchedPrimaryBySeries,
		matchedPrimaryByLegacy,
		matchedPrimaryByProtectedFingerprint,
		matchedPrimaryByProtectedSourceId,
	} = matchContext;

	log?.("[sync:upsert]", {
		googleEventId: event.googleEventId,
		eventCalendarId: event.calendarId,
		eventStart: event.start,
		eventEnd: event.end,
		eventTitle: event.title,
		eventLastSyncedAt: event.lastSyncedAt,
		seriesMatchCount: seriesMatches.length,
		legacyMatchCount: legacyMatches.length,
		protectedMatchCount: protectedFingerprintMatches.length,
		protectedSourceIdMatchCount: protectedSourceIdMatches.length,
		totalUniqueMatches: orderedMatches.length,
		primaryId: primary ? String(primary._id) : null,
		primarySource: primary?.source,
		primarySourceId: primary?.sourceId,
		primaryCalendarId: primary?.calendarId,
		primaryGoogleEventId: primary?.googleEventId,
		primaryStart: primary?.start,
		primaryEnd: primary?.end,
		primaryUpdatedAt: primary?.updatedAt,
		primaryPinned: primary?.pinned,
	});

	const { isProtectedSource, preserveProtectedGoogleEventId, resolvedGoogleEventId } =
		resolveGoogleEventIdForUpsert(
			primary,
			event,
			matchedPrimaryBySeries,
			matchedPrimaryByLegacy,
			matchedPrimaryByProtectedFingerprint,
			matchedPrimaryByProtectedSourceId,
		);
	const occurrencePatch = {
		...buildOccurrencePatch({
			event,
			primary,
			seriesId: series._id,
			occurrenceStart,
			now,
			isProtectedSource,
		}),
		googleEventId: resolvedGoogleEventId,
	};

	if (!primary) {
		log?.("[sync:upsert] NO MATCH — inserting new event", {
			googleEventId: event.googleEventId,
			calendarId: event.calendarId,
			title: event.title,
			start: event.start,
			end: event.end,
			source: isProtectedSource ? "task/habit" : "google",
		});
		await ctx.db.insert("calendarEvents", {
			userId,
			...occurrencePatch,
		});
		return { scheduleImpact: false };
	}

	const localUpdatedAt = primary.updatedAt ?? primary._creationTime ?? 0;
	const localIsNewer = localUpdatedAt > event.lastSyncedAt;
	const isSchedulingSource = primary.source === "task" || primary.source === "habit";
	const calendarChanged =
		resolvePrimaryCalendarId(primary.calendarId) !== resolvePrimaryCalendarId(event.calendarId);
	const startChanged = normalizeToMinute(primary.start) !== normalizeToMinute(event.start);
	const endChanged = normalizeToMinute(primary.end) !== normalizeToMinute(event.end);
	const scheduleImpact = Boolean(
		isSchedulingSource && !localIsNewer && (calendarChanged || startChanged || endChanged),
	);

	log?.("[sync:upsert] matched", {
		googleEventId: event.googleEventId,
		primaryId: String(primary._id),
		isProtectedSource: Boolean(isProtectedSource),
		preserveProtectedGoogleEventId,
		localUpdatedAt,
		eventLastSyncedAt: event.lastSyncedAt,
		localIsNewer,
		action: localIsNewer ? "sync-metadata-only" : "apply-full-patch",
	});

	if (primary.source === "task" && primary.sourceId && !localIsNewer) {
		if ((startChanged || endChanged) && !primary.sourceId.includes(":travel:")) {
			log?.("[sync:upsert] pinning task event", {
				primaryId: String(primary._id),
				primaryStart: primary.start,
				primaryEnd: primary.end,
				googleStart: event.start,
				googleEnd: event.end,
			});
			await ctx.db.patch(primary._id, { pinned: true });
		}
	}

	if (localIsNewer) {
		const nextSeriesId = isProtectedSource ? undefined : series._id;
		const shouldClearRecurrenceFields = Boolean(
			isProtectedSource &&
				(primary.recurrenceRule !== undefined ||
					primary.recurringEventId !== undefined ||
					primary.originalStartTime !== undefined),
		);
		if (
			primary.googleEventId !== resolvedGoogleEventId ||
			primary.etag !== event.etag ||
			primary.lastSyncedAt !== event.lastSyncedAt ||
			primary.seriesId !== nextSeriesId ||
			primary.occurrenceStart !== occurrenceStart ||
			shouldClearRecurrenceFields
		) {
			await ctx.db.patch(primary._id, {
				googleEventId: resolvedGoogleEventId,
				etag: event.etag,
				lastSyncedAt: event.lastSyncedAt,
				seriesId: nextSeriesId,
				occurrenceStart,
				recurrenceRule: isProtectedSource ? undefined : primary.recurrenceRule,
				recurringEventId: isProtectedSource ? undefined : primary.recurringEventId,
				originalStartTime: isProtectedSource ? undefined : primary.originalStartTime,
			});
		}
	} else {
		await ctx.db.patch(primary._id, occurrencePatch);
	}

	for (const duplicate of orderedMatches.slice(1)) {
		log?.("[sync:upsert] deleting duplicate", { duplicateId: String(duplicate._id) });
		await ctx.db.delete(duplicate._id);
	}

	return { scheduleImpact };
};

const performUpsertSyncedEventsForUser = async (
	ctx: MutationCtx,
	userId: string,
	args: {
		resetCalendars?: string[];
		events: SyncEventInput[];
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
	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();
	const primaryCalendarAliases = buildPrimaryCalendarAliases([
		...(settings?.googleConnectedCalendars ?? []),
		...(args.connectedCalendars ?? []),
	]);
	let needsReschedule = false;

	if (args.resetCalendars?.length) {
		const resetCalendarIds = new Set(args.resetCalendars);
		const existingEvents = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
		for (const event of existingEvents) {
			if (event.source !== "google") continue;
			if (!resetCalendarIds.has(resolvePrimaryCalendarId(event.calendarId))) continue;
			await ctx.db.delete(event._id);
		}

		const existingSeries = await ctx.db
			.query("calendarEventSeries")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
		for (const series of existingSeries) {
			if (series.source !== "google") continue;
			if (!resetCalendarIds.has(resolvePrimaryCalendarId(series.calendarId))) continue;
			await ctx.db.delete(series._id);
		}
	}

	for (const event of args.events) {
		const upsertResult = await upsertSingleSyncedEvent({
			ctx,
			userId,
			event,
			now,
			seriesCache,
			primaryCalendarAliases,
		});
		if (upsertResult.scheduleImpact) {
			needsReschedule = true;
		}
	}

	for (const deletedEvent of args.deletedEvents ?? []) {
		const existingMatches = await findLegacyMatches(
			ctx,
			userId,
			deletedEvent.calendarId,
			deletedEvent.googleEventId,
			primaryCalendarAliases,
		);

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
			activeProductId: settings.activeProductId,
			timezone: normalizeTimeZone(settings.timezone),
			timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(settings),
			defaultTaskSchedulingMode,
			...taskQuickCreateDefaults,
			schedulingHorizonDays: settings.schedulingHorizonDays ?? 70,
			schedulingDowntimeMinutes: normalizeSchedulingDowntimeMinutes(
				settings.schedulingDowntimeMinutes,
			),
			schedulingStepMinutes: normalizedSchedulingStepMinutesFromSettings(settings),
			schedulingModelVersion: settings.schedulingModelVersion,
			weekStartsOn: settings.weekStartsOn,
			dateFormat: settings.dateFormat,
			hoursBootstrapped: settings.hoursBootstrapped,
			googleRefreshToken: settings.googleRefreshToken,
			googleSyncToken: nextPrimaryToken,
			googleCalendarSyncTokens: nextSyncTokens,
			googleConnectedCalendars: args.connectedCalendars ?? settings.googleConnectedCalendars,
		});
	}

	return {
		upserted: args.events.length,
		needsReschedule,
	};
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
				activeProductId: existing.activeProductId,
				timezone: normalizeTimeZone(existing.timezone),
				timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(existing),
				defaultTaskSchedulingMode,
				...normalizeTaskQuickCreateDefaultsForSettings(existing),
				schedulingHorizonDays: existing.schedulingHorizonDays ?? 70,
				schedulingDowntimeMinutes: normalizeSchedulingDowntimeMinutes(
					existing.schedulingDowntimeMinutes,
				),
				schedulingStepMinutes: normalizedSchedulingStepMinutesFromSettings(existing),
				schedulingModelVersion: existing.schedulingModelVersion,
				weekStartsOn: existing.weekStartsOn,
				dateFormat: existing.dateFormat,
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
			schedulingHorizonDays: 70,
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
		const calendarId = resolvePrimaryCalendarId(args.input.calendarId);
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
				.withIndex("by_userId_seriesId_occurrenceStart", (q) =>
					q.eq("userId", userId).eq("seriesId", event.seriesId as Id<"calendarEventSeries">),
				)
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
			// Auto-pin task/habit event when dragged locally
			if ((event.source === "task" || event.source === "habit") && event.sourceId) {
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
			.withIndex("by_userId_seriesId_occurrenceStart", (q) =>
				q.eq("userId", userId).eq("seriesId", event.seriesId as Id<"calendarEventSeries">),
			)
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
		if (result.needsReschedule) {
			await enqueueSchedulingRunFromMutation(ctx, {
				userId: args.userId,
				triggeredBy: "calendar_change",
			});
		}
		return { upserted: result.upserted };
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
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.unique();
		const primaryCalendarAliases = buildPrimaryCalendarAliases(settings?.googleConnectedCalendars);

		for (const event of args.events) {
			await upsertSingleSyncedEvent({
				ctx,
				userId: args.userId,
				event,
				now,
				seriesCache,
				primaryCalendarAliases,
			});
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
