import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import type { RecurrenceEditScope } from "../providers/calendar/types";

const MINUTE_MS = 60 * 1000;
const normalizeToMinute = (timestamp: number) => Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;

const recurrenceScopeValidator = v.union(
	v.literal("single"),
	v.literal("following"),
	v.literal("series"),
);

const recencyScore = (event: Doc<"calendarEvents">) =>
	Math.max(event.lastSyncedAt ?? 0, event.updatedAt ?? 0, event._creationTime ?? 0);

const syncEventValidator = v.object({
	googleEventId: v.string(),
	title: v.string(),
	description: v.optional(v.string()),
	start: v.number(),
	end: v.number(),
	allDay: v.boolean(),
	calendarId: v.string(),
	recurrenceRule: v.optional(v.string()),
	recurringEventId: v.optional(v.string()),
	originalStartTime: v.optional(v.number()),
	status: v.optional(
		v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
	),
	etag: v.optional(v.string()),
	busyStatus: v.union(v.literal("free"), v.literal("busy"), v.literal("tentative")),
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
	lastSyncedAt: v.number(),
});

const syncDeletedEventValidator = v.object({
	googleEventId: v.string(),
	calendarId: v.string(),
	originalStartTime: v.optional(v.number()),
	lastSyncedAt: v.number(),
});

const syncTokenValidator = v.object({
	calendarId: v.string(),
	syncToken: v.string(),
});

const connectedCalendarValidator = v.object({
	calendarId: v.string(),
	name: v.string(),
	primary: v.boolean(),
	color: v.optional(v.string()),
	accessRole: v.optional(
		v.union(
			v.literal("owner"),
			v.literal("writer"),
			v.literal("reader"),
			v.literal("freeBusyReader"),
		),
	),
	isExternal: v.optional(v.boolean()),
});

const syncArgsValidator = {
	resetCalendars: v.optional(v.array(v.string())),
	events: v.array(syncEventValidator),
	deletedEvents: v.optional(v.array(syncDeletedEventValidator)),
	nextSyncToken: v.optional(v.string()),
	syncTokens: v.optional(v.array(syncTokenValidator)),
	connectedCalendars: v.optional(v.array(connectedCalendarValidator)),
};

type SyncEventInput = {
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

type BusyStatus = "free" | "busy" | "tentative";
type Visibility = "default" | "public" | "private" | "confidential";

type UpsertGoogleTokensArgs = {
	refreshToken: string;
	syncToken?: string;
};

type CreateEventArgs = {
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

type UpdateEventPatch = {
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

type UpdateEventArgs = {
	id: Id<"calendarEvents">;
	patch: UpdateEventPatch;
	scope?: RecurrenceEditScope;
};

type DeleteEventArgs = {
	id: Id<"calendarEvents">;
	scope?: RecurrenceEditScope;
};

type MoveResizeEventArgs = {
	id: Id<"calendarEvents">;
	start: number;
	end: number;
	scope?: RecurrenceEditScope;
};

const upsertSeriesForGoogleEvent = async (
	ctx: MutationCtx,
	userId: string,
	event: SyncEventInput,
	now: number,
	seriesCache: Map<string, Doc<"calendarEventSeries">>,
) => {
	const googleSeriesId = event.recurringEventId ?? event.googleEventId;
	const seriesCacheKey = `${event.calendarId}:${googleSeriesId}`;
	const cached = seriesCache.get(seriesCacheKey);
	if (cached) {
		return cached;
	}

	const existing = await ctx.db
		.query("calendarEventSeries")
		.withIndex("by_userId_calendarId_googleSeriesId", (q) =>
			q
				.eq("userId", userId)
				.eq("calendarId", event.calendarId)
				.eq("googleSeriesId", googleSeriesId),
		)
		.unique();

	const patch = {
		source: "google" as const,
		sourceId: event.googleEventId,
		calendarId: event.calendarId,
		googleSeriesId,
		title: event.title,
		description: event.description,
		allDay: event.allDay,
		recurrenceRule: event.recurrenceRule ?? existing?.recurrenceRule,
		status: event.status,
		busyStatus: event.busyStatus,
		visibility: event.visibility,
		location: event.location,
		color: event.color,
		etag: event.etag,
		lastSyncedAt: event.lastSyncedAt,
		updatedAt: now,
		isRecurring: Boolean(event.recurringEventId || event.recurrenceRule),
	};

	let series: Doc<"calendarEventSeries"> | null;
	if (existing) {
		await ctx.db.patch(existing._id, patch);
		series = await ctx.db.get(existing._id);
	} else {
		const insertedId = await ctx.db.insert("calendarEventSeries", {
			userId,
			...patch,
		});
		series = await ctx.db.get(insertedId);
	}

	if (!series) {
		throw new ConvexError({
			code: "SERIES_UPSERT_FAILED",
			message: "Unable to persist calendar event series.",
		});
	}

	seriesCache.set(seriesCacheKey, series);
	return series;
};

const performUpsertSyncedEventsForUser = async (
	ctx: MutationCtx,
	userId: string,
	args: {
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
			visibility?: "default" | "public" | "private" | "confidential";
			location?: string;
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
) => {
	const now = Date.now();
	const seriesCache = new Map<string, Doc<"calendarEventSeries">>();

	if (args.resetCalendars?.length) {
		const resetCalendarIds = new Set(args.resetCalendars);
		const existingEvents = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
		for (const event of existingEvents) {
			if (event.source !== "google") continue;
			if (!resetCalendarIds.has(event.calendarId ?? "primary")) continue;
			await ctx.db.delete(event._id);
		}

		const existingSeries = await ctx.db
			.query("calendarEventSeries")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
		for (const series of existingSeries) {
			if (series.source !== "google") continue;
			if (!resetCalendarIds.has(series.calendarId ?? "primary")) continue;
			await ctx.db.delete(series._id);
		}
	}

	for (const event of args.events) {
		const series = await upsertSeriesForGoogleEvent(ctx, userId, event, now, seriesCache);
		const occurrenceStart = normalizeToMinute(event.originalStartTime ?? event.start);
		const isRecurringInstance = Boolean(event.recurringEventId);

		const seriesMatches = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_seriesId_occurrenceStart", (q) =>
				q
					.eq("userId", userId)
					.eq("seriesId", series._id as Id<"calendarEventSeries">)
					.eq("occurrenceStart", occurrenceStart),
			)
			.collect();
		const legacyMatches = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_calendarId_googleEventId", (q) =>
				q
					.eq("userId", userId)
					.eq("calendarId", event.calendarId)
					.eq("googleEventId", event.googleEventId),
			)
			.collect();

		const allMatches = [...seriesMatches, ...legacyMatches];
		const uniqueMatchesById = new Map<string, Doc<"calendarEvents">>();
		for (const match of allMatches) {
			uniqueMatchesById.set(String(match._id), match);
		}
		const orderedMatches = Array.from(uniqueMatchesById.values()).sort(
			(a, b) => recencyScore(b) - recencyScore(a),
		);
		const primary = orderedMatches[0];

		const occurrencePatch = {
			title: isRecurringInstance ? undefined : event.title,
			description: isRecurringInstance ? undefined : event.description,
			start: event.start,
			end: event.end,
			allDay: isRecurringInstance ? undefined : event.allDay,
			updatedAt: now,
			source: "google" as const,
			sourceId: event.googleEventId,
			calendarId: event.calendarId,
			googleEventId: event.googleEventId,
			recurrenceRule: isRecurringInstance ? undefined : event.recurrenceRule,
			recurringEventId: event.recurringEventId,
			originalStartTime: event.originalStartTime,
			seriesId: series._id,
			occurrenceStart,
			status: event.status,
			etag: event.etag,
			lastSyncedAt: event.lastSyncedAt,
			busyStatus: isRecurringInstance ? undefined : event.busyStatus,
			visibility: isRecurringInstance ? undefined : event.visibility,
			location: isRecurringInstance ? undefined : event.location,
			color: isRecurringInstance ? undefined : event.color,
		};

		if (primary) {
			await ctx.db.patch(primary._id, occurrencePatch);
			for (const duplicate of orderedMatches.slice(1)) {
				await ctx.db.delete(duplicate._id);
			}
		} else {
			await ctx.db.insert("calendarEvents", {
				userId,
				...occurrencePatch,
			});
		}
	}

	for (const deletedEvent of args.deletedEvents ?? []) {
		const existingMatches = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_calendarId_googleEventId", (q) =>
				q
					.eq("userId", userId)
					.eq("calendarId", deletedEvent.calendarId)
					.eq("googleEventId", deletedEvent.googleEventId),
			)
			.collect();

		for (const existingEvent of existingMatches) {
			if (
				deletedEvent.originalStartTime !== undefined &&
				(existingEvent.originalStartTime ?? existingEvent.start) !== deletedEvent.originalStartTime
			) {
				continue;
			}
			await ctx.db.delete(existingEvent._id);
		}
	}

	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();

	if (settings) {
		const resetCalendarIds = new Set(args.resetCalendars ?? []);
		const existingSyncTokens = (settings.googleCalendarSyncTokens ?? []).filter(
			(token) => !resetCalendarIds.has(token.calendarId),
		);
		const mergedSyncTokensByCalendarId = new Map(
			existingSyncTokens.map((token) => [token.calendarId, token] as const),
		);
		for (const token of args.syncTokens ?? []) {
			mergedSyncTokensByCalendarId.set(token.calendarId, token);
		}
		const nextSyncTokens = Array.from(mergedSyncTokensByCalendarId.values());
		const nextPrimaryToken =
			args.nextSyncToken ??
			mergedSyncTokensByCalendarId.get("primary")?.syncToken ??
			(resetCalendarIds.has("primary") ? undefined : settings.googleSyncToken);

		await ctx.db.patch(settings._id, {
			googleSyncToken: nextPrimaryToken,
			googleCalendarSyncTokens: nextSyncTokens,
			googleConnectedCalendars: args.connectedCalendars ?? settings.googleConnectedCalendars,
		});
	}

	return { upserted: args.events.length };
};

export const upsertGoogleTokens = mutation({
	args: {
		refreshToken: v.string(),
		syncToken: v.optional(v.string()),
	},
	returns: v.id("userSettings"),
	handler: withMutationAuth(async (ctx, args: UpsertGoogleTokensArgs) => {
		const { userId } = ctx;
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique();

		if (existing) {
			const nextCalendarSyncTokens = args.syncToken
				? (() => {
						const tokensByCalendarId = new Map(
							(existing.googleCalendarSyncTokens ?? []).map(
								(token) => [token.calendarId, token] as const,
							),
						);
						tokensByCalendarId.set("primary", {
							calendarId: "primary",
							syncToken: args.syncToken,
						});
						return Array.from(tokensByCalendarId.values());
					})()
				: (existing.googleCalendarSyncTokens ?? []);
			await ctx.db.patch(existing._id, {
				googleRefreshToken: args.refreshToken,
				googleSyncToken: args.syncToken ?? existing.googleSyncToken,
				googleCalendarSyncTokens: nextCalendarSyncTokens,
			});
			await ctx.scheduler.runAfter(0, internal.crons.ensureCalendarSyncGoogleCron, {});
			return existing._id;
		}

		const insertedId = await ctx.db.insert("userSettings", {
			userId,
			timezone: "UTC",
			workingHoursStart: "09:00",
			workingHoursEnd: "17:00",
			workingDays: [1, 2, 3, 4, 5],
			schedulingHorizonDays: 75,
			googleRefreshToken: args.refreshToken,
			googleSyncToken: args.syncToken,
			googleCalendarSyncTokens: [],
		});
		await ctx.scheduler.runAfter(0, internal.crons.ensureCalendarSyncGoogleCron, {});
		return insertedId;
	}),
});

export const createEvent = mutation({
	args: {
		input: v.object({
			title: v.string(),
			description: v.optional(v.string()),
			start: v.number(),
			end: v.number(),
			allDay: v.optional(v.boolean()),
			recurrenceRule: v.optional(v.string()),
			calendarId: v.optional(v.string()),
			busyStatus: v.optional(v.union(v.literal("free"), v.literal("busy"), v.literal("tentative"))),
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
	},
	returns: v.id("calendarEvents"),
	handler: withMutationAuth(async (ctx, args: CreateEventArgs) => {
		const { userId } = ctx;
		const now = Date.now();
		const allDay = args.input.allDay ?? false;
		const calendarId = args.input.calendarId ?? "primary";
		const busyStatus = args.input.busyStatus ?? "busy";
		const visibility = args.input.visibility ?? "default";

		const seriesId = await ctx.db.insert("calendarEventSeries", {
			userId,
			source: "google",
			sourceId: undefined,
			calendarId,
			googleSeriesId: undefined,
			title: args.input.title,
			description: args.input.description,
			allDay,
			recurrenceRule: args.input.recurrenceRule,
			status: "confirmed",
			busyStatus,
			visibility,
			location: args.input.location,
			color: args.input.color,
			etag: undefined,
			lastSyncedAt: undefined,
			updatedAt: now,
			isRecurring: Boolean(args.input.recurrenceRule),
		});

		return ctx.db.insert("calendarEvents", {
			userId,
			title: undefined,
			description: undefined,
			start: args.input.start,
			end: args.input.end,
			allDay: undefined,
			updatedAt: now,
			source: "google",
			sourceId: undefined,
			googleEventId: undefined,
			calendarId,
			recurrenceRule: undefined,
			recurringEventId: undefined,
			originalStartTime: undefined,
			seriesId,
			occurrenceStart: normalizeToMinute(args.input.start),
			status: "confirmed",
			etag: undefined,
			lastSyncedAt: undefined,
			busyStatus: undefined,
			visibility: undefined,
			location: undefined,
			color: undefined,
		});
	}),
});

export const updateEvent = mutation({
	args: {
		id: v.id("calendarEvents"),
		patch: v.object({
			title: v.optional(v.string()),
			description: v.optional(v.string()),
			start: v.optional(v.number()),
			end: v.optional(v.number()),
			allDay: v.optional(v.boolean()),
			recurrenceRule: v.optional(v.string()),
			calendarId: v.optional(v.string()),
			busyStatus: v.optional(v.union(v.literal("free"), v.literal("busy"), v.literal("tentative"))),
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
		scope: v.optional(recurrenceScopeValidator),
	},
	returns: v.object({
		id: v.id("calendarEvents"),
		scope: recurrenceScopeValidator,
	}),
	handler: withMutationAuth(async (ctx, args: UpdateEventArgs) => {
		const { userId } = ctx;
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Event not found.",
			});
		}

		const scope = (args.scope ?? "single") as RecurrenceEditScope;
		const series = event.seriesId ? await ctx.db.get(event.seriesId) : null;
		const now = Date.now();

		if (series && scope !== "single") {
			await ctx.db.patch(series._id, {
				title: args.patch.title ?? series.title,
				description: args.patch.description ?? series.description,
				allDay: args.patch.allDay ?? series.allDay,
				recurrenceRule: args.patch.recurrenceRule ?? series.recurrenceRule,
				calendarId: args.patch.calendarId ?? series.calendarId,
				busyStatus: args.patch.busyStatus ?? series.busyStatus,
				visibility: args.patch.visibility ?? series.visibility,
				location: args.patch.location ?? series.location,
				color: args.patch.color ?? series.color,
				updatedAt: now,
			});
		}

		const nextStart = args.patch.start ?? event.start;
		const occurrencePatch: Partial<Doc<"calendarEvents">> = {
			start: nextStart,
			end: args.patch.end ?? event.end,
			updatedAt: now,
			occurrenceStart: normalizeToMinute(nextStart),
		};

		if (scope === "single" || !series) {
			if (args.patch.title !== undefined) occurrencePatch.title = args.patch.title;
			if (args.patch.description !== undefined)
				occurrencePatch.description = args.patch.description;
			if (args.patch.allDay !== undefined) occurrencePatch.allDay = args.patch.allDay;
			if (args.patch.recurrenceRule !== undefined) {
				occurrencePatch.recurrenceRule = args.patch.recurrenceRule;
			}
			if (args.patch.calendarId !== undefined) occurrencePatch.calendarId = args.patch.calendarId;
			if (args.patch.busyStatus !== undefined) occurrencePatch.busyStatus = args.patch.busyStatus;
			if (args.patch.visibility !== undefined) occurrencePatch.visibility = args.patch.visibility;
			if (args.patch.location !== undefined) occurrencePatch.location = args.patch.location;
			if (args.patch.color !== undefined) occurrencePatch.color = args.patch.color;
		}

		await ctx.db.patch(args.id, occurrencePatch);

		if (series && scope !== "single" && args.patch.calendarId !== undefined) {
			const baseOccurrenceStart = event.occurrenceStart ?? normalizeToMinute(event.start);
			const seriesEvents = await ctx.db
				.query("calendarEvents")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.filter((q) => q.eq(q.field("seriesId"), event.seriesId))
				.collect();

			for (const seriesEvent of seriesEvents) {
				const seriesOccurrenceStart =
					seriesEvent.occurrenceStart ?? normalizeToMinute(seriesEvent.start);
				if (scope === "following" && seriesOccurrenceStart < baseOccurrenceStart) {
					continue;
				}
				if (seriesEvent._id === args.id) continue;
				await ctx.db.patch(seriesEvent._id, {
					calendarId: args.patch.calendarId,
					updatedAt: now,
				});
			}
		}
		return { id: args.id, scope };
	}),
});

export const deleteEvent = mutation({
	args: {
		id: v.id("calendarEvents"),
		scope: v.optional(recurrenceScopeValidator),
	},
	returns: v.object({
		scope: recurrenceScopeValidator,
	}),
	handler: withMutationAuth(async (ctx, args: DeleteEventArgs) => {
		const { userId } = ctx;
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Event not found.",
			});
		}

		await ctx.db.delete(args.id);
		return { scope: (args.scope ?? "single") as RecurrenceEditScope };
	}),
});

export const moveResizeEvent = mutation({
	args: {
		id: v.id("calendarEvents"),
		start: v.number(),
		end: v.number(),
		scope: v.optional(recurrenceScopeValidator),
	},
	returns: v.object({
		id: v.id("calendarEvents"),
		scope: recurrenceScopeValidator,
	}),
	handler: withMutationAuth(async (ctx, args: MoveResizeEventArgs) => {
		const { userId } = ctx;
		const event = await ctx.db.get(args.id);
		if (!event || event.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Event not found.",
			});
		}

		const scope = (args.scope ?? "single") as RecurrenceEditScope;
		const now = Date.now();
		if (scope === "single" || !event.seriesId) {
			await ctx.db.patch(args.id, {
				start: args.start,
				end: args.end,
				updatedAt: now,
				occurrenceStart: normalizeToMinute(args.start),
			});
			return { id: args.id, scope };
		}

		const baseOccurrenceStart = event.occurrenceStart ?? normalizeToMinute(event.start);
		const deltaStart = args.start - event.start;
		const deltaEnd = args.end - event.end;
		const seriesEvents = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("seriesId"), event.seriesId))
			.collect();

		for (const seriesEvent of seriesEvents) {
			const seriesOccurrenceStart =
				seriesEvent.occurrenceStart ?? normalizeToMinute(seriesEvent.start);
			if (scope === "following" && seriesOccurrenceStart < baseOccurrenceStart) {
				continue;
			}

			const nextStart = seriesEvent.start + deltaStart;
			const nextEnd = seriesEvent.end + deltaEnd;
			await ctx.db.patch(seriesEvent._id, {
				start: nextStart,
				end: nextEnd,
				updatedAt: now,
				occurrenceStart: normalizeToMinute(nextStart),
			});
		}

		const series = await ctx.db.get(event.seriesId);
		if (series) {
			await ctx.db.patch(series._id, {
				updatedAt: now,
			});
		}

		return { id: args.id, scope };
	}),
});

export const upsertSyncedEventsForUser = internalMutation({
	args: {
		userId: v.string(),
		...syncArgsValidator,
	},
	returns: v.object({
		upserted: v.number(),
	}),
	handler: async (ctx, args) => {
		return performUpsertSyncedEventsForUser(ctx, args.userId, args);
	},
});
