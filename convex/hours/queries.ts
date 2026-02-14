import { v } from "convex/values";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import {
	dateFormatValidator,
	defaultHabitQuickCreateSettings,
	defaultTaskQuickCreateSettings,
	habitFrequencyValidator,
	habitRecoveryPolicyValidator,
	hoursSetValidator,
	isValidTimeZone,
	normalizeDateFormat,
	normalizeSchedulingDowntimeMinutes,
	normalizeSchedulingStepMinutes,
	normalizeTimeFormatPreference,
	normalizeWeekStartsOn,
	schedulingStepMinutesValidator,
	taskCreationStatusValidator,
	taskPriorityValidator,
	taskSchedulingModeValidator,
	taskVisibilityPreferenceValidator,
	timeFormatPreferenceValidator,
	weekStartsOnValidator,
} from "./shared";

const sanitizeTaskSchedulingMode = (
	mode: string | undefined,
): "fastest" | "balanced" | "packed" => {
	if (mode === "fastest" || mode === "balanced" || mode === "packed") return mode;
	return "fastest";
};

const taskQuickCreateDefaultsValidator = v.object({
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

type TaskQuickCreateDefaults = {
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

const sanitizeTaskQuickCreateDefaults = (
	settings: {
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
	} | null,
): TaskQuickCreateDefaults => {
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

	const estimatedMinutes = Math.max(
		15,
		Number.isFinite(settings?.taskQuickCreateEstimatedMinutes)
			? (settings?.taskQuickCreateEstimatedMinutes ??
					defaultTaskQuickCreateSettings.estimatedMinutes)
			: defaultTaskQuickCreateSettings.estimatedMinutes,
	);

	const splitAllowed =
		settings?.taskQuickCreateSplitAllowed ?? defaultTaskQuickCreateSettings.splitAllowed;
	const minChunkMinutes = Math.max(
		15,
		Number.isFinite(settings?.taskQuickCreateMinChunkMinutes)
			? (settings?.taskQuickCreateMinChunkMinutes ?? defaultTaskQuickCreateSettings.minChunkMinutes)
			: defaultTaskQuickCreateSettings.minChunkMinutes,
	);
	const maxChunkMinutes = Math.max(
		minChunkMinutes,
		Number.isFinite(settings?.taskQuickCreateMaxChunkMinutes)
			? (settings?.taskQuickCreateMaxChunkMinutes ?? defaultTaskQuickCreateSettings.maxChunkMinutes)
			: defaultTaskQuickCreateSettings.maxChunkMinutes,
	);
	const restMinutes = Math.max(
		0,
		Math.round(
			Number.isFinite(settings?.taskQuickCreateRestMinutes)
				? (settings?.taskQuickCreateRestMinutes ?? defaultTaskQuickCreateSettings.restMinutes)
				: defaultTaskQuickCreateSettings.restMinutes,
		),
	);
	const travelMinutes = Math.max(
		0,
		Math.round(
			Number.isFinite(settings?.taskQuickCreateTravelMinutes)
				? (settings?.taskQuickCreateTravelMinutes ?? defaultTaskQuickCreateSettings.travelMinutes)
				: defaultTaskQuickCreateSettings.travelMinutes,
		),
	);

	const visibilityPreference =
		settings?.taskQuickCreateVisibilityPreference === "default" ||
		settings?.taskQuickCreateVisibilityPreference === "private"
			? settings.taskQuickCreateVisibilityPreference
			: defaultTaskQuickCreateSettings.visibilityPreference;

	const color =
		typeof settings?.taskQuickCreateColor === "string" &&
		settings.taskQuickCreateColor.trim().length > 0
			? settings.taskQuickCreateColor
			: defaultTaskQuickCreateSettings.color;

	return {
		priority,
		status,
		estimatedMinutes,
		splitAllowed,
		minChunkMinutes,
		maxChunkMinutes,
		restMinutes,
		travelMinutes,
		sendToUpNext:
			settings?.taskQuickCreateSendToUpNext ?? defaultTaskQuickCreateSettings.sendToUpNext,
		visibilityPreference,
		color,
	};
};

const habitQuickCreateDefaultsValidator = v.object({
	priority: taskPriorityValidator,
	durationMinutes: v.number(),
	frequency: habitFrequencyValidator,
	recoveryPolicy: habitRecoveryPolicyValidator,
	visibilityPreference: taskVisibilityPreferenceValidator,
	color: v.string(),
});

type HabitQuickCreateDefaults = {
	priority: "low" | "medium" | "high" | "critical" | "blocker";
	durationMinutes: number;
	frequency: "daily" | "weekly" | "biweekly" | "monthly";
	recoveryPolicy: "skip" | "recover";
	visibilityPreference: "default" | "private";
	color: string;
};

const sanitizeHabitQuickCreateDefaults = (
	settings: {
		habitQuickCreatePriority?: string;
		habitQuickCreateDurationMinutes?: number;
		habitQuickCreateFrequency?: string;
		habitQuickCreateRecoveryPolicy?: string;
		habitQuickCreateVisibilityPreference?: string;
		habitQuickCreateColor?: string;
	} | null,
): HabitQuickCreateDefaults => {
	const priority =
		settings?.habitQuickCreatePriority === "low" ||
		settings?.habitQuickCreatePriority === "medium" ||
		settings?.habitQuickCreatePriority === "high" ||
		settings?.habitQuickCreatePriority === "critical" ||
		settings?.habitQuickCreatePriority === "blocker"
			? settings.habitQuickCreatePriority
			: defaultHabitQuickCreateSettings.priority;

	const durationMinutes = Math.max(
		5,
		Number.isFinite(settings?.habitQuickCreateDurationMinutes)
			? (settings?.habitQuickCreateDurationMinutes ??
					defaultHabitQuickCreateSettings.durationMinutes)
			: defaultHabitQuickCreateSettings.durationMinutes,
	);

	const frequency =
		settings?.habitQuickCreateFrequency === "daily" ||
		settings?.habitQuickCreateFrequency === "weekly" ||
		settings?.habitQuickCreateFrequency === "biweekly" ||
		settings?.habitQuickCreateFrequency === "monthly"
			? settings.habitQuickCreateFrequency
			: defaultHabitQuickCreateSettings.frequency;

	const recoveryPolicy =
		settings?.habitQuickCreateRecoveryPolicy === "skip" ||
		settings?.habitQuickCreateRecoveryPolicy === "recover"
			? settings.habitQuickCreateRecoveryPolicy
			: defaultHabitQuickCreateSettings.recoveryPolicy;

	const visibilityPreference =
		settings?.habitQuickCreateVisibilityPreference === "default" ||
		settings?.habitQuickCreateVisibilityPreference === "private"
			? settings.habitQuickCreateVisibilityPreference
			: defaultHabitQuickCreateSettings.visibilityPreference;

	const color =
		typeof settings?.habitQuickCreateColor === "string" &&
		settings.habitQuickCreateColor.trim().length > 0
			? settings.habitQuickCreateColor
			: defaultHabitQuickCreateSettings.color;

	return { priority, durationMinutes, frequency, recoveryPolicy, visibilityPreference, color };
};

export const listHoursSets = query({
	args: {},
	returns: v.array(hoursSetValidator),
	handler: withQueryAuth(async (ctx) => {
		const hoursSets = await ctx.db
			.query("hoursSets")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.collect();

		return [...hoursSets].sort((a, b) => {
			if (a.isDefault && !b.isDefault) return -1;
			if (!a.isDefault && b.isDefault) return 1;
			return a.name.localeCompare(b.name);
		});
	}),
});

export const getTaskSchedulingDefaults = query({
	args: {},
	returns: v.object({
		defaultTaskSchedulingMode: taskSchedulingModeValidator,
		schedulingDowntimeMinutes: v.number(),
		schedulingStepMinutes: schedulingStepMinutesValidator,
		taskQuickCreateDefaults: taskQuickCreateDefaultsValidator,
		habitQuickCreateDefaults: habitQuickCreateDefaultsValidator,
		schedulingHorizonWeeks: v.number(),
		activeProductId: v.optional(v.string()),
		weekStartsOn: weekStartsOnValidator,
		dateFormat: dateFormatValidator,
		timeFormatPreference: v.union(v.literal("12h"), v.literal("24h")),
	}),
	handler: withQueryAuth(async (ctx) => {
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.unique();
		return {
			defaultTaskSchedulingMode: sanitizeTaskSchedulingMode(settings?.defaultTaskSchedulingMode),
			schedulingDowntimeMinutes: normalizeSchedulingDowntimeMinutes(
				settings?.schedulingDowntimeMinutes,
			),
			schedulingStepMinutes: normalizeSchedulingStepMinutes(settings?.schedulingStepMinutes),
			taskQuickCreateDefaults: sanitizeTaskQuickCreateDefaults(settings),
			habitQuickCreateDefaults: sanitizeHabitQuickCreateDefaults(settings),
			schedulingHorizonWeeks: Math.max(1, Math.floor((settings?.schedulingHorizonDays ?? 70) / 7)),
			activeProductId: settings?.activeProductId,
			weekStartsOn: normalizeWeekStartsOn(settings?.weekStartsOn) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
			dateFormat: normalizeDateFormat(settings?.dateFormat) as
				| "MM/DD/YYYY"
				| "DD/MM/YYYY"
				| "YYYY-MM-DD",
			timeFormatPreference: (normalizeTimeFormatPreference(settings?.timeFormatPreference) ??
				"12h") as "12h" | "24h",
		};
	}),
});

export const getCalendarDisplayPreferences = query({
	args: {},
	returns: v.object({
		timezone: v.union(v.null(), v.string()),
		timeFormatPreference: v.union(v.null(), timeFormatPreferenceValidator),
	}),
	handler: withQueryAuth(async (ctx) => {
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.unique();
		const rawTimezone = settings?.timezone?.trim();
		return {
			timezone: rawTimezone && isValidTimeZone(rawTimezone) ? rawTimezone : null,
			timeFormatPreference: normalizeTimeFormatPreference(settings?.timeFormatPreference),
		};
	}),
});
