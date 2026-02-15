import { formatDurationFromMinutes } from "@/lib/duration";
import type { RecurrenceState } from "@/lib/recurrence";
import { defaultRecurrenceState } from "@/lib/recurrence";
import type { HabitFrequency, HabitPriority } from "@auto-cron/types";

export type HabitVisibilityPreference = "default" | "public" | "private";
export type HabitTimeDefenseMode = "always_free" | "auto" | "always_busy";
export type HabitReminderMode = "default" | "custom" | "none";
export type HabitUnscheduledBehavior = "leave_on_calendar" | "remove_from_calendar";
export type HabitRecoveryPolicy = "skip" | "recover";

export type HabitEditorState = {
	id?: string;
	title: string;
	description: string;
	priority: HabitPriority;
	categoryId: string;
	frequency: HabitFrequency;
	recurrenceState: RecurrenceState;
	repeatsPerPeriod: string;
	minDurationMinutes: string;
	maxDurationMinutes: string;
	idealTime: string;
	preferredDays: number[];
	hoursSetId: string;
	preferredCalendarId: string;
	color: string;
	location: string;
	startDate: string;
	endDate: string;
	visibilityPreference: HabitVisibilityPreference;
	timeDefenseMode: HabitTimeDefenseMode;
	reminderMode: HabitReminderMode;
	customReminderMinutes: string;
	unscheduledBehavior: HabitUnscheduledBehavior;
	recoveryPolicy: HabitRecoveryPolicy;
	autoDeclineInvites: boolean;
	ccEmails: string;
	duplicateAvoidKeywords: string;
	dependencyNote: string;
	publicDescription: string;
	isActive: boolean;
};

export type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

export const priorityLabels: Record<HabitPriority, string> = {
	low: "Low priority",
	medium: "Medium priority",
	high: "High priority",
	critical: "Critical priority",
};

export const priorityClass: Record<HabitPriority, string> = {
	low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
	medium: "bg-sky-500/10 text-sky-700 border-sky-500/30",
	high: "bg-amber-500/10 text-amber-700 border-amber-500/30",
	critical: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

export const frequencyLabels: Record<HabitFrequency, string> = {
	daily: "Daily",
	weekly: "Weekly",
	biweekly: "Biweekly",
	monthly: "Monthly",
};

export const reminderModeLabels: Record<HabitReminderMode, string> = {
	default: "Use calendar default reminders",
	custom: "Custom reminders",
	none: "Disable reminders",
};

export const unscheduledLabels: Record<HabitUnscheduledBehavior, string> = {
	leave_on_calendar: "Leave it on the calendar",
	remove_from_calendar: "Remove it from the calendar",
};

export const recoveryLabels: Record<HabitRecoveryPolicy, string> = {
	skip: "Skip missed occurrences",
	recover: "Recover missed occurrences",
};

export const visibilityLabels: Record<HabitVisibilityPreference, string> = {
	public: "Public",
	default: "Default visibility",
	private: "Private",
};

export const defenseModeLabels: Record<HabitTimeDefenseMode, string> = {
	always_free: "Always free",
	auto: "Use Auto Cron AI",
	always_busy: "Always busy",
};

export const habitColors = [
	"#f59e0b",
	"#f97316",
	"#ef4444",
	"#84cc16",
	"#22c55e",
	"#14b8a6",
	"#0ea5e9",
	"#8b5cf6",
	"#ec4899",
] as const;

export const initialHabitForm: HabitEditorState = {
	title: "",
	description: "",
	priority: "medium",
	categoryId: "",
	frequency: "weekly",
	recurrenceState: defaultRecurrenceState(),
	repeatsPerPeriod: "1",
	minDurationMinutes: formatDurationFromMinutes(30),
	maxDurationMinutes: formatDurationFromMinutes(30),
	idealTime: "09:00",
	preferredDays: [1, 2, 3, 4, 5],
	hoursSetId: "",
	preferredCalendarId: "primary",
	color: "#f59e0b",
	location: "",
	startDate: "",
	endDate: "",
	visibilityPreference: "default",
	timeDefenseMode: "auto",
	reminderMode: "default",
	customReminderMinutes: "15",
	unscheduledBehavior: "remove_from_calendar",
	recoveryPolicy: "skip",
	autoDeclineInvites: false,
	ccEmails: "",
	duplicateAvoidKeywords: "",
	dependencyNote: "",
	publicDescription: "",
	isActive: true,
};

export const createRequestId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `habit-${Date.now()}-${Math.round(Math.random() * 10_000)}`;
};

export const toDateTimeInput = (timestamp?: number) => {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	const hours = `${date.getHours()}`.padStart(2, "0");
	const minutes = `${date.getMinutes()}`.padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const toTimestamp = (value: string) => {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

export const addMinutesToTime = (time: string, minutesToAdd: number) => {
	const match = time.match(/^(\d{2}):(\d{2})$/);
	if (!match) return undefined;
	const hours = Number.parseInt(match[1] ?? "0", 10);
	const minutes = Number.parseInt(match[2] ?? "0", 10);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
	const total = (((hours * 60 + minutes + minutesToAdd) % 1440) + 1440) % 1440;
	const nextHours = Math.floor(total / 60);
	const nextMinutes = total % 60;
	return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
};

export const parseCsv = (value: string) =>
	value
		.split(",")
		.map((segment) => segment.trim())
		.filter(Boolean);

export const getEditableCalendars = (
	calendars: GoogleCalendarListItem[],
): GoogleCalendarListItem[] => {
	const writable = calendars.filter((calendar) => {
		const accessRole = calendar.accessRole;
		return !accessRole || accessRole === "owner" || accessRole === "writer";
	});
	if (writable.length > 0) return writable;
	return [
		{
			id: "primary",
			name: "Default",
			primary: true,
			color: undefined,
			isExternal: false,
		},
	];
};
