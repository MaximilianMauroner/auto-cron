"use client";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels, statusLabels } from "@/lib/scheduling-constants";
import type { CalendarEventDTO, TaskDTO, TaskStatus } from "@auto-cron/types";
import { Check, ChevronDown, CircleDot, Clock3, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { TaskScheduleView } from "./task-schedule-view";

type AsideTaskCardProps = {
	task: TaskDTO;
	onEditTask?: (taskId: string) => void;
};

export function AsideTaskCard({ task, onEditTask }: AsideTaskCardProps) {
	const [isOpen, setIsOpen] = useState(false);

	const eventsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listTaskEvents,
		isOpen ? { taskId: task._id } : "skip",
	);
	const events = (eventsQuery.data ?? []) as CalendarEventDTO[];

	const { mutate: updateTask } = useMutationWithStatus(api.tasks.mutations.updateTask);
	const { mutate: deleteTask } = useMutationWithStatus(api.tasks.mutations.deleteTask);
	const { mutate: pinAllTaskEvents } = useMutationWithStatus(
		api.calendar.mutations.pinAllTaskEvents,
	);

	const handleStatusChange = (newStatus: TaskStatus) => {
		void updateTask({ id: task._id as Id<"tasks">, patch: { status: newStatus } });
	};

	const hasScheduledEvents = task.scheduledStart != null && task.scheduledEnd != null;

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div>
					<Collapsible open={isOpen} onOpenChange={setIsOpen}>
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="w-full rounded-lg border border-border/60 bg-background/70 p-2.5 text-left transition-colors hover:bg-background/95 data-[state=open]:rounded-b-none data-[state=open]:border-b-0"
							>
								<div className="flex items-start gap-2">
									<span
										className="mt-1 size-2 shrink-0 rounded-full"
										style={{ backgroundColor: task.effectiveColor ?? task.color ?? "#f59e0b" }}
									/>
									<div className="min-w-0 flex-1">
										<p className="font-[family-name:var(--font-outfit)] truncate text-[0.76rem] font-medium">
											{task.title}
										</p>
										<div className="mt-1 flex items-center gap-2 font-[family-name:var(--font-cutive)] text-[0.68rem] text-muted-foreground">
											<span className="inline-flex items-center gap-0.5">
												<Clock3 className="size-3" />
												{formatDurationCompact(task.estimatedMinutes)}
											</span>
											{task.deadline ? (
												<span>
													Due{" "}
													{new Intl.DateTimeFormat(undefined, {
														month: "short",
														day: "numeric",
													}).format(new Date(task.deadline))}
												</span>
											) : null}
										</div>
									</div>
									<div className="flex items-center gap-1">
										<Badge
											className={`${priorityClass[task.priority]} font-[family-name:var(--font-cutive)] text-[0.6rem] px-1.5 py-0`}
										>
											{priorityLabels[task.priority]}
										</Badge>
										<ChevronDown
											className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
										/>
									</div>
								</div>
							</button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="rounded-b-lg border border-t-0 border-border/60 bg-background/70 px-2.5 pb-2.5">
								<TaskScheduleView
									events={events}
									isLoading={eventsQuery.isPending}
									estimatedMinutes={task.estimatedMinutes}
								/>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				{onEditTask ? (
					<ContextMenuItem onClick={() => onEditTask(task._id)}>
						<Pencil className="mr-2 size-4" />
						Edit
					</ContextMenuItem>
				) : null}
				<ContextMenuItem
					onClick={() => handleStatusChange("done")}
					disabled={task.status === "done"}
				>
					<Check className="mr-2 size-4" />
					Mark as done
				</ContextMenuItem>
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<CircleDot className="mr-2 size-4" />
						Change status
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className="w-40">
						{(["backlog", "queued", "in_progress"] as const).map((s) => (
							<ContextMenuItem
								key={s}
								onClick={() => handleStatusChange(s)}
								disabled={task.status === s}
							>
								{task.status === s ? "\u2022 " : ""}
								{statusLabels[s]}
							</ContextMenuItem>
						))}
					</ContextMenuSubContent>
				</ContextMenuSub>
				{hasScheduledEvents ? (
					<>
						<ContextMenuItem
							onClick={() => void pinAllTaskEvents({ taskId: task._id, pinned: true })}
						>
							<Pin className="mr-2 size-4" />
							Pin all events
						</ContextMenuItem>
						<ContextMenuItem
							onClick={() => void pinAllTaskEvents({ taskId: task._id, pinned: false })}
						>
							<PinOff className="mr-2 size-4" />
							Unpin all events
						</ContextMenuItem>
					</>
				) : null}
				<ContextMenuSeparator />
				<ContextMenuItem
					onClick={() => void deleteTask({ id: task._id as Id<"tasks"> })}
					className="text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 size-4" />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
