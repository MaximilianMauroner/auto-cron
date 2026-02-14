"use client";

import { TaskEditSheet } from "@/components/tasks/task-edit-sheet";
import { Input } from "@/components/ui/input";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import type { TaskDTO } from "@auto-cron/types";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { AsideTaskCard } from "./aside-task-card";

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

	const upNextTasks = useMemo(
		() => filteredTasks.filter((t) => t.status === "queued"),
		[filteredTasks],
	);
	const otherTasks = useMemo(
		() => filteredTasks.filter((t) => t.status !== "queued" && t.status !== "done"),
		[filteredTasks],
	);

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
				) : tasks.length === 0 ? (
					<div className="font-[family-name:var(--font-cutive)] rounded-xl border border-dashed border-border/60 p-4 text-center text-[0.76rem] text-muted-foreground">
						No tasks yet. Create your first task on the Tasks page.
					</div>
				) : (
					<>
						{upNextTasks.length > 0 ? (
							<div className="space-y-2">
								<div className="font-[family-name:var(--font-cutive)] text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
									Up Next
								</div>
								<div className="space-y-1.5 rounded-lg border border-dashed border-border/60 p-2">
									{upNextTasks.map((task) => (
										<AsideTaskCard key={task._id} task={task} onEditTask={setEditingTaskId} />
									))}
								</div>
							</div>
						) : null}

						{otherTasks.length > 0 ? (
							<div className="space-y-2">
								<div className="font-[family-name:var(--font-cutive)] text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
									All Tasks
								</div>
								<div className="space-y-1.5">
									{otherTasks.map((task) => (
										<AsideTaskCard key={task._id} task={task} onEditTask={setEditingTaskId} />
									))}
								</div>
							</div>
						) : null}

						{filteredTasks.length === 0 && search ? (
							<div className="text-center text-[0.76rem] text-muted-foreground">
								No tasks match &ldquo;{search}&rdquo;
							</div>
						) : null}
					</>
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
