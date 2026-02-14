import type { HabitPriority, Priority, TaskStatus } from "@auto-cron/types";

// ── Priority ──

export const priorityOrder: Priority[] = ["blocker", "critical", "high", "medium", "low"];

export const habitPriorityOrder: HabitPriority[] = ["critical", "high", "medium", "low"];

export const priorityLabels: Record<Priority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
	blocker: "Blocker",
};

export const priorityClass: Record<Priority, string> = {
	low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
	medium: "bg-sky-500/15 text-sky-700 border-sky-500/25",
	high: "bg-amber-500/15 text-amber-700 border-amber-500/25",
	critical: "bg-orange-500/15 text-orange-700 border-orange-500/25",
	blocker: "bg-rose-500/15 text-rose-700 border-rose-500/25",
};

// ── Task Status ──

/** Aside panel ordering — active items first */
export const statusOrder: TaskStatus[] = ["in_progress", "queued", "scheduled", "backlog", "done"];

/** Pipeline ordering — backlog → done flow (used on tasks page) */
export const statusPipelineOrder: TaskStatus[] = [
	"backlog",
	"queued",
	"scheduled",
	"in_progress",
	"done",
];

export const manuallyAssignableTaskStatuses: TaskStatus[] = ["backlog", "queued", "done"];

export const isManuallyAssignableTaskStatus = (status: TaskStatus) =>
	manuallyAssignableTaskStatuses.includes(status);

export const statusLabels: Record<TaskStatus, string> = {
	backlog: "Backlog",
	queued: "Up Next",
	scheduled: "Scheduled",
	in_progress: "In Progress",
	done: "Done",
};

export const statusClass: Record<TaskStatus, string> = {
	backlog: "bg-zinc-500/15 text-zinc-700 border-zinc-500/25",
	queued: "bg-sky-500/15 text-sky-700 border-sky-500/25",
	scheduled: "bg-violet-500/15 text-violet-700 border-violet-500/25",
	in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/25",
	done: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
};
