"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { CategoryPicker } from "@/components/category-picker";
import { QuickCreateTaskDialog } from "@/components/quick-create/quick-create-task-dialog";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DurationInput } from "@/components/ui/duration-input";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUserPreferences } from "@/components/user-preferences-context";
import {
	useActionWithStatus,
	useAuthenticatedQueryWithStatus,
	useMutationWithStatus,
} from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import {
	formatDurationCompact,
	formatDurationFromMinutes,
	parseDurationToMinutes,
} from "@/lib/duration";
import { cn } from "@/lib/utils";
import type {
	HoursSetDTO,
	Priority,
	TaskDTO,
	TaskSchedulingMode,
	TaskStatus,
	TaskVisibilityPreference,
} from "@auto-cron/types";
import { GOOGLE_CALENDAR_COLORS } from "@auto-cron/types";
import { ArrowDown, ArrowUp, ChevronDown, Clock3, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type TaskEditorState = {
	id?: string;
	title: string;
	description: string;
	location: string;
	priority: Priority;
	status: TaskStatus;
	estimatedMinutes: string;
	deadline: string;
	scheduleAfter: string;
	splitAllowed: boolean;
	minChunkMinutes: string;
	maxChunkMinutes: string;
	restMinutes: string;
	travelMinutes: string;
	sendToUpNext: boolean;
	hoursSetId: string;
	schedulingMode: "default" | TaskSchedulingMode;
	visibilityPreference: TaskVisibilityPreference;
	preferredCalendarId: string;
	color: string;
	categoryId: string;
};

type TaskQuickCreateDefaults = {
	priority: Priority;
	status: "backlog" | "queued";
	estimatedMinutes: number;
	splitAllowed: boolean;
	minChunkMinutes: number;
	maxChunkMinutes: number;
	restMinutes: number;
	travelMinutes: number;
	sendToUpNext: boolean;
	visibilityPreference: TaskVisibilityPreference;
	color: string;
};

type TaskColumn = {
	key: TaskStatus;
	title: string;
	empty: string;
};

type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

const priorityClass: Record<Priority, string> = {
	low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
	medium: "bg-sky-500/15 text-sky-700 border-sky-500/25",
	high: "bg-amber-500/15 text-amber-700 border-amber-500/25",
	critical: "bg-orange-500/15 text-orange-700 border-orange-500/25",
	blocker: "bg-rose-500/15 text-rose-700 border-rose-500/25",
};

const priorityLabels: Record<Priority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
	blocker: "Blocker",
};

const statusOrder: TaskStatus[] = ["backlog", "queued", "scheduled", "in_progress", "done"];

const statusTitles: Record<TaskStatus, string> = {
	backlog: "Backlog",
	queued: "Queued",
	scheduled: "Scheduled",
	in_progress: "In Progress",
	done: "Done",
};

const rightLaneColumns: TaskColumn[] = [
	{ key: "queued", title: "Queued", empty: "No queued tasks" },
	{ key: "scheduled", title: "Scheduled", empty: "No scheduled tasks" },
	{ key: "in_progress", title: "In progress", empty: "Nothing in progress" },
	{ key: "done", title: "Done", empty: "No completed tasks yet" },
];

const taskColors = GOOGLE_CALENDAR_COLORS;

const schedulingModeLabels: Record<TaskSchedulingMode, string> = {
	fastest: "Fastest",
	balanced: "Balanced",
	packed: "Packed",
};

const visibilityLabels: Record<TaskVisibilityPreference, string> = {
	default: "Use default calendar visibility",
	private: "Make this task private",
};

const fallbackTaskQuickCreateDefaults: TaskQuickCreateDefaults = {
	priority: "medium",
	status: "backlog",
	estimatedMinutes: 30,
	splitAllowed: true,
	minChunkMinutes: 30,
	maxChunkMinutes: 180,
	restMinutes: 0,
	travelMinutes: 0,
	sendToUpNext: false,
	visibilityPreference: "private",
	color: "#f59e0b",
};

const createTaskEditorState = ({
	defaults,
	defaultHoursSetId,
	defaultCalendarId,
	defaultCategoryId,
}: {
	defaults: TaskQuickCreateDefaults;
	defaultHoursSetId: string;
	defaultCalendarId: string;
	defaultCategoryId?: string;
}): TaskEditorState => ({
	title: "",
	description: "",
	location: "",
	priority: defaults.priority,
	status: defaults.status,
	estimatedMinutes: formatDurationFromMinutes(defaults.estimatedMinutes),
	deadline: "",
	scheduleAfter: "",
	splitAllowed: defaults.splitAllowed,
	minChunkMinutes: formatDurationFromMinutes(defaults.minChunkMinutes),
	maxChunkMinutes: formatDurationFromMinutes(defaults.maxChunkMinutes),
	restMinutes: formatDurationFromMinutes(defaults.restMinutes),
	travelMinutes: formatDurationFromMinutes(defaults.travelMinutes),
	sendToUpNext: defaults.sendToUpNext,
	hoursSetId: defaultHoursSetId,
	schedulingMode: "default",
	visibilityPreference: defaults.visibilityPreference,
	preferredCalendarId: defaultCalendarId,
	color: defaults.color,
	categoryId: defaultCategoryId ?? "",
});

const createRequestId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `task-${Date.now()}-${Math.round(Math.random() * 10_000)}`;
};

const toDateInput = (timestamp?: number) => {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const toTimestamp = (value: string) => {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

const toDateTimeInput = (timestamp?: number) => {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	const hours = `${date.getHours()}`.padStart(2, "0");
	const minutes = `${date.getMinutes()}`.padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const readableDeadline = (timestamp?: number, hour12?: boolean) => {
	if (!timestamp) return "No deadline";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12,
	}).format(new Date(timestamp));
};

const asTaskId = (id: string) => id as Id<"tasks">;

export default function TasksPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [paywallOpen, setPaywallOpen] = useState(false);
	const [createForm, setCreateForm] = useState<TaskEditorState>(() =>
		createTaskEditorState({
			defaults: fallbackTaskQuickCreateDefaults,
			defaultHoursSetId: "",
			defaultCalendarId: "primary",
			defaultCategoryId: "",
		}),
	);
	const [editForm, setEditForm] = useState<TaskEditorState | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
	const editableGoogleCalendars = useMemo(() => {
		const writable = googleCalendars.filter((calendar) => {
			const accessRole = calendar.accessRole;
			return !accessRole || accessRole === "owner" || accessRole === "writer";
		});
		if (writable.length > 0) return writable;
		return [
			{
				id: "primary",
				name: "Default",
				primary: true,
				color: undefined,
				isExternal: false,
			},
		];
	}, [googleCalendars]);
	const defaultCalendarId =
		editableGoogleCalendars.find((calendar) => calendar.primary)?.id ?? "primary";
	const defaultCategoryQuery = useAuthenticatedQueryWithStatus(
		api.categories.queries.getDefaultCategory,
		{},
	);
	const defaultCategoryId = defaultCategoryQuery.data?._id ?? "";

	const openCreate = () => {
		setCreateForm(
			createTaskEditorState({
				defaults: taskQuickCreateDefaults,
				defaultHoursSetId,
				defaultCalendarId,
				defaultCategoryId,
			}),
		);
		setErrorMessage(null);
		setIsCreateOpen(true);
	};

	useEffect(() => {
		if (!isCreateOpen) return;
		if (
			editableGoogleCalendars.some((calendar) => calendar.id === createForm.preferredCalendarId)
		) {
			return;
		}
		setCreateForm((current) => ({ ...current, preferredCalendarId: defaultCalendarId }));
	}, [createForm.preferredCalendarId, defaultCalendarId, editableGoogleCalendars, isCreateOpen]);

	useEffect(() => {
		if (!isCreateOpen || !defaultHoursSetId) return;
		if (createForm.hoursSetId) return;
		setCreateForm((current) => ({ ...current, hoursSetId: defaultHoursSetId }));
	}, [createForm.hoursSetId, defaultHoursSetId, isCreateOpen]);

	useEffect(() => {
		if (!isEditOpen || !editForm || !defaultHoursSetId) return;
		if (editForm.hoursSetId) return;
		setEditForm((current) => (current ? { ...current, hoursSetId: defaultHoursSetId } : current));
	}, [defaultHoursSetId, editForm, isEditOpen]);

	const { execute: createTask, isPending: isCreatingTask } = useActionWithStatus(
		api.tasks.actions.createTask,
	);
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
		for (const status of statusOrder) {
			grouped[status] = [...grouped[status]].sort((a, b) => {
				if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
				return a._creationTime - b._creationTime;
			});
		}
		return grouped;
	}, [tasks]);

	const busy = isCreatingTask || isUpdatingTask || isDeletingTask || isReorderingTasks;
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

	const applyBillingAwareError = (error: unknown) => {
		const payload = getConvexErrorPayload(error);
		if (payload?.code === "FEATURE_LIMIT_REACHED" && payload.featureId === "tasks") {
			setPaywallOpen(true);
			setErrorMessage(payload.message ?? "Task limit reached.");
			return;
		}
		setErrorMessage(payload?.message ?? "Could not save task.");
	};

	const onCreateTask = async () => {
		const estimatedMinutesParsed = parseDurationToMinutes(createForm.estimatedMinutes);
		const minChunkMinutesParsed = parseDurationToMinutes(createForm.minChunkMinutes);
		const maxChunkMinutesParsed = parseDurationToMinutes(createForm.maxChunkMinutes);
		const restMinutesParsed = parseDurationToMinutes(createForm.restMinutes);
		const travelMinutesParsed = parseDurationToMinutes(createForm.travelMinutes);
		if (
			!createForm.title.trim() ||
			estimatedMinutesParsed === null ||
			estimatedMinutesParsed <= 0
		) {
			setErrorMessage("Please provide a title and valid estimated duration.");
			return;
		}
		if (
			createForm.splitAllowed &&
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
		const location = createForm.location.trim();

		const payload = {
			title: createForm.title.trim(),
			description: createForm.description.trim() || undefined,
			location: location || undefined,
			priority: createForm.priority,
			status: (createForm.sendToUpNext || createForm.status === "queued" ? "queued" : "backlog") as
				| "backlog"
				| "queued",
			estimatedMinutes,
			deadline: toTimestamp(createForm.deadline),
			scheduleAfter: toTimestamp(createForm.scheduleAfter),
			splitAllowed: createForm.splitAllowed,
			minChunkMinutes: createForm.splitAllowed ? (minChunkMinutesParsed ?? undefined) : undefined,
			maxChunkMinutes: createForm.splitAllowed ? (maxChunkMinutesParsed ?? undefined) : undefined,
			restMinutes: restMinutesParsed,
			travelMinutes: travelMinutesParsed,
			sendToUpNext: createForm.sendToUpNext,
			hoursSetId: createForm.hoursSetId ? (createForm.hoursSetId as Id<"hoursSets">) : undefined,
			schedulingMode:
				createForm.schedulingMode === "default" ? undefined : createForm.schedulingMode,
			visibilityPreference: createForm.visibilityPreference,
			preferredCalendarId: createForm.preferredCalendarId || undefined,
			color: createForm.color,
			categoryId: createForm.categoryId
				? (createForm.categoryId as Id<"taskCategories">)
				: undefined,
		};

		setErrorMessage(null);
		try {
			await createTask({ requestId: createRequestId(), input: payload });
			setCreateForm(
				createTaskEditorState({
					defaults: taskQuickCreateDefaults,
					defaultHoursSetId,
					defaultCalendarId,
					defaultCategoryId,
				}),
			);
			setIsCreateOpen(false);
		} catch (error) {
			applyBillingAwareError(error);
		}
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

	const moveTask = async (task: TaskDTO, nextStatus: TaskStatus) => {
		if (task.status === nextStatus) return;
		const nextSortOrder = tasksByStatus[nextStatus].reduce(
			(maxSortOrder, current) => Math.max(maxSortOrder, current.sortOrder),
			-1,
		);
		await updateTask({
			id: asTaskId(task._id),
			patch: { status: nextStatus, sortOrder: nextSortOrder + 1 },
		});
	};

	const reorderWithinStatus = async (status: TaskStatus, id: string, direction: -1 | 1) => {
		const current = tasksByStatus[status];
		const index = current.findIndex((item) => item._id === id);
		if (index < 0) return;
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= current.length) return;

		const reordered = [...current];
		const [moved] = reordered.splice(index, 1);
		if (!moved) return;
		reordered.splice(targetIndex, 0, moved);

		await reorderTasks({
			items: reordered.map((task, sortOrder) => ({
				id: asTaskId(task._id),
				sortOrder,
				status,
			})),
		});
	};

	const openEdit = (task: TaskDTO) => {
		setEditForm({
			id: task._id,
			title: task.title,
			description: task.description ?? "",
			location: task.location ?? "",
			priority: task.priority,
			status: task.status,
			estimatedMinutes: formatDurationFromMinutes(task.estimatedMinutes),
			deadline: toDateTimeInput(task.deadline),
			scheduleAfter: toDateTimeInput(task.scheduleAfter),
			splitAllowed: task.splitAllowed ?? false,
			minChunkMinutes: formatDurationFromMinutes(task.minChunkMinutes ?? 30),
			maxChunkMinutes: formatDurationFromMinutes(task.maxChunkMinutes ?? 180),
			restMinutes: formatDurationFromMinutes(task.restMinutes ?? 0),
			travelMinutes: formatDurationFromMinutes(task.travelMinutes ?? 0),
			sendToUpNext: task.sendToUpNext ?? task.status === "queued",
			hoursSetId: task.hoursSetId ?? defaultHoursSetId,
			schedulingMode: task.schedulingMode ?? "default",
			visibilityPreference: task.visibilityPreference ?? "default",
			preferredCalendarId: task.preferredCalendarId ?? "primary",
			color: task.color ?? "#f59e0b",
			categoryId: task.categoryId ?? "",
		});
		setIsEditOpen(true);
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
						onClick={openCreate}
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
							onClick={openCreate}
							className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
						>
							<Plus className="size-4" />
							Create task
						</Button>
					</Empty>
				) : (
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
										{tasksByStatus.backlog.length}
									</span>
								</div>
								<div className="mt-2 h-px bg-border/60" />
							</div>
							<div className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
								{tasksByStatus.backlog.length === 0 ? (
									<p className="text-sm text-muted-foreground">No backlog tasks.</p>
								) : (
									tasksByStatus.backlog.map((task) => (
										<TaskCard
											key={task._id}
											task={task}
											onEdit={() => openEdit(task)}
											onDelete={() => deleteTask({ id: asTaskId(task._id) })}
											onMove={(nextStatus) => moveTask(task, nextStatus)}
											onReorder={(direction) =>
												reorderWithinStatus(task.status, task._id, direction)
											}
											isBusy={busy}
										/>
									))
								)}
							</div>
						</div>

						{/* Execution lanes column */}
						<div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
							{rightLaneColumns.map((column, index) => {
								const isCollapsed = collapsedLanes.has(column.key);
								const columnTasks = tasksByStatus[column.key];
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
										{!isCollapsed && (
											<div className="space-y-2">
												{columnTasks.length === 0 ? (
													<p className="text-sm text-muted-foreground">{column.empty}</p>
												) : (
													columnTasks.map((task) => (
														<TaskCard
															key={task._id}
															task={task}
															onEdit={() => openEdit(task)}
															onDelete={() => deleteTask({ id: asTaskId(task._id) })}
															onMove={(nextStatus) => moveTask(task, nextStatus)}
															onReorder={(direction) =>
																reorderWithinStatus(task.status, task._id, direction)
															}
															isBusy={busy}
														/>
													))
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>

			<QuickCreateTaskDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

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

function TaskCard({
	task,
	onEdit,
	onDelete,
	onMove,
	onReorder,
	isBusy,
}: {
	task: TaskDTO;
	onEdit: () => void;
	onDelete: () => void;
	onMove: (status: TaskStatus) => void;
	onReorder: (direction: -1 | 1) => void;
	isBusy: boolean;
}) {
	const { hour12 } = useUserPreferences();
	return (
		<div
			className="group rounded-xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-border hover:bg-card/90"
			style={{
				borderLeftWidth: 3,
				borderLeftColor: task.effectiveColor ?? task.color ?? "#f59e0b",
			}}
		>
			<div className="flex items-start justify-between gap-3">
				<p className="text-sm font-semibold leading-snug">{task.title}</p>
				<Badge className={priorityClass[task.priority]} variant="outline">
					{priorityLabels[task.priority]}
				</Badge>
			</div>

			{task.description && (
				<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
			)}

			<div className="mt-3 flex flex-wrap items-center gap-1.5">
				<span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
					<Clock3 className="size-3" /> {formatDurationCompact(task.estimatedMinutes)}
				</span>
				{task.deadline && (
					<span className="text-[11px] text-muted-foreground">
						Due {readableDeadline(task.deadline, hour12)}
					</span>
				)}
				{task.splitAllowed && (
					<span className="text-[11px] text-muted-foreground">
						Split {formatDurationCompact(task.minChunkMinutes ?? 30)}-
						{formatDurationCompact(task.maxChunkMinutes ?? 180)}
					</span>
				)}
				{task.location && (
					<span className="text-[11px] text-muted-foreground">At {task.location}</span>
				)}
				{task.visibilityPreference === "private" && (
					<span className="text-[11px] text-muted-foreground">Private</span>
				)}
			</div>

			<div className="mt-3 flex items-center justify-between border-t border-border/30 pt-3">
				<Select value={task.status} onValueChange={(value) => onMove(value as TaskStatus)}>
					<SelectTrigger className="h-8 w-auto min-w-[120px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{statusOrder.map((status) => (
							<SelectItem key={status} value={status}>
								{statusTitles[status]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex items-center gap-1">
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						disabled={isBusy}
						onClick={() => onReorder(-1)}
					>
						<ArrowUp className="size-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						disabled={isBusy}
						onClick={() => onReorder(1)}
					>
						<ArrowDown className="size-3.5" />
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={isBusy}
						onClick={onEdit}
						className="h-7 px-2 text-xs"
					>
						Edit
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={isBusy}
						onClick={onDelete}
						className="h-7 px-2 text-xs text-destructive"
					>
						Delete
					</Button>
				</div>
			</div>
		</div>
	);
}

function TaskDialog({
	open,
	onOpenChange,
	title,
	compactCreate = false,
	value,
	onChange,
	onSubmit,
	submitLabel,
	busy,
	calendars,
	hoursSets,
	defaultTaskSchedulingMode,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	compactCreate?: boolean;
	value: TaskEditorState;
	onChange: (value: TaskEditorState) => void;
	onSubmit: () => void;
	submitLabel: string;
	busy: boolean;
	calendars: GoogleCalendarListItem[];
	hoursSets: HoursSetDTO[];
	defaultTaskSchedulingMode: TaskSchedulingMode;
}) {
	const updateEstimatedMinutes = (next: number) => {
		const clamped = Math.max(15, next);
		onChange({
			...value,
			estimatedMinutes: formatDurationFromMinutes(clamped),
		});
	};

	const bumpEstimatedMinutes = (delta: number) => {
		const current = parseDurationToMinutes(value.estimatedMinutes ?? "");
		const base = current ?? 30;
		updateEstimatedMinutes(base + delta);
	};
	const [showAdvanced, setShowAdvanced] = useState(!compactCreate);

	useEffect(() => {
		if (!open) return;
		setShowAdvanced(!compactCreate);
	}, [compactCreate, open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				{/* ── Header ── */}
				<DialogHeader className="space-y-1">
					<div className="flex items-center gap-2.5">
						<span
							className="size-2.5 rounded-full ring-2 ring-offset-1 ring-offset-background"
							style={{
								backgroundColor: value.color || "#f59e0b",
								boxShadow: `0 0 8px ${value.color || "#f59e0b"}30`,
								// biome-ignore lint/suspicious/noExplicitAny: ring color via style
								["--tw-ring-color" as any]: `${value.color || "#f59e0b"}40`,
							}}
						/>
						<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							{title}
						</p>
					</div>
					<DialogTitle className="font-[family-name:var(--font-outfit)] text-xl font-semibold tracking-tight">
						{value.title || "New task"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{compactCreate && !showAdvanced ? (
						<div className="space-y-5 rounded-xl border border-border/50 p-5">
							<div className="space-y-1.5">
								<Label
									htmlFor="quick-task-name"
									className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
								>
									Task name
								</Label>
								<Input
									id="quick-task-name"
									placeholder="What needs to get done?"
									value={value.title}
									onChange={(event) => onChange({ ...value, title: event.target.value })}
									className="border-0 border-b border-border/50 bg-transparent px-0 font-[family-name:var(--font-outfit)] text-[0.9rem] font-medium shadow-none ring-0 transition-colors placeholder:text-muted-foreground/40 focus-visible:border-accent focus-visible:ring-0"
								/>
							</div>
							<div className="space-y-1.5">
								<Label
									htmlFor="quick-task-location"
									className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
								>
									Location (optional)
								</Label>
								<Input
									id="quick-task-location"
									placeholder="Office, gym, client site..."
									value={value.location}
									onChange={(event) => onChange({ ...value, location: event.target.value })}
									className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
								/>
							</div>

							<div className="h-px bg-border/30" />

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Time needed
									</Label>
									<DurationInput
										value={value.estimatedMinutes}
										onChange={(estimatedMinutes) => onChange({ ...value, estimatedMinutes })}
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Due date
									</Label>
									<DateTimePicker
										value={value.deadline}
										onChange={(deadline) => onChange({ ...value, deadline })}
										placeholder="Anytime"
										minuteStep={15}
									/>
								</div>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Priority
									</Label>
									<Select
										value={value.priority}
										onValueChange={(priority) =>
											onChange({ ...value, priority: priority as Priority })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Priority" />
										</SelectTrigger>
										<SelectContent>
											{(Object.keys(priorityLabels) as Priority[]).map((p) => (
												<SelectItem key={p} value={p}>
													{priorityLabels[p]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-end">
									<div className="flex w-full items-center justify-between rounded-lg border border-border/40 px-3.5 py-3">
										<div>
											<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-medium">
												Send to Up Next
											</p>
											<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
												Queue it immediately.
											</p>
										</div>
										<Switch
											checked={value.sendToUpNext}
											onCheckedChange={(sendToUpNext) => onChange({ ...value, sendToUpNext })}
										/>
									</div>
								</div>
							</div>

							<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
								Using account defaults for split, rest, travel, visibility, color, hours, and
								calendar. Change these in{" "}
								<a href="/app/settings/scheduling" className="underline underline-offset-2">
									Settings
								</a>
								.
							</p>
						</div>
					) : null}

					{!compactCreate || showAdvanced ? (
						<Accordion type="multiple" defaultValue={["general"]}>
							{/* ── Section 1: General ── */}
							<AccordionItem value="general" className="rounded-xl border border-border/50 px-5">
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											01 / General
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											General details
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Name, category, color, and notes
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-5 pb-5">
									<div className="space-y-1.5">
										<Label
											htmlFor="task-name"
											className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
										>
											Task name
										</Label>
										<Input
											id="task-name"
											placeholder="Task name..."
											value={value.title}
											onChange={(event) => onChange({ ...value, title: event.target.value })}
											className="border-0 border-b border-border/50 bg-transparent px-0 font-[family-name:var(--font-outfit)] text-[0.9rem] font-medium shadow-none ring-0 transition-colors placeholder:text-muted-foreground/40 focus-visible:border-accent focus-visible:ring-0"
										/>
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Category
										</Label>
										<CategoryPicker
											value={value.categoryId}
											onValueChange={(categoryId) => onChange({ ...value, categoryId })}
										/>
									</div>
									<div className="grid gap-4 md:grid-cols-3">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Color
											</Label>
											<div className="flex flex-wrap gap-2 rounded-lg border border-border/40 p-2">
												{taskColors.map((color) => (
													<button
														key={color}
														type="button"
														onClick={() => onChange({ ...value, color })}
														className={cn(
															"size-6 rounded-full border transition-transform hover:scale-110",
															value.color === color
																? "border-foreground ring-2 ring-foreground/20 scale-110"
																: "border-border/50",
														)}
														style={{ backgroundColor: color }}
														aria-label={`Select ${color}`}
													/>
												))}
											</div>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Hours
											</Label>
											<Select
												value={value.hoursSetId || undefined}
												onValueChange={(hoursSetId) => onChange({ ...value, hoursSetId })}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select hours set" />
												</SelectTrigger>
												<SelectContent>
													{hoursSets.map((hoursSet) => (
														<SelectItem key={hoursSet._id} value={hoursSet._id}>
															{hoursSet.name}
															{hoursSet.isDefault ? " (Default)" : ""}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Calendar
											</Label>
											<Select
												value={value.preferredCalendarId}
												onValueChange={(preferredCalendarId) =>
													onChange({ ...value, preferredCalendarId })
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{calendars.map((calendar) => (
														<SelectItem key={calendar.id} value={calendar.id}>
															{calendar.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label
											htmlFor="task-notes"
											className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
										>
											Notes
										</Label>
										<Textarea
											id="task-notes"
											placeholder="Add notes..."
											value={value.description}
											onChange={(event) => onChange({ ...value, description: event.target.value })}
											className="min-h-24 font-[family-name:var(--font-outfit)] text-[0.82rem]"
										/>
									</div>
									<div className="space-y-1.5">
										<Label
											htmlFor="task-location"
											className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
										>
											Location
										</Label>
										<Input
											id="task-location"
											placeholder="Office, gym, client site..."
											value={value.location}
											onChange={(event) => onChange({ ...value, location: event.target.value })}
											className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
										/>
										<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
											If set, scheduler can add travel events before and after this task.
										</p>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* ── Section 2: Scheduling ── */}
							<AccordionItem
								value="scheduling"
								className="mt-4 rounded-xl border border-border/50 px-5"
							>
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											02 / Scheduling
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											Scheduling
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Priority, timing, duration, and split settings
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-5 pb-5">
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Priority
											</Label>
											<Select
												value={value.priority}
												onValueChange={(priority) =>
													onChange({ ...value, priority: priority as Priority })
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Priority" />
												</SelectTrigger>
												<SelectContent>
													{Object.keys(priorityClass).map((priority) => (
														<SelectItem key={priority} value={priority}>
															{priority}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Status
											</Label>
											<Select
												value={value.status}
												onValueChange={(status) =>
													onChange({ ...value, status: status as TaskStatus })
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Status" />
												</SelectTrigger>
												<SelectContent>
													{statusOrder.map((status) => (
														<SelectItem key={status} value={status}>
															{statusTitles[status]}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Scheduling mode
										</Label>
										<Select
											value={value.schedulingMode}
											onValueChange={(schedulingMode) =>
												onChange({
													...value,
													schedulingMode: schedulingMode as "default" | TaskSchedulingMode,
												})
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Scheduling mode" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="default">
													Use default ({schedulingModeLabels[defaultTaskSchedulingMode]})
												</SelectItem>
												{Object.entries(schedulingModeLabels).map(([mode, label]) => (
													<SelectItem key={mode} value={mode}>
														{label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
											This stores mode intent for the scheduler. Algorithms remain unchanged.
										</p>
									</div>

									<div className="h-px bg-border/30" />

									<div className="grid gap-4 md:grid-cols-[1fr_auto]">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Time needed
											</Label>
											<div className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-7"
													onClick={() => bumpEstimatedMinutes(-15)}
												>
													<ArrowDown className="size-3.5" />
												</Button>
												<Input
													type="text"
													inputMode="text"
													value={value.estimatedMinutes}
													onChange={(event) =>
														onChange({ ...value, estimatedMinutes: event.target.value })
													}
													className="h-9 border-0 shadow-none focus-visible:ring-0"
												/>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-7"
													onClick={() => bumpEstimatedMinutes(15)}
												>
													<ArrowUp className="size-3.5" />
												</Button>
											</div>
										</div>
										<div className="flex items-end">
											<div className="flex items-center gap-2 rounded-lg border border-border/40 px-3.5 py-3">
												<Switch
													checked={value.splitAllowed}
													onCheckedChange={(splitAllowed) => onChange({ ...value, splitAllowed })}
												/>
												<Label className="font-[family-name:var(--font-outfit)] text-[0.82rem]">
													Split up
												</Label>
											</div>
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Min chunk
											</Label>
											<DurationInput
												value={value.minChunkMinutes}
												onChange={(minChunkMinutes) => onChange({ ...value, minChunkMinutes })}
												className={cn(!value.splitAllowed && "pointer-events-none opacity-60")}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Max chunk
											</Label>
											<DurationInput
												value={value.maxChunkMinutes}
												onChange={(maxChunkMinutes) => onChange({ ...value, maxChunkMinutes })}
												className={cn(!value.splitAllowed && "pointer-events-none opacity-60")}
											/>
										</div>
									</div>
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Rest time
											</Label>
											<DurationInput
												value={value.restMinutes}
												onChange={(restMinutes) => onChange({ ...value, restMinutes })}
												allowZero
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Travel duration (each side)
											</Label>
											<DurationInput
												value={value.travelMinutes}
												onChange={(travelMinutes) => onChange({ ...value, travelMinutes })}
												allowZero
											/>
											<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
												Adds before/after travel blocks around each scheduled task block.
											</p>
										</div>
									</div>

									<div className="h-px bg-border/30" />

									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Schedule after
											</Label>
											<DateTimePicker
												value={value.scheduleAfter}
												onChange={(scheduleAfter) => onChange({ ...value, scheduleAfter })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Due date
											</Label>
											<DateTimePicker
												value={value.deadline}
												onChange={(deadline) => onChange({ ...value, deadline })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
									</div>

									<div className="flex items-center justify-between rounded-lg border border-border/40 px-3.5 py-3">
										<div>
											<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-medium">
												Send to Up Next
											</p>
											<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
												Push this task to queued immediately.
											</p>
										</div>
										<Switch
											checked={value.sendToUpNext}
											onCheckedChange={(sendToUpNext) => onChange({ ...value, sendToUpNext })}
										/>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* ── Section 3: Visibility ── */}
							<AccordionItem
								value="visibility"
								className="mt-4 rounded-xl border border-border/50 px-5"
							>
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											03 / Visibility
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											Visibility
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Calendar privacy and event visibility
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-3 pb-5">
									<RadioGroup
										value={value.visibilityPreference}
										onValueChange={(visibilityPreference) =>
											onChange({
												...value,
												visibilityPreference: visibilityPreference as TaskVisibilityPreference,
											})
										}
										className="rounded-lg border border-border/40"
									>
										{Object.entries(visibilityLabels).map(([key, label]) => (
											<div
												key={key}
												className={cn(
													"flex cursor-pointer items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0",
													value.visibilityPreference === key && "bg-muted/40",
												)}
											>
												<RadioGroupItem id={`visibility-${key}`} value={key} />
												<div>
													<Label
														htmlFor={`visibility-${key}`}
														className="cursor-pointer font-[family-name:var(--font-outfit)] text-[0.82rem]"
													>
														{label}
													</Label>
													<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
														{key === "private"
															? "Task events are marked private and busy."
															: "Task events follow the calendar's default privacy settings."}
													</p>
												</div>
											</div>
										))}
									</RadioGroup>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					) : null}
				</div>

				{/* ── Footer ── */}
				<DialogFooter>
					{compactCreate ? (
						<Button
							variant="ghost"
							onClick={() => setShowAdvanced((current) => !current)}
							disabled={busy}
							className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium tracking-[0.02em] text-muted-foreground hover:text-foreground"
						>
							{showAdvanced ? "Back to quick form" : "Show advanced fields"}
						</Button>
					) : null}
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={busy}
						className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium tracking-[0.02em] text-muted-foreground hover:text-foreground"
					>
						Cancel
					</Button>
					<Button
						onClick={onSubmit}
						disabled={busy}
						className="gap-2 bg-accent font-[family-name:var(--font-outfit)] text-[0.76rem] font-bold uppercase tracking-[0.1em] text-accent-foreground shadow-[0_2px_12px_-3px_rgba(252,163,17,0.3)] transition-all hover:bg-accent/90 hover:shadow-[0_4px_16px_-3px_rgba(252,163,17,0.4)]"
					>
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
