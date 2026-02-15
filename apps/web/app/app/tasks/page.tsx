"use client";

import { useAsideContent } from "@/components/aside-panel";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import { DragOverlayCard, DroppableColumn, SortableItem } from "@/components/dnd";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { useDndKanban } from "@/hooks/use-dnd-kanban";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import { isManuallyAssignableTaskStatus, statusPipelineOrder } from "@/lib/scheduling-constants";
import {
	createTaskEditorState,
	fallbackTaskQuickCreateDefaults,
	getEditableCalendars,
	toDateTimeInput,
	toTimestamp,
} from "@/lib/task-editor";
import type { GoogleCalendarListItem, TaskEditorState } from "@/lib/task-editor";
import { cn } from "@/lib/utils";
import type { HoursSetDTO, TaskDTO, TaskStatus } from "@auto-cron/types";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ChevronDown, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type TaskColumn = {
	key: TaskStatus;
	title: string;
	empty: string;
};

const rightLaneColumns: TaskColumn[] = [
	{ key: "queued", title: "Queued", empty: "No queued tasks" },
	{ key: "scheduled", title: "Scheduled", empty: "No scheduled tasks" },
	{ key: "in_progress", title: "In progress", empty: "Nothing in progress" },
	{ key: "done", title: "Done", empty: "No completed tasks yet" },
];

const asTaskId = (id: string) => id as Id<"tasks">;

export default function TasksPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [paywallOpen, setPaywallOpen] = useState(false);
	const [editForm, setEditForm] = useState<TaskEditorState | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const { openTask } = useAsideContent();

	const tasksQuery = useAuthenticatedQueryWithStatus(api.tasks.queries.listTasks, {});
	const tasks = (tasksQuery.data ?? []) as TaskDTO[];
	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const hoursSets = (hoursSetsQuery.data ?? []) as HoursSetDTO[];
	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);
	const defaultTaskSchedulingMode =
		schedulingDefaultsQuery.data?.defaultTaskSchedulingMode ?? "fastest";
	const taskQuickCreateDefaults = useMemo(
		() => schedulingDefaultsQuery.data?.taskQuickCreateDefaults ?? fallbackTaskQuickCreateDefaults,
		[schedulingDefaultsQuery.data?.taskQuickCreateDefaults],
	);
	const defaultHoursSetId = hoursSets.find((hoursSet) => hoursSet.isDefault)?._id ?? "";
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const googleCalendars = (googleCalendarsQuery.data ?? []) as GoogleCalendarListItem[];
	const editableGoogleCalendars = useMemo(
		() => getEditableCalendars(googleCalendars),
		[googleCalendars],
	);
	const defaultCalendarId =
		editableGoogleCalendars.find((calendar) => calendar.primary)?.id ?? "primary";
	const defaultCategoryQuery = useAuthenticatedQueryWithStatus(
		api.categories.queries.getDefaultCategory,
		{},
	);
	const defaultCategoryId = defaultCategoryQuery.data?._id ?? "";

	useEffect(() => {
		if (!isEditOpen || !editForm || !defaultHoursSetId) return;
		if (editForm.hoursSetId) return;
		setEditForm((current) => (current ? { ...current, hoursSetId: defaultHoursSetId } : current));
	}, [defaultHoursSetId, editForm, isEditOpen]);

	const { mutate: updateTask, isPending: isUpdatingTask } = useMutationWithStatus(
		api.tasks.mutations.updateTask,
	);
	const { mutate: deleteTask, isPending: isDeletingTask } = useMutationWithStatus(
		api.tasks.mutations.deleteTask,
	);
	const { mutate: reorderTasks, isPending: isReorderingTasks } = useMutationWithStatus(
		api.tasks.mutations.reorderTasks,
	);

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
			grouped[status] = [...grouped[status]].sort((a, b) => {
				if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
				return a._creationTime - b._creationTime;
			});
		}
		return grouped;
	}, [tasks]);

	const busy = isUpdatingTask || isDeletingTask || isReorderingTasks;
	const completedCount = tasksByStatus.done.length;
	const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
	const activeCount =
		tasksByStatus.queued.length + tasksByStatus.scheduled.length + tasksByStatus.in_progress.length;

	const [collapsedLanes, setCollapsedLanes] = useState<Set<TaskStatus>>(() => new Set(["done"]));

	const toggleLaneCollapsed = (status: TaskStatus) => {
		setCollapsedLanes((prev) => {
			const next = new Set(prev);
			if (next.has(status)) next.delete(status);
			else next.add(status);
			return next;
		});
	};

	const moveTask = useCallback(
		async (task: TaskDTO, nextStatus: TaskStatus) => {
			if (task.status === nextStatus) return;
			if (!isManuallyAssignableTaskStatus(nextStatus)) return;
			const nextSortOrder = tasksByStatus[nextStatus].reduce(
				(maxSortOrder, current) => Math.max(maxSortOrder, current.sortOrder),
				-1,
			);
			await updateTask({
				id: asTaskId(task._id),
				patch: { status: nextStatus, sortOrder: nextSortOrder + 1 },
			});
		},
		[tasksByStatus, updateTask],
	);

	// ── DnD ──

	const getColumnForItem = useCallback(
		(itemId: string) => {
			for (const status of statusPipelineOrder) {
				if (tasksByStatus[status].some((t) => t._id === itemId)) return status;
			}
			return null;
		},
		[tasksByStatus],
	);

	const onDndMoveItem = useCallback(
		(itemId: string, _fromColumn: string, toColumn: string) => {
			const task = tasks.find((t) => t._id === itemId);
			if (task) void moveTask(task, toColumn as TaskStatus);
		},
		[tasks, moveTask],
	);

	const onDndReorder = useCallback(
		(columnId: string, activeId: string, overId: string) => {
			const status = columnId as TaskStatus;
			const current = tasksByStatus[status];
			const oldIndex = current.findIndex((t) => t._id === activeId);
			const newIndex = current.findIndex((t) => t._id === overId);
			if (oldIndex < 0 || newIndex < 0) return;
			const reordered = arrayMove(current, oldIndex, newIndex);
			void reorderTasks({
				items: reordered.map((task, sortOrder) => ({
					id: asTaskId(task._id),
					sortOrder,
					status,
				})),
			});
		},
		[tasksByStatus, reorderTasks],
	);

	const dndState = useDndKanban({
		onMoveItem: onDndMoveItem,
		onReorderInColumn: onDndReorder,
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

	const applyBillingAwareError = (error: unknown) => {
		const payload = getConvexErrorPayload(error);
		if (payload?.code === "FEATURE_LIMIT_REACHED" && payload.featureId === "tasks") {
			setPaywallOpen(true);
			setErrorMessage(payload.message ?? "Task limit reached.");
			return;
		}
		setErrorMessage(payload?.message ?? "Could not save task.");
	};

	const onSaveEdit = async () => {
		if (!editForm?.id) return;
		const estimatedMinutesParsed = parseDurationToMinutes(editForm.estimatedMinutes);
		const minChunkMinutesParsed = parseDurationToMinutes(editForm.minChunkMinutes);
		const maxChunkMinutesParsed = parseDurationToMinutes(editForm.maxChunkMinutes);
		const restMinutesParsed = parseDurationToMinutes(editForm.restMinutes);
		const travelMinutesParsed = parseDurationToMinutes(editForm.travelMinutes);
		if (!editForm.title.trim() || estimatedMinutesParsed === null || estimatedMinutesParsed <= 0) {
			setErrorMessage("Please provide a title and valid estimated duration.");
			return;
		}
		if (
			editForm.splitAllowed &&
			(minChunkMinutesParsed === null ||
				maxChunkMinutesParsed === null ||
				minChunkMinutesParsed <= 0 ||
				maxChunkMinutesParsed < minChunkMinutesParsed)
		) {
			setErrorMessage("Split duration range is invalid.");
			return;
		}
		if (
			restMinutesParsed === null ||
			travelMinutesParsed === null ||
			restMinutesParsed < 0 ||
			travelMinutesParsed < 0
		) {
			setErrorMessage("Rest and travel durations must be 0 or greater.");
			return;
		}
		const estimatedMinutes = estimatedMinutesParsed;
		const location = editForm.location.trim();

		const patch = {
			title: editForm.title.trim(),
			description: editForm.description.trim() || null,
			location: location || null,
			priority: editForm.priority,
			status: editForm.sendToUpNext && editForm.status === "backlog" ? "queued" : editForm.status,
			estimatedMinutes,
			deadline: toTimestamp(editForm.deadline) ?? null,
			scheduleAfter: toTimestamp(editForm.scheduleAfter) ?? null,
			splitAllowed: editForm.splitAllowed,
			minChunkMinutes: editForm.splitAllowed ? (minChunkMinutesParsed ?? null) : null,
			maxChunkMinutes: editForm.splitAllowed ? (maxChunkMinutesParsed ?? null) : null,
			restMinutes: restMinutesParsed ?? null,
			travelMinutes: travelMinutesParsed ?? null,
			sendToUpNext: editForm.sendToUpNext,
			hoursSetId: editForm.hoursSetId ? (editForm.hoursSetId as Id<"hoursSets">) : null,
			schedulingMode: editForm.schedulingMode === "default" ? null : editForm.schedulingMode,
			visibilityPreference: editForm.visibilityPreference,
			preferredCalendarId: editForm.preferredCalendarId || null,
			color: editForm.color,
			...(editForm.categoryId ? { categoryId: editForm.categoryId as Id<"taskCategories"> } : {}),
		};

		setErrorMessage(null);
		try {
			await updateTask({ id: asTaskId(editForm.id), patch });
			setIsEditOpen(false);
			setEditForm(null);
		} catch (error) {
			applyBillingAwareError(error);
		}
	};

	const openEdit = (task: TaskDTO) => {
		openTask(task._id, "edit");
	};

	return (
		<div className="flex h-full min-h-0 flex-col overflow-auto p-4 md:p-6 lg:overflow-hidden lg:p-8">
			<div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 lg:min-h-0">
				<div className="flex shrink-0 items-start justify-between gap-4">
					<SettingsSectionHeader
						sectionNumber="01"
						sectionLabel="Engine"
						title="Tasks"
						description="Plan what matters, queue execution, and let the scheduler place work automatically."
					/>
					<Button
						onClick={() => setIsCreateOpen(true)}
						disabled={busy}
						className="mt-6 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_2px_8px_-2px_rgba(252,163,17,0.2)]"
					>
						<Plus className="size-4" />
						New task
					</Button>
				</div>

				<div className="grid shrink-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
					<MetricTile label="Total" value={tasks.length} />
					<MetricTile label="Active" value={activeCount} />
					<MetricTile label="Done" value={completedCount} />
					<MetricTile label="Complete" value={`${completionRate}%`} />
				</div>

				{errorMessage ? (
					<div className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
						{errorMessage}
					</div>
				) : null}

				{tasksQuery.isPending ? (
					<div className="grid gap-4 md:grid-cols-2">
						{["task-skeleton-left", "task-skeleton-right"].map((key) => (
							<div key={key} className="h-80 animate-pulse rounded-xl bg-muted/30" />
						))}
					</div>
				) : tasks.length === 0 ? (
					<Empty className="border-border/60 bg-card/40">
						<EmptyHeader>
							<EmptyTitle className="font-[family-name:var(--font-outfit)]">
								No tasks yet
							</EmptyTitle>
							<EmptyDescription>
								Create your first task and move it from backlog into execution.
							</EmptyDescription>
						</EmptyHeader>
						<Button
							onClick={() => setIsCreateOpen(true)}
							className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
						>
							<Plus className="size-4" />
							Create task
						</Button>
					</Empty>
				) : (
					<DndContext
						sensors={dndState.sensors}
						collisionDetection={dndState.collisionDetection}
						onDragStart={dndState.handleDragStart}
						onDragEnd={dndState.handleDragEnd}
						onDragCancel={dndState.handleDragCancel}
					>
						<div className="grid gap-6 lg:flex-1 lg:grid-cols-[0.95fr_1.45fr] lg:min-h-0">
							{/* Backlog column */}
							<div className="flex flex-col lg:min-h-0">
								<div className="mb-4 shrink-0">
									<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
										01 / Backlog
									</p>
									<div className="mt-2 flex items-center justify-between">
										<h2 className="text-lg font-semibold">Backlog</h2>
										<span className="text-xs tabular-nums text-muted-foreground">
											{displayTasksByStatus.backlog.length}
										</span>
									</div>
									<div className="mt-2 h-px bg-border/60" />
								</div>
								<DroppableColumn
									id="backlog"
									items={displayTasksByStatus.backlog.map((t) => t._id)}
									className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
								>
									{displayTasksByStatus.backlog.length === 0 ? (
										<p className="text-sm text-muted-foreground">No backlog tasks.</p>
									) : (
										displayTasksByStatus.backlog.map((task) => (
											<SortableItem key={task._id} id={task._id}>
												<TaskCard
													task={task}
													onEdit={() => openEdit(task)}
													onDelete={() => deleteTask({ id: asTaskId(task._id) })}
													onMove={(nextStatus) => moveTask(task, nextStatus)}
													onPriorityChange={(priority) =>
														updateTask({
															id: asTaskId(task._id),
															patch: { priority },
														})
													}
													isBusy={busy}
													onOpenDetails={() => openTask(task._id, "details")}
												/>
											</SortableItem>
										))
									)}
								</DroppableColumn>
							</div>

							{/* Execution lanes column */}
							<div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
								{rightLaneColumns.map((column, index) => {
									const isCollapsed = collapsedLanes.has(column.key);
									const columnTasks = displayTasksByStatus[column.key];
									return (
										<div key={column.key}>
											<button
												type="button"
												onClick={() => toggleLaneCollapsed(column.key)}
												className="mb-3 w-full text-left"
											>
												<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
													{String(index + 2).padStart(2, "0")} / {column.title}
												</p>
												<div className="mt-2 flex items-center justify-between">
													<h2 className="text-lg font-semibold">{column.title}</h2>
													<div className="flex items-center gap-2">
														<span className="text-xs tabular-nums text-muted-foreground">
															{columnTasks.length}
														</span>
														<ChevronDown
															className={cn(
																"size-4 text-muted-foreground transition-transform",
																isCollapsed && "-rotate-90",
															)}
														/>
													</div>
												</div>
												<div className="mt-2 h-px bg-border/60" />
											</button>
											<DroppableColumn
												id={column.key}
												items={columnTasks.map((t) => t._id)}
												className={cn("space-y-2", isCollapsed && "hidden")}
											>
												{columnTasks.length === 0 ? (
													<p className="text-sm text-muted-foreground">{column.empty}</p>
												) : (
													columnTasks.map((task) => (
														<SortableItem key={task._id} id={task._id}>
															<TaskCard
																task={task}
																onEdit={() => openEdit(task)}
																onDelete={() => deleteTask({ id: asTaskId(task._id) })}
																onMove={(nextStatus) => moveTask(task, nextStatus)}
																onPriorityChange={(priority) =>
																	updateTask({
																		id: asTaskId(task._id),
																		patch: { priority },
																	})
																}
																isBusy={busy}
																onOpenDetails={() => openTask(task._id, "details")}
															/>
														</SortableItem>
													))
												)}
											</DroppableColumn>
										</div>
									);
								})}
							</div>
						</div>

						<DragOverlay dropAnimation={null}>
							{dndState.activeId && activeTask ? (
								<DragOverlayCard>
									<TaskCard
										task={activeTask}
										onEdit={() => {}}
										onDelete={() => {}}
										onMove={() => {}}
										onPriorityChange={() => {}}
										isBusy
										onOpenDetails={() => {}}
									/>
								</DragOverlayCard>
							) : null}
						</DragOverlay>
					</DndContext>
				)}
			</div>

			<CreateTaskDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

			<TaskDialog
				open={isEditOpen}
				onOpenChange={(open) => {
					setIsEditOpen(open);
					if (!open) {
						setEditForm(null);
					}
				}}
				title="Edit task"
				value={
					editForm ??
					createTaskEditorState({
						defaults: taskQuickCreateDefaults,
						defaultHoursSetId,
						defaultCalendarId,
						defaultCategoryId,
					})
				}
				onChange={(nextValue) => setEditForm(nextValue)}
				onSubmit={onSaveEdit}
				submitLabel={isUpdatingTask ? "Saving..." : "Save changes"}
				busy={busy}
				calendars={editableGoogleCalendars}
				hoursSets={hoursSets}
				defaultTaskSchedulingMode={defaultTaskSchedulingMode}
				errorMessage={errorMessage}
			/>

			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="tasks" />
		</div>
	);
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-xl border border-border/60 p-4">
			<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-2 font-[family-name:var(--font-outfit)] text-3xl font-bold tabular-nums">
				{value}
			</p>
		</div>
	);
}
