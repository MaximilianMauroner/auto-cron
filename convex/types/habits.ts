import type { Id } from "../_generated/dataModel";

export type HabitFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export type HabitCreateInput = {
	title: string;
	description?: string;
	priority?: "low" | "medium" | "high" | "critical";
	categoryId: Id<"taskCategories">;
	recurrenceRule?: string;
	recoveryPolicy?: "skip" | "recover";
	frequency?: HabitFrequency;
	durationMinutes: number;
	minDurationMinutes?: number;
	maxDurationMinutes?: number;
	repeatsPerPeriod?: number;
	idealTime?: string;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	hoursSetId?: Id<"hoursSets">;
	preferredCalendarId?: string;
	color?: string;
	location?: string;
	startDate?: number;
	endDate?: number;
	visibilityPreference?: "default" | "public" | "private";
	timeDefenseMode?: "always_free" | "auto" | "always_busy";
	reminderMode?: "default" | "custom" | "none";
	customReminderMinutes?: number;
	unscheduledBehavior?: "leave_on_calendar" | "remove_from_calendar";
	autoDeclineInvites?: boolean;
	ccEmails?: string[];
	duplicateAvoidKeywords?: string[];
	dependencyNote?: string;
	publicDescription?: string;
	isActive?: boolean;
};

export type HabitUpdatePatch = {
	title?: string;
	description?: string | null;
	priority?: "low" | "medium" | "high" | "critical" | null;
	categoryId?: Id<"taskCategories">;
	recurrenceRule?: string | null;
	recoveryPolicy?: "skip" | "recover" | null;
	frequency?: HabitFrequency | null;
	durationMinutes?: number;
	minDurationMinutes?: number | null;
	maxDurationMinutes?: number | null;
	repeatsPerPeriod?: number | null;
	idealTime?: string | null;
	preferredWindowStart?: string | null;
	preferredWindowEnd?: string | null;
	preferredDays?: number[] | null;
	hoursSetId?: Id<"hoursSets"> | null;
	preferredCalendarId?: string | null;
	color?: string | null;
	location?: string | null;
	startDate?: number | null;
	endDate?: number | null;
	visibilityPreference?: "default" | "public" | "private" | null;
	timeDefenseMode?: "always_free" | "auto" | "always_busy" | null;
	reminderMode?: "default" | "custom" | "none" | null;
	customReminderMinutes?: number | null;
	unscheduledBehavior?: "leave_on_calendar" | "remove_from_calendar" | null;
	autoDeclineInvites?: boolean | null;
	ccEmails?: string[] | null;
	duplicateAvoidKeywords?: string[] | null;
	dependencyNote?: string | null;
	publicDescription?: string | null;
	isActive?: boolean;
};

export type UpdateHabitArgs = {
	id: Id<"habits">;
	patch: HabitUpdatePatch;
};

export type DeleteHabitArgs = {
	id: Id<"habits">;
};

export type ToggleHabitArgs = {
	id: Id<"habits">;
	isActive: boolean;
};

export type InternalCreateHabitArgs = {
	userId: string;
	operationKey: string;
	input: HabitCreateInput;
};

export type InternalRollbackHabitArgs = {
	operationKey: string;
	userId: string;
};

export type CreateHabitArgs = {
	requestId: string;
	input: HabitCreateInput;
};

export type ListHabitsArgs = {
	activeOnly?: boolean;
};
