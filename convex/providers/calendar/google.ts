"use node";
import { env } from "../../env";
import {
	GOOGLE_CALENDAR_LIST_PAGE_SIZE,
	GOOGLE_EVENTS_PAGE_SIZE,
	clampWatchTtlSeconds,
	createGoogleEventPayload,
	ingestSyncResponseItems,
	mapCalendarListEntry,
	parseWatchExpiration,
	patchGoogleEventPayload,
	resolveSyncRangeIso,
	toGoogleEventUpsert,
	toGoogleUpdateFallbackEvent,
} from "./googleHelpers";
import type {
	GoogleCalendarListEntry,
	GoogleCalendarListResponse,
	GoogleEvent,
	GoogleEventsResponse,
	GoogleTokenResponse,
	GoogleWatchStartResponse,
} from "./googleTypes";
import type {
	CalendarEventUpdateInput,
	CalendarProvider,
	CalendarProviderSyncResult,
	CalendarWatchStartResult,
	GoogleEventUpsert,
	ProviderCalendar,
} from "./types";

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_CALENDAR_LIST_FIELDS =
	"nextPageToken,items(id,summary,primary,backgroundColor,colorId,accessRole,deleted,hidden)";
const GOOGLE_EVENT_FIELDS =
	"id,summary,description,start,end,status,etag,recurrence,recurringEventId,originalStartTime,transparency,visibility,location,colorId,extendedProperties/private,htmlLink";
const GOOGLE_EVENTS_SYNC_FIELDS = `nextPageToken,nextSyncToken,items(${GOOGLE_EVENT_FIELDS})`;
const GOOGLE_WATCH_RESPONSE_FIELDS = "id,resourceId,resourceUri,expiration";
const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 60 * 1000;
const accessTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

const getAccessToken = async (refreshToken: string) => {
	const cached = accessTokenCache.get(refreshToken);
	if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_SAFETY_WINDOW_MS) {
		return { access_token: cached.accessToken } as GoogleTokenResponse;
	}

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
	const token = (await response.json()) as GoogleTokenResponse;
	const expiresInSeconds = Number(token.expires_in ?? 3600);
	if (token.access_token) {
		accessTokenCache.set(refreshToken, {
			accessToken: token.access_token,
			expiresAt: Date.now() + Math.max(0, expiresInSeconds) * 1000,
		});
	}
	return token;
};

const callGoogle = async (
	refreshToken: string,
	path: string,
	init: RequestInit = {},
): Promise<Response> => {
	const token = await getAccessToken(refreshToken);
	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${token.access_token}`);
	headers.set("Accept-Encoding", "gzip");
	const userAgent = headers.get("User-Agent");
	if (!userAgent) {
		headers.set("User-Agent", "auto-cron-calendar-sync (gzip)");
	} else if (!userAgent.toLowerCase().includes("gzip")) {
		headers.set("User-Agent", `${userAgent} (gzip)`);
	}
	if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
	return fetch(`${GOOGLE_CALENDAR_BASE}${path}`, { ...init, headers });
};

const readGoogleErrorBody = async (response: Response) => {
	try {
		const raw = await response.text();
		if (!raw) return undefined;
		return raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
	} catch {
		return undefined;
	}
};

export const googleCalendarProvider: CalendarProvider = {
	async listCalendars({ refreshToken }) {
		const calendars: ProviderCalendar[] = [];
		let nextPageToken: string | undefined;

		do {
			const searchParams = new URLSearchParams({
				showHidden: "false",
				showDeleted: "false",
				maxResults: String(GOOGLE_CALENDAR_LIST_PAGE_SIZE),
				fields: GOOGLE_CALENDAR_LIST_FIELDS,
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
				const mappedCalendar = mapCalendarListEntry(calendar);
				if (!mappedCalendar) continue;
				calendars.push(mappedCalendar);
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
			const syncRangeIso = resolveSyncRangeIso(rangeStart, rangeEnd);

			do {
				const searchParams = new URLSearchParams({
					singleEvents: "true",
					showDeleted: "true",
					maxResults: String(GOOGLE_EVENTS_PAGE_SIZE),
					fields: GOOGLE_EVENTS_SYNC_FIELDS,
				});
				if (currentSyncToken) {
					searchParams.set("syncToken", currentSyncToken);
				} else {
					searchParams.set("orderBy", "startTime");
					searchParams.set("timeMin", syncRangeIso.timeMin);
					searchParams.set("timeMax", syncRangeIso.timeMax);
				}
				if (nextPageToken) {
					searchParams.set("pageToken", nextPageToken);
				}

				const response = await callGoogle(
					refreshToken,
					`/calendars/${encodeURIComponent(calendarId)}/events?${searchParams.toString()}`,
				);
				if (!response.ok) {
					const details = await readGoogleErrorBody(response);
					throw new Error(
						`Google sync failed (${response.status})${details ? `: ${details}` : ""}`,
					);
				}
				const data = (await response.json()) as GoogleEventsResponse;
				ingestSyncResponseItems({
					items: data.items,
					calendarId,
					calendarColor,
					events,
					deletedEvents,
					unresolvedSeriesIds,
				});
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
		const searchParams = new URLSearchParams({ fields: GOOGLE_EVENT_FIELDS });
		const response = await callGoogle(
			refreshToken,
			`/calendars/${encodeURIComponent(targetCalendarId)}/events?${searchParams.toString()}`,
			{
				method: "POST",
				body: JSON.stringify(createGoogleEventPayload(event)),
			},
		);
		if (!response.ok) {
			const details = await readGoogleErrorBody(response);
			throw new Error(
				`Failed to create Google event (${response.status})${details ? `: ${details}` : ""}`,
			);
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
		params.set("fields", GOOGLE_EVENT_FIELDS);
		if (scope !== "series") {
			params.set("sendUpdates", "none");
		}
		const sourceCalendarId = calendarId;
		const targetCalendarId = patch.calendarId?.trim() || sourceCalendarId;
		const patchWithoutCalendar: CalendarEventUpdateInput = {
			...patch,
			calendarId: undefined,
		};
		const patchPayload = patchGoogleEventPayload(
			patchWithoutCalendar,
			event.appSourceKey ?? event.sourceId,
		);

		let updated: GoogleEvent | null = null;
		if (targetCalendarId !== sourceCalendarId) {
			const moveParams = new URLSearchParams({
				destination: targetCalendarId,
				fields: GOOGLE_EVENT_FIELDS,
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
				const details = await readGoogleErrorBody(moveResponse);
				throw new Error(
					`Failed to move Google event (${moveResponse.status})${details ? `: ${details}` : ""}`,
				);
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
				const details = await readGoogleErrorBody(patchResponse);
				throw new Error(
					`Failed to update Google event (${patchResponse.status})${details ? `: ${details}` : ""}`,
				);
			}
			updated = (await patchResponse.json()) as GoogleEvent;
		}

		if (!updated) {
			updated = toGoogleUpdateFallbackEvent(event, googleEventId);
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

	async watchEvents({
		refreshToken,
		calendarId,
		address,
		channelId,
		channelToken,
		ttlSeconds = 7 * 24 * 60 * 60,
	}): Promise<CalendarWatchStartResult> {
		const ttl = clampWatchTtlSeconds(ttlSeconds);
		const searchParams = new URLSearchParams({ fields: GOOGLE_WATCH_RESPONSE_FIELDS });
		const response = await callGoogle(
			refreshToken,
			`/calendars/${encodeURIComponent(calendarId)}/events/watch?${searchParams.toString()}`,
			{
				method: "POST",
				body: JSON.stringify({
					id: channelId,
					type: "web_hook",
					address,
					token: channelToken,
					params: {
						ttl: String(ttl),
					},
				}),
			},
		);
		if (!response.ok) {
			throw new Error(`Failed to start Google watch channel (${response.status})`);
		}
		const data = (await response.json()) as GoogleWatchStartResponse;
		const responseChannelId = data.id ?? channelId;
		const resourceId = data.resourceId;
		if (!resourceId) {
			throw new Error("Google watch response missing resourceId.");
		}
		return {
			channelId: responseChannelId,
			resourceId,
			resourceUri: data.resourceUri,
			expirationAt: parseWatchExpiration(data.expiration),
		};
	},

	async stopWatchChannel({ refreshToken, channelId, resourceId }) {
		const response = await callGoogle(refreshToken, "/channels/stop", {
			method: "POST",
			body: JSON.stringify({
				id: channelId,
				resourceId,
			}),
		});
		if (!response.ok && response.status !== 404 && response.status !== 410) {
			throw new Error(`Failed to stop Google watch channel (${response.status})`);
		}
	},
};
