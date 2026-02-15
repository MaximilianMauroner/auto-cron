import { formatDurationFromMinutes } from "@/lib/duration";
import type {
	Priority,
	TaskSchedulingMode,
	TaskStatus,
	TaskVisibilityPreference,
} from "@auto-cron/types";
import { GOOGLE_CALENDAR_COLORS } from "@auto-cron/types";

export type TaskEditorState = {
	id?: string;
	title: string;
	description: string;
	location: string;
	priority: Priority;
	status: TaskStatus;
	estimatedMinutes: string;
	deadline: string;
	scheduleAfter: string;
	splitAllowed: boolean;
	minChunkMinutes: string;
	maxChunkMinutes: string;
	restMinutes: string;
	travelMinutes: string;
	sendToUpNext: boolean;
	hoursSetId: string;
	schedulingMode: "default" | TaskSchedulingMode;
	visibilityPreference: TaskVisibilityPreference;
	preferredCalendarId: string;
	color: string;
	categoryId: string;
};

export type TaskQuickCreateDefaults = {
	priority: Priority;
	status: "backlog" | "queued";
	estimatedMinutes: number;
	splitAllowed: boolean;
	minChunkMinutes: number;
	maxChunkMinutes: number;
	restMinutes: number;
	travelMinutes: number;
	sendToUpNext: boolean;
	visibilityPreference: TaskVisibilityPreference;
	color: string;
};

export type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

export const statusTitles: Record<TaskStatus, string> = {
	backlog: "Backlog",
	queued: "Queued",
	scheduled: "Scheduled",
	in_progress: "In Progress",
	done: "Done",
};

export const taskColors = GOOGLE_CALENDAR_COLORS;

export const schedulingModeLabels: Record<TaskSchedulingMode, string> = {
	fastest: "Fastest",
	balanced: "Balanced",
	packed: "Packed",
};

export const visibilityLabels: Record<TaskVisibilityPreference, string> = {
	default: "Use default calendar visibility",
	private: "Make this task private",
};

export const fallbackTaskQuickCreateDefaults: TaskQuickCreateDefaults = {
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
};

export const createTaskEditorState = ({
	defaults,
	defaultHoursSetId,
	defaultCalendarId,
	defaultCategoryId,
}: {
	defaults: TaskQuickCreateDefaults;
	defaultHoursSetId: string;
	defaultCalendarId: string;
	defaultCategoryId?: string;
}): TaskEditorState => ({
	title: "",
	description: "",
	location: "",
	priority: defaults.priority,
	status: defaults.status,
	estimatedMinutes: formatDurationFromMinutes(defaults.estimatedMinutes),
	deadline: "",
	scheduleAfter: "",
	splitAllowed: defaults.splitAllowed,
	minChunkMinutes: formatDurationFromMinutes(defaults.minChunkMinutes),
	maxChunkMinutes: formatDurationFromMinutes(defaults.maxChunkMinutes),
	restMinutes: formatDurationFromMinutes(defaults.restMinutes),
	travelMinutes: formatDurationFromMinutes(defaults.travelMinutes),
	sendToUpNext: defaults.sendToUpNext,
	hoursSetId: defaultHoursSetId,
	schedulingMode: "default",
	visibilityPreference: defaults.visibilityPreference,
	preferredCalendarId: defaultCalendarId,
	color: defaults.color,
	categoryId: defaultCategoryId ?? "",
});

export const createRequestId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `task-${Date.now()}-${Math.round(Math.random() * 10_000)}`;
};

export const toDateInput = (timestamp?: number) => {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export const toTimestamp = (value: string) => {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
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
