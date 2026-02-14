"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useUserPreferences } from "@/components/user-preferences-context";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels, statusPipelineOrder } from "@/lib/scheduling-constants";
import type { TaskDTO, TaskStatus } from "@auto-cron/types";
import { Clock3, GripVertical } from "lucide-react";
import { memo } from "react";

const statusTitles: Record<TaskStatus, string> = {
	backlog: "Backlog",
	queued: "Queued",
	scheduled: "Scheduled",
	in_progress: "In Progress",
	done: "Done",
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

export type TaskCardProps = {
	task: TaskDTO;
	onEdit: () => void;
	onDelete: () => void;
	onMove: (status: TaskStatus) => void;
	isBusy: boolean;
	dragHandleProps?: {
		listeners?: Record<string, unknown>;
		attributes?: Record<string, unknown>;
	};
};

export const TaskCard = memo(function TaskCard({
	task,
	onEdit,
	onDelete,
	onMove,
	isBusy,
	dragHandleProps,
}: TaskCardProps) {
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
				<div className="flex items-start gap-1.5">
					{dragHandleProps ? (
						<button
							type="button"
							className="mt-0.5 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
							{...(dragHandleProps.listeners as Record<string, unknown>)}
							{...(dragHandleProps.attributes as Record<string, unknown>)}
						>
							<GripVertical className="size-4" />
						</button>
					) : null}
					<p className="text-sm font-semibold leading-snug">{task.title}</p>
				</div>
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
						{statusPipelineOrder.map((status) => (
							<SelectItem key={status} value={status}>
								{statusTitles[status]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex items-center gap-1">
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
});
