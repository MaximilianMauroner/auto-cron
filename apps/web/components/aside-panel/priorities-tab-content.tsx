"use client";

import { DragOverlayCard, DroppableColumn, SortableItem } from "@/components/dnd";
import { TaskEditSheet } from "@/components/tasks/task-edit-sheet";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { useDndKanban } from "@/hooks/use-dnd-kanban";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels, priorityOrder } from "@/lib/scheduling-constants";
import type { HabitDTO, HabitPriority } from "@auto-cron/types";
import type { Priority, TaskDTO } from "@auto-cron/types";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { ChevronDown, Clock3, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AsideHabitItem } from "./aside-habit-item";
import { AsideTaskCard } from "./aside-task-card";

export function PrioritiesTabContent({
	tasks,
	tasksPending,
}: {
	tasks: TaskDTO[];
	tasksPending: boolean;
}) {
	const [search, setSearch] = useState("");
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const habitsQuery = useAuthenticatedQueryWithStatus(api.habits.queries.listHabits, {});
	const habits = (habitsQuery.data ?? []) as HabitDTO[];
	const { mutate: updateTask } = useMutationWithStatus(api.tasks.mutations.updateTask);

	const isLoading = tasksPending || habitsQuery.isPending;

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
				(h) => (h.priority ?? "medium") === (priority as unknown as HabitPriority),
			);
			return {
				priority,
				tasks: priorityTasks,
				habits: priorityHabits,
				total: priorityTasks.length + priorityHabits.length,
			};
		});
	}, [filteredTasks, filteredHabits]);

	// ── DnD (tasks only — habits are non-draggable in the aside) ──

	const getColumnForItem = useCallback(
		(itemId: string) => {
			for (const group of groupedByPriority) {
				if (group.tasks.some((t) => t._id === itemId)) return group.priority;
			}
			return null;
		},
		[groupedByPriority],
	);

	const onMoveItem = useCallback(
		(itemId: string, _fromColumn: string, toColumn: string) => {
			void updateTask({
				id: itemId as Id<"tasks">,
				patch: { priority: toColumn as Priority },
			});
		},
		[updateTask],
	);

	const dndState = useDndKanban({
		onMoveItem,
		getColumnForItem,
	});

	const activeTask = useMemo(
		() =>
			dndState.activeId ? (filteredTasks.find((t) => t._id === dndState.activeId) ?? null) : null,
		[dndState.activeId, filteredTasks],
	);

	// Optimistic display: move tasks to target priority before server confirms
	const displayGroups = useMemo(() => {
		if (dndState.pendingMoves.size === 0) return groupedByPriority;
		const movedToPriority = new Map<string, TaskDTO[]>();
		for (const [itemId, target] of dndState.pendingMoves) {
			const task = filteredTasks.find((t) => t._id === itemId);
			if (task) {
				const arr = movedToPriority.get(target) ?? [];
				arr.push(task);
				movedToPriority.set(target, arr);
			}
		}
		return groupedByPriority.map((group) => {
			const tasks = [
				...group.tasks.filter((t) => !dndState.pendingMoves.has(t._id)),
				...(movedToPriority.get(group.priority) ?? []),
			];
			return { ...group, tasks, total: tasks.length + group.habits.length };
		});
	}, [groupedByPriority, dndState.pendingMoves, filteredTasks]);

	return (
		<>
			<div className="flex flex-col gap-3 p-3">
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search for something..."
						className="h-8 pl-8 font-[family-name:var(--font-outfit)] text-[0.76rem]"
					/>
				</div>

				{isLoading ? (
					<div className="font-[family-name:var(--font-cutive)] text-[0.76rem] text-muted-foreground">
						Loading...
					</div>
				) : (
					<DndContext
						sensors={dndState.sensors}
						collisionDetection={dndState.collisionDetection}
						onDragStart={dndState.handleDragStart}
						onDragEnd={dndState.handleDragEnd}
						onDragCancel={dndState.handleDragCancel}
					>
						<div className="space-y-1">
							{displayGroups.map((group) => (
								<Collapsible key={group.priority} defaultOpen={group.total > 0}>
									<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[0.76rem] font-medium hover:bg-accent/50">
										<div className="flex items-center gap-2">
											<span className="font-[family-name:var(--font-outfit)]">
												{priorityLabels[group.priority]}
											</span>
											<Badge
												className={`${priorityClass[group.priority]} font-[family-name:var(--font-outfit)] tabular-nums text-[0.6rem] px-1.5 py-0`}
											>
												{group.total}
											</Badge>
										</div>
										<ChevronDown className="size-3.5 text-muted-foreground transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className="space-y-1 pl-1">
											{group.habits.length > 0 ? (
												<div className="space-y-0.5">
													<div className="flex items-center gap-2 px-2 py-1 font-[family-name:var(--font-cutive)] text-[0.66rem] uppercase tracking-[0.08em] text-muted-foreground">
														Habits
														<Badge
															variant="secondary"
															className="font-[family-name:var(--font-outfit)] tabular-nums text-[0.58rem] px-1 py-0"
														>
															{group.habits.length}
														</Badge>
													</div>
													{group.habits.map((habit) => (
														<AsideHabitItem key={habit._id} habit={habit} />
													))}
												</div>
											) : null}
											<DroppableColumn
												id={group.priority}
												items={group.tasks.map((t) => t._id)}
												className="space-y-1"
											>
												{group.tasks.length > 0 ? (
													<>
														<div className="flex items-center gap-2 px-2 py-1 font-[family-name:var(--font-cutive)] text-[0.66rem] uppercase tracking-[0.08em] text-muted-foreground">
															Tasks
															<Badge
																variant="secondary"
																className="font-[family-name:var(--font-outfit)] tabular-nums text-[0.58rem] px-1 py-0"
															>
																{group.tasks.length}
															</Badge>
														</div>
														{group.tasks.map((task) => (
															<SortableItem key={task._id} id={task._id}>
																<AsideTaskCard task={task} onEditTask={setEditingTaskId} />
															</SortableItem>
														))}
													</>
												) : (
													<div className="py-1 text-center font-[family-name:var(--font-cutive)] text-[0.6rem] text-muted-foreground/40">
														Drop tasks here
													</div>
												)}
											</DroppableColumn>
										</div>
									</CollapsibleContent>
								</Collapsible>
							))}
							{displayGroups.every((g) => g.total === 0) ? (
								<div className="font-[family-name:var(--font-cutive)] rounded-xl border border-dashed border-border/60 p-4 text-center text-[0.76rem] text-muted-foreground">
									{search ? `No items match \u201c${search}\u201d` : "No active tasks or habits."}
								</div>
							) : null}
						</div>

						<DragOverlay dropAnimation={null}>
							{activeTask ? (
								<DragOverlayCard>
									<div className="rounded-lg border border-border/60 bg-background/95 p-2.5">
										<div className="flex items-start gap-2">
											<span
												className="mt-1 size-2 shrink-0 rounded-full"
												style={{
													backgroundColor:
														activeTask.effectiveColor ?? activeTask.color ?? "#f59e0b",
												}}
											/>
											<div className="min-w-0 flex-1">
												<p className="font-[family-name:var(--font-outfit)] truncate text-[0.76rem] font-medium">
													{activeTask.title}
												</p>
												<div className="mt-1 flex items-center gap-2 font-[family-name:var(--font-cutive)] text-[0.68rem] text-muted-foreground">
													<span className="inline-flex items-center gap-0.5">
														<Clock3 className="size-3" />
														{formatDurationCompact(activeTask.estimatedMinutes)}
													</span>
												</div>
											</div>
											<Badge
												className={`${priorityClass[activeTask.priority]} font-[family-name:var(--font-cutive)] text-[0.6rem] px-1.5 py-0`}
											>
												{priorityLabels[activeTask.priority]}
											</Badge>
										</div>
									</div>
								</DragOverlayCard>
							) : null}
						</DragOverlay>
					</DndContext>
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
