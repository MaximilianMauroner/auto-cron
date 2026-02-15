"use client";

import { DragOverlayCard, DroppableColumn, SortableItem } from "@/components/dnd";
import { TaskEditSheet } from "@/components/tasks/task-edit-sheet";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useMutationWithStatus } from "@/hooks/use-convex-status";
import { useDndKanban } from "@/hooks/use-dnd-kanban";
import { formatDurationCompact } from "@/lib/duration";
import {
	isManuallyAssignableTaskStatus,
	priorityClass,
	priorityLabels,
	statusClass,
	statusLabels,
	statusOrder,
} from "@/lib/scheduling-constants";
import type { TaskDTO, TaskStatus } from "@auto-cron/types";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { ChevronDown, Clock3, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	AsideSortFilterBar,
	type DurationFilter,
	type HoursSetOption,
	type SortOption,
	matchesDurationFilter,
	sortByDueDate,
} from "./aside-sort-filter-bar";
import { AsideTaskCard } from "./aside-task-card";

export function TasksTabContent({
	tasks,
	tasksPending,
	hoursSets,
}: {
	tasks: TaskDTO[];
	tasksPending: boolean;
	hoursSets: HoursSetOption[];
}) {
	const [search, setSearch] = useState("");
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const [sort, setSort] = useState<SortOption>("default");
	const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
	const [hoursSetFilter, setHoursSetFilter] = useState("all");
	const { mutate: updateTask } = useMutationWithStatus(api.tasks.mutations.updateTask);

	const filteredTasks = useMemo(() => {
		let result = tasks;
		const term = search.toLowerCase().trim();
		if (term) {
			result = result.filter(
				(t) => t.title.toLowerCase().includes(term) || t.description?.toLowerCase().includes(term),
			);
		}
		if (durationFilter !== "all") {
			result = result.filter((t) => matchesDurationFilter(t.estimatedMinutes, durationFilter));
		}
		if (hoursSetFilter !== "all") {
			result = result.filter((t) => t.hoursSetId === hoursSetFilter);
		}
		return result;
	}, [tasks, search, durationFilter, hoursSetFilter]);

	const groupedByStatus = useMemo(() => {
		return statusOrder.map((status) => {
			const groupTasks = filteredTasks.filter((t) => t.status === status);
			if (sort === "due_asc") return { status, tasks: sortByDueDate(groupTasks, "asc") };
			if (sort === "due_desc") return { status, tasks: sortByDueDate(groupTasks, "desc") };
			return { status, tasks: groupTasks };
		});
	}, [filteredTasks, sort]);

	const hasAnyTasks = groupedByStatus.some((g) => g.tasks.length > 0);

	// ── DnD ──

	const getColumnForItem = useCallback(
		(itemId: string) => {
			for (const group of groupedByStatus) {
				if (group.tasks.some((t) => t._id === itemId)) return group.status;
			}
			return null;
		},
		[groupedByStatus],
	);

	const onMoveItem = useCallback(
		(itemId: string, _fromColumn: string, toColumn: string) => {
			if (!isManuallyAssignableTaskStatus(toColumn as TaskStatus)) return;
			void updateTask({
				id: itemId as Id<"tasks">,
				patch: { status: toColumn as TaskStatus },
			});
		},
		[updateTask],
	);

	const dndState = useDndKanban({
		onMoveItem,
		getColumnForItem,
		canMoveItem: (_itemId, _fromColumn, toColumn) =>
			isManuallyAssignableTaskStatus(toColumn as TaskStatus),
	});

	const activeTask = useMemo(
		() => (dndState.activeId ? (tasks.find((t) => t._id === dndState.activeId) ?? null) : null),
		[dndState.activeId, tasks],
	);

	// Optimistic display: move items to target column before server confirms
	const displayGroups = useMemo(() => {
		if (dndState.pendingMoves.size === 0) return groupedByStatus;
		const movedToStatus = new Map<string, TaskDTO[]>();
		for (const [itemId, target] of dndState.pendingMoves) {
			const task = filteredTasks.find((t) => t._id === itemId);
			if (task) {
				const arr = movedToStatus.get(target) ?? [];
				arr.push(task);
				movedToStatus.set(target, arr);
			}
		}
		return groupedByStatus.map((group) => ({
			...group,
			tasks: [
				...group.tasks.filter((t) => !dndState.pendingMoves.has(t._id)),
				...(movedToStatus.get(group.status) ?? []),
			],
		}));
	}, [groupedByStatus, dndState.pendingMoves, filteredTasks]);

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

				<AsideSortFilterBar
					sort={sort}
					onSortChange={setSort}
					durationFilter={durationFilter}
					onDurationFilterChange={setDurationFilter}
					hoursSetFilter={hoursSetFilter}
					onHoursSetFilterChange={setHoursSetFilter}
					hoursSets={hoursSets}
				/>

				{tasksPending ? (
					<div className="font-[family-name:var(--font-cutive)] text-[0.76rem] text-muted-foreground">
						Loading tasks...
					</div>
				) : !hasAnyTasks ? (
					<div className="font-[family-name:var(--font-cutive)] rounded-xl border border-dashed border-border/60 p-4 text-center text-[0.76rem] text-muted-foreground">
						{search || durationFilter !== "all" || hoursSetFilter !== "all"
							? "No tasks match the current filters."
							: "No tasks yet. Create your first task on the Tasks page."}
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
							{displayGroups.map((group) =>
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
											<DroppableColumn
												id={group.status}
												items={group.tasks.map((t) => t._id)}
												className="space-y-1 pl-1 pt-1"
											>
												{group.tasks.map((task) => (
													<SortableItem key={task._id} id={task._id}>
														<AsideTaskCard task={task} onEditTask={setEditingTaskId} />
													</SortableItem>
												))}
											</DroppableColumn>
										</CollapsibleContent>
									</Collapsible>
								) : null,
							)}
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
