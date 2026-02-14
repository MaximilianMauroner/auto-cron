import type { Doc, Id } from "../_generated/dataModel";
import type { RecurrenceEditScope } from "../providers/calendar/types";

export type BusyStatus = "free" | "busy" | "tentative";
export type Visibility = "default" | "public" | "private" | "confidential";

export type RecurrenceScope = "single" | "following" | "series";

export type SyncFromGoogleArgs = {
	fullSync?: boolean;
	rangeStart?: number;
	rangeEnd?: number;
};

export type PushEventPatch = {
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

export type PushEventToGoogleArgs = {
	eventId: Id<"calendarEvents">;
	operation: "create" | "update" | "delete" | "moveResize";
	scope?: RecurrenceScope;
	previousCalendarId?: string;
	patch?: PushEventPatch;
};

export type RemovedGoogleEvent = {
	googleEventId: string;
	calendarId: string;
};

export type ScheduledEventForGoogleSync = {
	id: Id<"calendarEvents">;
	source: "task" | "habit";
	sourceId: string;
	title: string;
	description?: string;
	start: number;
	end: number;
	allDay: boolean;
	googleEventId?: string;
	calendarId: string;
	recurrenceRule?: string;
	recurringEventId?: string;
	originalStartTime?: number;
	status?: "confirmed" | "tentative" | "cancelled";
	etag?: string;
	busyStatus: BusyStatus;
	visibility?: Visibility;
	location?: string;
	color?: string;
};

export type CalendarListItem = {
	id: string;
	summary: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal?: boolean;
};

export type DeletedSyncEvent = {
	googleEventId: string;
	calendarId: string;
	originalStartTime?: number;
	lastSyncedAt: number;
};

export type EffectiveSyncRange = {
	start: number;
	end: number;
};

export type SyncPushAction = "create" | "unchanged" | "update";

export type WatchCalendarItem = {
	id: string;
	summary: string;
	primary: boolean;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
};

export type WatchChannelItem = {
	_id: Id<"googleCalendarWatchChannels">;
	calendarId: string;
	channelId: string;
	resourceId: string;
	expirationAt: number;
	status: "active" | "expired" | "stopped";
	updatedAt: number;
};

export type EventSource = "google" | "task" | "habit" | "manual";

export type ListEventsArgs = {
	start: number;
	end: number;
	sourceFilter?: EventSource[];
};

export type SyncEventInput = {
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
	appSourceKey?: string;
	lastSyncedAt: number;
};

export type UpsertGoogleTokensArgs = {
	refreshToken: string;
	syncToken?: string;
};

export type CreateEventArgs = {
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

export type UpdateEventPatch = {
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

export type UpdateEventArgs = {
	id: Id<"calendarEvents">;
	patch: UpdateEventPatch;
	scope?: RecurrenceEditScope;
};

export type DeleteEventArgs = {
	id: Id<"calendarEvents">;
	scope?: RecurrenceEditScope;
};

export type MoveResizeEventArgs = {
	id: Id<"calendarEvents">;
	start: number;
	end: number;
	scope?: RecurrenceEditScope;
};

export type UpsertMatchContext = {
	seriesMatches: Doc<"calendarEvents">[];
	legacyMatches: Doc<"calendarEvents">[];
	protectedFingerprintMatches: Doc<"calendarEvents">[];
	protectedSourceIdMatches: Doc<"calendarEvents">[];
	orderedMatches: Doc<"calendarEvents">[];
	primary?: Doc<"calendarEvents">;
	matchedPrimaryBySeries: boolean;
	matchedPrimaryByLegacy: boolean;
	matchedPrimaryByProtectedFingerprint: boolean;
	matchedPrimaryByProtectedSourceId: boolean;
};

export type SyncedUser = {
	userId: string;
	googleRefreshToken: string;
	googleSyncToken?: string;
	googleCalendarSyncTokens?: Array<{ calendarId: string; syncToken: string }>;
};

export type SyncedEventInput = {
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

export type DeletedSyncedEventInput = {
	googleEventId: string;
	calendarId: string;
	originalStartTime?: number;
	lastSyncedAt: number;
};

export type ConnectedCalendarInput = {
	calendarId: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal?: boolean;
};

export type UpsertSyncedEventsForUserArgs = {
	userId: string;
	resetCalendars?: string[];
	events: SyncedEventInput[];
	deletedEvents?: DeletedSyncedEventInput[];
	nextSyncToken?: string;
	syncTokens?: Array<{ calendarId: string; syncToken: string }>;
	connectedCalendars?: ConnectedCalendarInput[];
};

export type UpsertSyncedEventsBatchArgs = {
	userId: string;
	events: SyncedEventInput[];
};
