"use client";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import type { CalendarEventDTO, Priority, TaskDTO } from "@auto-cron/types";
import { ChevronDown, Clock3 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { TaskScheduleView } from "./task-schedule-view";

export const priorityClass: Record<Priority, string> = {
	low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
	medium: "bg-sky-500/15 text-sky-700 border-sky-500/25",
	high: "bg-amber-500/15 text-amber-700 border-amber-500/25",
	critical: "bg-orange-500/15 text-orange-700 border-orange-500/25",
	blocker: "bg-rose-500/15 text-rose-700 border-rose-500/25",
};

export function AsideTaskCard({ task }: { task: TaskDTO }) {
	const [isOpen, setIsOpen] = useState(false);

	const eventsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listTaskEvents,
		isOpen ? { taskId: task._id } : "skip",
	);
	const events = (eventsQuery.data ?? []) as CalendarEventDTO[];

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="w-full rounded-lg border border-border/70 bg-background/70 p-2.5 text-left transition-colors hover:bg-background/95 data-[state=open]:rounded-b-none data-[state=open]:border-b-0"
				>
					<div className="flex items-start gap-2">
						<span
							className="mt-1 size-2 shrink-0 rounded-full"
							style={{ backgroundColor: task.color ?? "#f59e0b" }}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate text-[0.76rem] font-medium">{task.title}</p>
							<div className="mt-1 flex items-center gap-2 text-[0.68rem] text-muted-foreground">
								<span className="inline-flex items-center gap-0.5">
									<Clock3 className="size-3" />
									{task.estimatedMinutes}m
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
							<Badge className={`${priorityClass[task.priority]} text-[0.6rem] px-1.5 py-0`}>
								{task.priority}
							</Badge>
							<ChevronDown
								className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
							/>
						</div>
					</div>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="rounded-b-lg border border-t-0 border-border/70 bg-background/70 px-2.5 pb-2.5">
					<TaskScheduleView events={events} isLoading={eventsQuery.isPending} />
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
