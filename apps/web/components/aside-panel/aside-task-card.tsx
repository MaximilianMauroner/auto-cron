"use client";

import { TaskActionsMenu } from "@/components/entity-actions";
import { Badge } from "@/components/ui/badge";
import { useMutationWithStatus } from "@/hooks/use-convex-status";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels } from "@/lib/scheduling-constants";
import type { Priority, TaskDTO, TaskStatus } from "@auto-cron/types";
import { Clock3 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type AsideTaskCardProps = {
	task: TaskDTO;
	onOpenTask: (taskId: string) => void;
	onEditTask?: (taskId: string) => void;
};

export function AsideTaskCard({ task, onOpenTask, onEditTask }: AsideTaskCardProps) {
	const { mutate: updateTask } = useMutationWithStatus(api.tasks.mutations.updateTask);
	const { mutate: deleteTask } = useMutationWithStatus(api.tasks.mutations.deleteTask);
	const onChangeStatus = (nextStatus: TaskStatus) => {
		void updateTask({ id: task._id as Id<"tasks">, patch: { status: nextStatus } });
	};

	const onChangePriority = (nextPriority: Priority) => {
		void updateTask({ id: task._id as Id<"tasks">, patch: { priority: nextPriority } });
	};

	return (
		<div className="flex w-full items-start gap-2 rounded-lg border border-border/60 bg-background/70 p-2.5 transition-colors hover:bg-background/95">
			<button
				type="button"
				onClick={() => onOpenTask(task._id)}
				className="flex min-w-0 flex-1 items-start gap-2 text-left"
			>
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
			</button>
			<div className="flex items-center gap-1">
				<Badge
					className={`${priorityClass[task.priority]} font-[family-name:var(--font-cutive)] text-[0.6rem] px-1.5 py-0`}
				>
					{priorityLabels[task.priority]}
				</Badge>
				<TaskActionsMenu
					priority={task.priority}
					status={task.status}
					onOpenDetails={() => onOpenTask(task._id)}
					onEdit={onEditTask ? () => onEditTask(task._id) : undefined}
					onDelete={() => void deleteTask({ id: task._id as Id<"tasks"> })}
					onOpenInCalendar={() => window.location.assign("/app/calendar")}
					onChangePriority={onChangePriority}
					onChangeStatus={onChangeStatus}
				/>
			</div>
		</div>
	);
}
