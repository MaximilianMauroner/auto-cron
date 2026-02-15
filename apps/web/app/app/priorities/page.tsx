"use client";

import { useAsideContent } from "@/components/aside-panel";
import { DragOverlayCard, DroppableColumn, SortableItem } from "@/components/dnd";
import { PriorityCard } from "@/components/priorities/priority-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { useDndKanban } from "@/hooks/use-dnd-kanban";
import {
	isManuallyAssignableTaskStatus,
	priorityClass,
	priorityLabels,
	priorityOrder,
	statusClass,
	statusLabels,
	statusPipelineOrder,
} from "@/lib/scheduling-constants";
import type { HabitDTO, HabitPriority, Priority, TaskDTO, TaskStatus } from "@auto-cron/types";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type ViewMode = "priority" | "status";

export default function PrioritiesPage() {
	const [view, setView] = useState<ViewMode>("priority");
	const { openHabit, openTask } = useAsideContent();

	const tasksQuery = useAuthenticatedQueryWithStatus(api.tasks.queries.listTasks, {});
	const tasks = (tasksQuery.data ?? []) as TaskDTO[];
	const habitsQuery = useAuthenticatedQueryWithStatus(api.habits.queries.listHabits, {});
	const habits = (habitsQuery.data ?? []) as HabitDTO[];

	const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
	const activeHabits = useMemo(() => habits.filter((h) => h.isActive), [habits]);

	const isLoading = tasksQuery.isPending || habitsQuery.isPending;

	return (
		<div className="flex h-full min-h-0 flex-col overflow-auto p-4 md:p-6 lg:overflow-hidden lg:p-8">
			<div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 lg:min-h-0">
				<div className="flex shrink-0 items-start justify-between gap-4">
					<SettingsSectionHeader
						sectionNumber="01"
						sectionLabel="Engine"
						title="Priorities"
						description="Organize tasks and habits by priority or status. Drag items between columns to update."
					/>
					<Tabs
						value={view}
						onValueChange={(v) => setView(v as ViewMode)}
						className="mt-6 shrink-0"
					>
						<TabsList className="font-[family-name:var(--font-outfit)]">
							<TabsTrigger value="priority" className="text-xs">
								Priority
							</TabsTrigger>
							<TabsTrigger value="status" className="text-xs">
								Status
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{isLoading ? (
					<div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
						{Array.from({ length: 5 }).map((_, i) => (
							<div
								key={`skeleton-${priorityOrder[i] ?? i}`}
								className="h-64 animate-pulse rounded-xl bg-muted/30"
							/>
						))}
					</div>
				) : view === "priority" ? (
					<PriorityColumnsView
						tasks={activeTasks}
						habits={activeHabits}
						onOpenTaskDetails={(task) => openTask(task._id, "details")}
						onOpenHabitDetails={(habit) => openHabit(habit._id, "details")}
						onEditTask={(task) => openTask(task._id, "edit")}
						onEditHabit={(habit) => openHabit(habit._id, "edit")}
					/>
				) : (
					<StatusKanbanView
						tasks={tasks}
						onOpenTaskDetails={(task) => openTask(task._id, "details")}
						onEditTask={(task) => openTask(task._id, "edit")}
					/>
				)}
			</div>
		</div>
	);
}

// ── Priority Columns View ──

type PriorityColumnsViewProps = {
	tasks: TaskDTO[];
	habits: HabitDTO[];
	onEditTask: (task: TaskDTO) => void;
	onEditHabit: (habit: HabitDTO) => void;
	onOpenTaskDetails: (task: TaskDTO) => void;
	onOpenHabitDetails: (habit: HabitDTO) => void;
};

function PriorityColumnsView({
	tasks,
	habits,
	onEditTask,
	onEditHabit,
	onOpenTaskDetails,
	onOpenHabitDetails,
}: PriorityColumnsViewProps) {
	const { mutate: updateTask } = useMutationWithStatus(api.tasks.mutations.updateTask);
	const { mutate: deleteTask } = useMutationWithStatus(api.tasks.mutations.deleteTask);
	const { mutate: updateHabit } = useMutationWithStatus(api.habits.mutations.updateHabit);
	const { mutate: toggleHabitActive } = useMutationWithStatus(
		api.habits.mutations.toggleHabitActive,
	);
	const { mutate: deleteHabit } = useMutationWithStatus(api.habits.mutations.deleteHabit);

	const groupedByPriority = useMemo(() => {
		return priorityOrder.map((priority) => ({
			priority,
			tasks: tasks.filter((t) => t.priority === priority),
			habits: habits.filter((h) => (h.priority ?? "medium") === (priority as HabitPriority)),
		}));
	}, [tasks, habits]);

	const getColumnForItem = useCallback(
		(itemId: string) => {
			for (const group of groupedByPriority) {
				if (group.tasks.some((t) => t._id === itemId)) return group.priority;
				if (group.habits.some((h) => `habit:${h._id}` === itemId)) return group.priority;
			}
			return null;
		},
		[groupedByPriority],
	);

	const onMoveItem = useCallback(
		(itemId: string, _fromColumn: string, toColumn: string) => {
			const targetPriority = toColumn as Priority;

			if (itemId.startsWith("habit:")) {
				const habitId = itemId.replace("habit:", "");
				if (targetPriority === "blocker") return;
				void updateHabit({
					id: habitId as Id<"habits">,
					patch: { priority: targetPriority as HabitPriority },
				});
			} else {
				void updateTask({
					id: itemId as Id<"tasks">,
					patch: { priority: targetPriority },
				});
			}
		},
		[updateTask, updateHabit],
	);

	const dndState = useDndKanban({
		onMoveItem,
		getColumnForItem,
	});

	const activeItem = useMemo(() => {
		if (!dndState.activeId) return null;
		const id = dndState.activeId;
		if (id.startsWith("habit:")) {
			const habitId = id.replace("habit:", "");
			const habit = habits.find((h) => h._id === habitId);
			return habit ? { item: habit, type: "habit" as const } : null;
		}
		const task = tasks.find((t) => t._id === id);
		return task ? { item: task, type: "task" as const } : null;
	}, [dndState.activeId, tasks, habits]);

	// Optimistic display: move items to target priority before server confirms
	const displayGroups = useMemo(() => {
		if (dndState.pendingMoves.size === 0) return groupedByPriority;
		const movedToPriority = new Map<string, { tasks: TaskDTO[]; habits: HabitDTO[] }>();
		for (const [itemId, target] of dndState.pendingMoves) {
			const entry = movedToPriority.get(target) ?? { tasks: [], habits: [] };
			if (itemId.startsWith("habit:")) {
				const habitId = itemId.replace("habit:", "");
				const habit = habits.find((h) => h._id === habitId);
				if (habit) entry.habits.push(habit);
			} else {
				const task = tasks.find((t) => t._id === itemId);
				if (task) entry.tasks.push(task);
			}
			movedToPriority.set(target, entry);
		}
		return groupedByPriority.map((group) => {
			const moved = movedToPriority.get(group.priority);
			const groupTasks = [
				...group.tasks.filter((t) => !dndState.pendingMoves.has(t._id)),
				...(moved?.tasks ?? []),
			];
			const groupHabits = [
				...group.habits.filter((h) => !dndState.pendingMoves.has(`habit:${h._id}`)),
				...(moved?.habits ?? []),
			];
			return { ...group, tasks: groupTasks, habits: groupHabits };
		});
	}, [groupedByPriority, dndState.pendingMoves, tasks, habits]);

	return (
		<DndContext
			sensors={dndState.sensors}
			collisionDetection={dndState.collisionDetection}
			onDragStart={dndState.handleDragStart}
			onDragEnd={dndState.handleDragEnd}
			onDragCancel={dndState.handleDragCancel}
		>
			<div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pb-2 pr-2">
				{displayGroups.map((group, index) => {
					const allItems = [
						...group.habits.map((h) => `habit:${h._id}`),
						...group.tasks.map((t) => t._id),
					];

					return (
						<div
							key={group.priority}
							className="flex w-[340px] min-w-[340px] snap-start flex-col lg:w-[420px] lg:min-w-[420px]"
						>
							<div className="mb-3 shrink-0">
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
									{String(index + 1).padStart(2, "0")} / {priorityLabels[group.priority]}
								</p>
								<div className="mt-2 flex items-center justify-between">
									<h2 className="font-[family-name:var(--font-outfit)] text-base font-semibold">
										{priorityLabels[group.priority]}
									</h2>
									<Badge
										className={`${priorityClass[group.priority]} font-[family-name:var(--font-outfit)] tabular-nums text-[0.6rem] px-1.5 py-0`}
									>
										{group.tasks.length + group.habits.length}
									</Badge>
								</div>
								<div className="mt-2 h-px bg-border/60" />
							</div>
							<DroppableColumn
								id={group.priority}
								items={allItems}
								className="min-h-0 flex-1 space-y-2 overflow-y-auto"
							>
								{group.habits.length > 0 ? (
									<>
										<p className="font-[family-name:var(--font-cutive)] text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground">
											Habits
										</p>
										{group.habits.map((habit) => (
											<SortableItem key={`habit:${habit._id}`} id={`habit:${habit._id}`}>
												<PriorityCard
													item={habit}
													type="habit"
													onEdit={() => onEditHabit(habit)}
													onOpenInCalendar={() => window.location.assign("/app/calendar")}
													onToggleHabitActive={(isActive) =>
														toggleHabitActive({
															id: habit._id as Id<"habits">,
															isActive,
														})
													}
													onHabitPriorityChange={(priority) =>
														updateHabit({
															id: habit._id as Id<"habits">,
															patch: { priority },
														})
													}
													onDeleteHabit={() =>
														deleteHabit({
															id: habit._id as Id<"habits">,
														})
													}
													onOpenDetails={() => onOpenHabitDetails(habit)}
												/>
											</SortableItem>
										))}
									</>
								) : null}
								{group.tasks.length > 0 ? (
									<>
										<p className="font-[family-name:var(--font-cutive)] text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground">
											Tasks
										</p>
										{group.tasks.map((task) => (
											<SortableItem key={task._id} id={task._id}>
												<PriorityCard
													item={task}
													type="task"
													onEdit={() => onEditTask(task)}
													onOpenDetails={() => onOpenTaskDetails(task)}
													onOpenInCalendar={() => window.location.assign("/app/calendar")}
													onDeleteTask={() =>
														deleteTask({
															id: task._id as Id<"tasks">,
														})
													}
													onTaskStatusChange={(status) =>
														updateTask({
															id: task._id as Id<"tasks">,
															patch: { status },
														})
													}
													onTaskPriorityChange={(priority) =>
														updateTask({
															id: task._id as Id<"tasks">,
															patch: { priority },
														})
													}
												/>
											</SortableItem>
										))}
									</>
								) : null}
								{group.tasks.length === 0 && group.habits.length === 0 ? (
									<p className="py-4 text-center font-[family-name:var(--font-cutive)] text-[0.66rem] text-muted-foreground/40">
										Drop items here
									</p>
								) : null}
							</DroppableColumn>
						</div>
					);
				})}
			</div>

			<DragOverlay dropAnimation={null}>
				{activeItem ? (
					<DragOverlayCard>
						<PriorityCard item={activeItem.item} type={activeItem.type} />
					</DragOverlayCard>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

// ── Status Kanban View ──

type StatusKanbanViewProps = {
	tasks: TaskDTO[];
	onEditTask: (task: TaskDTO) => void;
	onOpenTaskDetails: (task: TaskDTO) => void;
};

function StatusKanbanView({ tasks, onEditTask, onOpenTaskDetails }: StatusKanbanViewProps) {
	const { mutate: updateTask } = useMutationWithStatus(api.tasks.mutations.updateTask);
	const { mutate: deleteTask } = useMutationWithStatus(api.tasks.mutations.deleteTask);

	const tasksByStatus = useMemo(() => {
		const grouped: Record<TaskStatus, TaskDTO[]> = {
			backlog: [],
			queued: [],
			scheduled: [],
			in_progress: [],
			done: [],
		};
		for (const task of tasks) {
			grouped[task.status].push(task);
		}
		for (const status of statusPipelineOrder) {
			grouped[status].sort((a, b) => {
				if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
				return a._creationTime - b._creationTime;
			});
		}
		return grouped;
	}, [tasks]);

	const getColumnForItem = useCallback(
		(itemId: string) => {
			for (const status of statusPipelineOrder) {
				if (tasksByStatus[status].some((t) => t._id === itemId)) return status;
			}
			return null;
		},
		[tasksByStatus],
	);

	const onMoveItem = useCallback(
		(itemId: string, _fromColumn: string, toColumn: string) => {
			const targetStatus = toColumn as TaskStatus;
			if (!isManuallyAssignableTaskStatus(targetStatus)) return;
			const targetColumn = tasksByStatus[targetStatus];
			const nextSortOrder = targetColumn.reduce(
				(maxSortOrder, current) => Math.max(maxSortOrder, current.sortOrder),
				-1,
			);
			void updateTask({
				id: itemId as Id<"tasks">,
				patch: { status: targetStatus, sortOrder: nextSortOrder + 1 },
			});
		},
		[updateTask, tasksByStatus],
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

	// Optimistic display: move items to target status before server confirms
	const displayTasksByStatus = useMemo(() => {
		if (dndState.pendingMoves.size === 0) return tasksByStatus;
		const movedToStatus = new Map<string, TaskDTO[]>();
		for (const [itemId, target] of dndState.pendingMoves) {
			const task = tasks.find((t) => t._id === itemId);
			if (task) {
				const arr = movedToStatus.get(target) ?? [];
				arr.push(task);
				movedToStatus.set(target, arr);
			}
		}
		const result = { ...tasksByStatus };
		for (const status of statusPipelineOrder) {
			result[status] = [
				...tasksByStatus[status].filter((t) => !dndState.pendingMoves.has(t._id)),
				...(movedToStatus.get(status) ?? []),
			];
		}
		return result;
	}, [tasksByStatus, dndState.pendingMoves, tasks]);

	return (
		<DndContext
			sensors={dndState.sensors}
			collisionDetection={dndState.collisionDetection}
			onDragStart={dndState.handleDragStart}
			onDragEnd={dndState.handleDragEnd}
			onDragCancel={dndState.handleDragCancel}
		>
			<div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pb-2 pr-2">
				{statusPipelineOrder.map((status, index) => {
					const columnTasks = displayTasksByStatus[status];
					return (
						<div
							key={status}
							className="flex w-[340px] min-w-[340px] snap-start flex-col lg:w-[420px] lg:min-w-[420px]"
						>
							<div className="mb-3 shrink-0">
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
									{String(index + 1).padStart(2, "0")} / {statusLabels[status]}
								</p>
								<div className="mt-2 flex items-center justify-between">
									<h2 className="font-[family-name:var(--font-outfit)] text-base font-semibold">
										{statusLabels[status]}
									</h2>
									<Badge
										className={`${statusClass[status]} font-[family-name:var(--font-outfit)] tabular-nums text-[0.6rem] px-1.5 py-0`}
									>
										{columnTasks.length}
									</Badge>
								</div>
								<div className="mt-2 h-px bg-border/60" />
							</div>
							<DroppableColumn
								id={status}
								items={columnTasks.map((t) => t._id)}
								className="min-h-0 flex-1 space-y-2 overflow-y-auto"
							>
								{columnTasks.length > 0 ? (
									columnTasks.map((task) => (
										<SortableItem key={task._id} id={task._id}>
											<PriorityCard
												item={task}
												type="task"
												onEdit={() => onEditTask(task)}
												onOpenDetails={() => onOpenTaskDetails(task)}
												onOpenInCalendar={() => window.location.assign("/app/calendar")}
												onDeleteTask={() =>
													deleteTask({
														id: task._id as Id<"tasks">,
													})
												}
												onTaskStatusChange={(status) =>
													updateTask({
														id: task._id as Id<"tasks">,
														patch: { status },
													})
												}
												onTaskPriorityChange={(priority) =>
													updateTask({
														id: task._id as Id<"tasks">,
														patch: { priority },
													})
												}
											/>
										</SortableItem>
									))
								) : (
									<p className="py-4 text-center font-[family-name:var(--font-cutive)] text-[0.66rem] text-muted-foreground/40">
										Drop tasks here
									</p>
								)}
							</DroppableColumn>
						</div>
					);
				})}
			</div>

			<DragOverlay dropAnimation={null}>
				{activeTask ? (
					<DragOverlayCard>
						<PriorityCard item={activeTask} type="task" />
					</DragOverlayCard>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
