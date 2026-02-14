import type { Id } from "../_generated/dataModel";

export type TaskStatus = "backlog" | "queued" | "scheduled" | "in_progress" | "done";

export type TaskPriority = "low" | "medium" | "high" | "critical" | "blocker";

export type TaskCreateInput = {
	title: string;
	description?: string;
	priority?: TaskPriority;
	status?: "backlog" | "queued";
	estimatedMinutes: number;
	deadline?: number;
	scheduleAfter?: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	restMinutes?: number;
	travelMinutes?: number;
	location?: string;
	sendToUpNext?: boolean;
	hoursSetId?: Id<"hoursSets">;
	schedulingMode?: "fastest" | "balanced" | "packed";
	visibilityPreference?: "default" | "private";
	preferredCalendarId?: string;
	color?: string;
	categoryId?: Id<"taskCategories">;
};

export type TaskUpdatePatch = {
	title?: string;
	description?: string | null;
	priority?: TaskPriority;
	status?: TaskStatus;
	estimatedMinutes?: number;
	deadline?: number | null;
	scheduleAfter?: number | null;
	scheduledStart?: number | null;
	scheduledEnd?: number | null;
	completedAt?: number | null;
	sortOrder?: number;
	splitAllowed?: boolean | null;
	minChunkMinutes?: number | null;
	maxChunkMinutes?: number | null;
	restMinutes?: number | null;
	travelMinutes?: number | null;
	location?: string | null;
	sendToUpNext?: boolean | null;
	hoursSetId?: Id<"hoursSets"> | null;
	schedulingMode?: "fastest" | "balanced" | "packed" | null;
	visibilityPreference?: "default" | "private" | null;
	preferredCalendarId?: string | null;
	color?: string | null;
	categoryId?: Id<"taskCategories">;
};

export type UpdateTaskArgs = {
	id: Id<"tasks">;
	patch: TaskUpdatePatch;
};

export type DeleteTaskArgs = {
	id: Id<"tasks">;
};

export type ReorderTasksArgs = {
	items: Array<{
		id: Id<"tasks">;
		sortOrder: number;
		status: TaskStatus;
	}>;
};

export type InternalCreateTaskArgs = {
	userId: string;
	operationKey: string;
	input: TaskCreateInput;
};

export type InternalRollbackTaskArgs = {
	operationKey: string;
	userId: string;
};

export type CreateTaskArgs = {
	requestId: string;
	input: TaskCreateInput;
};

export type ListTasksArgs = {
	statusFilter?: TaskStatus[];
};
