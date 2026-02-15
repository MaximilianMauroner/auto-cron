"use client";

import {
	type AsideOccurrenceItem,
	AsideOccurrenceList,
	ChangeLogDialog,
	useOccurrencePagination,
} from "@/components/aside-panel/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useUserPreferences } from "@/components/user-preferences-context";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels } from "@/lib/scheduling-constants";
import { cn } from "@/lib/utils";
import { CircleCheck, Clock3, History, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsideContent } from "./aside-content-context";

const formatDate = (timestamp?: number) =>
	timestamp
		? new Intl.DateTimeFormat(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "numeric",
				minute: "2-digit",
			}).format(new Date(timestamp))
		: "Anytime";

export function TaskDetailView({ taskId }: { taskId: string }) {
	const { hour12 } = useUserPreferences();
	const { goBack, openTask, openEvent } = useAsideContent();
	const [changeLogTarget, setChangeLogTarget] = useState<{
		entityType: "task" | "habit" | "event" | "occurrence";
		entityId: string;
		title?: string;
	} | null>(null);
	const taskQuery = useAuthenticatedQueryWithStatus(api.tasks.queries.getTask, {
		id: taskId as Id<"tasks">,
	});
	const task = taskQuery.data;
	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const taskEventsQuery = useAuthenticatedQueryWithStatus(api.calendar.queries.listTaskEvents, {
		taskId,
	});
	const { mutate: updateTask } = useMutationWithStatus(api.tasks.mutations.updateTask);

	const upcoming = useOccurrencePagination<AsideOccurrenceItem>({
		queryRef: api.calendar.queries.listTaskOccurrencesPage,
		args: { taskId: taskId as Id<"tasks"> },
		bucket: "upcoming",
		enabled: Boolean(task),
	});
	const past = useOccurrencePagination<AsideOccurrenceItem>({
		queryRef: api.calendar.queries.listTaskOccurrencesPage,
		args: { taskId: taskId as Id<"tasks"> },
		bucket: "past",
		enabled: Boolean(task),
	});

	if (taskQuery.isPending) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Loading task...
			</div>
		);
	}

	if (!task) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Task not found.
			</div>
		);
	}

	const hoursSetName = hoursSetsQuery.data?.find((entry) => entry._id === task.hoursSetId)?.name;
	const scheduledMinutes = (taskEventsQuery.data ?? []).reduce(
		(total, event) => total + Math.max(0, (event.end - event.start) / 60_000),
		0,
	);
	const remainingMinutes = Math.max(0, task.estimatedMinutes - Math.round(scheduledMinutes));
	const progressPercent =
		task.estimatedMinutes > 0
			? Math.max(
					0,
					Math.min(
						100,
						Math.round(((task.estimatedMinutes - remainingMinutes) / task.estimatedMinutes) * 100),
					),
				)
			: 0;

	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 border-b border-border/60 px-4 py-3">
				<div className="flex items-center justify-between gap-2">
					<Button variant="ghost" size="sm" className="h-8 text-[0.74rem]" onClick={goBack}>
						Back
					</Button>
					<div className="flex items-center gap-1.5">
						<Button
							variant="outline"
							size="sm"
							className={cn(
								"h-8 w-8 p-0 transition-colors",
								task.status === "done"
									? "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
									: "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
							)}
							onClick={() =>
								updateTask({
									id: task._id as Id<"tasks">,
									patch: { status: task.status === "done" ? "backlog" : "done" },
								})
							}
							aria-label={task.status === "done" ? "Move to backlog" : "Complete task"}
							title={task.status === "done" ? "Move to backlog" : "Complete task"}
						>
							{task.status === "done" ? (
								<RotateCcw className="size-3.5" />
							) : (
								<CircleCheck className="size-3.5" />
							)}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1 text-[0.74rem]"
							onClick={() =>
								setChangeLogTarget({
									entityType: "task",
									entityId: task._id,
									title: task.title,
								})
							}
						>
							<History className="size-3.5" />
							Log
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1 text-[0.74rem]"
							onClick={() => openTask(task._id, "edit", { replace: true })}
						>
							<Pencil className="size-3.5" />
							Edit
						</Button>
					</div>
				</div>
				<div className="mt-3 flex items-start gap-2.5">
					<span
						className="mt-1.5 size-2 shrink-0 rounded-full"
						style={{ backgroundColor: task.effectiveColor ?? task.color ?? "#f59e0b" }}
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate font-[family-name:var(--font-outfit)] text-[1.05rem] font-semibold leading-tight">
							{task.title}
						</p>
						<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
							<Badge
								className={`${priorityClass[task.priority]} px-1.5 py-0 text-[0.6rem] font-[family-name:var(--font-cutive)]`}
							>
								{priorityLabels[task.priority]}
							</Badge>
							<Badge variant="outline" className="text-[0.6rem]">
								{task.status}
							</Badge>
						</div>
						<div className="mt-2.5">
							<div className="mb-1.5 flex items-center justify-between text-[0.7rem] text-muted-foreground">
								<span>Scheduled progress</span>
								<span>{progressPercent}%</span>
							</div>
							<Progress value={progressPercent} className="h-2 w-full" />
						</div>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
				<div className="space-y-4">
					<div className="rounded-2xl border border-border/60 bg-card/65 p-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Duration
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">
									{formatDurationCompact(task.estimatedMinutes)}
								</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Remaining
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">
									{formatDurationCompact(remainingMinutes)}
								</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Hours
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">{hoursSetName ?? "Default"}</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Next block
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">{formatDate(task.scheduledStart)}</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Schedule after
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">{formatDate(task.scheduleAfter)}</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Due
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">{formatDate(task.deadline)}</p>
							</div>
						</div>
						<div className="mt-4 border-t border-border/50 pt-3.5">
							<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
								Quick controls
							</p>
							<div className="mt-2.5">
								<Select
									value={task.priority}
									onValueChange={(priority) =>
										updateTask({
											id: task._id as Id<"tasks">,
											patch: { priority: priority as (typeof task)["priority"] },
										})
									}
								>
									<SelectTrigger className="h-11 w-full">
										<SelectValue placeholder="Priority" />
									</SelectTrigger>
									<SelectContent>
										{(Object.keys(priorityLabels) as Array<keyof typeof priorityLabels>).map(
											(priority) => (
												<SelectItem key={priority} value={priority}>
													{priorityLabels[priority]}
												</SelectItem>
											),
										)}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="mt-4 border-t border-border/50 pt-3.5">
							<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
								Notes
							</p>
							<p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-foreground">
								{task.description || "No notes"}
							</p>
						</div>
						<div className="mt-3 border-t border-border/40 pt-3 text-[0.74rem] text-muted-foreground">
							<div className="flex items-center gap-1.5">
								<Clock3 className="size-3.5" />
								Visibility: {task.visibilityPreference}
							</div>
						</div>
					</div>

					<AsideOccurrenceList
						title="Upcoming"
						items={upcoming.items}
						hour12={hour12}
						isLoading={upcoming.isPending}
						hasMore={upcoming.hasMore}
						onLoadMore={upcoming.loadMore}
						onOpenOccurrenceDetails={(eventId) => openEvent(eventId, "details")}
						allowFollowingEdit={false}
						onViewChangeLog={(eventId) =>
							setChangeLogTarget({
								entityType: "event",
								entityId: eventId,
								title: "Occurrence event",
							})
						}
					/>
					<AsideOccurrenceList
						title="Past"
						items={past.items}
						hour12={hour12}
						isLoading={past.isPending}
						hasMore={past.hasMore}
						onLoadMore={past.loadMore}
						onOpenOccurrenceDetails={(eventId) => openEvent(eventId, "details")}
						allowFollowingEdit={false}
						onViewChangeLog={(eventId) =>
							setChangeLogTarget({
								entityType: "event",
								entityId: eventId,
								title: "Occurrence event",
							})
						}
					/>
				</div>
			</div>
			<ChangeLogDialog
				open={Boolean(changeLogTarget)}
				onOpenChange={(open) => {
					if (!open) setChangeLogTarget(null);
				}}
				target={changeLogTarget}
			/>
		</div>
	);
}
