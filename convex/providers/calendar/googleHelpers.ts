import type { GoogleCalendarListEntry, GoogleEvent, GoogleEventDateTime } from "./googleTypes";
import type {
	CalendarEventCreateInput,
	CalendarEventUpdateInput,
	CalendarProvider,
	CalendarProviderSyncResult,
	GoogleEventUpsert,
	ProviderCalendar,
} from "./types";
export type { GoogleCalendarListEntry, GoogleEvent, GoogleEventsResponse } from "./googleTypes";

export const GOOGLE_CALENDAR_LIST_PAGE_SIZE = 250;
export const GOOGLE_EVENTS_PAGE_SIZE = 2500;
const GOOGLE_WATCH_TTL_MIN_SECONDS = 60;
const GOOGLE_WATCH_TTL_MAX_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_SYNC_LOOKBACK_DAYS = 30;
const DEFAULT_SYNC_LOOKAHEAD_DAYS = 180;
const DEFAULT_WATCH_EXPIRATION_DAYS = 7;

const APP_SOURCE_KEY_FIELD = "autoCronSourceId";
const GOOGLE_COLOR_ID_TO_HEX: Record<string, string> = {
	"1": "#a4bdfc",
	"2": "#7ae7bf",
	"3": "#dbadff",
	"4": "#ff887c",
	"5": "#fbd75b",
	"6": "#ffb878",
	"7": "#46d6db",
	"8": "#e1e1e1",
	"9": "#5484ed",
	"10": "#16a765",
	"11": "#dc2127",
	"12": "#f691b2",
	"13": "#c2c2c2",
	"14": "#4986e7",
	"15": "#9fc6e7",
	"16": "#47b6ff",
	"17": "#51b749",
	"18": "#fbd75b",
	"19": "#ffb878",
	"20": "#ff887c",
	"21": "#dc2127",
	"22": "#dbadff",
	"23": "#c2c2c2",
	"24": "#9fc6e7",
};
const GOOGLE_HEX_TO_COLOR_ID = Object.fromEntries(
	Object.entries(GOOGLE_COLOR_ID_TO_HEX).map(([id, hex]) => [hex.toLowerCase(), id]),
);
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const hexToRgb = (hex: string): [number, number, number] => {
	const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
	return [
		Number.parseInt(h.slice(1, 3), 16),
		Number.parseInt(h.slice(3, 5), 16),
		Number.parseInt(h.slice(5, 7), 16),
	];
};

const colorDistanceSq = (a: [number, number, number], b: [number, number, number]): number =>
	(a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const REMOTE_CALENDAR_ID_REGEX =
	/(group\.(?:v\.)?calendar\.google\.com|import\.calendar\.google\.com|holiday)/i;

const isExternalCalendar = (calendar: GoogleCalendarListEntry) => {
	if (calendar.primary) return false;
	if (calendar.accessRole === "reader" || calendar.accessRole === "freeBusyReader") return true;
	return REMOTE_CALENDAR_ID_REGEX.test(calendar.id);
};

const normalizeColorTokenToHex = (token?: string) => {
	if (!token) return undefined;
	const normalized = token.trim().toLowerCase();
	if (HEX_COLOR_REGEX.test(normalized)) return normalized;
	return GOOGLE_COLOR_ID_TO_HEX[normalized];
};

const toGoogleColorId = (color?: string) => {
	if (!color) return undefined;
	const normalized = color.trim().toLowerCase();
	if (GOOGLE_COLOR_ID_TO_HEX[normalized]) return normalized;
	const exactMatch = GOOGLE_HEX_TO_COLOR_ID[normalized];
	if (exactMatch) return exactMatch;
	if (!HEX_COLOR_REGEX.test(normalized)) return undefined;
	const rgb = hexToRgb(normalized);
	let bestId: string | undefined;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const [id, hex] of Object.entries(GOOGLE_COLOR_ID_TO_HEX)) {
		const dist = colorDistanceSq(rgb, hexToRgb(hex));
		if (dist < bestDist) {
			bestDist = dist;
			bestId = id;
		}
	}
	return bestId;
};

const toDateTime = (value: number) => new Date(value).toISOString();

const RFC3339_OFFSET_SUFFIX_REGEX = /(z|[+-]\d{2}:\d{2})$/i;
const LOCAL_DATE_TIME_REGEX =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.(\d{1,3}))?)?$/;
const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getTimeZoneFormatter = (timeZone: string) => {
	const existing = timeZoneFormatterCache.get(timeZone);
	if (existing) return existing;
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	timeZoneFormatterCache.set(timeZone, formatter);
	return formatter;
};

const getTimeZoneParts = (timestamp: number, timeZone: string) => {
	try {
		const formatter = getTimeZoneFormatter(timeZone);
		const parts = formatter.formatToParts(new Date(timestamp));
		const byType = new Map(parts.map((part) => [part.type, part.value]));
		const year = Number.parseInt(byType.get("year") ?? "", 10);
		const month = Number.parseInt(byType.get("month") ?? "", 10);
		const day = Number.parseInt(byType.get("day") ?? "", 10);
		const hour = Number.parseInt(byType.get("hour") ?? "", 10);
		const minute = Number.parseInt(byType.get("minute") ?? "", 10);
		const second = Number.parseInt(byType.get("second") ?? "", 10);
		if (
			!Number.isFinite(year) ||
			!Number.isFinite(month) ||
			!Number.isFinite(day) ||
			!Number.isFinite(hour) ||
			!Number.isFinite(minute) ||
			!Number.isFinite(second)
		) {
			return null;
		}
		return {
			year,
			month,
			day,
			hour,
			minute,
			second,
		};
	} catch {
		return null;
	}
};

const parseLocalDateTimeInTimeZone = (raw: string, timeZone: string): number | undefined => {
	const match = raw.match(LOCAL_DATE_TIME_REGEX);
	if (!match) return undefined;

	const year = Number.parseInt(match[1] ?? "", 10);
	const month = Number.parseInt(match[2] ?? "", 10);
	const day = Number.parseInt(match[3] ?? "", 10);
	const hour = Number.parseInt(match[4] ?? "", 10);
	const minute = Number.parseInt(match[5] ?? "", 10);
	const second = Number.parseInt(match[6] ?? "0", 10);
	const millisecond = Number.parseInt((match[8] ?? "0").padEnd(3, "0"), 10);

	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day) ||
		!Number.isFinite(hour) ||
		!Number.isFinite(minute) ||
		!Number.isFinite(second) ||
		!Number.isFinite(millisecond)
	) {
		return undefined;
	}

	const targetUtcValue = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
	let candidate = targetUtcValue;
	for (let index = 0; index < 3; index += 1) {
		const resolved = getTimeZoneParts(candidate, timeZone);
		if (!resolved) return undefined;
		const observedUtcValue = Date.UTC(
			resolved.year,
			resolved.month - 1,
			resolved.day,
			resolved.hour,
			resolved.minute,
			resolved.second,
			millisecond,
		);
		const delta = targetUtcValue - observedUtcValue;
		candidate += delta;
		if (delta === 0) break;
	}
	return candidate;
};

const maybeDateTimeToMillis = (dt?: GoogleEventDateTime): number | undefined => {
	if (dt?.dateTime) {
		if (RFC3339_OFFSET_SUFFIX_REGEX.test(dt.dateTime)) {
			const parsed = Date.parse(dt.dateTime);
			return Number.isNaN(parsed) ? undefined : parsed;
		}

		if (dt.timeZone) {
			const parsedInTimeZone = parseLocalDateTimeInTimeZone(dt.dateTime, dt.timeZone);
			if (parsedInTimeZone !== undefined) return parsedInTimeZone;
		}

		const parsed = Date.parse(dt.dateTime);
		return Number.isNaN(parsed) ? undefined : parsed;
	}

	if (!dt?.date) return undefined;
	const parsed = Date.parse(`${dt.date}T00:00:00.000Z`);
	return Number.isNaN(parsed) ? undefined : parsed;
};

const toBusyStatus = (event: GoogleEvent): "free" | "busy" | "tentative" => {
	if (event.status === "tentative") return "tentative";
	if (event.transparency === "transparent") return "free";
	return "busy";
};

export const toGoogleEventUpsert = (
	event: GoogleEvent,
	calendarId: string,
	calendarColor?: string,
): GoogleEventUpsert | null => {
	const start = maybeDateTimeToMillis(event.start);
	const end = maybeDateTimeToMillis(event.end);
	if (!start || !end || !event.id) return null;

	return {
		id: event.id,
		title: event.summary ?? "Untitled event",
		description: event.description,
		start,
		end,
		allDay: Boolean(event.start?.date && !event.start?.dateTime),
		googleEventId: event.id,
		calendarId,
		appSourceKey: event.extendedProperties?.private?.[APP_SOURCE_KEY_FIELD],
		recurrenceRule: event.recurrence?.[0],
		recurringEventId: event.recurringEventId,
		originalStartTime: maybeDateTimeToMillis(event.originalStartTime),
		status: event.status,
		etag: event.etag,
		htmlLink: event.htmlLink,
		busyStatus: toBusyStatus(event),
		visibility: event.visibility,
		location: event.location,
		color: normalizeColorTokenToHex(event.colorId ?? calendarColor),
		lastSyncedAt: Date.now(),
	};
};

const toDeletedEvent = (event: GoogleEvent, calendarId: string) => {
	if (!event.id) return null;
	return {
		googleEventId: event.id,
		calendarId,
		originalStartTime: maybeDateTimeToMillis(event.originalStartTime),
		lastSyncedAt: Date.now(),
	};
};

export const createGoogleEventPayload = (
	input: CalendarEventCreateInput,
): Record<string, unknown> => {
	const isAllDay = Boolean(input.allDay);
	const colorId = toGoogleColorId(input.color);
	return {
		summary: input.title,
		description: input.description,
		location: input.location,
		extendedProperties: input.appSourceKey
			? { private: { [APP_SOURCE_KEY_FIELD]: input.appSourceKey } }
			: undefined,
		visibility: input.visibility,
		start: isAllDay
			? { date: new Date(input.start).toISOString().slice(0, 10) }
			: { dateTime: toDateTime(input.start) },
		end: isAllDay
			? { date: new Date(input.end).toISOString().slice(0, 10) }
			: { dateTime: toDateTime(input.end) },
		recurrence: input.recurrenceRule ? [input.recurrenceRule] : undefined,
		transparency: input.busyStatus === "free" ? "transparent" : "opaque",
		colorId,
	};
};

export const patchGoogleEventPayload = (
	patch: CalendarEventUpdateInput,
	appSourceKey?: string,
): Record<string, unknown> => {
	const payload: Record<string, unknown> = {};
	if (patch.title !== undefined) payload.summary = patch.title;
	if (patch.description !== undefined) payload.description = patch.description;
	if (patch.location !== undefined) payload.location = patch.location;
	if (patch.visibility !== undefined) payload.visibility = patch.visibility;
	if (patch.start !== undefined || patch.allDay !== undefined) {
		const allDay = Boolean(patch.allDay);
		if (patch.start !== undefined) {
			payload.start = allDay
				? { date: new Date(patch.start).toISOString().slice(0, 10) }
				: { dateTime: toDateTime(patch.start) };
		}
	}
	if (patch.end !== undefined || patch.allDay !== undefined) {
		const allDay = Boolean(patch.allDay);
		if (patch.end !== undefined) {
			payload.end = allDay
				? { date: new Date(patch.end).toISOString().slice(0, 10) }
				: { dateTime: toDateTime(patch.end) };
		}
	}
	if (patch.recurrenceRule !== undefined) {
		payload.recurrence = patch.recurrenceRule ? [patch.recurrenceRule] : [];
	}
	if (patch.busyStatus !== undefined) {
		payload.transparency = patch.busyStatus === "free" ? "transparent" : "opaque";
	}
	if (patch.color !== undefined) {
		payload.colorId = toGoogleColorId(patch.color);
	}
	if (appSourceKey) {
		payload.extendedProperties = {
			private: {
				[APP_SOURCE_KEY_FIELD]: appSourceKey,
			},
		};
	}
	return payload;
};

const resolveDefaultSyncStart = () => Date.now() - 1000 * 60 * 60 * 24 * DEFAULT_SYNC_LOOKBACK_DAYS;

const resolveDefaultSyncEnd = () => Date.now() + 1000 * 60 * 60 * 24 * DEFAULT_SYNC_LOOKAHEAD_DAYS;

export const resolveSyncRangeIso = (rangeStart?: number, rangeEnd?: number) => ({
	timeMin: new Date(rangeStart ?? resolveDefaultSyncStart()).toISOString(),
	timeMax: new Date(rangeEnd ?? resolveDefaultSyncEnd()).toISOString(),
});

const resolveDefaultWatchExpiration = () =>
	Date.now() + DEFAULT_WATCH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

export const clampWatchTtlSeconds = (ttlSeconds: number) =>
	Math.max(
		GOOGLE_WATCH_TTL_MIN_SECONDS,
		Math.min(Math.round(ttlSeconds), GOOGLE_WATCH_TTL_MAX_SECONDS),
	);

export const toGoogleUpdateFallbackEvent = (
	event: Parameters<CalendarProvider["updateEvent"]>[0]["event"],
	googleEventId: string,
): GoogleEvent => ({
	id: googleEventId,
	summary: event.title,
	description: event.description,
	location: event.location,
	extendedProperties: event.appSourceKey
		? { private: { [APP_SOURCE_KEY_FIELD]: event.appSourceKey } }
		: event.sourceId
			? { private: { [APP_SOURCE_KEY_FIELD]: event.sourceId } }
			: undefined,
	visibility: event.visibility,
	start: event.allDay
		? { date: new Date(event.start).toISOString().slice(0, 10) }
		: { dateTime: toDateTime(event.start) },
	end: event.allDay
		? { date: new Date(event.end).toISOString().slice(0, 10) }
		: { dateTime: toDateTime(event.end) },
	status: event.status,
	etag: event.etag,
	recurrence: event.recurrenceRule ? [event.recurrenceRule] : undefined,
	recurringEventId: event.recurringEventId,
	originalStartTime:
		event.originalStartTime !== undefined
			? { dateTime: toDateTime(event.originalStartTime) }
			: undefined,
	transparency: event.busyStatus === "free" ? "transparent" : "opaque",
	colorId: toGoogleColorId(event.color),
});

export const mapCalendarListEntry = (
	calendar: GoogleCalendarListEntry,
): ProviderCalendar | null => {
	if (!calendar.id || calendar.deleted || calendar.hidden) return null;
	return {
		id: calendar.id,
		summary: calendar.summary ?? calendar.id,
		primary: Boolean(calendar.primary),
		color: normalizeColorTokenToHex(calendar.backgroundColor ?? calendar.colorId),
		accessRole: calendar.accessRole,
		isExternal: isExternalCalendar(calendar),
	};
};

export const ingestSyncResponseItems = ({
	items,
	calendarId,
	calendarColor,
	events,
	deletedEvents,
	unresolvedSeriesIds,
}: {
	items: GoogleEvent[] | undefined;
	calendarId: string;
	calendarColor?: string;
	events: GoogleEventUpsert[];
	deletedEvents: NonNullable<CalendarProviderSyncResult["deletedEvents"]>;
	unresolvedSeriesIds: Set<string>;
}) => {
	for (const event of items ?? []) {
		if (!event.id) continue;
		if (event.status === "cancelled" || event.deleted) {
			const deletedEvent = toDeletedEvent(event, calendarId);
			if (deletedEvent) {
				deletedEvents.push(deletedEvent);
			}
			continue;
		}

		const mapped = toGoogleEventUpsert(event, calendarId, calendarColor);
		if (!mapped) continue;
		if (!mapped.recurrenceRule && mapped.recurringEventId) {
			unresolvedSeriesIds.add(mapped.recurringEventId);
		}
		events.push(mapped);
	}
};

export const parseWatchExpiration = (raw: string | undefined): number => {
	const parsed = Number.parseInt(raw ?? "", 10);
	if (Number.isFinite(parsed) && parsed > 0) return parsed;
	return resolveDefaultWatchExpiration();
};
