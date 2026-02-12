"use node";

import { createHash, randomUUID } from "node:crypto";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalAction } from "../_generated/server";
import { withActionAuth } from "../auth";
import { getCalendarProvider } from "../providers/calendar";
import type { GoogleEventUpsert } from "../providers/calendar/types";
import {
	dedupeUserCalendarEventsInRange,
	getCurrentUserGoogleSettings,
	getEventById,
	listUsersWithGoogleSync,
	normalizeGoogleEventsInRange,
	updateLocalEventFromGoogle,
	upsertSyncedEventsBatch,
	upsertSyncedEventsForUser,
} from "./syncRuntime";

const scopeValidator = v.optional(
	v.union(v.literal("single"), v.literal("following"), v.literal("series")),
);

const googleSyncRunTriggerValidator = v.union(
	v.literal("webhook"),
	v.literal("cron"),
	v.literal("manual"),
	v.literal("oauth_connect"),
);

type RecurrenceScope = "single" | "following" | "series";
type BusyStatus = "free" | "busy" | "tentative";
type Visibility = "default" | "public" | "private" | "confidential";

type SyncFromGoogleArgs = {
	fullSync?: boolean;
	rangeStart?: number;
	rangeEnd?: number;
};

type PushEventPatch = {
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

type PushEventToGoogleArgs = {
	eventId: Id<"calendarEvents">;
	operation: "create" | "update" | "delete" | "moveResize";
	scope?: RecurrenceScope;
	previousCalendarId?: string;
	patch?: PushEventPatch;
};

type RemovedGoogleEvent = {
	googleEventId: string;
	calendarId: string;
};

type ScheduledEventForGoogleSync = {
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

const WATCH_CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;
const WATCH_RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizeWatchTokenInput = (value: string) => value.trim();

const hashWatchToken = (rawToken: string, secret: string) =>
	createHash("sha256")
		.update(`${secret}:${normalizeWatchTokenInput(rawToken)}`)
		.digest("hex");

const secureEqualString = (left: string, right: string) => {
	if (left.length !== right.length) return false;
	let diff = 0;
	for (let index = 0; index < left.length; index += 1) {
		diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return diff === 0;
};

const getWatchConfig = () => {
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

const createChannelToken = (tokenSecret: string) => {
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

const isSyncedEventEqual = (
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
		(localEvent.calendarId || "primary") === remoteEvent.calendarId &&
		(localEvent.recurrenceRule ?? undefined) === (remoteEvent.recurrenceRule ?? undefined) &&
		localEvent.busyStatus === remoteEvent.busyStatus &&
		(localEvent.visibility ?? undefined) === (remoteEvent.visibility ?? undefined) &&
		normalizeOptionalString(localEvent.location) ===
			normalizeOptionalString(remoteEvent.location) &&
		normalizeOptionalString(localEvent.color) === normalizeOptionalString(remoteEvent.color)
	);
};

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

	const mappedEvents = allEvents.map((event) => ({
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
	}));

	// Batch events into chunks to avoid OCC (Optimistic Concurrency Control)
	// failures when syncing large numbers of calendar events.
	const BATCH_SIZE = 50;
	if (mappedEvents.length <= BATCH_SIZE) {
		// Small sync — single mutation handles everything.
		await upsertSyncedEventsForUser(ctx, {
			userId,
			resetCalendars: Array.from(resetCalendars),
			events: mappedEvents,
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
	} else {
		// Large sync — first handle reset, deleted events, and settings update
		// without events to keep the transaction small.
		await upsertSyncedEventsForUser(ctx, {
			userId,
			resetCalendars: Array.from(resetCalendars),
			events: [],
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

		// Then upsert events in batches to avoid OCC conflicts.
		for (let i = 0; i < mappedEvents.length; i += BATCH_SIZE) {
			await upsertSyncedEventsBatch(ctx, {
				userId,
				events: mappedEvents.slice(i, i + BATCH_SIZE),
			});
		}
	}

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
	handler: withActionAuth(
		async (
			ctx,
			args: SyncFromGoogleArgs,
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
			const result = await syncUserFromGoogle(ctx, {
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
			try {
				await ctx.runAction(internal.calendar.actions.ensureWatchChannelsForUser, {
					userId: settings.userId,
				});
			} catch (error) {
				console.error("[calendar] failed to ensure watch channels after syncFromGoogle", {
					userId: settings.userId,
					error: error instanceof Error ? error.message : error,
				});
			}
			return result;
		},
	),
});

export const ensureGoogleWatchChannels: ReturnType<typeof action> = action({
	args: {},
	returns: v.object({
		configured: v.boolean(),
		created: v.number(),
		reused: v.number(),
		deactivated: v.number(),
	}),
	handler: withActionAuth(async (ctx) => {
		return await ctx.runAction(internal.calendar.actions.ensureWatchChannelsForUser, {
			userId: ctx.userId,
		});
	}),
});

export const syncFromGoogleForUser: ReturnType<typeof internalAction> = internalAction({
	args: {
		runId: v.id("googleSyncRuns"),
		userId: v.string(),
		triggeredBy: googleSyncRunTriggerValidator,
	},
	returns: v.object({
		runId: v.id("googleSyncRuns"),
		status: v.union(v.literal("completed"), v.literal("failed")),
		imported: v.number(),
		deleted: v.number(),
	}),
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.calendar.mutations.markGoogleSyncRunRunning, {
			runId: args.runId,
		});
		try {
			const settings = await ctx.runQuery(internal.calendar.internal.getUserGoogleSettings, {
				userId: args.userId,
			});
			if (!settings?.googleRefreshToken) {
				await ctx.runMutation(internal.calendar.mutations.failGoogleSyncRun, {
					runId: args.runId,
					error: "Google refresh token missing for user.",
				});
				return {
					runId: args.runId,
					status: "failed" as const,
					imported: 0,
					deleted: 0,
				};
			}

			const result = await syncUserFromGoogle(ctx, {
				userId: args.userId,
				settings: {
					googleRefreshToken: settings.googleRefreshToken,
					googleSyncToken: settings.googleSyncToken,
					googleCalendarSyncTokens: settings.googleCalendarSyncTokens,
				},
			});
			await ctx.runMutation(internal.calendar.mutations.completeGoogleSyncRun, {
				runId: args.runId,
				imported: result.imported,
				deleted: result.deleted,
			});

			if (args.triggeredBy === "oauth_connect") {
				try {
					await ctx.runAction(internal.calendar.actions.ensureWatchChannelsForUser, {
						userId: args.userId,
					});
				} catch (error) {
					console.error("[calendar] failed to ensure watch channels after oauth sync", {
						userId: args.userId,
						error: error instanceof Error ? error.message : error,
					});
				}
			}

			return {
				runId: args.runId,
				status: "completed" as const,
				imported: result.imported,
				deleted: result.deleted,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Google sync failed.";
			await ctx.runMutation(internal.calendar.mutations.failGoogleSyncRun, {
				runId: args.runId,
				error: message,
			});
			return {
				runId: args.runId,
				status: "failed" as const,
				imported: 0,
				deleted: 0,
			};
		}
	},
});

export const enqueueGoogleSyncRunsForAllUsers: ReturnType<typeof internalAction> = internalAction({
	args: {
		limit: v.optional(v.number()),
		triggeredBy: v.optional(googleSyncRunTriggerValidator),
	},
	returns: v.object({
		processedUsers: v.number(),
		enqueuedUsers: v.number(),
		reusedPendingUsers: v.number(),
	}),
	handler: async (ctx, args) => {
		const users = await listUsersWithGoogleSync(ctx, args.limit ?? 200);
		let enqueuedUsers = 0;
		let reusedPendingUsers = 0;
		for (const user of users) {
			const queued = await ctx.runMutation(internal.calendar.mutations.enqueueGoogleSyncRun, {
				userId: user.userId,
				triggeredBy: args.triggeredBy ?? "cron",
			});
			if (queued.enqueued) {
				enqueuedUsers += 1;
			} else {
				reusedPendingUsers += 1;
			}
		}
		return {
			processedUsers: users.length,
			enqueuedUsers,
			reusedPendingUsers,
		};
	},
});

export const ensureWatchChannelsForUser: ReturnType<typeof internalAction> = internalAction({
	args: {
		userId: v.string(),
	},
	returns: v.object({
		configured: v.boolean(),
		created: v.number(),
		reused: v.number(),
		deactivated: v.number(),
	}),
	handler: async (ctx, args) => {
		const watchConfig = getWatchConfig();
		if (!watchConfig) {
			return {
				configured: false,
				created: 0,
				reused: 0,
				deactivated: 0,
			};
		}

		const settings = await ctx.runQuery(internal.calendar.internal.getUserGoogleSettings, {
			userId: args.userId,
		});
		if (!settings?.googleRefreshToken) {
			return {
				configured: true,
				created: 0,
				reused: 0,
				deactivated: 0,
			};
		}

		const provider = getCalendarProvider();
		let calendars: Array<{
			id: string;
			summary: string;
			primary: boolean;
			accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
		}> = [];
		try {
			calendars = await provider.listCalendars({
				refreshToken: settings.googleRefreshToken,
			});
		} catch {
			calendars = (settings.googleConnectedCalendars ?? []).map((calendar) => ({
				id: calendar.calendarId,
				summary: calendar.name,
				primary: calendar.primary,
				accessRole: calendar.accessRole,
			}));
		}
		if (calendars.length === 0) {
			calendars = [
				{
					id: "primary",
					summary: "Primary",
					primary: true,
					accessRole: "owner",
				},
			];
		}

		const writableCalendars = calendars.filter(
			(calendar) => isWritableCalendar(calendar) || (calendar.primary && !calendar.accessRole),
		);
		const targetCalendars = writableCalendars.length
			? writableCalendars
			: [
					{
						id: "primary",
						summary: "Primary",
						primary: true,
						accessRole: "owner" as const,
					},
				];

		const now = Date.now();
		const channels = await ctx.runQuery(internal.calendar.internal.listWatchChannelsForUser, {
			userId: args.userId,
		});
		const activeByCalendarId = new Map(
			channels
				.filter((channel) => channel.status === "active")
				.sort((a, b) => b.updatedAt - a.updatedAt)
				.map((channel) => [channel.calendarId, channel] as const),
		);
		const targetCalendarIds = new Set(targetCalendars.map((calendar) => calendar.id));
		let created = 0;
		let reused = 0;
		let deactivated = 0;

		for (const calendar of targetCalendars) {
			const existing = activeByCalendarId.get(calendar.id);
			const isStillFresh = existing && existing.expirationAt - now > WATCH_RENEWAL_WINDOW_MS;
			if (isStillFresh) {
				reused += 1;
				continue;
			}

			if (existing) {
				try {
					await provider.stopWatchChannel({
						refreshToken: settings.googleRefreshToken,
						channelId: existing.channelId,
						resourceId: existing.resourceId,
					});
				} catch {
					// Best-effort cleanup, continue with replacement.
				}
				await ctx.runMutation(internal.calendar.mutations.deactivateWatchChannel, {
					watchChannelId: existing._id,
					status: existing.expirationAt <= now ? "expired" : "stopped",
				});
				deactivated += 1;
			}

			const channelId = randomUUID();
			const channelToken = createChannelToken(watchConfig.tokenSecret);
			const started = await provider.watchEvents({
				refreshToken: settings.googleRefreshToken,
				calendarId: calendar.id,
				address: watchConfig.webhookUrl,
				channelId,
				channelToken: channelToken.raw,
				ttlSeconds: WATCH_CHANNEL_TTL_SECONDS,
			});
			await ctx.runMutation(internal.calendar.mutations.upsertWatchChannel, {
				userId: args.userId,
				calendarId: calendar.id,
				channelId: started.channelId,
				resourceId: started.resourceId,
				resourceUri: started.resourceUri,
				channelTokenHash: channelToken.hash,
				expirationAt: started.expirationAt,
			});
			created += 1;
		}

		for (const channel of channels) {
			if (channel.status !== "active") continue;
			if (targetCalendarIds.has(channel.calendarId)) continue;
			try {
				await provider.stopWatchChannel({
					refreshToken: settings.googleRefreshToken,
					channelId: channel.channelId,
					resourceId: channel.resourceId,
				});
			} catch {
				// Best-effort cleanup, continue.
			}
			await ctx.runMutation(internal.calendar.mutations.deactivateWatchChannel, {
				watchChannelId: channel._id,
				status: "stopped",
			});
			deactivated += 1;
		}

		return {
			configured: true,
			created,
			reused,
			deactivated,
		};
	},
});

export const renewExpiringWatchChannels: ReturnType<typeof internalAction> = internalAction({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.object({
		processedUsers: v.number(),
		succeededUsers: v.number(),
		failedUsers: v.number(),
	}),
	handler: async (ctx, args) => {
		const expiring = await ctx.runQuery(internal.calendar.internal.listExpiringWatchChannels, {
			before: Date.now() + WATCH_RENEWAL_WINDOW_MS,
			limit: args.limit ?? 1000,
		});
		const userIds = Array.from(
			new Set(
				expiring.filter((channel) => channel.status === "active").map((channel) => channel.userId),
			),
		);
		let succeededUsers = 0;
		let failedUsers = 0;
		for (const userId of userIds) {
			try {
				await ctx.runAction(internal.calendar.actions.ensureWatchChannelsForUser, {
					userId,
				});
				succeededUsers += 1;
			} catch (error) {
				failedUsers += 1;
				console.error("[calendar] failed to renew watch channels for user", {
					userId,
					error: error instanceof Error ? error.message : error,
				});
			}
		}
		return {
			processedUsers: userIds.length,
			succeededUsers,
			failedUsers,
		};
	},
});

export const ensureWatchChannelsForAllUsers: ReturnType<typeof internalAction> = internalAction({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.object({
		processedUsers: v.number(),
		succeededUsers: v.number(),
		failedUsers: v.number(),
	}),
	handler: async (ctx, args) => {
		const users = await listUsersWithGoogleSync(ctx, args.limit ?? 200);
		let succeededUsers = 0;
		let failedUsers = 0;
		for (const user of users) {
			try {
				await ctx.runAction(internal.calendar.actions.ensureWatchChannelsForUser, {
					userId: user.userId,
				});
				succeededUsers += 1;
			} catch (error) {
				failedUsers += 1;
				console.error("[calendar] failed to backfill watch channels", {
					userId: user.userId,
					error: error instanceof Error ? error.message : error,
				});
			}
		}
		return {
			processedUsers: users.length,
			succeededUsers,
			failedUsers,
		};
	},
});

export const handleGoogleCalendarWebhook: ReturnType<typeof internalAction> = internalAction({
	args: {
		channelId: v.optional(v.string()),
		channelToken: v.optional(v.string()),
		resourceId: v.optional(v.string()),
		resourceState: v.optional(v.string()),
		messageNumber: v.optional(v.number()),
	},
	returns: v.object({
		accepted: v.boolean(),
		enqueued: v.boolean(),
		reason: v.string(),
	}),
	handler: async (ctx, args) => {
		if (!args.channelId || !args.resourceState) {
			return {
				accepted: true,
				enqueued: false,
				reason: "missing_headers",
			};
		}
		const watchConfig = getWatchConfig();
		if (!watchConfig) {
			return {
				accepted: true,
				enqueued: false,
				reason: "watch_not_configured",
			};
		}
		const channel = await ctx.runQuery(internal.calendar.internal.getWatchChannelByChannelId, {
			channelId: args.channelId,
		});
		if (!channel) {
			return {
				accepted: true,
				enqueued: false,
				reason: "unknown_channel",
			};
		}
		if (channel.status !== "active") {
			return {
				accepted: true,
				enqueued: false,
				reason: "channel_not_active",
			};
		}
		if (!args.channelToken || !args.resourceId) {
			return {
				accepted: true,
				enqueued: false,
				reason: "invalid_headers",
			};
		}
		const tokenHash = hashWatchToken(args.channelToken, watchConfig.tokenSecret);
		if (!secureEqualString(tokenHash, channel.channelTokenHash)) {
			return {
				accepted: true,
				enqueued: false,
				reason: "token_mismatch",
			};
		}
		if (args.resourceId !== channel.resourceId) {
			return {
				accepted: true,
				enqueued: false,
				reason: "resource_mismatch",
			};
		}

		await ctx.runMutation(internal.calendar.mutations.recordWatchNotification, {
			watchChannelId: channel._id,
			lastNotifiedAt: Date.now(),
			lastMessageNumber: args.messageNumber,
		});

		if (channel.expirationAt <= Date.now()) {
			await ctx.runMutation(internal.calendar.mutations.deactivateWatchChannel, {
				watchChannelId: channel._id,
				status: "expired",
			});
			return {
				accepted: true,
				enqueued: false,
				reason: "channel_expired",
			};
		}

		if (args.resourceState === "sync") {
			return {
				accepted: true,
				enqueued: false,
				reason: "sync_handshake",
			};
		}
		if (args.resourceState !== "exists" && args.resourceState !== "not_exists") {
			return {
				accepted: true,
				enqueued: false,
				reason: "ignored_state",
			};
		}

		const queued = await ctx.runMutation(internal.calendar.mutations.enqueueGoogleSyncRun, {
			userId: channel.userId,
			triggeredBy: "webhook",
		});
		return {
			accepted: true,
			enqueued: queued.enqueued,
			reason: queued.enqueued ? "enqueued" : "already_pending",
		};
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

export const syncScheduledBlocksToGoogle: ReturnType<typeof internalAction> = internalAction({
	args: {
		userId: v.string(),
		horizonStart: v.number(),
		horizonEnd: v.number(),
		removedGoogleEvents: v.array(
			v.object({
				googleEventId: v.string(),
				calendarId: v.string(),
			}),
		),
	},
	returns: v.object({
		skipped: v.boolean(),
		created: v.number(),
		updated: v.number(),
		deleted: v.number(),
		unchanged: v.number(),
	}),
	handler: async (ctx, args) => {
		const settings = await ctx.runQuery(internal.calendar.internal.getUserGoogleSettings, {
			userId: args.userId,
		});
		if (!settings?.googleRefreshToken) {
			return {
				skipped: true,
				created: 0,
				updated: 0,
				deleted: 0,
				unchanged: 0,
			};
		}

		const scheduledEvents = (await ctx.runQuery(
			internal.calendar.internal.listScheduledEventsForGoogleSync,
			{
				userId: args.userId,
				start: args.horizonStart,
				end: args.horizonEnd,
			},
		)) as ScheduledEventForGoogleSync[];

		const calendarsToSync = new Set<string>();
		for (const event of scheduledEvents) {
			calendarsToSync.add(event.calendarId || "primary");
		}
		for (const removed of args.removedGoogleEvents) {
			calendarsToSync.add(removed.calendarId || "primary");
		}

		const provider = getCalendarProvider();
		let calendars: Array<{
			id: string;
			color?: string;
		}> = [];
		try {
			const availableCalendars = await provider.listCalendars({
				refreshToken: settings.googleRefreshToken,
			});
			calendars = availableCalendars.map((calendar) => ({
				id: calendar.id,
				color: calendar.color,
			}));
		} catch {
			calendars = [];
		}
		const calendarColorById = new Map(calendars.map((calendar) => [calendar.id, calendar.color]));

		const remoteByGoogleEventId = new Map<string, GoogleEventUpsert>();
		for (const calendarId of calendarsToSync) {
			try {
				const synced = await provider.syncEvents({
					refreshToken: settings.googleRefreshToken,
					calendarId,
					calendarColor: calendarColorById.get(calendarId),
					rangeStart: args.horizonStart,
					rangeEnd: args.horizonEnd,
				});
				for (const remoteEvent of synced.events) {
					remoteByGoogleEventId.set(remoteEvent.googleEventId, remoteEvent);
				}
			} catch (error) {
				console.error("[calendar] failed to pull events before scheduler push", {
					userId: args.userId,
					calendarId,
					error: error instanceof Error ? error.message : error,
				});
			}
		}

		const seenRemoved = new Set<string>();
		let deleted = 0;
		for (const removed of args.removedGoogleEvents) {
			const dedupeKey = `${removed.calendarId}:${removed.googleEventId}`;
			if (seenRemoved.has(dedupeKey)) continue;
			seenRemoved.add(dedupeKey);
			if (!remoteByGoogleEventId.has(removed.googleEventId)) continue;

			await provider.deleteEvent({
				refreshToken: settings.googleRefreshToken,
				calendarId: removed.calendarId || "primary",
				event: {
					_id: dedupeKey,
					title: "Scheduled block",
					start: args.horizonStart,
					end: args.horizonEnd,
					allDay: false,
					googleEventId: removed.googleEventId,
					calendarId: removed.calendarId || "primary",
					busyStatus: "busy",
				},
				scope: "single",
			});
			deleted += 1;
		}

		let created = 0;
		let updated = 0;
		let unchanged = 0;

		for (const event of scheduledEvents) {
			const remote = event.googleEventId
				? remoteByGoogleEventId.get(event.googleEventId)
				: undefined;

			if (!event.googleEventId || !remote) {
				const createdEvent = await provider.createEvent({
					refreshToken: settings.googleRefreshToken,
					calendarId: event.calendarId || "primary",
					event: {
						title: event.title,
						description: event.description,
						start: event.start,
						end: event.end,
						allDay: event.allDay,
						recurrenceRule: event.recurrenceRule,
						calendarId: event.calendarId || "primary",
						busyStatus: event.busyStatus,
						visibility: event.visibility,
						location: event.location,
						color: event.color,
					},
				});
				await updateLocalEventFromGoogle(ctx, {
					id: event.id,
					googleEventId: createdEvent.googleEventId,
					calendarId: createdEvent.calendarId,
					etag: createdEvent.etag,
					lastSyncedAt: createdEvent.lastSyncedAt,
				});
				created += 1;
				continue;
			}

			if (isSyncedEventEqual(event, remote)) {
				unchanged += 1;
				continue;
			}

			const updatedEvent = await provider.updateEvent({
				refreshToken: settings.googleRefreshToken,
				calendarId: remote.calendarId || event.calendarId || "primary",
				event: {
					_id: String(event.id),
					title: event.title,
					description: event.description,
					start: event.start,
					end: event.end,
					allDay: event.allDay,
					sourceId: event.sourceId,
					googleEventId: event.googleEventId,
					calendarId: remote.calendarId || event.calendarId || "primary",
					recurrenceRule: event.recurrenceRule,
					recurringEventId: event.recurringEventId,
					originalStartTime: event.originalStartTime,
					status: event.status,
					etag: event.etag,
					busyStatus: event.busyStatus,
					visibility: event.visibility,
					location: event.location,
					color: event.color,
				},
				patch: {
					title: event.title,
					description: event.description,
					start: event.start,
					end: event.end,
					allDay: event.allDay,
					recurrenceRule: event.recurrenceRule,
					calendarId: event.calendarId || "primary",
					busyStatus: event.busyStatus,
					visibility: event.visibility,
					location: event.location,
					color: event.color,
				},
				scope: "single",
			});

			await updateLocalEventFromGoogle(ctx, {
				id: event.id,
				googleEventId: updatedEvent.googleEventId,
				calendarId: updatedEvent.calendarId,
				etag: updatedEvent.etag,
				lastSyncedAt: updatedEvent.lastSyncedAt,
			});
			updated += 1;
		}

		return {
			skipped: false,
			created,
			updated,
			deleted,
			unchanged,
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
	handler: withActionAuth(async (ctx, args: PushEventToGoogleArgs) => {
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
	}),
});
