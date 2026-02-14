"use node";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type {
	SyncedUser,
	UpsertSyncedEventsBatchArgs,
	UpsertSyncedEventsForUserArgs,
} from "./syncRuntimeTypes";

export const getCurrentUserGoogleSettings = (ctx: ActionCtx): Promise<Doc<"userSettings"> | null> =>
	ctx.runQuery(internal.calendar.internal.getUserGoogleSettings, {});

export const listUsersWithGoogleSync = (
	ctx: ActionCtx,
	limit: number,
): Promise<Array<SyncedUser>> =>
	ctx.runQuery(internal.calendar.internal.listUsersWithGoogleSync, { limit });

export const upsertSyncedEventsForUser = (ctx: ActionCtx, args: UpsertSyncedEventsForUserArgs) =>
	ctx.runMutation(internal.calendar.mutations.upsertSyncedEventsForUser, args);

export const upsertSyncedEventsBatch = (ctx: ActionCtx, args: UpsertSyncedEventsBatchArgs) =>
	ctx.runMutation(internal.calendar.mutations.upsertSyncedEventsBatch, args);

export const normalizeGoogleEventsInRange = (
	ctx: ActionCtx,
	args: { userId: string; start: number; end: number },
) => ctx.runMutation(internal.calendar.internal.normalizeGoogleEventsInRange, args);

export const dedupeUserCalendarEventsInRange = (
	ctx: ActionCtx,
	args: { userId: string; start: number; end: number },
) => ctx.runMutation(internal.calendar.internal.dedupeUserCalendarEventsInRange, args);

export const normalizeAndDedupeEventsInRange = (
	ctx: ActionCtx,
	args: { userId: string; start: number; end: number },
) => ctx.runMutation(internal.calendar.internal.normalizeAndDedupeEventsInRange, args);

export const getEventById = (ctx: ActionCtx, id: Id<"calendarEvents">) =>
	ctx.runQuery(internal.calendar.internal.getEventById, { id });

export const updateLocalEventFromGoogle = (
	ctx: ActionCtx,
	args: {
		id: Id<"calendarEvents">;
		googleEventId: string;
		calendarId?: string;
		etag?: string;
		lastSyncedAt: number;
	},
) => ctx.runMutation(internal.calendar.internal.updateLocalEventFromGoogle, args);
