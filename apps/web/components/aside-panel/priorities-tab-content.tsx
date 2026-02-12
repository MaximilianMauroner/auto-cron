"use client";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import type { HabitDTO, HabitPriority } from "@auto-cron/types";
import type { Priority, TaskDTO } from "@auto-cron/types";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { AsideHabitItem } from "./aside-habit-item";
import { AsideTaskCard, priorityClass } from "./aside-task-card";

const priorityOrder: Priority[] = ["critical", "high", "medium", "low"];
const priorityLabels: Record<Priority, string> = {
	critical: "Critical",
	high: "High",
	medium: "Medium",
	low: "Low",
	blocker: "Blocker",
};

export function PrioritiesTabContent() {
	const [search, setSearch] = useState("");
	const tasksQuery = useAuthenticatedQueryWithStatus(api.tasks.queries.listTasks, {});
	const tasks = (tasksQuery.data ?? []) as TaskDTO[];
	const habitsQuery = useAuthenticatedQueryWithStatus(api.habits.queries.listHabits, {});
	const habits = (habitsQuery.data ?? []) as HabitDTO[];

	const isLoading = tasksQuery.isPending || habitsQuery.isPending;

	const filteredTasks = useMemo(() => {
		const term = search.toLowerCase().trim();
		const activeTasks = tasks.filter((t) => t.status !== "done");
		if (!term) return activeTasks;
		return activeTasks.filter(
			(t) => t.title.toLowerCase().includes(term) || t.description?.toLowerCase().includes(term),
		);
	}, [tasks, search]);

	const filteredHabits = useMemo(() => {
		const term = search.toLowerCase().trim();
		const activeHabits = habits.filter((h) => h.isActive);
		if (!term) return activeHabits;
		return activeHabits.filter(
			(h) => h.title.toLowerCase().includes(term) || h.description?.toLowerCase().includes(term),
		);
	}, [habits, search]);

	const groupedByPriority = useMemo(() => {
		return priorityOrder.map((priority) => {
			const priorityTasks = filteredTasks.filter((t) => t.priority === priority);
			const priorityHabits = filteredHabits.filter(
				(h) => (h.priority ?? "medium") === (priority as string as HabitPriority),
			);
			return {
				priority,
				tasks: priorityTasks,
				habits: priorityHabits,
				total: priorityTasks.length + priorityHabits.length,
			};
		});
	}, [filteredTasks, filteredHabits]);

	return (
		<div className="flex flex-col gap-3 p-3">
			<div className="relative">
				<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search for something..."
					className="h-8 pl-8 text-[0.76rem]"
				/>
			</div>

			{isLoading ? (
				<div className="text-[0.76rem] text-muted-foreground">Loading...</div>
			) : (
				<div className="space-y-1">
					{groupedByPriority.map((group) =>
						group.total > 0 ? (
							<Collapsible key={group.priority} defaultOpen>
								<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[0.76rem] font-medium hover:bg-accent/50">
									<div className="flex items-center gap-2">
										<span>{priorityLabels[group.priority]}</span>
										<Badge className={`${priorityClass[group.priority]} text-[0.6rem] px-1.5 py-0`}>
											{group.total}
										</Badge>
									</div>
									<ChevronDown className="size-3.5 text-muted-foreground transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
								</CollapsibleTrigger>
								<CollapsibleContent>
									<div className="space-y-1 pl-1">
										{group.habits.length > 0 ? (
											<div className="space-y-0.5">
												<div className="flex items-center gap-2 px-2 py-1 text-[0.66rem] uppercase tracking-[0.08em] text-muted-foreground">
													Habits
													<Badge variant="secondary" className="text-[0.58rem] px-1 py-0">
														{group.habits.length}
													</Badge>
												</div>
												{group.habits.map((habit) => (
													<AsideHabitItem key={habit._id} habit={habit} />
												))}
											</div>
										) : null}
										{group.tasks.length > 0 ? (
											<div className="space-y-1">
												<div className="flex items-center gap-2 px-2 py-1 text-[0.66rem] uppercase tracking-[0.08em] text-muted-foreground">
													Tasks
													<Badge variant="secondary" className="text-[0.58rem] px-1 py-0">
														{group.tasks.length}
													</Badge>
												</div>
												{group.tasks.map((task) => (
													<AsideTaskCard key={task._id} task={task} />
												))}
											</div>
										) : null}
									</div>
								</CollapsibleContent>
							</Collapsible>
						) : null,
					)}
					{groupedByPriority.every((g) => g.total === 0) ? (
						<div className="rounded-lg border border-dashed border-border p-4 text-center text-[0.76rem] text-muted-foreground">
							{search ? `No items match "${search}"` : "No active tasks or habits."}
						</div>
					) : null}
				</div>
			)}
		</div>
	);
}
