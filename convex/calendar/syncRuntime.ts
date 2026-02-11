"use node";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";

type SyncedUser = {
	userId: string;
	googleRefreshToken: string;
	googleSyncToken?: string;
	googleCalendarSyncTokens?: Array<{ calendarId: string; syncToken: string }>;
};

export const getCurrentUserGoogleSettings = (ctx: ActionCtx): Promise<Doc<"userSettings"> | null> =>
	ctx.runQuery(internal.calendar.internal.getUserGoogleSettings, {});

export const listUsersWithGoogleSync = (
	ctx: ActionCtx,
	limit: number,
): Promise<Array<SyncedUser>> =>
	ctx.runQuery(internal.calendar.internal.listUsersWithGoogleSync, { limit });

export const upsertSyncedEventsForUser = (
	ctx: ActionCtx,
	args: {
		userId: string;
		resetCalendars?: string[];
		events: Array<{
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
			color?: string;
			lastSyncedAt: number;
		}>;
		deletedEvents?: Array<{
			googleEventId: string;
			calendarId: string;
			originalStartTime?: number;
			lastSyncedAt: number;
		}>;
		nextSyncToken?: string;
		syncTokens?: Array<{ calendarId: string; syncToken: string }>;
		connectedCalendars?: Array<{
			calendarId: string;
			name: string;
			primary: boolean;
			color?: string;
			accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
			isExternal?: boolean;
		}>;
	},
) => ctx.runMutation(internal.calendar.mutations.upsertSyncedEventsForUser, args);

export const normalizeGoogleEventsInRange = (
	ctx: ActionCtx,
	args: { userId: string; start: number; end: number },
) => ctx.runMutation(internal.calendar.internal.normalizeGoogleEventsInRange, args);

export const dedupeUserCalendarEventsInRange = (
	ctx: ActionCtx,
	args: { userId: string; start: number; end: number },
) => ctx.runMutation(internal.calendar.internal.dedupeUserCalendarEventsInRange, args);

export const getEventById = (ctx: ActionCtx, id: Id<"calendarEvents">) =>
	ctx.runQuery(internal.calendar.internal.getEventById, { id });

export const updateLocalEventFromGoogle = (
	ctx: ActionCtx,
	args: { id: Id<"calendarEvents">; googleEventId: string; etag?: string; lastSyncedAt: number },
) => ctx.runMutation(internal.calendar.internal.updateLocalEventFromGoogle, args);
