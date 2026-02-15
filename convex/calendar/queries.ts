import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import type { ListEventsArgs } from "./queryTypes";

const MINUTE_MS = 60 * 1000;

/**
 * Floors timestamps to minute precision for stable dedupe keys.
 */
const normalizeToMinute = (timestamp: number) => Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
const REMOTE_CALENDAR_ID_REGEX =
	/(group\.(?:v\.)?calendar\.google\.com|import\.calendar\.google\.com|holiday)/i;

const recencyScore = (event: Doc<"calendarEvents">) =>
	Math.max(event.lastSyncedAt ?? 0, event.updatedAt ?? 0, event._creationTime ?? 0);

/**
 * Resolves optional calendar ids to a concrete key.
 */
const resolvePrimaryCalendarId = (calendarId: string | undefined) => calendarId ?? "primary";

const buildDedupeKey = (event: Doc<"calendarEvents">) => {
	if (event.seriesId && event.occurrenceStart !== undefined && event.recurringEventId) {
		return `series:${event.seriesId}:${event.occurrenceStart}`;
	}
	if (event.googleEventId) {
		const occurrenceTs = normalizeToMinute(event.originalStartTime ?? event.start);
		return `google:${resolvePrimaryCalendarId(event.calendarId)}:${event.googleEventId}:${occurrenceTs}`;
	}
	if (event.seriesId && event.occurrenceStart !== undefined) {
		return `series:${event.seriesId}:${event.occurrenceStart}`;
	}
	return `fallback:${event.source}:${event.sourceId ?? "none"}:${event.start}:${event.end}:${event.title ?? "untitled"}`;
};

const hydrateEvent = (
	event: Doc<"calendarEvents">,
	series?: Doc<"calendarEventSeries"> | null,
) => ({
	...event,
	title: event.title ?? series?.title ?? "Untitled event",
	description: event.description ?? series?.description,
	allDay: event.allDay ?? series?.allDay ?? false,
	recurrenceRule: event.recurrenceRule ?? series?.recurrenceRule,
	recurringEventId: event.recurringEventId ?? series?.googleSeriesId,
	status: event.status ?? series?.status,
	etag: event.etag ?? series?.etag,
	busyStatus: event.busyStatus ?? series?.busyStatus ?? "busy",
	visibility: event.visibility ?? series?.visibility,
	location: event.location ?? series?.location,
	color: event.color ?? series?.color,
	calendarId: event.calendarId ?? series?.calendarId,
});

/**
 * Builds a lookup map of series docs keyed by id string.
 */
const buildSeriesById = (
	seriesIds: Array<NonNullable<Doc<"calendarEvents">["seriesId"]>>,
	seriesDocs: Array<Doc<"calendarEventSeries"> | null>,
) => {
	const seriesById = new Map<string, Doc<"calendarEventSeries"> | null>();
	for (let index = 0; index < seriesIds.length; index += 1) {
		seriesById.set(String(seriesIds[index]), seriesDocs[index] ?? null);
	}
	return seriesById;
};

/**
 * Returns associated series document for a calendar event, if present.
 */
const resolveSeriesForEvent = (
	event: Doc<"calendarEvents">,
	seriesById: Map<string, Doc<"calendarEventSeries"> | null>,
) => (event.seriesId ? (seriesById.get(String(event.seriesId)) ?? null) : null);

/**
 * Deduplicates events by logical key while keeping the most recent row.
 */
const dedupeByLatestRecency = (events: Doc<"calendarEvents">[]) => {
	const deduped = new Map<string, Doc<"calendarEvents">>();
	for (const event of events) {
		const key = buildDedupeKey(event);
		const previous = deduped.get(key);
		if (!previous || recencyScore(event) > recencyScore(previous)) {
			deduped.set(key, event);
		}
	}
	return Array.from(deduped.values());
};

const isExternalGoogleCalendar = ({
	id,
	primary,
	accessRole,
	isExternal,
}: {
	id: string;
	primary: boolean;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal?: boolean;
}) => {
	if (typeof isExternal === "boolean") return isExternal;
	if (primary) return false;
	if (accessRole === "reader" || accessRole === "freeBusyReader") return true;
	return REMOTE_CALENDAR_ID_REGEX.test(id);
};

const calendarEventDtoValidator = v.object({
	_id: v.id("calendarEvents"),
	_creationTime: v.number(),
	userId: v.string(),
	title: v.string(),
	description: v.optional(v.string()),
	start: v.number(),
	end: v.number(),
	allDay: v.boolean(),
	updatedAt: v.number(),
	source: v.union(v.literal("manual"), v.literal("google"), v.literal("task"), v.literal("habit")),
	sourceId: v.optional(v.string()),
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
	pinned: v.optional(v.boolean()),
});

const occurrenceBucketValidator = v.union(v.literal("upcoming"), v.literal("past"));

const occurrenceItemValidator = v.object({
	id: v.id("calendarEvents"),
	title: v.string(),
	start: v.number(),
	end: v.number(),
	source: v.union(v.literal("manual"), v.literal("google"), v.literal("task"), v.literal("habit")),
	sourceId: v.optional(v.string()),
	calendarId: v.optional(v.string()),
	status: v.optional(
		v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
	),
	pinned: v.optional(v.boolean()),
	seriesId: v.optional(v.id("calendarEventSeries")),
});

const occurrencePageValidator = v.object({
	items: v.array(occurrenceItemValidator),
	nextCursor: v.optional(v.number()),
	hasMore: v.boolean(),
	totalLoaded: v.number(),
});

const changeLogEntityTypeValidator = v.union(
	v.literal("task"),
	v.literal("habit"),
	v.literal("event"),
	v.literal("occurrence"),
);

const changeLogItemValidator = v.object({
	_id: v.id("changeLogs"),
	_creationTime: v.number(),
	userId: v.string(),
	entityType: changeLogEntityTypeValidator,
	entityId: v.string(),
	eventId: v.optional(v.id("calendarEvents")),
	seriesId: v.optional(v.id("calendarEventSeries")),
	action: v.string(),
	scope: v.optional(v.union(v.literal("single"), v.literal("following"), v.literal("series"))),
	actor: v.object({
		type: v.literal("user"),
		id: v.string(),
	}),
	metadata: v.optional(v.any()),
	timestamp: v.number(),
	createdAt: v.number(),
});

type GetEventArgs = {
	id: Id<"calendarEvents">;
};

type ListTaskOccurrencesPageArgs = {
	taskId: Id<"tasks">;
	bucket: "upcoming" | "past";
	cursor?: number;
	limit?: number;
};

type ListHabitOccurrencesPageArgs = {
	habitId: Id<"habits">;
	bucket: "upcoming" | "past";
	cursor?: number;
	limit?: number;
};

type ListEntityChangeLogPageArgs = {
	entityType: "task" | "habit" | "event" | "occurrence";
	entityId: string;
	cursor?: number;
	limit?: number;
};

const toOccurrencePage = (
	events: Doc<"calendarEvents">[],
	args: { bucket: "upcoming" | "past"; cursor?: number; limit?: number },
) => {
	const normalizedLimit = Number.isFinite(args.limit)
		? Math.max(1, Math.min(Math.floor(args.limit as number), 50))
		: 5;
	const now = Date.now();
	const boundary = args.cursor ?? now;
	const filtered = events.filter((event) => event.status !== "cancelled");
	const ordered =
		args.bucket === "upcoming"
			? filtered
					.filter((event) =>
						args.cursor === undefined ? event.start >= boundary : event.start > boundary,
					)
					.sort((a, b) => a.start - b.start)
			: filtered
					.filter((event) =>
						args.cursor === undefined ? event.start < boundary : event.start < boundary,
					)
					.sort((a, b) => b.start - a.start);
	const items = ordered.slice(0, normalizedLimit).map((event) => ({
		id: event._id,
		title: event.title ?? "Untitled event",
		start: event.start,
		end: event.end,
		source: event.source,
		sourceId: event.sourceId,
		calendarId: event.calendarId,
		status: event.status,
		pinned: event.pinned,
		seriesId: event.seriesId,
	}));
	const hasMore = ordered.length > normalizedLimit;
	const nextCursor = hasMore ? items[items.length - 1]?.start : undefined;
	return {
		items,
		nextCursor,
		hasMore,
		totalLoaded: items.length,
	};
};

export const listEvents = query({
	args: {
		start: v.number(),
		end: v.number(),
		sourceFilter: v.optional(
			v.array(
				v.union(v.literal("google"), v.literal("task"), v.literal("habit"), v.literal("manual")),
			),
		),
	},
	returns: v.array(calendarEventDtoValidator),
	handler: withQueryAuth(async (ctx, args: ListEventsArgs) => {
		const { userId } = ctx;
		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_start", (q) => q.eq("userId", userId).lte("start", args.end))
			.filter((q) => q.gte(q.field("end"), args.start))
			.collect();

		const filtered = events.filter(
			(event) =>
				event.status !== "cancelled" &&
				(!args.sourceFilter || args.sourceFilter.includes(event.source)),
		);

		const dedupedEvents = dedupeByLatestRecency(filtered);

		const seriesIds = Array.from(
			new Set(
				dedupedEvents
					.map((event) => event.seriesId)
					.filter((seriesId): seriesId is NonNullable<typeof seriesId> => Boolean(seriesId)),
			),
		);
		const seriesDocs = await Promise.all(seriesIds.map((seriesId) => ctx.db.get(seriesId)));
		const seriesById = buildSeriesById(seriesIds, seriesDocs);
		const hydratedEvents = dedupedEvents.map((event) =>
			hydrateEvent(event, resolveSeriesForEvent(event, seriesById)),
		);

		return hydratedEvents.sort((a, b) => a.start - b.start);
	}),
});

export const listTaskEvents = query({
	args: {
		taskId: v.string(),
	},
	returns: v.array(calendarEventDtoValidator),
	handler: withQueryAuth(async (ctx, args: { taskId: string }) => {
		const { userId } = ctx;
		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_source_sourceId", (q) =>
				q.eq("userId", userId).eq("source", "task").eq("sourceId", args.taskId),
			)
			.collect();

		const valid = events.filter((event) => event.status !== "cancelled");

		const seriesIds = Array.from(
			new Set(
				valid
					.map((event) => event.seriesId)
					.filter((id): id is NonNullable<typeof id> => Boolean(id)),
			),
		);
		const seriesDocs = await Promise.all(seriesIds.map((id) => ctx.db.get(id)));
		const seriesById = buildSeriesById(seriesIds, seriesDocs);
		return dedupeByLatestRecency(valid)
			.map((event) => hydrateEvent(event, resolveSeriesForEvent(event, seriesById)))
			.sort((a, b) => a.start - b.start);
	}),
});

export const getEvent = query({
	args: {
		id: v.id("calendarEvents"),
	},
	returns: v.union(calendarEventDtoValidator, v.null()),
	handler: withQueryAuth(async (ctx, args: GetEventArgs) => {
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== ctx.userId) return null;
		const series = event.seriesId ? await ctx.db.get(event.seriesId) : null;
		return hydrateEvent(event, series);
	}),
});

export const listEntityChangeLogPage = query({
	args: {
		entityType: changeLogEntityTypeValidator,
		entityId: v.string(),
		cursor: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		items: v.array(changeLogItemValidator),
		nextCursor: v.optional(v.number()),
		hasMore: v.boolean(),
		totalLoaded: v.number(),
	}),
	handler: withQueryAuth(async (ctx, args: ListEntityChangeLogPageArgs) => {
		const limit = Number.isFinite(args.limit)
			? Math.max(1, Math.min(Math.floor(args.limit as number), 50))
			: 10;
		const rows = await ctx.db
			.query("changeLogs")
			.withIndex("by_userId_entityType_entityId_timestamp", (q) =>
				q.eq("userId", ctx.userId).eq("entityType", args.entityType).eq("entityId", args.entityId),
			)
			.order("desc")
			.collect();
		const cursor = args.cursor;
		const filtered = cursor === undefined ? rows : rows.filter((row) => row.timestamp < cursor);
		const items = filtered.slice(0, limit);
		const hasMore = filtered.length > limit;
		const nextCursor = hasMore ? items[items.length - 1]?.timestamp : undefined;
		return {
			items,
			nextCursor,
			hasMore,
			totalLoaded: items.length,
		};
	}),
});

export const listTaskOccurrencesPage = query({
	args: {
		taskId: v.id("tasks"),
		bucket: occurrenceBucketValidator,
		cursor: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	returns: occurrencePageValidator,
	handler: withQueryAuth(async (ctx, args: ListTaskOccurrencesPageArgs) => {
		const task = await ctx.db.get(args.taskId);
		if (!task || task.userId !== ctx.userId) {
			return { items: [], nextCursor: undefined, hasMore: false, totalLoaded: 0 };
		}
		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_source_sourceId_start", (q) =>
				q.eq("userId", ctx.userId).eq("source", "task").eq("sourceId", String(args.taskId)),
			)
			.collect();
		return toOccurrencePage(events, args);
	}),
});

export const listHabitOccurrencesPage = query({
	args: {
		habitId: v.id("habits"),
		bucket: occurrenceBucketValidator,
		cursor: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	returns: occurrencePageValidator,
	handler: withQueryAuth(async (ctx, args: ListHabitOccurrencesPageArgs) => {
		const habit = await ctx.db.get(args.habitId);
		if (!habit || habit.userId !== ctx.userId) {
			return { items: [], nextCursor: undefined, hasMore: false, totalLoaded: 0 };
		}
		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_source_sourceId_start", (q) =>
				q.eq("userId", ctx.userId).eq("source", "habit").eq("sourceId", String(args.habitId)),
			)
			.collect();
		return toOccurrencePage(events, args);
	}),
});

export const listGoogleCalendars = query({
	args: {},
	returns: v.array(
		v.object({
			id: v.string(),
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
			isExternal: v.boolean(),
		}),
	),
	handler: withQueryAuth(async (ctx) => {
		const { userId } = ctx;
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique();

		if (settings?.googleConnectedCalendars?.length) {
			return settings.googleConnectedCalendars.map((calendar) => ({
				id: calendar.calendarId,
				name: calendar.name,
				primary: calendar.primary,
				color: calendar.color,
				accessRole: calendar.accessRole,
				isExternal: isExternalGoogleCalendar({
					id: calendar.calendarId,
					primary: calendar.primary,
					accessRole: calendar.accessRole,
					isExternal: calendar.isExternal,
				}),
			}));
		}

		const series = await ctx.db
			.query("calendarEventSeries")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();

		const byCalendar = new Map<
			string,
			{
				id: string;
				name: string;
				primary: boolean;
				color?: string;
				accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
				isExternal: boolean;
				recency: number;
			}
		>();

		for (const calendarSeries of series) {
			if (calendarSeries.source !== "google") continue;
			const id = calendarSeries.calendarId ?? "primary";
			const candidate = {
				id,
				name: id,
				primary: id === "primary",
				color: calendarSeries.color,
				accessRole: undefined,
				isExternal: isExternalGoogleCalendar({
					id,
					primary: id === "primary",
				}),
				recency: Math.max(
					calendarSeries.lastSyncedAt ?? 0,
					calendarSeries.updatedAt ?? 0,
					calendarSeries._creationTime ?? 0,
				),
			};
			const existing = byCalendar.get(id);
			if (!existing || candidate.recency > existing.recency) {
				byCalendar.set(id, candidate);
			}
		}

		return Array.from(byCalendar.values())
			.sort((a, b) => {
				if (a.primary && !b.primary) return -1;
				if (!a.primary && b.primary) return 1;
				return a.name.localeCompare(b.name);
			})
			.map((calendar) => ({
				id: calendar.id,
				name: calendar.name,
				primary: calendar.primary,
				color: calendar.color,
				accessRole: calendar.accessRole,
				isExternal: calendar.isExternal,
			}));
	}),
});

export const getGoogleSyncHealth = query({
	args: {
		includeLatestRun: v.optional(v.boolean()),
	},
	returns: v.object({
		googleConnected: v.boolean(),
		activeChannels: v.number(),
		expiringSoonChannels: v.number(),
		lastWebhookAt: v.optional(v.number()),
		latestRunStatus: v.optional(
			v.union(
				v.literal("pending"),
				v.literal("running"),
				v.literal("completed"),
				v.literal("failed"),
			),
		),
		latestRunCompletedAt: v.optional(v.number()),
		latestRunError: v.optional(v.string()),
	}),
	handler: withQueryAuth(async (ctx, args: { includeLatestRun?: boolean }) => {
		const { userId } = ctx;
		const latestRunPromise = args.includeLatestRun
			? ctx.db
					.query("googleSyncRuns")
					.withIndex("by_userId_startedAt", (q) => q.eq("userId", userId))
					.order("desc")
					.take(1)
			: Promise.resolve([] as Doc<"googleSyncRuns">[]);
		const [settings, channels, latestRunArr] = await Promise.all([
			ctx.db
				.query("userSettings")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.unique(),
			ctx.db
				.query("googleCalendarWatchChannels")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.collect(),
			latestRunPromise,
		]);
		const now = Date.now();
		const activeChannels = channels.filter(
			(channel) => channel.status === "active" && channel.expirationAt > now,
		);
		const expiringSoonChannels = activeChannels.filter(
			(channel) => channel.expirationAt <= now + 24 * 60 * 60 * 1000,
		);
		const lastWebhookAt = channels.reduce<number | undefined>((latest, channel) => {
			const current = channel.lastNotifiedAt;
			if (typeof current !== "number") return latest;
			return typeof latest === "number" ? Math.max(latest, current) : current;
		}, undefined);
		const latestRun = latestRunArr[0];
		return {
			googleConnected: Boolean(settings?.googleRefreshToken),
			activeChannels: activeChannels.length,
			expiringSoonChannels: expiringSoonChannels.length,
			lastWebhookAt,
			latestRunStatus: latestRun?.status,
			latestRunCompletedAt: latestRun?.completedAt,
			latestRunError: latestRun?.error,
		};
	}),
});
