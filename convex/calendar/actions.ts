"use node";

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { type ActionCtx, action, internalAction } from "../_generated/server";
import { getCalendarProvider } from "../providers/calendar";
import type { GoogleEventUpsert } from "../providers/calendar/types";
import {
	dedupeUserCalendarEventsInRange,
	getCurrentUserGoogleSettings,
	getEventById,
	listUsersWithGoogleSync,
	normalizeGoogleEventsInRange,
	updateLocalEventFromGoogle,
	upsertSyncedEventsForUser,
} from "./syncRuntime";

const scopeValidator = v.optional(
	v.union(v.literal("single"), v.literal("following"), v.literal("series")),
);

const syncUserFromGoogle = async (
	ctx: ActionCtx,
	{
		userId,
		settings,
		fullSync,
		rangeStart,
		rangeEnd,
	}: {
		userId: string;
		settings: {
			googleRefreshToken: string;
			googleSyncToken?: string;
			googleCalendarSyncTokens?: Array<{ calendarId: string; syncToken: string }>;
		};
		fullSync?: boolean;
		rangeStart?: number;
		rangeEnd?: number;
	},
) => {
	const now = Date.now();
	const effectiveRangeStart = rangeStart ?? now - 1000 * 60 * 60 * 24 * 7;
	const effectiveRangeEnd = rangeEnd ?? now + 1000 * 60 * 60 * 24 * 84;
	const provider = getCalendarProvider();
	let calendars: Array<{
		id: string;
		summary: string;
		primary: boolean;
		color?: string;
		accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
		isExternal?: boolean;
	}> = [];
	try {
		calendars = await provider.listCalendars({
			refreshToken: settings.googleRefreshToken,
		});
	} catch {
		// Fallback for older OAuth grants without calendar list scope.
		calendars = [];
	}
	const syncTokenByCalendar = new Map<string, string>();
	for (const token of settings.googleCalendarSyncTokens ?? []) {
		syncTokenByCalendar.set(token.calendarId, token.syncToken);
	}
	if (settings.googleSyncToken && !syncTokenByCalendar.has("primary")) {
		syncTokenByCalendar.set("primary", settings.googleSyncToken);
	}

	const allEvents: GoogleEventUpsert[] = [];
	const allDeletedEvents: Array<{
		googleEventId: string;
		calendarId: string;
		originalStartTime?: number;
		lastSyncedAt: number;
	}> = [];
	const nextTokens: Array<{ calendarId: string; syncToken: string }> = [];
	const resetCalendars = new Set<string>();

	const syncedCalendars = calendars.length
		? calendars
		: [
				{
					id: "primary",
					summary: "Primary",
					primary: true,
					color: undefined,
					accessRole: "owner" as const,
					isExternal: false,
				},
			];

	for (const calendar of syncedCalendars) {
		const result = await provider.syncEvents({
			refreshToken: settings.googleRefreshToken,
			calendarId: calendar.id,
			calendarColor: calendar.color,
			syncToken: fullSync ? undefined : syncTokenByCalendar.get(calendar.id),
			rangeStart: effectiveRangeStart,
			rangeEnd: effectiveRangeEnd,
		});

		allEvents.push(...result.events);
		allDeletedEvents.push(...(result.deletedEvents ?? []));
		if (result.resetSyncToken) {
			resetCalendars.add(calendar.id);
		}
		if (result.nextSyncToken) {
			nextTokens.push({
				calendarId: calendar.id,
				syncToken: result.nextSyncToken,
			});
		}
	}

	await upsertSyncedEventsForUser(ctx, {
		userId,
		resetCalendars: Array.from(resetCalendars),
		events: allEvents.map((event) => ({
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
		})),
		deletedEvents: allDeletedEvents,
		nextSyncToken:
			nextTokens.find((token) => token.calendarId === "primary")?.syncToken ??
			nextTokens[0]?.syncToken,
		syncTokens: nextTokens,
		connectedCalendars: syncedCalendars.map((calendar) => ({
			calendarId: calendar.id,
			name: calendar.summary,
			primary: calendar.primary,
			color: calendar.color,
			accessRole: calendar.accessRole,
			isExternal: calendar.isExternal,
		})),
	});

	await normalizeGoogleEventsInRange(ctx, {
		userId,
		start: effectiveRangeStart,
		end: effectiveRangeEnd,
	});

	const syncedStarts = allEvents.map((event) => event.start);
	const syncedEnds = allEvents.map((event) => event.end);
	const rangePaddingMs = 60 * 1000;
	const dedupeStart =
		syncedStarts.length > 0 ? Math.min(...syncedStarts) - rangePaddingMs : effectiveRangeStart;
	const dedupeEnd =
		syncedEnds.length > 0 ? Math.max(...syncedEnds) + rangePaddingMs : effectiveRangeEnd;
	await dedupeUserCalendarEventsInRange(ctx, {
		userId,
		start: dedupeStart,
		end: dedupeEnd,
	});

	return {
		imported: allEvents.length,
		deleted: allDeletedEvents.length,
		resetCalendars: Array.from(resetCalendars),
		nextSyncToken:
			nextTokens.find((token) => token.calendarId === "primary")?.syncToken ??
			nextTokens[0]?.syncToken,
	};
};

export const syncFromGoogle: ReturnType<typeof action> = action({
	args: {
		fullSync: v.optional(v.boolean()),
		rangeStart: v.optional(v.number()),
		rangeEnd: v.optional(v.number()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		imported: number;
		deleted: number;
		resetCalendars: string[];
		nextSyncToken?: string;
	}> => {
		const settings = await getCurrentUserGoogleSettings(ctx);
		if (!settings?.googleRefreshToken) {
			throw new ConvexError({
				code: "GOOGLE_NOT_CONNECTED",
				message:
					"Google refresh token not configured. Reconnect Google with offline access and consent.",
			});
		}
		return syncUserFromGoogle(ctx, {
			userId: settings.userId,
			settings: {
				googleRefreshToken: settings.googleRefreshToken,
				googleSyncToken: settings.googleSyncToken,
				googleCalendarSyncTokens: settings.googleCalendarSyncTokens,
			},
			fullSync: args.fullSync,
			rangeStart: args.rangeStart,
			rangeEnd: args.rangeEnd,
		});
	},
});

export const syncGoogleForAllUsers: ReturnType<typeof internalAction> = internalAction({
	args: {
		limit: v.optional(v.number()),
		fullSync: v.optional(v.boolean()),
		rangeStart: v.optional(v.number()),
		rangeEnd: v.optional(v.number()),
	},
	returns: v.object({
		processedUsers: v.number(),
		succeededUsers: v.number(),
		failedUsers: v.number(),
		totalImported: v.number(),
		totalDeleted: v.number(),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		processedUsers: number;
		succeededUsers: number;
		failedUsers: number;
		totalImported: number;
		totalDeleted: number;
	}> => {
		const users = await listUsersWithGoogleSync(ctx, args.limit ?? 200);
		let succeededUsers = 0;
		let failedUsers = 0;
		let totalImported = 0;
		let totalDeleted = 0;

		for (const user of users) {
			try {
				const result = await syncUserFromGoogle(ctx, {
					userId: user.userId,
					settings: {
						googleRefreshToken: user.googleRefreshToken,
						googleSyncToken: user.googleSyncToken,
						googleCalendarSyncTokens: user.googleCalendarSyncTokens,
					},
					fullSync: args.fullSync,
					rangeStart: args.rangeStart,
					rangeEnd: args.rangeEnd,
				});
				succeededUsers += 1;
				totalImported += result.imported;
				totalDeleted += result.deleted ?? 0;
			} catch (error) {
				failedUsers += 1;
				console.error("[calendar] scheduled sync failed for user", user.userId, error);
			}
		}

		return {
			processedUsers: users.length,
			succeededUsers,
			failedUsers,
			totalImported,
			totalDeleted,
		};
	},
});

export const pushEventToGoogle = action({
	args: {
		eventId: v.id("calendarEvents"),
		operation: v.union(
			v.literal("create"),
			v.literal("update"),
			v.literal("delete"),
			v.literal("moveResize"),
		),
		scope: scopeValidator,
		previousCalendarId: v.optional(v.string()),
		patch: v.optional(
			v.object({
				title: v.optional(v.string()),
				description: v.optional(v.string()),
				start: v.optional(v.number()),
				end: v.optional(v.number()),
				allDay: v.optional(v.boolean()),
				recurrenceRule: v.optional(v.string()),
				calendarId: v.optional(v.string()),
				busyStatus: v.optional(
					v.union(v.literal("free"), v.literal("busy"), v.literal("tentative")),
				),
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
			}),
		),
	},
	handler: async (ctx, args) => {
		const settings = await getCurrentUserGoogleSettings(ctx);
		if (!settings?.googleRefreshToken) {
			throw new ConvexError({
				code: "GOOGLE_NOT_CONNECTED",
				message:
					"Google refresh token not configured. Reconnect Google with offline access and consent.",
			});
		}

		const event = await getEventById(ctx, args.eventId);
		if (!event) {
			if (
				args.operation === "delete" ||
				args.operation === "update" ||
				args.operation === "moveResize"
			) {
				return { status: "deleted" as const };
			}
			throw new ConvexError({
				code: "EVENT_NOT_FOUND",
				message: "Event not found.",
			});
		}

		const provider = getCalendarProvider();

		if (args.operation === "delete") {
			await provider.deleteEvent({
				refreshToken: settings.googleRefreshToken,
				calendarId: event.calendarId ?? "primary",
				event,
				scope: args.scope ?? "single",
			});
			return { status: "deleted" as const };
		}

		if (args.operation === "create") {
			const created = await provider.createEvent({
				refreshToken: settings.googleRefreshToken,
				calendarId: event.calendarId ?? "primary",
				event: {
					title: event.title,
					description: event.description,
					start: event.start,
					end: event.end,
					allDay: event.allDay,
					recurrenceRule: event.recurrenceRule,
					calendarId: event.calendarId,
					busyStatus: event.busyStatus,
					visibility: event.visibility,
					location: event.location,
					color: event.color,
				},
			});

			await updateLocalEventFromGoogle(ctx, {
				id: args.eventId,
				googleEventId: created.googleEventId,
				calendarId: created.calendarId,
				etag: created.etag,
				lastSyncedAt: created.lastSyncedAt,
			});
			return { status: "created" as const };
		}

		const patch =
			args.operation === "moveResize"
				? { start: event.start, end: event.end, allDay: event.allDay }
				: (args.patch ?? {});

		const updated = await provider.updateEvent({
			refreshToken: settings.googleRefreshToken,
			calendarId: args.previousCalendarId ?? event.calendarId ?? "primary",
			event,
			patch,
			scope: args.scope ?? "single",
		});

		await updateLocalEventFromGoogle(ctx, {
			id: args.eventId,
			googleEventId: updated.googleEventId,
			calendarId: updated.calendarId,
			etag: updated.etag,
			lastSyncedAt: updated.lastSyncedAt,
		});

		return { status: "updated" as const };
	},
});
