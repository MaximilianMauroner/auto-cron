"use node";

import { createHash, randomUUID } from "node:crypto";
import type { CalendarProvider, GoogleEventUpsert } from "../providers/calendar/types";
import type {
	CalendarListItem,
	DeletedSyncEvent,
	EffectiveSyncRange,
	PushEventPatch,
	RemovedGoogleEvent,
	ScheduledEventForGoogleSync,
	SyncPushAction,
	WatchCalendarItem,
	WatchChannelItem,
} from "./actionTypes";
export type {
	BusyStatus,
	CalendarListItem,
	DeletedSyncEvent,
	PushEventPatch,
	RemovedGoogleEvent,
	ScheduledEventForGoogleSync,
	Visibility,
	WatchCalendarItem,
	WatchChannelItem,
} from "./actionTypes";

export const WATCH_CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;
export const WATCH_RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizeWatchTokenInput = (value: string) => value.trim();

export const hashWatchToken = (rawToken: string, secret: string) =>
	createHash("sha256")
		.update(`${secret}:${normalizeWatchTokenInput(rawToken)}`)
		.digest("hex");

export const secureEqualString = (left: string, right: string) => {
	if (left.length !== right.length) return false;
	let diff = 0;
	for (let index = 0; index < left.length; index += 1) {
		diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return diff === 0;
};

export const getWatchConfig = () => {
	const runtimeEnv =
		typeof process !== "undefined" && process.env
			? (process.env as Record<string, string | undefined>)
			: {};
	const webhookUrl = runtimeEnv.GOOGLE_CALENDAR_WEBHOOK_URL?.trim();
	const tokenSecret = runtimeEnv.GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET?.trim();
	if (!webhookUrl || !tokenSecret) return null;
	return {
		webhookUrl,
		tokenSecret,
	};
};

export const createChannelToken = (tokenSecret: string) => {
	const raw = randomUUID();
	return {
		raw,
		hash: hashWatchToken(raw, tokenSecret),
	};
};

const isWritableCalendar = (calendar: {
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
}) => calendar.accessRole === "owner" || calendar.accessRole === "writer";

const normalizeOptionalString = (value: string | undefined) => {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : undefined;
};

export const resolveCalendarId = (calendarId?: string) => calendarId || "primary";

export const isSyncedEventEqual = (
	localEvent: ScheduledEventForGoogleSync,
	remoteEvent: GoogleEventUpsert,
) => {
	return (
		localEvent.title === remoteEvent.title &&
		normalizeOptionalString(localEvent.description) ===
			normalizeOptionalString(remoteEvent.description) &&
		localEvent.start === remoteEvent.start &&
		localEvent.end === remoteEvent.end &&
		localEvent.allDay === remoteEvent.allDay &&
		resolveCalendarId(localEvent.calendarId) === remoteEvent.calendarId &&
		(localEvent.recurrenceRule ?? undefined) === (remoteEvent.recurrenceRule ?? undefined) &&
		localEvent.busyStatus === remoteEvent.busyStatus &&
		(localEvent.visibility ?? undefined) === (remoteEvent.visibility ?? undefined) &&
		normalizeOptionalString(localEvent.location) ===
			normalizeOptionalString(remoteEvent.location) &&
		normalizeOptionalString(localEvent.color) === normalizeOptionalString(remoteEvent.color)
	);
};

const fallbackPrimaryCalendar = (): CalendarListItem => ({
	id: "primary",
	summary: "Primary",
	primary: true,
	color: undefined,
	accessRole: "owner",
	isExternal: false,
});

export const resolveEffectiveSyncRange = (
	now: number,
	rangeStart?: number,
	rangeEnd?: number,
): EffectiveSyncRange => ({
	start: rangeStart ?? now - 1000 * 60 * 60 * 24 * 7,
	end: rangeEnd ?? now + 1000 * 60 * 60 * 24 * 84,
});

export const resolveSyncedCalendars = (calendars: CalendarListItem[]) =>
	calendars.length ? calendars : [fallbackPrimaryCalendar()];

export const resolveCombinedNormalizationRange = (
	events: GoogleEventUpsert[],
	effectiveRange: EffectiveSyncRange,
) => {
	const syncedStarts = events.map((event) => event.start);
	const syncedEnds = events.map((event) => event.end);
	const rangePaddingMs = 60 * 1000;

	const start =
		syncedStarts.length > 0
			? Math.min(effectiveRange.start, Math.min(...syncedStarts) - rangePaddingMs)
			: effectiveRange.start;
	const end =
		syncedEnds.length > 0
			? Math.max(effectiveRange.end, Math.max(...syncedEnds) + rangePaddingMs)
			: effectiveRange.end;

	return { start, end };
};

export const resolveSyncPushAction = (
	event: ScheduledEventForGoogleSync,
	remote: GoogleEventUpsert | undefined,
): SyncPushAction => {
	if (!event.googleEventId || !remote) return "create";
	return isSyncedEventEqual(event, remote) ? "unchanged" : "update";
};

export const resolveWatchTargetCalendars = (calendars: WatchCalendarItem[]) => {
	const writableCalendars = calendars.filter(
		(calendar) => isWritableCalendar(calendar) || (calendar.primary && !calendar.accessRole),
	);
	if (writableCalendars.length > 0) return writableCalendars;

	return [
		{
			id: "primary",
			summary: "Primary",
			primary: true,
			accessRole: "owner" as const,
		},
	];
};

export const buildActiveWatchChannelMap = (channels: WatchChannelItem[]) =>
	new Map(
		channels
			.filter((channel) => channel.status === "active")
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map((channel) => [channel.calendarId, channel] as const),
	);

export const isFreshWatchChannel = (channel: WatchChannelItem | undefined, now: number) =>
	Boolean(channel && channel.expirationAt - now > WATCH_RENEWAL_WINDOW_MS);

export const resolveWatchChannelDeactivationStatus = (
	channel: WatchChannelItem,
	now: number,
): "expired" | "stopped" => (channel.expirationAt <= now ? "expired" : "stopped");

export const mapProviderEventToMutationEvent = (event: GoogleEventUpsert) => ({
	googleEventId: event.googleEventId,
	title: event.title,
	description: event.description,
	start: event.start,
	end: event.end,
	allDay: event.allDay,
	calendarId: event.calendarId,
	recurrenceRule: event.recurrenceRule,
	recurringEventId: event.recurringEventId,
	originalStartTime: event.originalStartTime,
	status: event.status,
	etag: event.etag,
	busyStatus: event.busyStatus,
	visibility: event.visibility,
	location: event.location,
	color: event.color,
	lastSyncedAt: event.lastSyncedAt,
});

export const mapCalendarToConnectedCalendar = (calendar: CalendarListItem) => ({
	calendarId: calendar.id,
	name: calendar.summary,
	primary: calendar.primary,
	color: calendar.color,
	accessRole: calendar.accessRole,
	isExternal: calendar.isExternal,
});

export const resolvePrimaryNextToken = (
	nextTokens: Array<{ calendarId: string; syncToken: string }>,
) =>
	nextTokens.find((token) => token.calendarId === "primary")?.syncToken ?? nextTokens[0]?.syncToken;

export const buildSyncMutationPayload = ({
	userId,
	resetCalendars,
	events,
	deletedEvents,
	nextTokens,
	calendars,
}: {
	userId: string;
	resetCalendars: Set<string>;
	events: ReturnType<typeof mapProviderEventToMutationEvent>[];
	deletedEvents: DeletedSyncEvent[];
	nextTokens: Array<{ calendarId: string; syncToken: string }>;
	calendars: CalendarListItem[];
}) => ({
	userId,
	resetCalendars: Array.from(resetCalendars),
	events,
	deletedEvents,
	nextSyncToken: resolvePrimaryNextToken(nextTokens),
	syncTokens: nextTokens,
	connectedCalendars: calendars.map(mapCalendarToConnectedCalendar),
});

export const collectCalendarsToSync = (
	scheduledEvents: ScheduledEventForGoogleSync[],
	removedGoogleEvents: RemovedGoogleEvent[],
) => {
	const calendarsToSync = new Set<string>();
	for (const event of scheduledEvents) {
		calendarsToSync.add(resolveCalendarId(event.calendarId));
	}
	for (const removed of removedGoogleEvents) {
		calendarsToSync.add(resolveCalendarId(removed.calendarId));
	}
	return calendarsToSync;
};

export const listCalendarColors = async (provider: CalendarProvider, refreshToken: string) => {
	try {
		const availableCalendars = await provider.listCalendars({ refreshToken });
		return new Map(availableCalendars.map((calendar) => [calendar.id, calendar.color] as const));
	} catch {
		return new Map<string, string | undefined>();
	}
};

export const pullRemoteEventsForCalendars = async ({
	provider,
	refreshToken,
	userId,
	calendarIds,
	calendarColorById,
	horizonStart,
	horizonEnd,
}: {
	provider: CalendarProvider;
	refreshToken: string;
	userId: string;
	calendarIds: Set<string>;
	calendarColorById: Map<string, string | undefined>;
	horizonStart: number;
	horizonEnd: number;
}) => {
	const remoteByGoogleEventId = new Map<string, GoogleEventUpsert>();
	for (const calendarId of calendarIds) {
		try {
			const synced = await provider.syncEvents({
				refreshToken,
				calendarId,
				calendarColor: calendarColorById.get(calendarId),
				rangeStart: horizonStart,
				rangeEnd: horizonEnd,
			});
			for (const remoteEvent of synced.events) {
				remoteByGoogleEventId.set(remoteEvent.googleEventId, remoteEvent);
			}
		} catch (error) {
			console.error("[calendar] failed to pull events before scheduler push", {
				userId,
				calendarId,
				error: error instanceof Error ? error.message : error,
			});
		}
	}
	return remoteByGoogleEventId;
};

export const deleteRemovedGoogleEvents = async ({
	provider,
	refreshToken,
	removedGoogleEvents,
	remoteByGoogleEventId,
	horizonStart,
	horizonEnd,
}: {
	provider: CalendarProvider;
	refreshToken: string;
	removedGoogleEvents: RemovedGoogleEvent[];
	remoteByGoogleEventId: Map<string, GoogleEventUpsert>;
	horizonStart: number;
	horizonEnd: number;
}) => {
	const seenRemoved = new Set<string>();
	let deleted = 0;

	for (const removed of removedGoogleEvents) {
		const dedupeKey = `${removed.calendarId}:${removed.googleEventId}`;
		if (seenRemoved.has(dedupeKey)) continue;
		seenRemoved.add(dedupeKey);
		if (!remoteByGoogleEventId.has(removed.googleEventId)) continue;

		await provider.deleteEvent({
			refreshToken,
			calendarId: resolveCalendarId(removed.calendarId),
			event: {
				_id: dedupeKey,
				title: "Scheduled block",
				start: horizonStart,
				end: horizonEnd,
				allDay: false,
				googleEventId: removed.googleEventId,
				calendarId: resolveCalendarId(removed.calendarId),
				busyStatus: "busy",
			},
			scope: "single",
		});
		deleted += 1;
	}

	return deleted;
};

export const resolvePushEventPatch = (
	operation: "create" | "update" | "delete" | "moveResize",
	event: { start: number; end: number; allDay: boolean },
	patch: PushEventPatch | undefined,
) => {
	if (operation === "moveResize") {
		return {
			start: event.start,
			end: event.end,
			allDay: event.allDay,
		};
	}
	return patch ?? {};
};
