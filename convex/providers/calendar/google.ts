"use node";
import { env } from "../../env";
import type {
	CalendarEventCreateInput,
	CalendarEventUpdateInput,
	CalendarProvider,
	CalendarProviderSyncResult,
	GoogleEventUpsert,
	ProviderCalendar,
} from "./types";

type GoogleTokenResponse = {
	access_token: string;
	expires_in: number;
	token_type: string;
};

type GoogleEventDateTime = {
	dateTime?: string;
	date?: string;
	timeZone?: string;
};

type GoogleEvent = {
	id: string;
	summary?: string;
	description?: string;
	location?: string;
	visibility?: "default" | "public" | "private" | "confidential";
	start?: GoogleEventDateTime;
	end?: GoogleEventDateTime;
	status?: "confirmed" | "tentative" | "cancelled";
	deleted?: boolean;
	etag?: string;
	recurrence?: string[];
	recurringEventId?: string;
	originalStartTime?: GoogleEventDateTime;
	colorId?: string;
	htmlLink?: string;
	transparency?: "opaque" | "transparent";
};

type GoogleEventsResponse = {
	items?: GoogleEvent[];
	nextPageToken?: string;
	nextSyncToken?: string;
};

type GoogleCalendarListEntry = {
	id: string;
	summary?: string;
	primary?: boolean;
	hidden?: boolean;
	deleted?: boolean;
	colorId?: string;
	backgroundColor?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
};

type GoogleCalendarListResponse = {
	items?: GoogleCalendarListEntry[];
	nextPageToken?: string;
};

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
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
	return GOOGLE_HEX_TO_COLOR_ID[normalized];
};

const toDateTime = (value: number) => new Date(value).toISOString();

const maybeDateTimeToMillis = (dt?: GoogleEventDateTime): number | undefined => {
	const raw = dt?.dateTime ?? dt?.date;
	if (!raw) return undefined;
	const parsed = Date.parse(raw);
	return Number.isNaN(parsed) ? undefined : parsed;
};

const toBusyStatus = (event: GoogleEvent): "free" | "busy" | "tentative" => {
	if (event.status === "tentative") return "tentative";
	if (event.transparency === "transparent") return "free";
	return "busy";
};

const toGoogleEventUpsert = (
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

const createGoogleEventPayload = (input: CalendarEventCreateInput): Record<string, unknown> => {
	const isAllDay = Boolean(input.allDay);
	const colorId = toGoogleColorId(input.color);
	return {
		summary: input.title,
		description: input.description,
		location: input.location,
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

const patchGoogleEventPayload = (patch: CalendarEventUpdateInput): Record<string, unknown> => {
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
	return payload;
};

const getAccessToken = async (refreshToken: string) => {
	const environment = env();
	const clientId = environment.GOOGLE_CLIENT_ID;
	const clientSecret = environment.GOOGLE_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.");
	}

	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		}),
	});
	if (!response.ok) {
		throw new Error(`Unable to refresh Google token (${response.status}).`);
	}
	return (await response.json()) as GoogleTokenResponse;
};

const callGoogle = async (
	refreshToken: string,
	path: string,
	init: RequestInit = {},
): Promise<Response> => {
	const token = await getAccessToken(refreshToken);
	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${token.access_token}`);
	if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
	return fetch(`${GOOGLE_CALENDAR_BASE}${path}`, { ...init, headers });
};

export const googleCalendarProvider: CalendarProvider = {
	async listCalendars({ refreshToken }) {
		const calendars: ProviderCalendar[] = [];
		let nextPageToken: string | undefined;

		do {
			const searchParams = new URLSearchParams({
				showHidden: "false",
				showDeleted: "false",
				maxResults: "250",
			});
			if (nextPageToken) {
				searchParams.set("pageToken", nextPageToken);
			}

			const response = await callGoogle(
				refreshToken,
				`/users/me/calendarList?${searchParams.toString()}`,
			);
			if (!response.ok) {
				throw new Error(`Google calendar list failed (${response.status})`);
			}

			const data = (await response.json()) as GoogleCalendarListResponse;
			for (const calendar of data.items ?? []) {
				if (!calendar.id || calendar.deleted || calendar.hidden) continue;
				calendars.push({
					id: calendar.id,
					summary: calendar.summary ?? calendar.id,
					primary: Boolean(calendar.primary),
					color: normalizeColorTokenToHex(calendar.backgroundColor ?? calendar.colorId),
					accessRole: calendar.accessRole,
					isExternal: isExternalCalendar(calendar),
				});
			}
			nextPageToken = data.nextPageToken;
		} while (nextPageToken);

		return calendars;
	},

	async syncEvents({ refreshToken, calendarId, calendarColor, syncToken, rangeStart, rangeEnd }) {
		const recurrenceRuleCache = new Map<string, string | undefined>();
		const getSeriesRecurrenceRule = async (seriesId: string) => {
			if (recurrenceRuleCache.has(seriesId)) {
				return recurrenceRuleCache.get(seriesId);
			}
			const response = await callGoogle(
				refreshToken,
				`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(seriesId)}?fields=id,recurrence`,
			);
			if (response.status === 404 || response.status === 410) {
				recurrenceRuleCache.set(seriesId, undefined);
				return undefined;
			}
			if (!response.ok) {
				throw new Error(`Failed to fetch Google series rule (${response.status})`);
			}
			const data = (await response.json()) as GoogleEvent;
			const rule = data.recurrence?.[0];
			recurrenceRuleCache.set(seriesId, rule);
			return rule;
		};

		const fetchEvents = async (currentSyncToken?: string) => {
			const events: GoogleEventUpsert[] = [];
			const deletedEvents: NonNullable<CalendarProviderSyncResult["deletedEvents"]> = [];
			const unresolvedSeriesIds = new Set<string>();
			let nextPageToken: string | undefined;
			let nextSyncToken: string | undefined;

			do {
				const searchParams = new URLSearchParams({
					singleEvents: "true",
					showDeleted: "true",
					maxResults: "2500",
				});
				if (currentSyncToken) {
					searchParams.set("syncToken", currentSyncToken);
				} else {
					searchParams.set("orderBy", "startTime");
					searchParams.set(
						"timeMin",
						new Date(rangeStart ?? Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
					);
					searchParams.set(
						"timeMax",
						new Date(rangeEnd ?? Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
					);
				}
				if (nextPageToken) {
					searchParams.set("pageToken", nextPageToken);
				}

				const response = await callGoogle(
					refreshToken,
					`/calendars/${encodeURIComponent(calendarId)}/events?${searchParams.toString()}`,
				);
				if (!response.ok) {
					throw new Error(`Google sync failed (${response.status})`);
				}
				const data = (await response.json()) as GoogleEventsResponse;
				for (const event of data.items ?? []) {
					if (!event.id) continue;
					if (event.status === "cancelled" || event.deleted) {
						const deletedEvent = toDeletedEvent(event, calendarId);
						if (deletedEvent) {
							deletedEvents.push(deletedEvent);
						}
						continue;
					}
					const mapped = toGoogleEventUpsert(event, calendarId, calendarColor);
					if (mapped) {
						if (!mapped.recurrenceRule && mapped.recurringEventId) {
							unresolvedSeriesIds.add(mapped.recurringEventId);
						}
						events.push(mapped);
					}
				}
				nextPageToken = data.nextPageToken;
				if (data.nextSyncToken) {
					nextSyncToken = data.nextSyncToken;
				}
			} while (nextPageToken);

			if (unresolvedSeriesIds.size > 0) {
				const recurrenceEntries = await Promise.all(
					Array.from(unresolvedSeriesIds).map(
						async (seriesId) => [seriesId, await getSeriesRecurrenceRule(seriesId)] as const,
					),
				);
				const recurrenceBySeriesId = new Map<string, string>();
				for (const [seriesId, recurrenceRule] of recurrenceEntries) {
					if (recurrenceRule) {
						recurrenceBySeriesId.set(seriesId, recurrenceRule);
					}
				}
				if (recurrenceBySeriesId.size > 0) {
					for (const event of events) {
						if (!event.recurrenceRule && event.recurringEventId) {
							event.recurrenceRule = recurrenceBySeriesId.get(event.recurringEventId);
						}
					}
				}
			}

			return {
				events,
				deletedEvents,
				nextSyncToken,
				resetSyncToken: false,
			} satisfies CalendarProviderSyncResult;
		};

		try {
			return await fetchEvents(syncToken);
		} catch (error) {
			// Google returns 410 for invalid sync tokens; retry with a bounded full sync window.
			if (syncToken && error instanceof Error && error.message.includes("410")) {
				const fallbackResult = await fetchEvents(undefined);
				return {
					...fallbackResult,
					resetSyncToken: true,
				} satisfies CalendarProviderSyncResult;
			}
			throw error;
		}
	},

	async createEvent({ refreshToken, calendarId = "primary", event }) {
		const targetCalendarId = event.calendarId ?? calendarId;
		const response = await callGoogle(
			refreshToken,
			`/calendars/${encodeURIComponent(targetCalendarId)}/events`,
			{
				method: "POST",
				body: JSON.stringify(createGoogleEventPayload(event)),
			},
		);
		if (!response.ok) {
			throw new Error(`Failed to create Google event (${response.status})`);
		}
		const created = (await response.json()) as GoogleEvent;
		const mapped = toGoogleEventUpsert(created, targetCalendarId);
		if (!mapped) throw new Error("Google create event returned invalid payload.");
		return mapped;
	},

	async updateEvent({ refreshToken, calendarId = "primary", event, patch, scope }) {
		const googleEventId = event.googleEventId ?? event.sourceId;
		if (!googleEventId) throw new Error("Cannot update event without googleEventId.");
		const params = new URLSearchParams();
		if (scope !== "series") {
			params.set("sendUpdates", "none");
		}
		const sourceCalendarId = calendarId;
		const targetCalendarId = patch.calendarId?.trim() || sourceCalendarId;
		const patchWithoutCalendar: CalendarEventUpdateInput = {
			...patch,
			calendarId: undefined,
		};
		const patchPayload = patchGoogleEventPayload(patchWithoutCalendar);

		let updated: GoogleEvent | null = null;
		if (targetCalendarId !== sourceCalendarId) {
			const moveParams = new URLSearchParams({
				destination: targetCalendarId,
			});
			if (scope !== "series") {
				moveParams.set("sendUpdates", "none");
			}
			const moveResponse = await callGoogle(
				refreshToken,
				`/calendars/${encodeURIComponent(sourceCalendarId)}/events/${encodeURIComponent(googleEventId)}/move?${moveParams.toString()}`,
				{
					method: "POST",
				},
			);
			if (!moveResponse.ok) {
				throw new Error(`Failed to move Google event (${moveResponse.status})`);
			}
			updated = (await moveResponse.json()) as GoogleEvent;
		}

		if (Object.keys(patchPayload).length > 0) {
			const query = params.toString() ? `?${params.toString()}` : "";
			const patchResponse = await callGoogle(
				refreshToken,
				`/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(googleEventId)}${query}`,
				{
					method: "PATCH",
					body: JSON.stringify(patchPayload),
				},
			);
			if (!patchResponse.ok) {
				throw new Error(`Failed to update Google event (${patchResponse.status})`);
			}
			updated = (await patchResponse.json()) as GoogleEvent;
		}

		if (!updated) {
			updated = {
				id: googleEventId,
				summary: event.title,
				description: event.description,
				location: event.location,
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
			};
		}

		const mapped = toGoogleEventUpsert(updated, targetCalendarId);
		if (!mapped) throw new Error("Google update event returned invalid payload.");
		return mapped;
	},

	async deleteEvent({ refreshToken, calendarId = "primary", event }) {
		const googleEventId = event.googleEventId ?? event.sourceId;
		if (!googleEventId) throw new Error("Cannot delete event without googleEventId.");
		const response = await callGoogle(
			refreshToken,
			`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
			{ method: "DELETE" },
		);
		if (!response.ok && response.status !== 410 && response.status !== 404) {
			throw new Error(`Failed to delete Google event (${response.status})`);
		}
	},
};
