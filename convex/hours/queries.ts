import { v } from "convex/values";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import {
	defaultTaskQuickCreateSettings,
	hoursSetValidator,
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
		};
	}),
});

export const getCalendarDisplayPreferences = query({
	args: {},
	returns: v.object({
		timezone: v.string(),
		timeFormatPreference: v.union(v.null(), timeFormatPreferenceValidator),
	}),
	handler: withQueryAuth(async (ctx) => {
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.unique();
		return {
			timezone: normalizeTimeZone(settings?.timezone),
			timeFormatPreference: normalizeTimeFormatPreference(settings?.timeFormatPreference),
		};
	}),
});
