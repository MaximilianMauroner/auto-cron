"use client";

import { CategoryPicker } from "@/components/category-picker";
import { Button } from "@/components/ui/button";
import { ColorPaletteDropdown } from "@/components/ui/color-palette";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DurationInput } from "@/components/ui/duration-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import {
	formatDurationCompact,
	formatDurationFromMinutes,
	parseDurationToMinutes,
} from "@/lib/duration";
import { priorityLabels, statusLabels } from "@/lib/scheduling-constants";
import type { CalendarEventDTO, Priority, TaskStatus } from "@auto-cron/types";
import { MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const toTimestamp = (value: string) => {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

const toDateTimeLocal = (timestamp: number | undefined) => {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type TaskEditSheetProps = {
	taskId: string | null;
	onOpenChange: (open: boolean) => void;
};

export function TaskEditSheet({ taskId, onOpenChange }: TaskEditSheetProps) {
	const open = taskId !== null;

	const taskQuery = useAuthenticatedQueryWithStatus(
		api.tasks.queries.getTask,
		taskId ? { id: taskId as Id<"tasks"> } : "skip",
	);
	const task = taskQuery.data ?? null;

	const eventsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listTaskEvents,
		taskId ? { taskId } : "skip",
	);
	const events = (eventsQuery.data ?? []) as CalendarEventDTO[];

	const { mutate: updateTask, status: updateStatus } = useMutationWithStatus(
		api.tasks.mutations.updateTask,
	);
	const { mutate: deleteTask } = useMutationWithStatus(api.tasks.mutations.deleteTask);
	const { mutate: pinAllTaskEvents } = useMutationWithStatus(
		api.calendar.mutations.pinAllTaskEvents,
	);

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState<Priority>("medium");
	const [status, setStatus] = useState<TaskStatus>("backlog");
	const [estimatedMinutes, setEstimatedMinutes] = useState("");
	const [deadline, setDeadline] = useState("");
	const [scheduleAfter, setScheduleAfter] = useState("");
	const [location, setLocation] = useState("");
	const [color, setColor] = useState("#f59e0b");
	const [categoryId, setCategoryId] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		if (!task) return;
		setTitle(task.title);
		setDescription(task.description ?? "");
		setPriority(task.priority);
		setStatus(task.status);
		setEstimatedMinutes(formatDurationFromMinutes(task.estimatedMinutes));
		setDeadline(toDateTimeLocal(task.deadline));
		setScheduleAfter(toDateTimeLocal(task.scheduleAfter));
		setLocation(task.location ?? "");
		setColor(task.color ?? "#f59e0b");
		setCategoryId(task.categoryId ?? "");
		setErrorMessage(null);
	}, [task]);

	const { pinnedCount, totalEvents, scheduledMinutes } = useMemo(() => {
		const taskEvents = events.filter(
			(e) => e.source === "task" && !e.sourceId?.includes(":travel:"),
		);
		const pinned = taskEvents.filter((e) => e.pinned === true);
		const scheduled = Math.round(
			taskEvents.reduce((sum, e) => sum + (e.end - e.start) / 60_000, 0),
		);
		return {
			pinnedCount: pinned.length,
			totalEvents: taskEvents.length,
			scheduledMinutes: scheduled,
		};
	}, [events]);

	const onSave = async () => {
		if (!task) return;
		const parsed = parseDurationToMinutes(estimatedMinutes);
		if (!title.trim() || parsed === null || parsed <= 0) {
			setErrorMessage("Please provide a title and valid estimated duration.");
			return;
		}
		setErrorMessage(null);
		try {
			await updateTask({
				id: task._id as Id<"tasks">,
				patch: {
					title: title.trim(),
					description: description.trim() || null,
					priority,
					status,
					estimatedMinutes: parsed,
					deadline: toTimestamp(deadline) ?? null,
					scheduleAfter: toTimestamp(scheduleAfter) ?? null,
					location: location.trim() || null,
					color: color || null,
					...(categoryId ? { categoryId: categoryId as Id<"taskCategories"> } : {}),
				},
			});
			onOpenChange(false);
		} catch {
			setErrorMessage("Could not update task.");
		}
	};

	const onDelete = async () => {
		if (!task) return;
		try {
			await deleteTask({ id: task._id as Id<"tasks"> });
			onOpenChange(false);
		} catch {
			setErrorMessage("Could not delete task.");
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-80 p-0 sm:max-w-md" showCloseButton={false}>
				{/* ── Header ── */}
				<SheetHeader className="border-b border-border/60 px-6 py-5">
					<div className="flex items-center gap-2.5">
						<span
							className="size-2.5 rounded-full ring-2 ring-offset-1 ring-offset-background"
							style={{
								backgroundColor: color,
								boxShadow: `0 0 8px ${color}30`,
								// biome-ignore lint/suspicious/noExplicitAny: ring color via style
								["--tw-ring-color" as any]: `${color}40`,
							}}
						/>
						<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							Edit task
						</p>
					</div>
					<SheetTitle className="mt-1 font-[family-name:var(--font-outfit)] text-xl font-semibold tracking-tight">
						{task?.title || "Task details"}
					</SheetTitle>
				</SheetHeader>

				{task ? (
					<>
						<div className="max-h-[calc(100dvh-160px)] overflow-y-auto px-6">
							{/* ── Section 1: Identity ── */}
							<div className="space-y-3 py-5">
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
									Identity
								</p>
								<div className="space-y-1.5">
									<Label
										htmlFor="task-edit-title"
										className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
									>
										Title
									</Label>
									<Input
										id="task-edit-title"
										value={title}
										onChange={(e) => {
											setTitle(e.target.value);
											if (errorMessage) setErrorMessage(null);
										}}
										placeholder="Task name"
										className="border-0 border-b border-border/50 bg-transparent px-0 font-[family-name:var(--font-outfit)] text-[0.9rem] font-medium shadow-none ring-0 transition-colors placeholder:text-muted-foreground/40 focus-visible:border-accent focus-visible:ring-0"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Description
									</Label>
									<Textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Optional description"
										rows={3}
										className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
									/>
								</div>
							</div>

							<div className="h-px bg-border/40" />

							{/* ── Section 2: Classification ── */}
							<div className="space-y-3 py-5">
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
									Classification
								</p>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Status
										</Label>
										<Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(["backlog", "queued", "scheduled", "in_progress", "done"] as const).map(
													(s) => (
														<SelectItem key={s} value={s}>
															{statusLabels[s]}
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Priority
										</Label>
										<Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(["low", "medium", "high", "critical", "blocker"] as const).map((p) => (
													<SelectItem key={p} value={p}>
														{priorityLabels[p]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Category
										</Label>
										<CategoryPicker value={categoryId} onValueChange={setCategoryId} />
									</div>
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Color
										</Label>
										<ColorPaletteDropdown value={color} onChange={setColor} />
									</div>
								</div>
							</div>

							<div className="h-px bg-border/40" />

							{/* ── Section 3: Timing ── */}
							<div className="space-y-3 py-5">
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
									Timing
								</p>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Duration
										</Label>
										<DurationInput
											value={estimatedMinutes}
											onChange={setEstimatedMinutes}
											placeholder="e.g. 30m"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Location
										</Label>
										<Input
											value={location}
											onChange={(e) => setLocation(e.target.value)}
											placeholder="Optional"
											className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
										/>
									</div>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Deadline
									</Label>
									<DateTimePicker value={deadline} onChange={setDeadline} placeholder="None" />
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Schedule after
									</Label>
									<DateTimePicker
										value={scheduleAfter}
										onChange={setScheduleAfter}
										placeholder="No constraint"
									/>
								</div>
							</div>

							<div className="h-px bg-border/40" />

							{/* ── Section 4: Schedule ── */}
							{(() => {
								const total = task.estimatedMinutes;
								const remaining = Math.max(0, total - scheduledMinutes);
								const percent =
									total > 0 ? Math.min(100, Math.round((scheduledMinutes / total) * 100)) : 0;
								return (
									<div className="space-y-3 py-5">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											Schedule
										</p>
										<div className="space-y-3 rounded-lg border border-border/50 bg-card/50 px-3.5 py-3">
											{/* Progress */}
											<div>
												<div className="flex items-center justify-between">
													<span className="font-[family-name:var(--font-cutive)] text-[0.66rem] text-muted-foreground">
														{formatDurationCompact(scheduledMinutes)} /{" "}
														{formatDurationCompact(total)}
													</span>
													<span className="font-[family-name:var(--font-cutive)] text-[0.62rem] text-muted-foreground/80">
														{remaining > 0
															? `${formatDurationCompact(remaining)} left`
															: "Fully scheduled"}
													</span>
												</div>
												<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
													<div
														className="h-full rounded-full transition-all duration-500 ease-out"
														style={{
															width: `${percent}%`,
															backgroundColor: color || undefined,
															opacity: 0.75,
														}}
													/>
												</div>
											</div>

											{/* Pin controls */}
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													{pinnedCount > 0 ? (
														<Pin className="size-3 text-accent" />
													) : (
														<PinOff className="size-3 text-muted-foreground/50" />
													)}
													<span className="font-[family-name:var(--font-cutive)] text-[0.62rem] text-muted-foreground">
														{totalEvents === 0
															? "No events"
															: `${pinnedCount}/${totalEvents} pinned`}
													</span>
												</div>
												{totalEvents > 0 ? (
													<div className="flex gap-1">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-6 gap-1 px-2 font-[family-name:var(--font-cutive)] text-[0.58rem] uppercase tracking-[0.05em]"
															onClick={() =>
																void pinAllTaskEvents({
																	taskId: task._id,
																	pinned: true,
																})
															}
															disabled={pinnedCount === totalEvents}
														>
															<Pin className="size-2.5" />
															Pin
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-6 gap-1 px-2 font-[family-name:var(--font-cutive)] text-[0.58rem] uppercase tracking-[0.05em]"
															onClick={() =>
																void pinAllTaskEvents({
																	taskId: task._id,
																	pinned: false,
																})
															}
															disabled={pinnedCount === 0}
														>
															<PinOff className="size-2.5" />
															Unpin
														</Button>
													</div>
												) : null}
											</div>
										</div>
									</div>
								);
							})()}

							{/* ── Error ── */}
							{errorMessage ? (
								<div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
									<p className="font-[family-name:var(--font-cutive)] text-[0.66rem] uppercase tracking-[0.05em] text-destructive">
										{errorMessage}
									</p>
								</div>
							) : null}
						</div>

						{/* ── Footer ── */}
						<SheetFooter className="flex-row items-center border-t border-border/60 px-6 py-4">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="mr-auto size-8 text-muted-foreground/80 hover:text-foreground"
									>
										<MoreVertical className="size-4" />
										<span className="sr-only">More actions</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem
										variant="destructive"
										onClick={() => void onDelete()}
										className="gap-2 font-[family-name:var(--font-outfit)] text-[0.76rem]"
									>
										<Trash2 className="size-3.5" />
										Delete task
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<Button
								type="button"
								variant="ghost"
								onClick={() => onOpenChange(false)}
								className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium tracking-[0.02em] text-muted-foreground hover:text-foreground"
							>
								Cancel
							</Button>
							<Button
								onClick={() => void onSave()}
								disabled={updateStatus === "pending"}
								className="gap-2 bg-accent font-[family-name:var(--font-outfit)] text-[0.76rem] font-bold uppercase tracking-[0.1em] text-accent-foreground shadow-[0_2px_12px_-3px_rgba(252,163,17,0.3)] transition-all hover:bg-accent/90 hover:shadow-[0_4px_16px_-3px_rgba(252,163,17,0.4)]"
							>
								{updateStatus === "pending" ? "Saving…" : "Save"}
							</Button>
						</SheetFooter>
					</>
				) : (
					<div className="flex flex-col items-center justify-center gap-2 p-12">
						<p className="font-[family-name:var(--font-outfit)] text-sm text-muted-foreground">
							{taskQuery.isPending ? "Loading…" : "Task not found."}
						</p>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
