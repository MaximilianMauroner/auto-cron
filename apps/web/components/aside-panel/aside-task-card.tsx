"use client";

import { Badge } from "@/components/ui/badge";
import type { Priority, TaskDTO } from "@auto-cron/types";
import { Clock3 } from "lucide-react";

export const priorityClass: Record<Priority, string> = {
	low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
	medium: "bg-sky-500/15 text-sky-700 border-sky-500/25",
	high: "bg-amber-500/15 text-amber-700 border-amber-500/25",
	critical: "bg-orange-500/15 text-orange-700 border-orange-500/25",
	blocker: "bg-rose-500/15 text-rose-700 border-rose-500/25",
};

export function AsideTaskCard({ task }: { task: TaskDTO }) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/70 p-2.5 transition-colors hover:bg-background/95">
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
				<Badge className={`${priorityClass[task.priority]} text-[0.6rem] px-1.5 py-0`}>
					{task.priority}
				</Badge>
			</div>
		</div>
	);
}
