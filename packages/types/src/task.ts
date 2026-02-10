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
