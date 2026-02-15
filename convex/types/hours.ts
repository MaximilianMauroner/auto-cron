import type { MutationCtx, QueryCtx } from "../_generated/server";

export type DbCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

export type SchedulingStepMinutes = 15 | 30 | 60;

export type HourWindow = {
	day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	startMinute: number;
	endMinute: number;
};

export type HourWindowValidationErrorCode =
	| "INVALID_HOURS_WINDOW_RANGE"
	| "INVALID_HOURS_WINDOW_GRANULARITY"
	| "OVERLAPPING_HOURS_WINDOWS";

export type TaskQuickCreateDefaults = {
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

export type HabitQuickCreateDefaults = {
	priority: "low" | "medium" | "high" | "critical";
	durationMinutes: number;
	frequency: "daily" | "weekly" | "biweekly" | "monthly";
	recoveryPolicy: "skip" | "recover";
	visibilityPreference: "default" | "private";
	color: string;
};

export type SeedTaskTemplate = {
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

export type SeedHabitTemplate = {
	title: string;
	description: string;
	priority?: "low" | "medium" | "high" | "critical";
	recurrenceRule: string;
	frequency?: "daily" | "weekly" | "biweekly" | "monthly";
	durationMinutes: number;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	color?: string;
};

export type HoursSetCreateInput = {
	name: string;
	windows: HourWindow[];
	defaultCalendarId?: string;
};

export type HoursSetUpdateInput = {
	name?: string;
	windows?: HourWindow[];
	defaultCalendarId?: string;
	isDefault?: boolean;
};

export type TaskQuickCreateSettingsShape = {
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

export type NormalizedTaskQuickCreateDefaults = {
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

export type HabitQuickCreateSettingsShape = {
	habitQuickCreatePriority?: string;
	habitQuickCreateDurationMinutes?: number;
	habitQuickCreateFrequency?: string;
	habitQuickCreateRecoveryPolicy?: string;
	habitQuickCreateVisibilityPreference?: string;
	habitQuickCreateColor?: string;
};

export type NormalizedHabitQuickCreateDefaults = {
	habitQuickCreatePriority: "low" | "medium" | "high" | "critical";
	habitQuickCreateDurationMinutes: number;
	habitQuickCreateFrequency: "daily" | "weekly" | "biweekly" | "monthly";
	habitQuickCreateRecoveryPolicy: "skip" | "recover";
	habitQuickCreateVisibilityPreference: "default" | "private";
	habitQuickCreateColor: string;
};
