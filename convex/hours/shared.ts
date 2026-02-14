import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type {
	DbCtx,
	HourWindow,
	HourWindowValidationErrorCode,
	SchedulingStepMinutes,
} from "../types/hours";

export type { HourWindow, SchedulingStepMinutes } from "../types/hours";

export const taskSchedulingModeValidator = v.union(
	v.literal("fastest"),
	v.literal("balanced"),
	v.literal("packed"),
);

export const taskPriorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
	v.literal("blocker"),
);

export const taskCreationStatusValidator = v.union(v.literal("backlog"), v.literal("queued"));

export const taskVisibilityPreferenceValidator = v.union(
	v.literal("default"),
	v.literal("private"),
);
export const timeFormatPreferenceValidator = v.union(v.literal("12h"), v.literal("24h"));

export const defaultTaskQuickCreateSettings = {
	priority: "medium",
	status: "backlog",
	estimatedMinutes: 30,
	splitAllowed: true,
	minChunkMinutes: 30,
	maxChunkMinutes: 180,
	restMinutes: 0,
	travelMinutes: 0,
	sendToUpNext: false,
	visibilityPreference: "private",
	color: "#f59e0b",
} as const;

export const habitFrequencyValidator = v.union(
	v.literal("daily"),
	v.literal("weekly"),
	v.literal("biweekly"),
	v.literal("monthly"),
);

export const habitRecoveryPolicyValidator = v.union(v.literal("skip"), v.literal("recover"));

export const defaultHabitQuickCreateSettings = {
	priority: "medium",
	durationMinutes: 30,
	frequency: "daily",
	recoveryPolicy: "skip",
	visibilityPreference: "private",
	color: "#22c55e",
} as const;

export const defaultSchedulingDowntimeMinutes = 0;
const maxSchedulingDowntimeMinutes = 24 * 60;
export const schedulingStepMinutesOptions = [15, 30, 60] as const;
export const schedulingStepMinutesValidator = v.union(v.literal(15), v.literal(30), v.literal(60));
export const defaultSchedulingStepMinutes = 15;

export const normalizeSchedulingDowntimeMinutes = (value: number | undefined) => {
	if (!Number.isFinite(value)) return defaultSchedulingDowntimeMinutes;
	return Math.min(maxSchedulingDowntimeMinutes, Math.max(0, Math.round(value ?? 0)));
};

export const normalizeSchedulingStepMinutes = (
	value: number | undefined,
): SchedulingStepMinutes => {
	if (!Number.isFinite(value)) return defaultSchedulingStepMinutes;
	const candidate = Math.round(value ?? defaultSchedulingStepMinutes);
	if (candidate === 15 || candidate === 30 || candidate === 60) return candidate;
	return defaultSchedulingStepMinutes;
};

const DEFAULT_TIMEZONE = "UTC";

export const isValidTimeZone = (value: string) => {
	const normalized = value.trim();
	if (!normalized) return false;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(0);
		return true;
	} catch {
		return false;
	}
};

export const normalizeTimeZone = (value: string | undefined) => {
	const normalized = value?.trim();
	if (!normalized || !isValidTimeZone(normalized)) return DEFAULT_TIMEZONE;
	return normalized;
};

export const normalizeTimeFormatPreference = (value: string | undefined): "12h" | "24h" | null => {
	if (value === "12h" || value === "24h") return value;
	return null;
};

// Week starts on (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
export const weekStartsOnValidator = v.union(
	v.literal(0),
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4),
	v.literal(5),
	v.literal(6),
);
export const defaultWeekStartsOn = 1; // Monday
export const normalizeWeekStartsOn = (value: number | undefined): number => {
	if (!Number.isFinite(value)) return defaultWeekStartsOn;
	const day = Math.round(value ?? defaultWeekStartsOn);
	if (day >= 0 && day <= 6) return day;
	return defaultWeekStartsOn;
};

// Date format preferences
export const dateFormatValidator = v.union(
	v.literal("MM/DD/YYYY"),
	v.literal("DD/MM/YYYY"),
	v.literal("YYYY-MM-DD"),
);
export const defaultDateFormat = "MM/DD/YYYY";
export const normalizeDateFormat = (value: string | undefined): string => {
	if (value === "MM/DD/YYYY" || value === "DD/MM/YYYY" || value === "YYYY-MM-DD") return value;
	return defaultDateFormat;
};

export const hourWindowDayValidator = v.union(
	v.literal(0),
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4),
	v.literal(5),
	v.literal(6),
);

export const hourWindowValidator = v.object({
	day: hourWindowDayValidator,
	startMinute: v.number(),
	endMinute: v.number(),
});

export const hoursSetValidator = v.object({
	_id: v.id("hoursSets"),
	_creationTime: v.number(),
	userId: v.string(),
	name: v.string(),
	isDefault: v.boolean(),
	isSystem: v.boolean(),
	windows: v.array(hourWindowValidator),
	defaultCalendarId: v.optional(v.string()),
	updatedAt: v.number(),
});

const hoursValidationError = (code: HourWindowValidationErrorCode, message: string) => {
	throw new ConvexError({
		code,
		message,
	});
};

export const anytimeWindows: HourWindow[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
	day: day as HourWindow["day"],
	startMinute: 0,
	endMinute: 1440,
}));

export const normalizeWindows = (windows: HourWindow[]) => {
	return [...windows].sort((a, b) => {
		if (a.day !== b.day) return a.day - b.day;
		if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
		return a.endMinute - b.endMinute;
	});
};

export const assertValidWindows = (windows: HourWindow[]) => {
	for (const window of windows) {
		if (
			window.startMinute < 0 ||
			window.endMinute > 1440 ||
			window.startMinute >= window.endMinute
		) {
			hoursValidationError(
				"INVALID_HOURS_WINDOW_RANGE",
				"Hours windows must satisfy 0 <= start < end <= 1440.",
			);
		}
		if (window.startMinute % 15 !== 0 || window.endMinute % 15 !== 0) {
			hoursValidationError(
				"INVALID_HOURS_WINDOW_GRANULARITY",
				"Hours windows must use 15-minute granularity.",
			);
		}
	}

	const windowsByDay = new Map<HourWindow["day"], HourWindow[]>();
	for (const window of normalizeWindows(windows)) {
		const dayWindows = windowsByDay.get(window.day) ?? [];
		if (dayWindows.some((existing) => window.startMinute < existing.endMinute)) {
			hoursValidationError(
				"OVERLAPPING_HOURS_WINDOWS",
				"Hours windows cannot overlap on the same day.",
			);
		}
		dayWindows.push(window);
		windowsByDay.set(window.day, dayWindows);
	}
};

export const getDefaultHoursSet = async (
	ctx: DbCtx,
	userId: string,
): Promise<Doc<"hoursSets"> | null> => {
	return ctx.db
		.query("hoursSets")
		.withIndex("by_userId_isDefault", (q) => q.eq("userId", userId).eq("isDefault", true))
		.unique();
};

export const ensureHoursSetOwnership = async (
	ctx: DbCtx,
	hoursSetId: Id<"hoursSets"> | undefined,
	userId: string,
) => {
	if (!hoursSetId) return null;
	const hoursSet = await ctx.db.get(hoursSetId);
	if (!hoursSet || hoursSet.userId !== userId) {
		throw new ConvexError({
			code: "INVALID_HOURS_SET",
			message: "The selected hours set does not exist.",
		});
	}
	return hoursSet;
};
