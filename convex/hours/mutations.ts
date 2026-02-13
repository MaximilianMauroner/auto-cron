import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import {
	type HourWindow,
	anytimeWindows,
	assertValidWindows,
	ensureHoursSetOwnership,
	getDefaultHoursSet,
	hourWindowValidator,
	taskSchedulingModeValidator,
} from "./shared";

const WORK_SET_NAME = "Work";
const ANYTIME_SET_NAME = "Anytime (24/7)";
const DEFAULT_WORK_WINDOW_START = "09:00";
const DEFAULT_WORK_WINDOW_END = "17:00";
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5] as const;

const hoursSetCreateInputValidator = v.object({
	name: v.string(),
	windows: v.array(hourWindowValidator),
	defaultCalendarId: v.optional(v.string()),
});

const hoursSetUpdateInputValidator = v.object({
	name: v.optional(v.string()),
	windows: v.optional(v.array(hourWindowValidator)),
	defaultCalendarId: v.optional(v.string()),
	isDefault: v.optional(v.boolean()),
});

type HoursSetCreateInput = {
	name: string;
	windows: HourWindow[];
	defaultCalendarId?: string;
};

type HoursSetUpdateInput = {
	name?: string;
	windows?: HourWindow[];
	defaultCalendarId?: string;
	isDefault?: boolean;
};

const notFoundError = () =>
	new ConvexError({
		code: "NOT_FOUND",
		message: "Hours set not found.",
	});

const cannotDeleteSystemError = () =>
	new ConvexError({
		code: "SYSTEM_HOURS_SET_NOT_DELETABLE",
		message: "System hours sets cannot be deleted.",
	});

const cannotDeleteDefaultError = () =>
	new ConvexError({
		code: "DEFAULT_HOURS_SET_NOT_DELETABLE",
		message: "The default hours set cannot be deleted.",
	});

const invalidNameError = () =>
	new ConvexError({
		code: "INVALID_HOURS_SET_NAME",
		message: "Hours set name is required.",
	});

const cannotRenameSystemError = () =>
	new ConvexError({
		code: "SYSTEM_HOURS_SET_NAME_IMMUTABLE",
		message: "System hours set names are managed automatically.",
	});

const cannotUnsetDefaultError = () =>
	new ConvexError({
		code: "DEFAULT_HOURS_SET_REQUIRED",
		message: "At least one default hours set is required.",
	});

const parseTimeToMinute = (value: string | undefined, fallback: number) => {
	if (!value) return fallback;
	const match = value.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return fallback;
	const [_, rawHours = "0", rawMinutes = "0"] = match;
	const hours = Number.parseInt(rawHours, 10);
	const minutes = Number.parseInt(rawMinutes, 10);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
	return hours * 60 + minutes;
};

const toWorkWindowsFromLegacySettings = (settings: Doc<"userSettings"> | null): HourWindow[] => {
	const raw = settings as
		| (Doc<"userSettings"> & {
				workingHoursStart?: string;
				workingHoursEnd?: string;
				workingDays?: number[];
		  })
		| null;

	const startMinute = parseTimeToMinute(raw?.workingHoursStart, 9 * 60);
	const endMinute = parseTimeToMinute(raw?.workingHoursEnd, 17 * 60);
	const days = (raw?.workingDays ?? [...DEFAULT_WORK_DAYS]).filter(
		(day): day is HourWindow["day"] => {
			return Number.isInteger(day) && day >= 0 && day <= 6;
		},
	);
	const uniqueDays = Array.from(new Set(days));
	const fallbackDays = uniqueDays.length > 0 ? uniqueDays : [...DEFAULT_WORK_DAYS];
	const windows = fallbackDays.map((day) => ({
		day,
		startMinute,
		endMinute: Math.max(startMinute + 15, endMinute),
	}));
	assertValidWindows(windows);
	return windows;
};

const sanitizeTaskSchedulingMode = (
	mode: string | undefined,
): "fastest" | "backfacing" | "parallel" => {
	if (mode === "fastest" || mode === "backfacing" || mode === "parallel") {
		return mode;
	}
	return "fastest";
};

const ensureSettingsForUser = async (ctx: MutationCtx, userId: string) => {
	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();

	if (!settings) {
		await ctx.db.insert("userSettings", {
			userId,
			timezone: "UTC",
			defaultTaskSchedulingMode: "fastest",
			schedulingHorizonDays: 75,
			googleRefreshToken: undefined,
			googleSyncToken: undefined,
			googleCalendarSyncTokens: [],
			googleConnectedCalendars: [],
		});
		return;
	}

	await ctx.db.replace(settings._id, {
		userId: settings.userId,
		timezone: settings.timezone ?? "UTC",
		defaultTaskSchedulingMode: sanitizeTaskSchedulingMode(
			(settings as { defaultTaskSchedulingMode?: string }).defaultTaskSchedulingMode,
		),
		schedulingHorizonDays: settings.schedulingHorizonDays ?? 75,
		googleRefreshToken: settings.googleRefreshToken,
		googleSyncToken: settings.googleSyncToken,
		googleCalendarSyncTokens: settings.googleCalendarSyncTokens ?? [],
		googleConnectedCalendars: settings.googleConnectedCalendars,
	});
};

const clearDefaultForUser = async (ctx: MutationCtx, userId: string) => {
	const existing = await ctx.db
		.query("hoursSets")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	await Promise.all(
		existing
			.filter((hoursSet: Doc<"hoursSets">) => hoursSet.isDefault)
			.map((hoursSet: Doc<"hoursSets">) =>
				ctx.db.patch(hoursSet._id, { isDefault: false, updatedAt: Date.now() }),
			),
	);
};

const upsertSystemSet = async (
	ctx: MutationCtx,
	args: {
		userId: string;
		name: string;
		windows: HourWindow[];
		isDefault: boolean;
		defaultCalendarId?: string;
	},
) => {
	const existing = await ctx.db
		.query("hoursSets")
		.withIndex("by_userId_name", (q) => q.eq("userId", args.userId).eq("name", args.name))
		.collect();
	const primaryExisting =
		existing.find((hoursSet: Doc<"hoursSets">) => hoursSet.isSystem) ?? existing[0] ?? null;
	const now = Date.now();
	if (primaryExisting) {
		await ctx.db.patch(primaryExisting._id, {
			name: args.name,
			isSystem: true,
			isDefault: args.isDefault,
			windows: args.windows,
			defaultCalendarId: args.defaultCalendarId ?? primaryExisting.defaultCalendarId,
			updatedAt: now,
		});
		await Promise.all(
			existing
				.filter((hoursSet: Doc<"hoursSets">) => hoursSet._id !== primaryExisting._id)
				.map((hoursSet: Doc<"hoursSets">) => ctx.db.delete(hoursSet._id)),
		);
		return primaryExisting._id as Id<"hoursSets">;
	}

	return ctx.db.insert("hoursSets", {
		userId: args.userId,
		name: args.name,
		isDefault: args.isDefault,
		isSystem: true,
		windows: args.windows,
		defaultCalendarId: args.defaultCalendarId,
		updatedAt: now,
	});
};

export const setDefaultHoursSet = mutation({
	args: {
		id: v.id("hoursSets"),
	},
	returns: v.id("hoursSets"),
	handler: withMutationAuth(
		async (ctx, args: { id: Id<"hoursSets"> }): Promise<Id<"hoursSets">> => {
			const hoursSet = await ensureHoursSetOwnership(ctx, args.id, ctx.userId);
			if (!hoursSet) throw notFoundError();
			if (hoursSet.isDefault) return hoursSet._id;

			await clearDefaultForUser(ctx, ctx.userId);
			await ctx.db.patch(hoursSet._id, { isDefault: true, updatedAt: Date.now() });
			return hoursSet._id;
		},
	),
});

export const setDefaultTaskSchedulingMode = mutation({
	args: {
		mode: taskSchedulingModeValidator,
	},
	returns: taskSchedulingModeValidator,
	handler: withMutationAuth(
		async (
			ctx,
			args: { mode: "fastest" | "backfacing" | "parallel" },
		): Promise<"fastest" | "backfacing" | "parallel"> => {
			await ensureSettingsForUser(ctx, ctx.userId);
			const settings = await ctx.db
				.query("userSettings")
				.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
				.unique();
			if (!settings) {
				await ctx.db.insert("userSettings", {
					userId: ctx.userId,
					timezone: "UTC",
					defaultTaskSchedulingMode: args.mode,
					schedulingHorizonDays: 75,
					googleRefreshToken: undefined,
					googleSyncToken: undefined,
					googleCalendarSyncTokens: [],
					googleConnectedCalendars: [],
				});
				return args.mode;
			}
			await ctx.db.patch(settings._id, {
				defaultTaskSchedulingMode: args.mode,
			});
			return args.mode;
		},
	),
});

export const createHoursSet = mutation({
	args: {
		input: hoursSetCreateInputValidator,
	},
	returns: v.id("hoursSets"),
	handler: withMutationAuth(
		async (ctx, args: { input: HoursSetCreateInput }): Promise<Id<"hoursSets">> => {
			const name = args.input.name.trim();
			if (!name) throw invalidNameError();
			assertValidWindows(args.input.windows);

			const existing = await ctx.db
				.query("hoursSets")
				.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
				.collect();
			const isDefault = existing.length === 0;

			if (isDefault) {
				await clearDefaultForUser(ctx, ctx.userId);
			}

			return ctx.db.insert("hoursSets", {
				userId: ctx.userId,
				name,
				isDefault,
				isSystem: false,
				windows: args.input.windows,
				defaultCalendarId: args.input.defaultCalendarId,
				updatedAt: Date.now(),
			});
		},
	),
});

export const updateHoursSet = mutation({
	args: {
		id: v.id("hoursSets"),
		input: hoursSetUpdateInputValidator,
	},
	returns: v.id("hoursSets"),
	handler: withMutationAuth(
		async (
			ctx,
			args: { id: Id<"hoursSets">; input: HoursSetUpdateInput },
		): Promise<Id<"hoursSets">> => {
			const hoursSet = await ensureHoursSetOwnership(ctx, args.id, ctx.userId);
			if (!hoursSet) throw notFoundError();

			const nextPatch: Record<string, unknown> = { updatedAt: Date.now() };
			if (args.input.name !== undefined) {
				const name = args.input.name.trim();
				if (!name) throw invalidNameError();
				if (hoursSet.isSystem && name !== hoursSet.name) {
					throw cannotRenameSystemError();
				}
				nextPatch.name = name;
			}
			if (args.input.windows !== undefined) {
				assertValidWindows(args.input.windows);
				nextPatch.windows = args.input.windows;
			}
			if (args.input.defaultCalendarId !== undefined) {
				nextPatch.defaultCalendarId = args.input.defaultCalendarId;
			}

			if (args.input.isDefault === true) {
				await clearDefaultForUser(ctx, ctx.userId);
				nextPatch.isDefault = true;
			} else if (args.input.isDefault === false) {
				if (hoursSet.isDefault) throw cannotUnsetDefaultError();
				nextPatch.isDefault = false;
			}

			await ctx.db.patch(hoursSet._id, nextPatch);
			return hoursSet._id;
		},
	),
});

export const deleteHoursSet = mutation({
	args: {
		id: v.id("hoursSets"),
	},
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: { id: Id<"hoursSets"> }): Promise<null> => {
		const hoursSet = await ensureHoursSetOwnership(ctx, args.id, ctx.userId);
		if (!hoursSet) throw notFoundError();
		if (hoursSet.isSystem) throw cannotDeleteSystemError();
		if (hoursSet.isDefault) throw cannotDeleteDefaultError();

		const defaultHoursSet = await getDefaultHoursSet(ctx, ctx.userId);
		if (!defaultHoursSet || defaultHoursSet._id === hoursSet._id) {
			throw cannotUnsetDefaultError();
		}

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId_hoursSetId", (q) =>
				q.eq("userId", ctx.userId).eq("hoursSetId", hoursSet._id),
			)
			.collect();
		const habits = await ctx.db
			.query("habits")
			.withIndex("by_userId_hoursSetId", (q) =>
				q.eq("userId", ctx.userId).eq("hoursSetId", hoursSet._id),
			)
			.collect();

		await Promise.all(
			tasks.map((task) =>
				ctx.db.patch(task._id, {
					hoursSetId: defaultHoursSet._id,
				}),
			),
		);
		await Promise.all(
			habits.map((habit) =>
				ctx.db.patch(habit._id, {
					hoursSetId: defaultHoursSet._id,
				}),
			),
		);

		await ctx.db.delete(hoursSet._id);
		return null;
	}),
});

export const internalBootstrapHoursSetsForUser = internalMutation({
	args: {
		userId: v.string(),
	},
	returns: v.object({
		defaultHoursSetId: v.id("hoursSets"),
	}),
	handler: async (ctx, args): Promise<{ defaultHoursSetId: Id<"hoursSets"> }> => {
		await ensureSettingsForUser(ctx, args.userId);
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.unique();
		assertValidWindows(anytimeWindows);

		const existingHoursSets = await ctx.db
			.query("hoursSets")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		const existingWorkSystemSet =
			existingHoursSets.find((hoursSet) => hoursSet.isSystem && hoursSet.name === WORK_SET_NAME) ??
			existingHoursSets.find(
				(hoursSet) => hoursSet.isSystem && hoursSet.name !== ANYTIME_SET_NAME,
			) ??
			null;
		const workWindows = existingWorkSystemSet?.windows ?? toWorkWindowsFromLegacySettings(settings);
		const existingDefault = existingHoursSets.find((hoursSet) => hoursSet.isDefault);
		const defaultWork = !existingDefault
			? true
			: existingWorkSystemSet
				? existingDefault._id === existingWorkSystemSet._id
				: existingDefault.name === WORK_SET_NAME;

		const workSetId = await upsertSystemSet(ctx, {
			userId: args.userId,
			name: WORK_SET_NAME,
			windows: workWindows,
			isDefault: defaultWork,
		});
		await upsertSystemSet(ctx, {
			userId: args.userId,
			name: ANYTIME_SET_NAME,
			windows: anytimeWindows,
			isDefault: false,
		});

		const allHoursSets = await ctx.db
			.query("hoursSets")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		let defaultHoursSet = allHoursSets.find((hoursSet) => hoursSet.isDefault) ?? null;
		if (!defaultHoursSet) {
			defaultHoursSet = allHoursSets.find((hoursSet) => hoursSet._id === workSetId) ?? null;
		}
		if (!defaultHoursSet) {
			defaultHoursSet = allHoursSets[0] ?? null;
		}
		if (!defaultHoursSet) {
			throw new ConvexError({
				code: "DEFAULT_HOURS_SET_REQUIRED",
				message: "Could not determine a default hours set.",
			});
		}

		await Promise.all(
			allHoursSets
				.filter((hoursSet) => hoursSet._id !== defaultHoursSet._id && hoursSet.isDefault)
				.map((hoursSet) =>
					ctx.db.patch(hoursSet._id, {
						isDefault: false,
						updatedAt: Date.now(),
					}),
				),
		);
		if (!defaultHoursSet.isDefault) {
			await ctx.db.patch(defaultHoursSet._id, {
				isDefault: true,
				updatedAt: Date.now(),
			});
		}

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		const habits = await ctx.db
			.query("habits")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		await Promise.all(
			tasks
				.filter((task) => !task.hoursSetId)
				.map((task) =>
					ctx.db.patch(task._id, {
						hoursSetId: defaultHoursSet._id,
					}),
				),
		);
		await Promise.all(
			habits
				.filter((habit) => !habit.hoursSetId)
				.map((habit) =>
					ctx.db.patch(habit._id, {
						hoursSetId: defaultHoursSet._id,
					}),
				),
		);

		return {
			defaultHoursSetId: defaultHoursSet._id,
		};
	},
});

export const internalGetDefaultHoursSetForUser = internalMutation({
	args: {
		userId: v.string(),
	},
	returns: v.union(v.null(), v.id("hoursSets")),
	handler: async (ctx, args) => {
		const defaultHoursSet = await getDefaultHoursSet(ctx, args.userId);
		return defaultHoursSet?._id ?? null;
	},
});
