"use client";

import { Badge } from "@/components/ui/badge";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels } from "@/lib/scheduling-constants";
import type { HabitDTO, Priority, TaskDTO } from "@auto-cron/types";
import { Clock3, GripVertical, Pencil, Repeat } from "lucide-react";
import { memo } from "react";

type PriorityCardProps = {
	item: TaskDTO | HabitDTO;
	type: "task" | "habit";
	onEdit?: () => void;
	dragHandleProps?: {
		listeners?: Record<string, unknown>;
		attributes?: Record<string, unknown>;
	};
};

function isTask(item: TaskDTO | HabitDTO): item is TaskDTO {
	return "status" in item;
}

export const PriorityCard = memo(function PriorityCard({
	item,
	type,
	onEdit,
	dragHandleProps,
}: PriorityCardProps) {
	const color = isTask(item)
		? (item.effectiveColor ?? item.color ?? "#f59e0b")
		: (item.color ?? "#8b5cf6");

	const priority: Priority = isTask(item)
		? item.priority
		: ((item.priority ?? "medium") as Priority);

	const duration = isTask(item) ? item.estimatedMinutes : item.durationMinutes;

	return (
		<div
			className="group flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 transition-colors hover:bg-card/90"
			style={{ borderLeftWidth: 3, borderLeftColor: color }}
		>
			{dragHandleProps ? (
				<button
					type="button"
					className="shrink-0 cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground active:cursor-grabbing"
					{...(dragHandleProps.listeners as Record<string, unknown>)}
					{...(dragHandleProps.attributes as Record<string, unknown>)}
				>
					<GripVertical className="size-3.5" />
				</button>
			) : null}

			<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />

			<div className="min-w-0 flex-1">
				<p className="font-[family-name:var(--font-outfit)] truncate text-[0.82rem] font-medium leading-snug">
					{item.title}
				</p>
				<div className="mt-0.5 flex items-center gap-2 font-[family-name:var(--font-cutive)] text-[0.66rem] text-muted-foreground">
					<span className="inline-flex items-center gap-0.5">
						<Clock3 className="size-3" />
						{formatDurationCompact(duration)}
					</span>
					{type === "habit" ? (
						<span className="inline-flex items-center gap-0.5">
							<Repeat className="size-3" />
							Habit
						</span>
					) : null}
					{isTask(item) && item.deadline ? (
						<span>
							Due{" "}
							{new Intl.DateTimeFormat(undefined, {
								month: "short",
								day: "numeric",
							}).format(new Date(item.deadline))}
						</span>
					) : null}
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-1.5">
				<Badge
					className={`${priorityClass[priority]} font-[family-name:var(--font-cutive)] text-[0.58rem] px-1.5 py-0`}
				>
					{priorityLabels[priority]}
				</Badge>
				{onEdit ? (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onEdit();
						}}
						className="rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100"
					>
						<Pencil className="size-3" />
					</button>
				) : null}
			</div>
		</div>
	);
});
