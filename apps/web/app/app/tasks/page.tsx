"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUserPreferences } from "@/components/user-preferences-context";
import {
	useActionWithStatus,
	useAuthenticatedQueryWithStatus,
	useMutationWithStatus,
} from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type {
	HoursSetDTO,
	Priority,
	TaskDTO,
	TaskSchedulingMode,
	TaskStatus,
	TaskVisibilityPreference,
} from "@auto-cron/types";
import {
	ArrowDown,
	ArrowUp,
	CheckCircle2,
	Clock3,
	Plus,
	Rocket,
	Target,
	TrendingUp,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useState } from "react";
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

const taskColors = [
	"#f59e0b",
	"#ef4444",
	"#22c55e",
	"#0ea5e9",
	"#6366f1",
	"#a855f7",
	"#ec4899",
	"#14b8a6",
] as const;

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
}: {
	defaults: TaskQuickCreateDefaults;
	defaultHoursSetId: string;
	defaultCalendarId: string;
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

	const openCreate = () => {
		setCreateForm(
			createTaskEditorState({
				defaults: taskQuickCreateDefaults,
				defaultHoursSetId,
				defaultCalendarId,
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
		};

		setErrorMessage(null);
		try {
			await createTask({ requestId: createRequestId(), input: payload });
			setCreateForm(
				createTaskEditorState({
					defaults: taskQuickCreateDefaults,
					defaultHoursSetId,
					defaultCalendarId,
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
		});
		setIsEditOpen(true);
	};

	return (
		<div className="h-full min-h-0 overflow-auto p-4 md:p-6 lg:p-8">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
				<div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
					<Card className="border-border/60 bg-card/70">
						<CardHeader className="pb-2">
							<CardDescription className="text-xs uppercase tracking-[0.14em]">
								Task Engine
							</CardDescription>
							<CardTitle className="flex items-center gap-2 text-xl">
								<Target className="size-5 text-primary" />
								Tasks
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<p className="max-w-xl text-sm text-muted-foreground">
								Plan what matters, queue next execution, and keep scheduling unlimited on all plans.
								Only creation is plan-metered.
							</p>
							<Button
								onClick={openCreate}
								disabled={busy}
								className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_2px_8px_-2px_rgba(252,163,17,0.2)]"
							>
								<Plus className="size-4" />
								New task
							</Button>
						</CardContent>
					</Card>

					<Card className="border-border/60 bg-card/70">
						<CardHeader className="pb-2">
							<CardDescription className="text-xs uppercase tracking-[0.14em]">
								Pulse
							</CardDescription>
							<CardTitle className="text-lg">Execution Overview</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-2.5 text-sm">
							<MetricTile label="Total" value={tasks.length} icon={Rocket} />
							<MetricTile label="Active" value={activeCount} icon={TrendingUp} />
							<MetricTile label="Done" value={completedCount} icon={CheckCircle2} />
							<MetricTile label="Complete" value={`${completionRate}%`} icon={Target} />
						</CardContent>
					</Card>
				</div>

				{errorMessage ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
						{errorMessage}
					</div>
				) : null}

				{tasksQuery.isPending ? (
					<div className="grid gap-4 md:grid-cols-2">
						{["task-skeleton-left", "task-skeleton-right"].map((key) => (
							<Card key={key} className="h-80 animate-pulse bg-muted/30" />
						))}
					</div>
				) : tasks.length === 0 ? (
					<Empty className="border-border/70 bg-card/40">
						<EmptyHeader>
							<EmptyTitle>No tasks yet</EmptyTitle>
							<EmptyDescription>
								Create your first task and move it from backlog into execution.
							</EmptyDescription>
						</EmptyHeader>
						<Button onClick={openCreate} className="gap-1.5">
							<Plus className="size-4" />
							Create task
						</Button>
					</Empty>
				) : (
					<div className="grid min-h-[58vh] gap-4 lg:grid-cols-[0.95fr_1.45fr]">
						<Card className="border-border/70 bg-card/70">
							<CardHeader className="pb-2">
								<CardDescription className="text-xs uppercase tracking-[0.14em]">
									Backlog
								</CardDescription>
								<CardTitle className="flex items-center justify-between text-base">
									<span>{statusTitles.backlog}</span>
									<Badge variant="secondary">{tasksByStatus.backlog.length}</Badge>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
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
							</CardContent>
						</Card>

						<Card className="border-border/70 bg-card/70">
							<CardHeader className="pb-2">
								<CardDescription className="text-xs uppercase tracking-[0.14em]">
									Execution lanes
								</CardDescription>
								<CardTitle className="flex items-center justify-between text-base">
									<span>Execution lanes</span>
									<Badge variant="secondary">{activeCount + completedCount}</Badge>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{rightLaneColumns.map((column) => (
									<div key={column.key} className="space-y-2">
										<div className="flex items-center justify-between">
											<div className="text-sm font-medium">{column.title}</div>
											<Badge variant="outline">{tasksByStatus[column.key].length}</Badge>
										</div>
										<Separator />
										<div className="space-y-2">
											{tasksByStatus[column.key].length === 0 ? (
												<p className="text-sm text-muted-foreground">{column.empty}</p>
											) : (
												tasksByStatus[column.key].map((task) => (
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
								))}
							</CardContent>
						</Card>
					</div>
				)}
			</div>

			<TaskDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				title="Create task"
				compactCreate
				value={createForm}
				onChange={setCreateForm}
				onSubmit={onCreateTask}
				submitLabel={isCreatingTask ? "Creating..." : "Create task"}
				busy={busy}
				calendars={editableGoogleCalendars}
				hoursSets={hoursSets}
				defaultTaskSchedulingMode={defaultTaskSchedulingMode}
			/>

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

function MetricTile({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string | number;
	icon: ComponentType<{ className?: string }>;
}) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/50 p-3 transition-colors hover:border-primary/30">
			<div className="flex items-center justify-between text-muted-foreground">
				<span className="text-xs uppercase tracking-[0.08em]">{label}</span>
				<Icon className="size-3.5" />
			</div>
			<div className="mt-1.5 text-xl font-semibold">{value}</div>
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
		<div className="rounded-lg border border-border/70 bg-background/70 p-3 shadow-sm transition-colors hover:bg-background/95">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1.5">
					<p className="truncate text-sm font-semibold inline-flex items-center gap-2">
						<span
							className="size-2.5 rounded-full border border-border/60"
							style={{ backgroundColor: task.color ?? "#f59e0b" }}
						/>
						{task.title}
					</p>
					<p className="line-clamp-2 text-xs text-muted-foreground">
						{task.description || "No description"}
					</p>
				</div>
				<Badge className={priorityClass[task.priority]}>{task.priority}</Badge>
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5">
					<Clock3 className="size-3" />
					{task.estimatedMinutes}m
				</span>
				<span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5">
					<CheckCircle2 className="size-3" />
					{readableDeadline(task.deadline, hour12)}
				</span>
				{task.splitAllowed ? (
					<span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5">
						Split {task.minChunkMinutes ?? 30}-{task.maxChunkMinutes ?? 180}m
					</span>
				) : null}
				{task.location ? (
					<span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5">
						At {task.location}
					</span>
				) : null}
				<span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5">
					Mode{" "}
					{schedulingModeLabels[task.effectiveSchedulingMode ?? task.schedulingMode ?? "fastest"]}
				</span>
				{task.visibilityPreference ? (
					<span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5">
						{visibilityLabels[task.visibilityPreference]}
					</span>
				) : null}
			</div>
			<div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
				<Select value={task.status} onValueChange={(value) => onMove(value as TaskStatus)}>
					<SelectTrigger className="h-8">
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
						variant="outline"
						className="size-8"
						disabled={isBusy}
						onClick={() => onReorder(-1)}
					>
						<ArrowUp className="size-3.5" />
					</Button>
					<Button
						size="icon"
						variant="outline"
						className="size-8"
						disabled={isBusy}
						onClick={() => onReorder(1)}
					>
						<ArrowDown className="size-3.5" />
					</Button>
				</div>
			</div>
			<div className="mt-2 flex items-center justify-end gap-1">
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
					className="h-7 px-2 text-xs text-rose-600 hover:text-rose-600"
				>
					Delete
				</Button>
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
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Rocket className="size-4 text-primary" />
						{title}
					</DialogTitle>
				</DialogHeader>
				<div className="max-h-[70vh] overflow-y-auto pr-1">
					{compactCreate && !showAdvanced ? (
						<div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
							<div className="space-y-2">
								<Label htmlFor="quick-task-name">Task name</Label>
								<Input
									id="quick-task-name"
									placeholder="What needs to get done?"
									value={value.title}
									onChange={(event) => onChange({ ...value, title: event.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="quick-task-location">Location (optional)</Label>
								<Input
									id="quick-task-location"
									placeholder="Office, gym, client site..."
									value={value.location}
									onChange={(event) => onChange({ ...value, location: event.target.value })}
								/>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Time needed</Label>
									<DurationInput
										value={value.estimatedMinutes}
										onChange={(estimatedMinutes) => onChange({ ...value, estimatedMinutes })}
									/>
								</div>
								<div className="space-y-2">
									<Label>Due date</Label>
									<DateTimePicker
										value={value.deadline}
										onChange={(deadline) => onChange({ ...value, deadline })}
										placeholder="Anytime"
										minuteStep={15}
									/>
								</div>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Priority</Label>
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
								<div className="flex items-end">
									<div className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2">
										<div>
											<p className="text-sm font-medium">Send to Up Next</p>
											<p className="text-xs text-muted-foreground">Queue it immediately.</p>
										</div>
										<Switch
											checked={value.sendToUpNext}
											onCheckedChange={(sendToUpNext) => onChange({ ...value, sendToUpNext })}
										/>
									</div>
								</div>
							</div>

							<p className="text-xs text-muted-foreground">
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
						<Accordion
							type="multiple"
							defaultValue={compactCreate ? ["general"] : ["general", "scheduling", "visibility"]}
						>
							<AccordionItem value="general">
								<AccordionTrigger>General details</AccordionTrigger>
								<AccordionContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="task-name">Task name</Label>
										<Input
											id="task-name"
											placeholder="Task name..."
											value={value.title}
											onChange={(event) => onChange({ ...value, title: event.target.value })}
										/>
									</div>
									<div className="grid gap-3 md:grid-cols-3">
										<div className="space-y-2">
											<Label>Color</Label>
											<div className="flex flex-wrap gap-2 rounded-lg border border-border p-2">
												{taskColors.map((color) => (
													<button
														key={color}
														type="button"
														onClick={() => onChange({ ...value, color })}
														className={cn(
															"size-6 rounded-full border transition-transform hover:scale-105",
															value.color === color
																? "border-foreground ring-2 ring-foreground/20"
																: "border-border",
														)}
														style={{ backgroundColor: color }}
														aria-label={`Select ${color}`}
													/>
												))}
											</div>
										</div>
										<div className="space-y-2">
											<Label>Hours</Label>
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
										<div className="space-y-2">
											<Label>Calendar</Label>
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
									<div className="space-y-2">
										<Label htmlFor="task-notes">Notes</Label>
										<Textarea
											id="task-notes"
											placeholder="Add notes here..."
											value={value.description}
											onChange={(event) => onChange({ ...value, description: event.target.value })}
											className="min-h-24"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="task-location">Location</Label>
										<Input
											id="task-location"
											placeholder="Office, gym, client site..."
											value={value.location}
											onChange={(event) => onChange({ ...value, location: event.target.value })}
										/>
										<p className="text-xs text-muted-foreground">
											If set, scheduler can add travel events before and after this task.
										</p>
									</div>
								</AccordionContent>
							</AccordionItem>

							<AccordionItem value="scheduling">
								<AccordionTrigger>Scheduling</AccordionTrigger>
								<AccordionContent className="space-y-4">
									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Priority</Label>
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
										<div className="space-y-2">
											<Label>Status</Label>
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

									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Scheduling mode</Label>
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
											<p className="text-xs text-muted-foreground">
												This stores mode intent for the scheduler. Algorithms remain unchanged.
											</p>
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-[1fr_auto]">
										<div className="space-y-2">
											<Label>Time needed</Label>
											<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
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
											<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
												<Switch
													checked={value.splitAllowed}
													onCheckedChange={(splitAllowed) => onChange({ ...value, splitAllowed })}
												/>
												<Label>Split up</Label>
											</div>
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Min duration (mins)</Label>
											<DurationInput
												value={value.minChunkMinutes}
												onChange={(minChunkMinutes) => onChange({ ...value, minChunkMinutes })}
												className={cn(!value.splitAllowed && "pointer-events-none opacity-60")}
											/>
										</div>
										<div className="space-y-2">
											<Label>Max duration (mins)</Label>
											<DurationInput
												value={value.maxChunkMinutes}
												onChange={(maxChunkMinutes) => onChange({ ...value, maxChunkMinutes })}
												className={cn(!value.splitAllowed && "pointer-events-none opacity-60")}
											/>
										</div>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Rest time</Label>
											<DurationInput
												value={value.restMinutes}
												onChange={(restMinutes) => onChange({ ...value, restMinutes })}
											/>
										</div>
										<div className="space-y-2">
											<Label>Travel duration (each side)</Label>
											<DurationInput
												value={value.travelMinutes}
												onChange={(travelMinutes) => onChange({ ...value, travelMinutes })}
												className={cn(!value.location.trim() && "pointer-events-none opacity-60")}
											/>
											<p className="text-xs text-muted-foreground">
												Used only when location is set.
											</p>
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Schedule after</Label>
											<DateTimePicker
												value={value.scheduleAfter}
												onChange={(scheduleAfter) => onChange({ ...value, scheduleAfter })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
										<div className="space-y-2">
											<Label>Due date</Label>
											<DateTimePicker
												value={value.deadline}
												onChange={(deadline) => onChange({ ...value, deadline })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
									</div>

									<div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
										<div>
											<p className="text-sm font-medium">Send to Up Next</p>
											<p className="text-xs text-muted-foreground">
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

							<AccordionItem value="visibility">
								<AccordionTrigger>Visibility</AccordionTrigger>
								<AccordionContent className="space-y-3">
									<RadioGroup
										value={value.visibilityPreference}
										onValueChange={(visibilityPreference) =>
											onChange({
												...value,
												visibilityPreference: visibilityPreference as TaskVisibilityPreference,
											})
										}
										className="space-y-2"
									>
										{Object.entries(visibilityLabels).map(([key, label]) => (
											<label
												key={key}
												htmlFor={`visibility-${key}`}
												className={cn(
													"flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
													value.visibilityPreference === key
														? "border-primary/40 bg-primary/5"
														: "border-border",
												)}
											>
												<RadioGroupItem id={`visibility-${key}`} value={key} className="mt-1" />
												<div>
													<p className="font-medium">{label}</p>
													<p className="text-xs text-muted-foreground">
														{key === "private"
															? "Task events are marked private and busy."
															: "Task events follow the calendar's default privacy settings."}
													</p>
												</div>
											</label>
										))}
									</RadioGroup>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					) : null}
				</div>
				<DialogFooter>
					{compactCreate ? (
						<Button
							variant="ghost"
							onClick={() => setShowAdvanced((current) => !current)}
							disabled={busy}
						>
							{showAdvanced ? "Back to quick form" : "Show advanced fields"}
						</Button>
					) : null}
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
						Cancel
					</Button>
					<Button onClick={onSubmit} disabled={busy}>
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
