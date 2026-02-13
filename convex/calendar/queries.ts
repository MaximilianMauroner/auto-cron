import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";

type EventSource = "google" | "task" | "habit" | "manual";
type ListEventsArgs = {
	start: number;
	end: number;
	sourceFilter?: EventSource[];
};

const MINUTE_MS = 60 * 1000;
const normalizeToMinute = (timestamp: number) => Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
const REMOTE_CALENDAR_ID_REGEX =
	/(group\.(?:v\.)?calendar\.google\.com|import\.calendar\.google\.com|holiday)/i;

const recencyScore = (event: Doc<"calendarEvents">) =>
	Math.max(event.lastSyncedAt ?? 0, event.updatedAt ?? 0, event._creationTime ?? 0);

const buildDedupeKey = (event: Doc<"calendarEvents">) => {
	if (event.seriesId && event.occurrenceStart !== undefined) {
		return `series:${event.seriesId}:${event.occurrenceStart}`;
	}
	if (event.googleEventId) {
		const occurrenceTs = normalizeToMinute(event.originalStartTime ?? event.start);
		return `google:${event.calendarId ?? "primary"}:${event.googleEventId}:${occurrenceTs}`;
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

		const deduped = new Map<string, Doc<"calendarEvents">>();
		for (const event of filtered) {
			const key = buildDedupeKey(event);
			const previous = deduped.get(key);
			if (!previous || recencyScore(event) > recencyScore(previous)) {
				deduped.set(key, event);
			}
		}
		const dedupedEvents = Array.from(deduped.values());

		const seriesIds = Array.from(
			new Set(
				dedupedEvents
					.map((event) => event.seriesId)
					.filter((seriesId): seriesId is NonNullable<typeof seriesId> => Boolean(seriesId)),
			),
		);
		const seriesDocs = await Promise.all(seriesIds.map((seriesId) => ctx.db.get(seriesId)));
		const seriesById = new Map<string, Doc<"calendarEventSeries"> | null>();
		for (let index = 0; index < seriesIds.length; index += 1) {
			seriesById.set(String(seriesIds[index]), seriesDocs[index] ?? null);
		}
		const hydratedEvents = dedupedEvents.map((event) =>
			hydrateEvent(event, event.seriesId ? (seriesById.get(String(event.seriesId)) ?? null) : null),
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
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.filter((q) => q.and(q.eq(q.field("source"), "task"), q.eq(q.field("sourceId"), args.taskId)))
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
		const seriesById = new Map<string, Doc<"calendarEventSeries"> | null>();
		for (let i = 0; i < seriesIds.length; i += 1) {
			seriesById.set(String(seriesIds[i]), seriesDocs[i] ?? null);
		}

		const deduped = new Map<string, Doc<"calendarEvents">>();
		for (const event of valid) {
			const key = buildDedupeKey(event);
			const prev = deduped.get(key);
			if (!prev || recencyScore(event) > recencyScore(prev)) {
				deduped.set(key, event);
			}
		}

		return Array.from(deduped.values())
			.map((event) =>
				hydrateEvent(
					event,
					event.seriesId ? (seriesById.get(String(event.seriesId)) ?? null) : null,
				),
			)
			.sort((a, b) => a.start - b.start);
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
	args: {},
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
	handler: withQueryAuth(async (ctx) => {
		const { userId } = ctx;
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique();
		const channels = await ctx.db
			.query("googleCalendarWatchChannels")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
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
		const latestRun = (
			await ctx.db
				.query("googleSyncRuns")
				.withIndex("by_userId_startedAt", (q) => q.eq("userId", userId))
				.order("desc")
				.take(1)
		)[0];
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
