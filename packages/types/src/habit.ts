export const habitFrequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
export type HabitFrequency = (typeof habitFrequencies)[number];

export const habitPriorities = ["low", "medium", "high"] as const;
export type HabitPriority = (typeof habitPriorities)[number];

export const habitCategories = [
	"health",
	"fitness",
	"learning",
	"mindfulness",
	"productivity",
	"social",
	"other",
] as const;
export type HabitCategory = (typeof habitCategories)[number];

export const habitVisibilityPreferences = ["default", "public", "private"] as const;
export type HabitVisibilityPreference = (typeof habitVisibilityPreferences)[number];

export const habitTimeDefenseModes = ["always_free", "auto", "always_busy"] as const;
export type HabitTimeDefenseMode = (typeof habitTimeDefenseModes)[number];

export const habitReminderModes = ["default", "custom", "none"] as const;
export type HabitReminderMode = (typeof habitReminderModes)[number];

export const habitUnscheduledBehaviors = ["leave_on_calendar", "remove_from_calendar"] as const;
export type HabitUnscheduledBehavior = (typeof habitUnscheduledBehaviors)[number];

export type HabitDTO = {
	_id: string;
	_creationTime: number;
	userId: string;
	title: string;
	description?: string;
	priority?: HabitPriority;
	category: HabitCategory;
	frequency: HabitFrequency;
	durationMinutes: number;
	minDurationMinutes?: number;
	maxDurationMinutes?: number;
	repeatsPerPeriod?: number;
	idealTime?: string;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	hoursSetId?: string;
	preferredCalendarId?: string;
	color?: string;
	location?: string;
	startDate?: number;
	endDate?: number;
	visibilityPreference?: HabitVisibilityPreference;
	timeDefenseMode?: HabitTimeDefenseMode;
	reminderMode?: HabitReminderMode;
	customReminderMinutes?: number;
	unscheduledBehavior?: HabitUnscheduledBehavior;
	autoDeclineInvites?: boolean;
	ccEmails?: string[];
	duplicateAvoidKeywords?: string[];
	dependencyNote?: string;
	publicDescription?: string;
	isActive: boolean;
};

export type HabitCreateInput = {
	title: string;
	description?: string;
	priority?: HabitPriority;
	category: HabitCategory;
	frequency: HabitFrequency;
	durationMinutes: number;
	minDurationMinutes?: number;
	maxDurationMinutes?: number;
	repeatsPerPeriod?: number;
	idealTime?: string;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	hoursSetId?: string;
	preferredCalendarId?: string;
	color?: string;
	location?: string;
	startDate?: number;
	endDate?: number;
	visibilityPreference?: HabitVisibilityPreference;
	timeDefenseMode?: HabitTimeDefenseMode;
	reminderMode?: HabitReminderMode;
	customReminderMinutes?: number;
	unscheduledBehavior?: HabitUnscheduledBehavior;
	autoDeclineInvites?: boolean;
	ccEmails?: string[];
	duplicateAvoidKeywords?: string[];
	dependencyNote?: string;
	publicDescription?: string;
	isActive?: boolean;
};

export type HabitUpdateInput = {
	title?: string;
	description?: string;
	priority?: HabitPriority;
	category?: HabitCategory;
	frequency?: HabitFrequency;
	durationMinutes?: number;
	minDurationMinutes?: number;
	maxDurationMinutes?: number;
	repeatsPerPeriod?: number;
	idealTime?: string;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	hoursSetId?: string;
	preferredCalendarId?: string;
	color?: string;
	location?: string;
	startDate?: number;
	endDate?: number;
	visibilityPreference?: HabitVisibilityPreference;
	timeDefenseMode?: HabitTimeDefenseMode;
	reminderMode?: HabitReminderMode;
	customReminderMinutes?: number;
	unscheduledBehavior?: HabitUnscheduledBehavior;
	autoDeclineInvites?: boolean;
	ccEmails?: string[];
	duplicateAvoidKeywords?: string[];
	dependencyNote?: string;
	publicDescription?: string;
	isActive?: boolean;
};
