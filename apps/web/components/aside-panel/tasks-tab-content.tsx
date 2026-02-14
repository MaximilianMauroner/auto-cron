"use client";

import { TaskEditSheet } from "@/components/tasks/task-edit-sheet";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import type { TaskDTO, TaskStatus } from "@auto-cron/types";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { AsideTaskCard } from "./aside-task-card";

const statusOrder: TaskStatus[] = ["in_progress", "queued", "scheduled", "backlog", "done"];
const statusLabels: Record<TaskStatus, string> = {
	backlog: "Backlog",
	queued: "Up Next",
	scheduled: "Scheduled",
	in_progress: "In Progress",
	done: "Done",
};
const statusClass: Record<TaskStatus, string> = {
	backlog: "bg-zinc-500/15 text-zinc-700 border-zinc-500/25",
	queued: "bg-sky-500/15 text-sky-700 border-sky-500/25",
	scheduled: "bg-violet-500/15 text-violet-700 border-violet-500/25",
	in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/25",
	done: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
};

export function TasksTabContent() {
	const [search, setSearch] = useState("");
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const tasksQuery = useAuthenticatedQueryWithStatus(api.tasks.queries.listTasks, {});
	const tasks = (tasksQuery.data ?? []) as TaskDTO[];

	const filteredTasks = useMemo(() => {
		const term = search.toLowerCase().trim();
		if (!term) return tasks;
		return tasks.filter(
			(t) => t.title.toLowerCase().includes(term) || t.description?.toLowerCase().includes(term),
		);
	}, [tasks, search]);

	const groupedByStatus = useMemo(() => {
		return statusOrder.map((status) => ({
			status,
			tasks: filteredTasks.filter((t) => t.status === status),
		}));
	}, [filteredTasks]);

	const hasAnyTasks = groupedByStatus.some((g) => g.tasks.length > 0);

	return (
		<>
			<div className="flex flex-col gap-3 p-3">
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search Tasks..."
						className="h-8 pl-8 font-[family-name:var(--font-outfit)] text-[0.76rem]"
					/>
				</div>

				{tasksQuery.isPending ? (
					<div className="font-[family-name:var(--font-cutive)] text-[0.76rem] text-muted-foreground">
						Loading tasks...
					</div>
				) : !hasAnyTasks ? (
					<div className="font-[family-name:var(--font-cutive)] rounded-xl border border-dashed border-border/60 p-4 text-center text-[0.76rem] text-muted-foreground">
						{search
							? `No tasks match \u201c${search}\u201d`
							: "No tasks yet. Create your first task on the Tasks page."}
					</div>
				) : (
					<div className="space-y-1">
						{groupedByStatus.map((group) =>
							group.tasks.length > 0 ? (
								<Collapsible key={group.status} defaultOpen={group.status !== "done"}>
									<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[0.76rem] font-medium hover:bg-accent/50">
										<div className="flex items-center gap-2">
											<span className="font-[family-name:var(--font-outfit)]">
												{statusLabels[group.status]}
											</span>
											<Badge
												className={`${statusClass[group.status]} font-[family-name:var(--font-outfit)] tabular-nums text-[0.6rem] px-1.5 py-0`}
											>
												{group.tasks.length}
											</Badge>
										</div>
										<ChevronDown className="size-3.5 text-muted-foreground transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className="space-y-1 pl-1 pt-1">
											{group.tasks.map((task) => (
												<AsideTaskCard key={task._id} task={task} onEditTask={setEditingTaskId} />
											))}
										</div>
									</CollapsibleContent>
								</Collapsible>
							) : null,
						)}
					</div>
				)}
			</div>
			<TaskEditSheet
				taskId={editingTaskId}
				onOpenChange={(open) => {
					if (!open) setEditingTaskId(null);
				}}
			/>
		</>
	);
}
