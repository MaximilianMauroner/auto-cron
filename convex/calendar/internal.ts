import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { requireAuth } from "../auth";
import type { CalendarProviderEvent } from "../providers/calendar/types";

const MINUTE_MS = 60 * 1000;

/**
 * Floors a timestamp to the nearest minute boundary.
 */
const normalizeToMinute = (timestamp: number) => Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;

/**
 * Computes recency for conflict resolution and deduplication.
 */
const recencyScore = (event: Doc<"calendarEvents">) =>
	Math.max(event.lastSyncedAt ?? 0, event.updatedAt ?? 0, event._creationTime ?? 0);

/**
 * Clamps a numeric limit into an inclusive range.
 */
const clampLimit = (value: number | undefined, min: number, max: number, fallback: number) =>
	Math.max(min, Math.min(value ?? fallback, max));

const buildDedupeKey = (event: Doc<"calendarEvents">) => {
	if (event.seriesId && event.occurrenceStart !== undefined && event.recurringEventId) {
		return `series:${event.seriesId}:${event.occurrenceStart}`;
	}
	if (event.googleEventId) {
		const occurrenceTs = normalizeToMinute(event.originalStartTime ?? event.start);
		return `google:${event.calendarId ?? "primary"}:${event.googleEventId}:${occurrenceTs}`;
	}
	if (event.seriesId && event.occurrenceStart !== undefined) {
		return `series:${event.seriesId}:${event.occurrenceStart}`;
	}
	return `fallback:${event.source}:${event.sourceId ?? "none"}:${event.start}:${event.end}:${event.title ?? "untitled"}`;
};

const hydrateEvent = (
	event: Doc<"calendarEvents">,
	series?: Doc<"calendarEventSeries"> | null,
): CalendarProviderEvent => ({
	_id: String(event._id),
	title: event.title ?? series?.title ?? "Untitled event",
	description: event.description ?? series?.description,
	start: event.start,
	end: event.end,
	allDay: event.allDay ?? series?.allDay ?? false,
	sourceId: event.sourceId,
	googleEventId: event.googleEventId,
	calendarId: event.calendarId ?? series?.calendarId,
	recurrenceRule: event.recurrenceRule ?? series?.recurrenceRule,
	recurringEventId: event.recurringEventId ?? series?.googleSeriesId,
	originalStartTime: event.originalStartTime,
	status: event.status ?? series?.status,
	etag: event.etag ?? series?.etag,
	busyStatus: event.busyStatus ?? series?.busyStatus ?? "busy",
	visibility: event.visibility ?? series?.visibility,
	location: event.location ?? series?.location,
	color: event.color ?? series?.color,
});

/**
 * Fetches user events in an optional overlapping time range.
 */
const listUserEventsInRange = async (
	ctx: MutationCtx,
	userId: string,
	start?: number,
	end?: number,
) => {
	if (typeof start === "number" && typeof end === "number") {
		return await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_start", (q) => q.eq("userId", userId).lte("start", end))
			.filter((q) => q.gte(q.field("end"), start))
			.collect();
	}

	return await ctx.db
		.query("calendarEvents")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();
};

/**
 * Scores how complete an event row is so dedupe prefers richer records.
 */
const eventRichnessScore = (event: Doc<"calendarEvents">) =>
	(event.title ? 1 : 0) +
	(event.description ? 1 : 0) +
	(event.recurrenceRule ? 1 : 0) +
	(event.busyStatus ? 1 : 0) +
	(event.visibility ? 1 : 0) +
	(event.location ? 1 : 0) +
	(event.color ? 1 : 0);

const getRichestEvent = (group: Doc<"calendarEvents">[]) =>
	[...group].sort((a, b) => eventRichnessScore(b) - eventRichnessScore(a))[0];

/**
 * Merges duplicate events by key and removes stale copies.
 */
const dedupeEventGroups = async (ctx: MutationCtx, events: Doc<"calendarEvents">[]) => {
	const groups = new Map<string, Doc<"calendarEvents">[]>();
	for (const event of events) {
		const key = buildDedupeKey(event);
		const existing = groups.get(key) ?? [];
		existing.push(event);
		groups.set(key, existing);
	}

	let merged = 0;
	let removed = 0;

	for (const group of groups.values()) {
		if (group.length <= 1) continue;
		merged += 1;

		const [primary, ...duplicates] = [...group].sort((a, b) => recencyScore(b) - recencyScore(a));
		if (!primary) continue;

		const richest = getRichestEvent(group);
		if (richest && richest._id !== primary._id) {
			await ctx.db.patch(primary._id, {
				title: primary.title ?? richest.title,
				description: primary.description ?? richest.description,
				recurrenceRule: primary.recurrenceRule ?? richest.recurrenceRule,
				busyStatus: primary.busyStatus ?? richest.busyStatus,
				visibility: primary.visibility ?? richest.visibility,
				location: primary.location ?? richest.location,
				color: primary.color ?? richest.color,
				allDay: primary.allDay ?? richest.allDay,
			});
		}

		for (const duplicate of duplicates) {
			await ctx.db.delete(duplicate._id);
			removed += 1;
		}
	}

	return { merged, removed };
};

export const getUserGoogleSettings = internalQuery({
	args: {
		userId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = args.userId ?? (await requireAuth(ctx));
		return ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique();
	},
});

export const listUsersWithGoogleSync = internalQuery({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			userId: v.string(),
			googleRefreshToken: v.string(),
			googleSyncToken: v.optional(v.string()),
			googleCalendarSyncTokens: v.optional(
				v.array(
					v.object({
						calendarId: v.string(),
						syncToken: v.string(),
					}),
				),
			),
		}),
	),
	handler: async (ctx, args) => {
		const limit = clampLimit(args.limit, 1, 1000, 1000);
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_googleRefreshToken_userId", (q) => q.gte("googleRefreshToken", ""))
			.take(limit);
		return settings
			.filter(
				(setting): setting is typeof setting & { googleRefreshToken: string } =>
					typeof setting.googleRefreshToken === "string" && setting.googleRefreshToken.length > 0,
			)
			.map((setting) => ({
				userId: setting.userId,
				googleRefreshToken: setting.googleRefreshToken,
				googleSyncToken: setting.googleSyncToken,
				googleCalendarSyncTokens: setting.googleCalendarSyncTokens,
			}));
	},
});

export const listWatchChannelsForUser = internalQuery({
	args: {
		userId: v.string(),
	},
	returns: v.array(
		v.object({
			_id: v.id("googleCalendarWatchChannels"),
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
		}),
	),
	handler: async (ctx, args) => {
		const channels = await ctx.db
			.query("googleCalendarWatchChannels")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		return channels.map((channel) => ({
			_id: channel._id,
			userId: channel.userId,
			calendarId: channel.calendarId,
			channelId: channel.channelId,
			resourceId: channel.resourceId,
			resourceUri: channel.resourceUri,
			channelTokenHash: channel.channelTokenHash,
			expirationAt: channel.expirationAt,
			status: channel.status,
			lastNotifiedAt: channel.lastNotifiedAt,
			lastMessageNumber: channel.lastMessageNumber,
			createdAt: channel.createdAt,
			updatedAt: channel.updatedAt,
		}));
	},
});

export const getWatchChannelByChannelId = internalQuery({
	args: {
		channelId: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("googleCalendarWatchChannels"),
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
		}),
	),
	handler: async (ctx, args) => {
		const channel = await ctx.db
			.query("googleCalendarWatchChannels")
			.withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
			.unique();
		if (!channel) return null;
		return {
			_id: channel._id,
			userId: channel.userId,
			calendarId: channel.calendarId,
			channelId: channel.channelId,
			resourceId: channel.resourceId,
			resourceUri: channel.resourceUri,
			channelTokenHash: channel.channelTokenHash,
			expirationAt: channel.expirationAt,
			status: channel.status,
			lastNotifiedAt: channel.lastNotifiedAt,
			lastMessageNumber: channel.lastMessageNumber,
			createdAt: channel.createdAt,
			updatedAt: channel.updatedAt,
		};
	},
});

export const listExpiringWatchChannels = internalQuery({
	args: {
		before: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("googleCalendarWatchChannels"),
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
		}),
	),
	handler: async (ctx, args) => {
		const limit = clampLimit(args.limit, 1, 5000, 500);
		const channels = await ctx.db
			.query("googleCalendarWatchChannels")
			.withIndex("by_expirationAt", (q) => q.lte("expirationAt", args.before))
			.take(limit);
		return channels.map((channel) => ({
			_id: channel._id,
			userId: channel.userId,
			calendarId: channel.calendarId,
			channelId: channel.channelId,
			resourceId: channel.resourceId,
			resourceUri: channel.resourceUri,
			channelTokenHash: channel.channelTokenHash,
			expirationAt: channel.expirationAt,
			status: channel.status,
			lastNotifiedAt: channel.lastNotifiedAt,
			lastMessageNumber: channel.lastMessageNumber,
			createdAt: channel.createdAt,
			updatedAt: channel.updatedAt,
		}));
	},
});

export const getEventById = internalQuery({
	args: {
		id: v.id("calendarEvents"),
	},
	returns: v.union(
		v.null(),
		v.object({
			_id: v.string(),
			title: v.string(),
			description: v.optional(v.string()),
			start: v.number(),
			end: v.number(),
			allDay: v.boolean(),
			sourceId: v.optional(v.string()),
			googleEventId: v.optional(v.string()),
			calendarId: v.optional(v.string()),
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
		}),
	),
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) return null;

		const series = event.seriesId ? await ctx.db.get(event.seriesId) : null;
		return hydrateEvent(event, series);
	},
});

export const updateLocalEventFromGoogle = internalMutation({
	args: {
		id: v.id("calendarEvents"),
		googleEventId: v.string(),
		calendarId: v.optional(v.string()),
		etag: v.optional(v.string()),
		lastSyncedAt: v.number(),
	},
	handler: async (ctx, args) => {
		const event = await ctx.db.get(args.id);
		if (!event) return;
		const nextSourceId = event.source === "google" ? args.googleEventId : event.sourceId;

		console.log("[sync:updateLocal]", {
			eventId: String(args.id),
			googleEventId: args.googleEventId,
			argsCalendarId: args.calendarId,
			existingCalendarId: event.calendarId,
			resolvedCalendarId: args.calendarId ?? event.calendarId,
			existingSource: event.source,
			existingStart: event.start,
			existingEnd: event.end,
			lastSyncedAt: args.lastSyncedAt,
		});

		await ctx.db.patch(args.id, {
			googleEventId: args.googleEventId,
			sourceId: nextSourceId,
			calendarId: args.calendarId ?? event.calendarId,
			etag: args.etag,
			lastSyncedAt: args.lastSyncedAt,
			occurrenceStart: normalizeToMinute(event.originalStartTime ?? event.start),
		});

		if (event.seriesId) {
			const series = await ctx.db.get(event.seriesId);
			if (series) {
				await ctx.db.patch(series._id, {
					sourceId: args.googleEventId,
					calendarId: args.calendarId ?? series.calendarId,
					googleSeriesId: series.googleSeriesId ?? args.googleEventId,
					etag: args.etag ?? series.etag,
					lastSyncedAt: args.lastSyncedAt,
				});
			}
		}
	},
});

export const normalizeGoogleEventsInRange = internalMutation({
	args: {
		userId: v.optional(v.string()),
		start: v.optional(v.number()),
		end: v.optional(v.number()),
	},
	returns: v.object({
		seriesCreated: v.number(),
		seriesUpdated: v.number(),
		occurrencesPatched: v.number(),
	}),
	handler: async (ctx, args) => {
		const userId = args.userId ?? (await requireAuth(ctx));
		const now = Date.now();

		const events = await listUserEventsInRange(ctx, userId, args.start, args.end);

		const seriesCache = new Map<string, Doc<"calendarEventSeries"> | null>();
		const processedSeriesCacheKeys = new Set<string>();
		let seriesCreated = 0;
		let seriesUpdated = 0;
		let occurrencesPatched = 0;

		for (const event of events) {
			if (event.source !== "google") continue;
			const googleSeriesId = event.recurringEventId ?? event.googleEventId ?? event.sourceId;
			if (!googleSeriesId) continue;

			const seriesCacheKey = `${event.calendarId ?? "primary"}:${googleSeriesId}`;
			let series = seriesCache.get(seriesCacheKey);
			if (!seriesCache.has(seriesCacheKey)) {
				series = await ctx.db
					.query("calendarEventSeries")
					.withIndex("by_userId_calendarId_googleSeriesId", (q) =>
						q
							.eq("userId", userId)
							.eq("calendarId", event.calendarId ?? "primary")
							.eq("googleSeriesId", googleSeriesId),
					)
					.unique();
				seriesCache.set(seriesCacheKey, series);
			}

			const nextSeriesValues = {
				source: "google" as const,
				sourceId: event.sourceId ?? event.googleEventId,
				calendarId: event.calendarId ?? "primary",
				googleSeriesId,
				title: event.title ?? series?.title ?? "Untitled event",
				description: event.description ?? series?.description,
				allDay: event.allDay ?? series?.allDay ?? false,
				recurrenceRule: event.recurrenceRule ?? series?.recurrenceRule,
				status: event.status ?? series?.status,
				busyStatus: event.busyStatus ?? series?.busyStatus ?? "busy",
				visibility: event.visibility ?? series?.visibility,
				location: event.location ?? series?.location,
				color: event.color ?? series?.color,
				etag: event.etag ?? series?.etag,
				lastSyncedAt: event.lastSyncedAt ?? series?.lastSyncedAt,
				isRecurring: Boolean(event.recurringEventId || event.recurrenceRule),
			};
			const nextSeriesUpdatedAt = Math.max(now, event.updatedAt);

			if (!processedSeriesCacheKeys.has(seriesCacheKey)) {
				if (!series) {
					const seriesId = await ctx.db.insert("calendarEventSeries", {
						userId,
						...nextSeriesValues,
						updatedAt: nextSeriesUpdatedAt,
					});
					series = await ctx.db.get(seriesId);
					if (!series) {
						throw new ConvexError({
							code: "SERIES_CREATE_FAILED",
							message: "Could not create calendar event series",
						});
					}
					seriesCreated += 1;
				} else {
					const shouldPatchSeries =
						series.source !== nextSeriesValues.source ||
						series.sourceId !== nextSeriesValues.sourceId ||
						series.calendarId !== nextSeriesValues.calendarId ||
						series.googleSeriesId !== nextSeriesValues.googleSeriesId ||
						series.title !== nextSeriesValues.title ||
						series.description !== nextSeriesValues.description ||
						series.allDay !== nextSeriesValues.allDay ||
						series.recurrenceRule !== nextSeriesValues.recurrenceRule ||
						series.status !== nextSeriesValues.status ||
						series.busyStatus !== nextSeriesValues.busyStatus ||
						series.visibility !== nextSeriesValues.visibility ||
						series.location !== nextSeriesValues.location ||
						series.color !== nextSeriesValues.color ||
						series.etag !== nextSeriesValues.etag ||
						series.lastSyncedAt !== nextSeriesValues.lastSyncedAt ||
						series.isRecurring !== nextSeriesValues.isRecurring;
					if (shouldPatchSeries) {
						await ctx.db.patch(series._id, {
							...nextSeriesValues,
							updatedAt: nextSeriesUpdatedAt,
						});
						seriesUpdated += 1;
						series = {
							...series,
							...nextSeriesValues,
							updatedAt: nextSeriesUpdatedAt,
						};
					}
				}
				seriesCache.set(seriesCacheKey, series);
				processedSeriesCacheKeys.add(seriesCacheKey);
			}
			if (!series) continue;

			const isRecurringInstance = Boolean(event.recurringEventId);
			const occurrenceStart = normalizeToMinute(event.originalStartTime ?? event.start);
			const nextOccurrenceValues = {
				seriesId: series._id,
				occurrenceStart,
				sourceId: event.sourceId ?? event.googleEventId,
				title: isRecurringInstance ? undefined : event.title,
				description: isRecurringInstance ? undefined : event.description,
				allDay: isRecurringInstance ? undefined : event.allDay,
				recurrenceRule: isRecurringInstance ? undefined : event.recurrenceRule,
				busyStatus: isRecurringInstance ? undefined : event.busyStatus,
				visibility: isRecurringInstance ? undefined : event.visibility,
				location: isRecurringInstance ? undefined : event.location,
				color: isRecurringInstance ? undefined : event.color,
				updatedAt: Math.max(now, event.updatedAt),
			};

			const shouldPatch =
				event.seriesId !== nextOccurrenceValues.seriesId ||
				event.occurrenceStart !== nextOccurrenceValues.occurrenceStart ||
				event.sourceId !== nextOccurrenceValues.sourceId ||
				event.title !== nextOccurrenceValues.title ||
				event.description !== nextOccurrenceValues.description ||
				event.allDay !== nextOccurrenceValues.allDay ||
				event.recurrenceRule !== nextOccurrenceValues.recurrenceRule ||
				event.busyStatus !== nextOccurrenceValues.busyStatus ||
				event.visibility !== nextOccurrenceValues.visibility ||
				event.location !== nextOccurrenceValues.location ||
				event.color !== nextOccurrenceValues.color;
			if (!shouldPatch) continue;

			await ctx.db.patch(event._id, nextOccurrenceValues);
			occurrencesPatched += 1;
		}

		return {
			seriesCreated,
			seriesUpdated,
			occurrencesPatched,
		};
	},
});

export const dedupeUserCalendarEventsInRange = internalMutation({
	args: {
		userId: v.optional(v.string()),
		start: v.number(),
		end: v.number(),
	},
	returns: v.object({
		merged: v.number(),
		removed: v.number(),
	}),
	handler: async (ctx, args) => {
		const userId = args.userId ?? (await requireAuth(ctx));

		const events = await listUserEventsInRange(ctx, userId, args.start, args.end);
		return await dedupeEventGroups(ctx, events);
	},
});

export const normalizeAndDedupeEventsInRange = internalMutation({
	args: {
		userId: v.optional(v.string()),
		start: v.optional(v.number()),
		end: v.optional(v.number()),
	},
	returns: v.object({
		seriesCreated: v.number(),
		seriesUpdated: v.number(),
		occurrencesPatched: v.number(),
		merged: v.number(),
		removed: v.number(),
	}),
	handler: async (ctx, args) => {
		const userId = args.userId ?? (await requireAuth(ctx));
		const now = Date.now();

		// Fetch events once for both normalize and dedupe
		const events = await listUserEventsInRange(ctx, userId, args.start, args.end);

		// --- Normalize phase ---
		const normalizedEventsById = new Map(events.map((event) => [event._id, event]));
		const seriesCache = new Map<string, Doc<"calendarEventSeries"> | null>();
		const processedSeriesCacheKeys = new Set<string>();
		let seriesCreated = 0;
		let seriesUpdated = 0;
		let occurrencesPatched = 0;

		for (const event of events) {
			if (event.source !== "google") continue;
			const googleSeriesId = event.recurringEventId ?? event.googleEventId ?? event.sourceId;
			if (!googleSeriesId) continue;

			const seriesCacheKey = `${event.calendarId ?? "primary"}:${googleSeriesId}`;
			let series = seriesCache.get(seriesCacheKey);
			if (!seriesCache.has(seriesCacheKey)) {
				series = await ctx.db
					.query("calendarEventSeries")
					.withIndex("by_userId_calendarId_googleSeriesId", (q) =>
						q
							.eq("userId", userId)
							.eq("calendarId", event.calendarId ?? "primary")
							.eq("googleSeriesId", googleSeriesId),
					)
					.unique();
				seriesCache.set(seriesCacheKey, series);
			}

			const nextSeriesValues = {
				source: "google" as const,
				sourceId: event.sourceId ?? event.googleEventId,
				calendarId: event.calendarId ?? "primary",
				googleSeriesId,
				title: event.title ?? series?.title ?? "Untitled event",
				description: event.description ?? series?.description,
				allDay: event.allDay ?? series?.allDay ?? false,
				recurrenceRule: event.recurrenceRule ?? series?.recurrenceRule,
				status: event.status ?? series?.status,
				busyStatus: event.busyStatus ?? series?.busyStatus ?? "busy",
				visibility: event.visibility ?? series?.visibility,
				location: event.location ?? series?.location,
				color: event.color ?? series?.color,
				etag: event.etag ?? series?.etag,
				lastSyncedAt: event.lastSyncedAt ?? series?.lastSyncedAt,
				isRecurring: Boolean(event.recurringEventId || event.recurrenceRule),
			};
			const nextSeriesUpdatedAt = Math.max(now, event.updatedAt);

			if (!processedSeriesCacheKeys.has(seriesCacheKey)) {
				if (!series) {
					const seriesId = await ctx.db.insert("calendarEventSeries", {
						userId,
						...nextSeriesValues,
						updatedAt: nextSeriesUpdatedAt,
					});
					series = await ctx.db.get(seriesId);
					if (!series) {
						throw new ConvexError({
							code: "SERIES_CREATE_FAILED",
							message: "Could not create calendar event series",
						});
					}
					seriesCreated += 1;
				} else {
					const shouldPatchSeries =
						series.source !== nextSeriesValues.source ||
						series.sourceId !== nextSeriesValues.sourceId ||
						series.calendarId !== nextSeriesValues.calendarId ||
						series.googleSeriesId !== nextSeriesValues.googleSeriesId ||
						series.title !== nextSeriesValues.title ||
						series.description !== nextSeriesValues.description ||
						series.allDay !== nextSeriesValues.allDay ||
						series.recurrenceRule !== nextSeriesValues.recurrenceRule ||
						series.status !== nextSeriesValues.status ||
						series.busyStatus !== nextSeriesValues.busyStatus ||
						series.visibility !== nextSeriesValues.visibility ||
						series.location !== nextSeriesValues.location ||
						series.color !== nextSeriesValues.color ||
						series.etag !== nextSeriesValues.etag ||
						series.lastSyncedAt !== nextSeriesValues.lastSyncedAt ||
						series.isRecurring !== nextSeriesValues.isRecurring;
					if (shouldPatchSeries) {
						await ctx.db.patch(series._id, {
							...nextSeriesValues,
							updatedAt: nextSeriesUpdatedAt,
						});
						seriesUpdated += 1;
						series = {
							...series,
							...nextSeriesValues,
							updatedAt: nextSeriesUpdatedAt,
						};
					}
				}
				seriesCache.set(seriesCacheKey, series);
				processedSeriesCacheKeys.add(seriesCacheKey);
			}
			if (!series) continue;

			const isRecurringInstance = Boolean(event.recurringEventId);
			const occurrenceStart = normalizeToMinute(event.originalStartTime ?? event.start);
			const nextOccurrenceValues = {
				seriesId: series._id,
				occurrenceStart,
				sourceId: event.sourceId ?? event.googleEventId,
				title: isRecurringInstance ? undefined : event.title,
				description: isRecurringInstance ? undefined : event.description,
				allDay: isRecurringInstance ? undefined : event.allDay,
				recurrenceRule: isRecurringInstance ? undefined : event.recurrenceRule,
				busyStatus: isRecurringInstance ? undefined : event.busyStatus,
				visibility: isRecurringInstance ? undefined : event.visibility,
				location: isRecurringInstance ? undefined : event.location,
				color: isRecurringInstance ? undefined : event.color,
				updatedAt: Math.max(now, event.updatedAt),
			};

			const shouldPatch =
				event.seriesId !== nextOccurrenceValues.seriesId ||
				event.occurrenceStart !== nextOccurrenceValues.occurrenceStart ||
				event.sourceId !== nextOccurrenceValues.sourceId ||
				event.title !== nextOccurrenceValues.title ||
				event.description !== nextOccurrenceValues.description ||
				event.allDay !== nextOccurrenceValues.allDay ||
				event.recurrenceRule !== nextOccurrenceValues.recurrenceRule ||
				event.busyStatus !== nextOccurrenceValues.busyStatus ||
				event.visibility !== nextOccurrenceValues.visibility ||
				event.location !== nextOccurrenceValues.location ||
				event.color !== nextOccurrenceValues.color;
			if (!shouldPatch) continue;

			await ctx.db.patch(event._id, nextOccurrenceValues);
			normalizedEventsById.set(event._id, {
				...event,
				...nextOccurrenceValues,
			});
			occurrencesPatched += 1;
		}

		const dedupeEvents = Array.from(normalizedEventsById.values());
		const { merged, removed } = await dedupeEventGroups(ctx, dedupeEvents);

		return {
			seriesCreated,
			seriesUpdated,
			occurrencesPatched,
			merged,
			removed,
		};
	},
});

export const listScheduledEventsForGoogleSync = internalQuery({
	args: {
		userId: v.string(),
		start: v.number(),
		end: v.number(),
	},
	returns: v.array(
		v.object({
			id: v.id("calendarEvents"),
			source: v.union(v.literal("task"), v.literal("habit")),
			sourceId: v.string(),
			title: v.string(),
			description: v.optional(v.string()),
			start: v.number(),
			end: v.number(),
			allDay: v.boolean(),
			googleEventId: v.optional(v.string()),
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
		}),
	),
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_start", (q) => q.eq("userId", args.userId).lte("start", args.end))
			.filter((q) => q.gte(q.field("end"), args.start))
			.collect();

		return events
			.filter(
				(
					event,
				): event is typeof event & {
					source: "task" | "habit";
					sourceId: string;
				} =>
					(event.source === "task" || event.source === "habit") &&
					typeof event.sourceId === "string",
			)
			.map((event) => ({
				id: event._id,
				source: event.source,
				sourceId: event.sourceId,
				title: event.title ?? "Scheduled block",
				description: event.description,
				start: event.start,
				end: event.end,
				allDay: event.allDay ?? false,
				googleEventId: event.googleEventId,
				calendarId: event.calendarId ?? "primary",
				recurrenceRule: event.recurrenceRule,
				recurringEventId: event.recurringEventId,
				originalStartTime: event.originalStartTime,
				status: event.status,
				etag: event.etag,
				busyStatus: event.busyStatus ?? "busy",
				visibility: event.visibility,
				location: event.location,
				color: event.color,
			}))
			.sort((a, b) => {
				if (a.start !== b.start) return a.start - b.start;
				return String(a.id).localeCompare(String(b.id));
			});
	},
});
