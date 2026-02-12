import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import { enqueueSchedulingRunFromMutation } from "../scheduling/enqueue";
import {
	type HourWindow,
	anytimeWindows,
	assertValidWindows,
	defaultSchedulingDowntimeMinutes,
	defaultSchedulingStepMinutes,
	defaultTaskQuickCreateSettings,
	ensureHoursSetOwnership,
	getDefaultHoursSet,
	hourWindowValidator,
	isValidTimeZone,
	normalizeSchedulingDowntimeMinutes,
	normalizeSchedulingStepMinutes,
	normalizeTimeFormatPreference,
	normalizeTimeZone,
	schedulingStepMinutesValidator,
	taskCreationStatusValidator,
	taskPriorityValidator,
	taskSchedulingModeValidator,
	taskVisibilityPreferenceValidator,
	timeFormatPreferenceValidator,
} from "./shared";

const WORK_SET_NAME = "Work";
const ANYTIME_SET_NAME = "Anytime (24/7)";
const DEFAULT_WORK_WINDOW_START = "09:00";
const DEFAULT_WORK_WINDOW_END = "17:00";
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5] as const;
const WEEKDAY_PREFERRED_DAYS = [1, 2, 3, 4, 5] as const;
const WEEKDAY_RECURRENCE_RULE = "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";

type SeedTaskTemplate = {
	title: string;
	description: string;
	priority: "low" | "medium" | "high" | "critical" | "blocker";
	status: "backlog" | "queued";
	estimatedMinutes: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	color?: string;
};

type SeedHabitTemplate = {
	title: string;
	description: string;
	category: "health" | "fitness" | "learning" | "mindfulness" | "productivity" | "social" | "other";
	priority?: "low" | "medium" | "high" | "critical";
	recurrenceRule: string;
	frequency?: "daily" | "weekly" | "biweekly" | "monthly";
	durationMinutes: number;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	color?: string;
};

const DEFAULT_SEED_TASKS: SeedTaskTemplate[] = [
	{
		title: "Plan weekly priorities",
		description: "Clarify the highest-impact outcomes for this week.",
		priority: "high",
		status: "backlog",
		estimatedMinutes: 45,
		splitAllowed: false,
		color: "#0ea5e9",
	},
	{
		title: "Triage inbox and messages",
		description: "Clear important emails/messages and capture action items.",
		priority: "medium",
		status: "backlog",
		estimatedMinutes: 30,
		splitAllowed: false,
		color: "#14b8a6",
	},
	{
		title: "Deep work: top project milestone",
		description: "Reserve focused time for your most important project task.",
		priority: "high",
		status: "backlog",
		estimatedMinutes: 120,
		splitAllowed: true,
		minChunkMinutes: 60,
		maxChunkMinutes: 120,
		color: "#6366f1",
	},
	{
		title: "Follow up on pending blockers",
		description: "Unblock work by nudging dependencies and open decisions.",
		priority: "high",
		status: "backlog",
		estimatedMinutes: 30,
		splitAllowed: false,
		color: "#f97316",
	},
	{
		title: "Admin sweep (expenses, docs, approvals)",
		description: "Handle operational admin so it does not pile up.",
		priority: "medium",
		status: "backlog",
		estimatedMinutes: 45,
		splitAllowed: true,
		minChunkMinutes: 15,
		maxChunkMinutes: 45,
		color: "#a855f7",
	},
	{
		title: "End-of-day shutdown and tomorrow plan",
		description: "Close today intentionally and define tomorrow's first task.",
		priority: "medium",
		status: "backlog",
		estimatedMinutes: 20,
		splitAllowed: false,
		color: "#22c55e",
	},
];

const DEFAULT_SEED_HABITS: SeedHabitTemplate[] = [
	{
		title: "Daily planning",
		description: "Set the day's top outcomes before starting execution.",
		category: "productivity",
		priority: "high",
		recurrenceRule: WEEKDAY_RECURRENCE_RULE,
		frequency: "daily",
		durationMinutes: 15,
		preferredWindowStart: "08:30",
		preferredWindowEnd: "09:30",
		preferredDays: [...WEEKDAY_PREFERRED_DAYS],
		color: "#0ea5e9",
	},
	{
		title: "Focus block",
		description: "Protect uninterrupted time for high-cognitive work.",
		category: "productivity",
		priority: "high",
		recurrenceRule: WEEKDAY_RECURRENCE_RULE,
		frequency: "daily",
		durationMinutes: 90,
		preferredWindowStart: "09:00",
		preferredWindowEnd: "12:00",
		preferredDays: [...WEEKDAY_PREFERRED_DAYS],
		color: "#6366f1",
	},
	{
		title: "Lunch break",
		description: "Take a real mid-day break to sustain afternoon energy.",
		category: "health",
		priority: "medium",
		recurrenceRule: WEEKDAY_RECURRENCE_RULE,
		frequency: "daily",
		durationMinutes: 45,
		preferredWindowStart: "12:00",
		preferredWindowEnd: "14:00",
		preferredDays: [...WEEKDAY_PREFERRED_DAYS],
		color: "#22c55e",
	},
	{
		title: "Movement break",
		description: "Stand up, stretch, or walk to reduce sedentary load.",
		category: "health",
		priority: "medium",
		recurrenceRule: "RRULE:FREQ=DAILY",
		frequency: "daily",
		durationMinutes: 15,
		preferredWindowStart: "15:00",
		preferredWindowEnd: "17:00",
		color: "#14b8a6",
	},
	{
		title: "Wrap-up and shutdown",
		description: "Review progress, close loops, and prep handoff notes.",
		category: "productivity",
		priority: "medium",
		recurrenceRule: WEEKDAY_RECURRENCE_RULE,
		frequency: "daily",
		durationMinutes: 20,
		preferredWindowStart: "16:30",
		preferredWindowEnd: "18:30",
		preferredDays: [...WEEKDAY_PREFERRED_DAYS],
		color: "#f59e0b",
	},
	{
		title: "Weekly review",
		description: "Assess wins, blockers, and priorities for the next week.",
		category: "learning",
		priority: "high",
		recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=FR",
		frequency: "weekly",
		durationMinutes: 60,
		preferredWindowStart: "15:00",
		preferredWindowEnd: "17:30",
		preferredDays: [5],
		color: "#ec4899",
	},
];

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
): "fastest" | "balanced" | "packed" => {
	if (mode === "fastest" || mode === "balanced" || mode === "packed") {
		return mode;
	}
	if (mode === "backfacing") return "packed";
	if (mode === "parallel") return "balanced";
	return "fastest";
};

type TaskQuickCreateSettingsShape = {
	taskQuickCreatePriority?: string;
	taskQuickCreateStatus?: string;
	taskQuickCreateEstimatedMinutes?: number;
	taskQuickCreateSplitAllowed?: boolean;
	taskQuickCreateMinChunkMinutes?: number;
	taskQuickCreateMaxChunkMinutes?: number;
	taskQuickCreateRestMinutes?: number;
	taskQuickCreateTravelMinutes?: number;
	taskQuickCreateSendToUpNext?: boolean;
	taskQuickCreateVisibilityPreference?: string;
	taskQuickCreateColor?: string;
};

type NormalizedTaskQuickCreateDefaults = {
	taskQuickCreatePriority: "low" | "medium" | "high" | "critical" | "blocker";
	taskQuickCreateStatus: "backlog" | "queued";
	taskQuickCreateEstimatedMinutes: number;
	taskQuickCreateSplitAllowed: boolean;
	taskQuickCreateMinChunkMinutes: number;
	taskQuickCreateMaxChunkMinutes: number;
	taskQuickCreateRestMinutes: number;
	taskQuickCreateTravelMinutes: number;
	taskQuickCreateSendToUpNext: boolean;
	taskQuickCreateVisibilityPreference: "default" | "private";
	taskQuickCreateColor: string;
};

const normalizeTaskQuickCreateColor = (color: string | undefined) => {
	const normalized = color?.trim();
	return normalized && normalized.length > 0 ? normalized : defaultTaskQuickCreateSettings.color;
};

const normalizeTaskQuickCreateEstimatedMinutes = (value: number | undefined) => {
	const candidate = Number.isFinite(value)
		? (value ?? defaultTaskQuickCreateSettings.estimatedMinutes)
		: defaultTaskQuickCreateSettings.estimatedMinutes;
	return Math.max(15, Math.round(candidate));
};

const normalizeTaskQuickCreateMinChunkMinutes = (value: number | undefined) => {
	const candidate = Number.isFinite(value)
		? (value ?? defaultTaskQuickCreateSettings.minChunkMinutes)
		: defaultTaskQuickCreateSettings.minChunkMinutes;
	return Math.max(15, Math.round(candidate));
};

const normalizeTaskQuickCreateOptionalMinutes = (value: number | undefined, fallback: number) => {
	const candidate = Number.isFinite(value) ? (value ?? fallback) : fallback;
	return Math.max(0, Math.round(candidate));
};

const normalizeTaskQuickCreateDefaults = (
	settings: TaskQuickCreateSettingsShape | null,
): NormalizedTaskQuickCreateDefaults => {
	const priority =
		settings?.taskQuickCreatePriority === "low" ||
		settings?.taskQuickCreatePriority === "medium" ||
		settings?.taskQuickCreatePriority === "high" ||
		settings?.taskQuickCreatePriority === "critical" ||
		settings?.taskQuickCreatePriority === "blocker"
			? settings.taskQuickCreatePriority
			: defaultTaskQuickCreateSettings.priority;

	const status =
		settings?.taskQuickCreateStatus === "queued" || settings?.taskQuickCreateStatus === "backlog"
			? settings.taskQuickCreateStatus
			: defaultTaskQuickCreateSettings.status;

	const estimatedMinutes = normalizeTaskQuickCreateEstimatedMinutes(
		settings?.taskQuickCreateEstimatedMinutes,
	);
	const splitAllowed =
		settings?.taskQuickCreateSplitAllowed ?? defaultTaskQuickCreateSettings.splitAllowed;
	const minChunkMinutes = normalizeTaskQuickCreateMinChunkMinutes(
		settings?.taskQuickCreateMinChunkMinutes,
	);
	const maxChunkCandidate = Number.isFinite(settings?.taskQuickCreateMaxChunkMinutes)
		? (settings?.taskQuickCreateMaxChunkMinutes ?? defaultTaskQuickCreateSettings.maxChunkMinutes)
		: defaultTaskQuickCreateSettings.maxChunkMinutes;
	const maxChunkMinutes = Math.max(minChunkMinutes, Math.round(maxChunkCandidate));
	const restMinutes = normalizeTaskQuickCreateOptionalMinutes(
		settings?.taskQuickCreateRestMinutes,
		defaultTaskQuickCreateSettings.restMinutes,
	);
	const travelMinutes = normalizeTaskQuickCreateOptionalMinutes(
		settings?.taskQuickCreateTravelMinutes,
		defaultTaskQuickCreateSettings.travelMinutes,
	);

	const visibilityPreference =
		settings?.taskQuickCreateVisibilityPreference === "default" ||
		settings?.taskQuickCreateVisibilityPreference === "private"
			? settings.taskQuickCreateVisibilityPreference
			: defaultTaskQuickCreateSettings.visibilityPreference;

	return {
		taskQuickCreatePriority: priority,
		taskQuickCreateStatus: status,
		taskQuickCreateEstimatedMinutes: estimatedMinutes,
		taskQuickCreateSplitAllowed: splitAllowed,
		taskQuickCreateMinChunkMinutes: minChunkMinutes,
		taskQuickCreateMaxChunkMinutes: maxChunkMinutes,
		taskQuickCreateRestMinutes: restMinutes,
		taskQuickCreateTravelMinutes: travelMinutes,
		taskQuickCreateSendToUpNext:
			settings?.taskQuickCreateSendToUpNext ?? defaultTaskQuickCreateSettings.sendToUpNext,
		taskQuickCreateVisibilityPreference: visibilityPreference,
		taskQuickCreateColor: normalizeTaskQuickCreateColor(settings?.taskQuickCreateColor),
	};
};

const normalizedSchedulingDowntimeMinutesFromSettings = (
	settings: { schedulingDowntimeMinutes?: number } | null,
) => normalizeSchedulingDowntimeMinutes(settings?.schedulingDowntimeMinutes);
const normalizedSchedulingStepMinutesFromSettings = (
	settings: { schedulingStepMinutes?: number } | null,
) => normalizeSchedulingStepMinutes(settings?.schedulingStepMinutes);
const normalizedTimeFormatPreferenceFromSettings = (
	settings: {
		timeFormatPreference?: string;
	} | null,
) => normalizeTimeFormatPreference(settings?.timeFormatPreference) ?? undefined;

const sanitizeHabitPriority = (
	priority: string | undefined,
): "low" | "medium" | "high" | "critical" => {
	if (priority === "low" || priority === "medium" || priority === "high") return priority;
	if (priority === "critical" || priority === "blocker") return "critical";
	return "medium";
};

const recurrenceFromLegacyFrequency = (frequency: string | undefined) => {
	if (frequency === "daily") return "RRULE:FREQ=DAILY;INTERVAL=1";
	if (frequency === "weekly") return "RRULE:FREQ=WEEKLY;INTERVAL=1";
	if (frequency === "biweekly") return "RRULE:FREQ=WEEKLY;INTERVAL=2";
	if (frequency === "monthly") return "RRULE:FREQ=MONTHLY;INTERVAL=1";
	return "RRULE:FREQ=WEEKLY;INTERVAL=1";
};

const ensureSettingsForUser = async (ctx: MutationCtx, userId: string) => {
	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();

	if (!settings) {
		await ctx.db.insert("userSettings", {
			userId,
			timezone: normalizeTimeZone(undefined),
			timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(null),
			defaultTaskSchedulingMode: "fastest",
			...normalizeTaskQuickCreateDefaults(null),
			schedulingHorizonDays: 75,
			schedulingDowntimeMinutes: defaultSchedulingDowntimeMinutes,
			schedulingStepMinutes: defaultSchedulingStepMinutes,
			googleRefreshToken: undefined,
			googleSyncToken: undefined,
			googleCalendarSyncTokens: [],
			googleConnectedCalendars: [],
		});
		return;
	}

	await ctx.db.replace(settings._id, {
		userId: settings.userId,
		timezone: normalizeTimeZone(settings.timezone),
		timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(settings),
		defaultTaskSchedulingMode: sanitizeTaskSchedulingMode(
			(settings as { defaultTaskSchedulingMode?: string }).defaultTaskSchedulingMode,
		),
		...normalizeTaskQuickCreateDefaults(settings as TaskQuickCreateSettingsShape),
		schedulingHorizonDays: settings.schedulingHorizonDays ?? 75,
		schedulingDowntimeMinutes: normalizedSchedulingDowntimeMinutesFromSettings(settings),
		schedulingStepMinutes: normalizedSchedulingStepMinutesFromSettings(settings),
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
			await enqueueSchedulingRunFromMutation(ctx, {
				userId: ctx.userId,
				triggeredBy: "hours_change",
			});
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
			args: { mode: "fastest" | "balanced" | "packed" },
		): Promise<"fastest" | "balanced" | "packed"> => {
			await ensureSettingsForUser(ctx, ctx.userId);
			const settings = await ctx.db
				.query("userSettings")
				.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
				.unique();
			if (!settings) {
				await ctx.db.insert("userSettings", {
					userId: ctx.userId,
					timezone: normalizeTimeZone(undefined),
					timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(null),
					defaultTaskSchedulingMode: args.mode,
					...normalizeTaskQuickCreateDefaults(null),
					schedulingHorizonDays: 75,
					schedulingDowntimeMinutes: defaultSchedulingDowntimeMinutes,
					schedulingStepMinutes: defaultSchedulingStepMinutes,
					googleRefreshToken: undefined,
					googleSyncToken: undefined,
					googleCalendarSyncTokens: [],
					googleConnectedCalendars: [],
				});
				await enqueueSchedulingRunFromMutation(ctx, {
					userId: ctx.userId,
					triggeredBy: "hours_change",
				});
				return args.mode;
			}
			await ctx.db.patch(settings._id, {
				defaultTaskSchedulingMode: args.mode,
			});
			await enqueueSchedulingRunFromMutation(ctx, {
				userId: ctx.userId,
				triggeredBy: "hours_change",
			});
			return args.mode;
		},
	),
});

export const setSchedulingDowntimeMinutes = mutation({
	args: {
		minutes: v.number(),
	},
	returns: v.number(),
	handler: withMutationAuth(async (ctx, args: { minutes: number }): Promise<number> => {
		await ensureSettingsForUser(ctx, ctx.userId);
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.unique();
		const normalizedMinutes = normalizeSchedulingDowntimeMinutes(args.minutes);
		if (!settings) {
			await ctx.db.insert("userSettings", {
				userId: ctx.userId,
				timezone: normalizeTimeZone(undefined),
				timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(null),
				defaultTaskSchedulingMode: "fastest",
				...normalizeTaskQuickCreateDefaults(null),
				schedulingHorizonDays: 75,
				schedulingDowntimeMinutes: normalizedMinutes,
				schedulingStepMinutes: defaultSchedulingStepMinutes,
				googleRefreshToken: undefined,
				googleSyncToken: undefined,
				googleCalendarSyncTokens: [],
				googleConnectedCalendars: [],
			});
		} else {
			await ctx.db.patch(settings._id, {
				schedulingDowntimeMinutes: normalizedMinutes,
			});
		}
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "hours_change",
		});
		return normalizedMinutes;
	}),
});

export const setSchedulingStepMinutes = mutation({
	args: {
		minutes: schedulingStepMinutesValidator,
	},
	returns: schedulingStepMinutesValidator,
	handler: withMutationAuth(async (ctx, args: { minutes: 15 | 30 | 60 }): Promise<15 | 30 | 60> => {
		await ensureSettingsForUser(ctx, ctx.userId);
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.unique();
		const normalizedMinutes = normalizeSchedulingStepMinutes(args.minutes);
		if (!settings) {
			await ctx.db.insert("userSettings", {
				userId: ctx.userId,
				timezone: normalizeTimeZone(undefined),
				timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(null),
				defaultTaskSchedulingMode: "fastest",
				...normalizeTaskQuickCreateDefaults(null),
				schedulingHorizonDays: 75,
				schedulingDowntimeMinutes: defaultSchedulingDowntimeMinutes,
				schedulingStepMinutes: normalizedMinutes,
				googleRefreshToken: undefined,
				googleSyncToken: undefined,
				googleCalendarSyncTokens: [],
				googleConnectedCalendars: [],
			});
		} else {
			await ctx.db.patch(settings._id, {
				schedulingStepMinutes: normalizedMinutes,
			});
		}
		return normalizedMinutes;
	}),
});

const calendarDisplayPreferencesValidator = v.object({
	timezone: v.string(),
	timeFormatPreference: timeFormatPreferenceValidator,
});

export const setCalendarDisplayPreferences = mutation({
	args: {
		timezone: v.string(),
		timeFormatPreference: timeFormatPreferenceValidator,
	},
	returns: calendarDisplayPreferencesValidator,
	handler: withMutationAuth(
		async (
			ctx,
			args: { timezone: string; timeFormatPreference: "12h" | "24h" },
		): Promise<{ timezone: string; timeFormatPreference: "12h" | "24h" }> => {
			const timezone = args.timezone.trim();
			if (!isValidTimeZone(timezone)) {
				throw new ConvexError({
					code: "INVALID_TIMEZONE",
					message: "Timezone must be a valid IANA timezone identifier.",
				});
			}

			await ensureSettingsForUser(ctx, ctx.userId);
			const settings = await ctx.db
				.query("userSettings")
				.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
				.unique();
			const previousTimezone = normalizeTimeZone(settings?.timezone);
			if (!settings) {
				await ctx.db.insert("userSettings", {
					userId: ctx.userId,
					timezone,
					timeFormatPreference: args.timeFormatPreference,
					defaultTaskSchedulingMode: "fastest",
					...normalizeTaskQuickCreateDefaults(null),
					schedulingHorizonDays: 75,
					schedulingDowntimeMinutes: defaultSchedulingDowntimeMinutes,
					schedulingStepMinutes: defaultSchedulingStepMinutes,
					googleRefreshToken: undefined,
					googleSyncToken: undefined,
					googleCalendarSyncTokens: [],
					googleConnectedCalendars: [],
				});
			} else {
				await ctx.db.patch(settings._id, {
					timezone,
					timeFormatPreference: args.timeFormatPreference,
				});
			}

			if (previousTimezone !== timezone) {
				await enqueueSchedulingRunFromMutation(ctx, {
					userId: ctx.userId,
					triggeredBy: "hours_change",
				});
			}

			return {
				timezone,
				timeFormatPreference: args.timeFormatPreference,
			};
		},
	),
});

const taskQuickCreateDefaultsInputValidator = v.object({
	priority: taskPriorityValidator,
	status: taskCreationStatusValidator,
	estimatedMinutes: v.number(),
	splitAllowed: v.boolean(),
	minChunkMinutes: v.number(),
	maxChunkMinutes: v.number(),
	restMinutes: v.number(),
	travelMinutes: v.number(),
	sendToUpNext: v.boolean(),
	visibilityPreference: taskVisibilityPreferenceValidator,
	color: v.string(),
});

const taskQuickCreateDefaultsReturnValidator = v.object({
	priority: taskPriorityValidator,
	status: taskCreationStatusValidator,
	estimatedMinutes: v.number(),
	splitAllowed: v.boolean(),
	minChunkMinutes: v.number(),
	maxChunkMinutes: v.number(),
	restMinutes: v.number(),
	travelMinutes: v.number(),
	sendToUpNext: v.boolean(),
	visibilityPreference: taskVisibilityPreferenceValidator,
	color: v.string(),
});

export const setTaskQuickCreateDefaults = mutation({
	args: {
		defaults: taskQuickCreateDefaultsInputValidator,
	},
	returns: taskQuickCreateDefaultsReturnValidator,
	handler: withMutationAuth(
		async (
			ctx,
			args: {
				defaults: {
					priority: "low" | "medium" | "high" | "critical" | "blocker";
					status: "backlog" | "queued";
					estimatedMinutes: number;
					splitAllowed: boolean;
					minChunkMinutes: number;
					maxChunkMinutes: number;
					restMinutes: number;
					travelMinutes: number;
					sendToUpNext: boolean;
					visibilityPreference: "default" | "private";
					color: string;
				};
			},
		): Promise<{
			priority: "low" | "medium" | "high" | "critical" | "blocker";
			status: "backlog" | "queued";
			estimatedMinutes: number;
			splitAllowed: boolean;
			minChunkMinutes: number;
			maxChunkMinutes: number;
			restMinutes: number;
			travelMinutes: number;
			sendToUpNext: boolean;
			visibilityPreference: "default" | "private";
			color: string;
		}> => {
			await ensureSettingsForUser(ctx, ctx.userId);
			const settings = await ctx.db
				.query("userSettings")
				.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
				.unique();

			const normalizedDefaults = normalizeTaskQuickCreateDefaults({
				taskQuickCreatePriority: args.defaults.priority,
				taskQuickCreateStatus: args.defaults.status,
				taskQuickCreateEstimatedMinutes: args.defaults.estimatedMinutes,
				taskQuickCreateSplitAllowed: args.defaults.splitAllowed,
				taskQuickCreateMinChunkMinutes: args.defaults.minChunkMinutes,
				taskQuickCreateMaxChunkMinutes: args.defaults.maxChunkMinutes,
				taskQuickCreateRestMinutes: args.defaults.restMinutes,
				taskQuickCreateTravelMinutes: args.defaults.travelMinutes,
				taskQuickCreateSendToUpNext: args.defaults.sendToUpNext,
				taskQuickCreateVisibilityPreference: args.defaults.visibilityPreference,
				taskQuickCreateColor: args.defaults.color,
			});

			if (!settings) {
				await ctx.db.insert("userSettings", {
					userId: ctx.userId,
					timezone: normalizeTimeZone(undefined),
					timeFormatPreference: normalizedTimeFormatPreferenceFromSettings(null),
					defaultTaskSchedulingMode: "fastest",
					...normalizedDefaults,
					schedulingHorizonDays: 75,
					schedulingDowntimeMinutes: defaultSchedulingDowntimeMinutes,
					schedulingStepMinutes: defaultSchedulingStepMinutes,
					googleRefreshToken: undefined,
					googleSyncToken: undefined,
					googleCalendarSyncTokens: [],
					googleConnectedCalendars: [],
				});
			} else {
				await ctx.db.patch(settings._id, normalizedDefaults);
			}

			return {
				priority: normalizedDefaults.taskQuickCreatePriority,
				status: normalizedDefaults.taskQuickCreateStatus,
				estimatedMinutes: normalizedDefaults.taskQuickCreateEstimatedMinutes,
				splitAllowed: normalizedDefaults.taskQuickCreateSplitAllowed,
				minChunkMinutes: normalizedDefaults.taskQuickCreateMinChunkMinutes,
				maxChunkMinutes: normalizedDefaults.taskQuickCreateMaxChunkMinutes,
				restMinutes: normalizedDefaults.taskQuickCreateRestMinutes,
				travelMinutes: normalizedDefaults.taskQuickCreateTravelMinutes,
				sendToUpNext: normalizedDefaults.taskQuickCreateSendToUpNext,
				visibilityPreference: normalizedDefaults.taskQuickCreateVisibilityPreference,
				color: normalizedDefaults.taskQuickCreateColor,
			};
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

			const createdId = await ctx.db.insert("hoursSets", {
				userId: ctx.userId,
				name,
				isDefault,
				isSystem: false,
				windows: args.input.windows,
				defaultCalendarId: args.input.defaultCalendarId,
				updatedAt: Date.now(),
			});
			await enqueueSchedulingRunFromMutation(ctx, {
				userId: ctx.userId,
				triggeredBy: "hours_change",
			});
			return createdId;
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
			await enqueueSchedulingRunFromMutation(ctx, {
				userId: ctx.userId,
				triggeredBy: "hours_change",
			});
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
		await enqueueSchedulingRunFromMutation(ctx, {
			userId: ctx.userId,
			triggeredBy: "hours_change",
		});
		return null;
	}),
});

const normalizeTitleKey = (title: string) => title.trim().toLowerCase();

const taskStatuses = ["backlog", "queued", "scheduled", "in_progress", "done"] as const;

const bootstrapHoursSetsForUser = async (
	ctx: MutationCtx,
	userId: string,
): Promise<{ defaultHoursSetId: Id<"hoursSets">; reassignedCount: number }> => {
	await ensureSettingsForUser(ctx, userId);
	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();
	assertValidWindows(anytimeWindows);

	const existingHoursSets = await ctx.db
		.query("hoursSets")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();
	const existingWorkSystemSet =
		existingHoursSets.find((hoursSet) => hoursSet.isSystem && hoursSet.name === WORK_SET_NAME) ??
		existingHoursSets.find((hoursSet) => hoursSet.isSystem && hoursSet.name !== ANYTIME_SET_NAME) ??
		null;
	const workWindows = existingWorkSystemSet?.windows ?? toWorkWindowsFromLegacySettings(settings);
	const existingDefault = existingHoursSets.find((hoursSet) => hoursSet.isDefault);
	const defaultWork = !existingDefault
		? true
		: existingWorkSystemSet
			? existingDefault._id === existingWorkSystemSet._id
			: existingDefault.name === WORK_SET_NAME;

	const workSetId = await upsertSystemSet(ctx, {
		userId,
		name: WORK_SET_NAME,
		windows: workWindows,
		isDefault: defaultWork,
	});
	await upsertSystemSet(ctx, {
		userId,
		name: ANYTIME_SET_NAME,
		windows: anytimeWindows,
		isDefault: false,
	});

	const allHoursSets = await ctx.db
		.query("hoursSets")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
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
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();
	const habits = await ctx.db
		.query("habits")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	const tasksWithoutSet = tasks.filter((task) => !task.hoursSetId);
	const habitsWithoutSet = habits.filter((habit) => !habit.hoursSetId);

	await Promise.all(
		tasksWithoutSet.map((task) =>
			ctx.db.patch(task._id, {
				hoursSetId: defaultHoursSet._id,
			}),
		),
	);
	await Promise.all(
		habitsWithoutSet.map((habit) =>
			ctx.db.patch(habit._id, {
				hoursSetId: defaultHoursSet._id,
			}),
		),
	);

	return {
		defaultHoursSetId: defaultHoursSet._id,
		reassignedCount: tasksWithoutSet.length + habitsWithoutSet.length,
	};
};

export const internalBootstrapHoursSetsForUser = internalMutation({
	args: {
		userId: v.string(),
	},
	returns: v.object({
		defaultHoursSetId: v.id("hoursSets"),
	}),
	handler: async (ctx, args): Promise<{ defaultHoursSetId: Id<"hoursSets"> }> => {
		const result = await bootstrapHoursSetsForUser(ctx, args.userId);
		return { defaultHoursSetId: result.defaultHoursSetId };
	},
});

export const internalBootstrapDefaultPlannerDataForUser = internalMutation({
	args: {
		userId: v.string(),
	},
	returns: v.object({
		defaultHoursSetId: v.id("hoursSets"),
		createdTasks: v.number(),
		createdHabits: v.number(),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		defaultHoursSetId: Id<"hoursSets">;
		createdTasks: number;
		createdHabits: number;
	}> => {
		const result = await bootstrapHoursSetsForUser(ctx, args.userId);
		const existingTasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		const existingHabits = await ctx.db
			.query("habits")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		const taskTitleKeys = new Set(existingTasks.map((task) => normalizeTitleKey(task.title)));
		const habitTitleKeys = new Set(existingHabits.map((habit) => normalizeTitleKey(habit.title)));
		const maxSortOrderByStatus = new Map<(typeof taskStatuses)[number], number>(
			taskStatuses.map((status) => [status, -1] as const),
		);

		for (const task of existingTasks) {
			const currentMax = maxSortOrderByStatus.get(task.status) ?? -1;
			if (task.sortOrder > currentMax) {
				maxSortOrderByStatus.set(task.status, task.sortOrder);
			}
		}

		let createdTasks = 0;
		for (const template of DEFAULT_SEED_TASKS) {
			const titleKey = normalizeTitleKey(template.title);
			if (taskTitleKeys.has(titleKey)) continue;

			const currentSortOrder = maxSortOrderByStatus.get(template.status) ?? -1;
			const nextSortOrder = currentSortOrder + 1;
			maxSortOrderByStatus.set(template.status, nextSortOrder);

			await ctx.db.insert("tasks", {
				userId: args.userId,
				title: template.title,
				description: template.description,
				priority: template.priority,
				status: template.status,
				estimatedMinutes: template.estimatedMinutes,
				deadline: undefined,
				scheduleAfter: undefined,
				scheduledStart: undefined,
				scheduledEnd: undefined,
				completedAt: undefined,
				sortOrder: nextSortOrder,
				splitAllowed: template.splitAllowed,
				minChunkMinutes: template.minChunkMinutes,
				maxChunkMinutes: template.maxChunkMinutes,
				sendToUpNext: false,
				hoursSetId: result.defaultHoursSetId,
				schedulingMode: undefined,
				visibilityPreference: "default",
				preferredCalendarId: "primary",
				color: template.color,
			});
			taskTitleKeys.add(titleKey);
			createdTasks += 1;
		}

		let createdHabits = 0;
		for (const template of DEFAULT_SEED_HABITS) {
			const titleKey = normalizeTitleKey(template.title);
			if (habitTitleKeys.has(titleKey)) continue;
			await ctx.db.insert("habits", {
				userId: args.userId,
				title: template.title,
				description: template.description,
				priority: template.priority ?? "medium",
				category: template.category,
				recurrenceRule: template.recurrenceRule,
				recoveryPolicy: "skip",
				frequency: template.frequency,
				durationMinutes: template.durationMinutes,
				minDurationMinutes: undefined,
				maxDurationMinutes: undefined,
				repeatsPerPeriod: undefined,
				idealTime: undefined,
				preferredWindowStart: template.preferredWindowStart,
				preferredWindowEnd: template.preferredWindowEnd,
				preferredDays: template.preferredDays,
				hoursSetId: result.defaultHoursSetId,
				preferredCalendarId: "primary",
				color: template.color,
				location: undefined,
				startDate: undefined,
				endDate: undefined,
				visibilityPreference: "default",
				timeDefenseMode: "auto",
				reminderMode: "default",
				customReminderMinutes: undefined,
				unscheduledBehavior: "leave_on_calendar",
				autoDeclineInvites: undefined,
				ccEmails: undefined,
				duplicateAvoidKeywords: undefined,
				dependencyNote: undefined,
				publicDescription: undefined,
				isActive: true,
			});
			habitTitleKeys.add(titleKey);
			createdHabits += 1;
		}

		if (createdTasks > 0 || createdHabits > 0 || result.reassignedCount > 0) {
			await enqueueSchedulingRunFromMutation(ctx, {
				userId: args.userId,
				triggeredBy: "task_change",
			});
		}

		return {
			defaultHoursSetId: result.defaultHoursSetId,
			createdTasks,
			createdHabits,
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

export const internalMigrateSchedulingModelForUser = internalMutation({
	args: {
		userId: v.string(),
	},
	returns: v.object({
		updatedSettings: v.number(),
		updatedTasks: v.number(),
		updatedHabits: v.number(),
	}),
	handler: async (ctx, args) => {
		let updatedSettings = 0;
		let updatedTasks = 0;
		let updatedHabits = 0;

		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.unique();
		if (settings) {
			const normalizedMode = sanitizeTaskSchedulingMode(
				(settings as { defaultTaskSchedulingMode?: string }).defaultTaskSchedulingMode,
			);
			const normalizedDowntimeMinutes = normalizedSchedulingDowntimeMinutesFromSettings(settings);
			const normalizedStepMinutes = normalizedSchedulingStepMinutesFromSettings(settings);
			if (
				settings.defaultTaskSchedulingMode !== normalizedMode ||
				settings.schedulingDowntimeMinutes !== normalizedDowntimeMinutes ||
				settings.schedulingStepMinutes !== normalizedStepMinutes
			) {
				await ctx.db.patch(settings._id, {
					defaultTaskSchedulingMode: normalizedMode,
					schedulingDowntimeMinutes: normalizedDowntimeMinutes,
					schedulingStepMinutes: normalizedStepMinutes,
				});
				updatedSettings += 1;
			}
		}

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		for (const task of tasks) {
			const nextMode = task.schedulingMode
				? sanitizeTaskSchedulingMode(task.schedulingMode as string)
				: undefined;
			if (nextMode !== task.schedulingMode) {
				await ctx.db.patch(task._id, {
					schedulingMode: nextMode,
				});
				updatedTasks += 1;
			}
		}

		const habits = await ctx.db
			.query("habits")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();
		for (const habit of habits) {
			const nextPriority = sanitizeHabitPriority(habit.priority as string | undefined);
			const nextRecurrence =
				habit.recurrenceRule ??
				recurrenceFromLegacyFrequency((habit as { frequency?: string }).frequency);
			const nextRecoveryPolicy = habit.recoveryPolicy ?? "skip";
			const shouldPatch =
				habit.priority !== nextPriority ||
				habit.recurrenceRule !== nextRecurrence ||
				habit.recoveryPolicy !== nextRecoveryPolicy;
			if (!shouldPatch) continue;
			await ctx.db.patch(habit._id, {
				priority: nextPriority,
				recurrenceRule: nextRecurrence,
				recoveryPolicy: nextRecoveryPolicy,
			});
			updatedHabits += 1;
		}

		return {
			updatedSettings,
			updatedTasks,
			updatedHabits,
		};
	},
});
