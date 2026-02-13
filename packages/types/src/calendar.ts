export const calendarSources = ["google", "task", "habit", "manual"] as const;
export type CalendarSource = (typeof calendarSources)[number];

export const recurrenceEditScopes = ["single", "following", "series"] as const;
export type RecurrenceEditScope = (typeof recurrenceEditScopes)[number];

export const calendarSyncStatuses = ["idle", "syncing", "error", "conflicted"] as const;
export type CalendarSyncStatus = (typeof calendarSyncStatuses)[number];

export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";
export type CalendarBusyStatus = "free" | "busy" | "tentative";
export type CalendarVisibility = "default" | "public" | "private" | "confidential";

export type CalendarEventDTO = {
	_id: string;
	title: string;
	description?: string;
	start: number;
	end: number;
	allDay: boolean;
	source: CalendarSource;
	sourceId?: string;
	googleEventId?: string;
	calendarId?: string;
	recurrenceRule?: string;
	recurringEventId?: string;
	originalStartTime?: number;
	seriesId?: string;
	occurrenceStart?: number;
	status?: CalendarEventStatus;
	etag?: string;
	busyStatus: CalendarBusyStatus;
	visibility?: CalendarVisibility;
	location?: string;
	color?: string;
	updatedAt: number;
	lastSyncedAt?: number;
};

export type CalendarEventCreateInput = {
	title: string;
	start: number;
	end: number;
	allDay?: boolean;
	description?: string;
	recurrenceRule?: string;
	calendarId?: string;
	busyStatus?: CalendarBusyStatus;
	visibility?: CalendarVisibility;
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
	busyStatus?: CalendarBusyStatus;
	visibility?: CalendarVisibility;
	location?: string;
	color?: string;
};
