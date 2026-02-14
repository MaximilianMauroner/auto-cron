export type RecurrenceEditScope = "single" | "following" | "series";
export type CalendarEventCreateInput = {
	title: string;
	description?: string;
	start: number;
	end: number;
	allDay?: boolean;
	appSourceKey?: string;
	recurrenceRule?: string;
	calendarId?: string;
	busyStatus?: "free" | "busy" | "tentative";
	visibility?: "default" | "public" | "private" | "confidential";
	location?: string;
	color?: string;
};

export type CalendarEventUpdateInput = {
	title?: string;
	description?: string;
	start?: number;
	end?: number;
	allDay?: boolean;
	recurrenceRule?: string;
	calendarId?: string;
	busyStatus?: "free" | "busy" | "tentative";
	visibility?: "default" | "public" | "private" | "confidential";
	location?: string;
	color?: string;
};

export type GoogleEventUpsert = {
	id: string;
	title: string;
	description?: string;
	start: number;
	end: number;
	allDay: boolean;
	googleEventId: string;
	calendarId: string;
	appSourceKey?: string;
	recurrenceRule?: string;
	recurringEventId?: string;
	originalStartTime?: number;
	status?: "confirmed" | "tentative" | "cancelled";
	etag?: string;
	htmlLink?: string;
	busyStatus: "free" | "busy" | "tentative";
	visibility?: "default" | "public" | "private" | "confidential";
	location?: string;
	color?: string;
	lastSyncedAt: number;
};

export type CalendarProviderEvent = {
	_id: string;
	title: string;
	description?: string;
	start: number;
	end: number;
	allDay: boolean;
	sourceId?: string;
	googleEventId?: string;
	calendarId?: string;
	appSourceKey?: string;
	recurrenceRule?: string;
	recurringEventId?: string;
	originalStartTime?: number;
	status?: "confirmed" | "tentative" | "cancelled";
	etag?: string;
	busyStatus: "free" | "busy" | "tentative";
	visibility?: "default" | "public" | "private" | "confidential";
	location?: string;
	color?: string;
};

export type ProviderCalendar = {
	id: string;
	summary: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal?: boolean;
};

export type CalendarProviderSyncResult = {
	events: GoogleEventUpsert[];
	deletedEvents?: Array<{
		googleEventId: string;
		calendarId: string;
		originalStartTime?: number;
		lastSyncedAt: number;
	}>;
	nextSyncToken?: string;
	resetSyncToken?: boolean;
};

export type CalendarWatchStartResult = {
	channelId: string;
	resourceId: string;
	resourceUri?: string;
	expirationAt: number;
};

export interface CalendarProvider {
	listCalendars(input: { refreshToken: string }): Promise<ProviderCalendar[]>;
	syncEvents(input: {
		refreshToken: string;
		calendarId: string;
		calendarColor?: string;
		syncToken?: string;
		rangeStart?: number;
		rangeEnd?: number;
	}): Promise<CalendarProviderSyncResult>;
	createEvent(input: {
		refreshToken: string;
		calendarId?: string;
		event: CalendarEventCreateInput;
	}): Promise<GoogleEventUpsert>;
	updateEvent(input: {
		refreshToken: string;
		calendarId?: string;
		event: CalendarProviderEvent;
		patch: CalendarEventUpdateInput;
		scope: RecurrenceEditScope;
	}): Promise<GoogleEventUpsert>;
	deleteEvent(input: {
		refreshToken: string;
		calendarId?: string;
		event: CalendarProviderEvent;
		scope: RecurrenceEditScope;
	}): Promise<void>;
	watchEvents(input: {
		refreshToken: string;
		calendarId: string;
		address: string;
		channelId: string;
		channelToken: string;
		ttlSeconds?: number;
	}): Promise<CalendarWatchStartResult>;
	stopWatchChannel(input: {
		refreshToken: string;
		channelId: string;
		resourceId: string;
	}): Promise<void>;
}
