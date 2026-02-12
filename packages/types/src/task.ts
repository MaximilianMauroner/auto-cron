export const priorities = ["low", "medium", "high", "critical", "blocker"] as const;
export type Priority = (typeof priorities)[number];

export const priorityWeights: Record<Priority, number> = {
	low: 1,
	medium: 2,
	high: 4,
	critical: 8,
	blocker: 16,
};

export const taskStatuses = ["backlog", "queued", "scheduled", "in_progress", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskSchedulingModes = ["fastest", "balanced", "packed"] as const;
export type TaskSchedulingMode = (typeof taskSchedulingModes)[number];

export const taskVisibilityPreferences = ["default", "private"] as const;
export type TaskVisibilityPreference = (typeof taskVisibilityPreferences)[number];

export type TaskDTO = {
	_id: string;
	_creationTime: number;
	userId: string;
	title: string;
	description?: string;
	priority: Priority;
	status: TaskStatus;
	estimatedMinutes: number;
	deadline?: number;
	scheduleAfter?: number;
	scheduledStart?: number;
	scheduledEnd?: number;
	completedAt?: number;
	sortOrder: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	sendToUpNext?: boolean;
	hoursSetId?: string;
	schedulingMode?: TaskSchedulingMode;
	effectiveSchedulingMode?: TaskSchedulingMode;
	visibilityPreference?: TaskVisibilityPreference;
	preferredCalendarId?: string;
	color?: string;
};

export type TaskCreateInput = {
	title: string;
	description?: string;
	priority?: Priority;
	status?: Extract<TaskStatus, "backlog" | "queued">;
	estimatedMinutes: number;
	deadline?: number;
	scheduleAfter?: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	sendToUpNext?: boolean;
	hoursSetId?: string;
	schedulingMode?: TaskSchedulingMode;
	visibilityPreference?: TaskVisibilityPreference;
	preferredCalendarId?: string;
	color?: string;
};

export type TaskUpdateInput = {
	title?: string;
	description?: string;
	priority?: Priority;
	status?: TaskStatus;
	estimatedMinutes?: number;
	deadline?: number;
	scheduleAfter?: number;
	scheduledStart?: number;
	scheduledEnd?: number;
	completedAt?: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	sendToUpNext?: boolean;
	hoursSetId?: string;
	schedulingMode?: TaskSchedulingMode;
	visibilityPreference?: TaskVisibilityPreference;
	preferredCalendarId?: string;
	color?: string;
};

export type TaskReorderInput = {
	id: string;
	sortOrder: number;
	status: TaskStatus;
};
