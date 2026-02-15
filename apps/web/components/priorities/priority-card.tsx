"use client";

import { HabitActionsMenu, TaskActionsMenu } from "@/components/entity-actions";
import { Badge } from "@/components/ui/badge";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels } from "@/lib/scheduling-constants";
import type { HabitDTO, HabitPriority, Priority, TaskDTO, TaskStatus } from "@auto-cron/types";
import { Clock3, GripVertical, Repeat } from "lucide-react";
import { memo } from "react";

type PriorityCardProps = {
	item: TaskDTO | HabitDTO;
	type: "task" | "habit";
	onEdit?: () => void;
	onOpenDetails?: () => void;
	onOpenInCalendar?: () => void;
	onDeleteTask?: () => void;
	onTaskPriorityChange?: (priority: Priority) => void;
	onTaskStatusChange?: (status: TaskStatus) => void;
	dragHandleProps?: {
		listeners?: Record<string, unknown>;
		attributes?: Record<string, unknown>;
	};
	onToggleHabitActive?: (isActive: boolean) => void;
	onDeleteHabit?: () => void;
	onHabitPriorityChange?: (priority: HabitPriority) => void;
};

function isTask(item: TaskDTO | HabitDTO): item is TaskDTO {
	return "status" in item;
}

export const PriorityCard = memo(function PriorityCard({
	item,
	type,
	onEdit,
	onOpenDetails,
	onOpenInCalendar,
	onDeleteTask,
	onTaskPriorityChange,
	onTaskStatusChange,
	dragHandleProps,
	onToggleHabitActive,
	onDeleteHabit,
	onHabitPriorityChange,
}: PriorityCardProps) {
	const color = isTask(item)
		? (item.effectiveColor ?? item.color ?? "#f59e0b")
		: (item.color ?? "#8b5cf6");

	const priority: Priority = isTask(item)
		? item.priority
		: ((item.priority ?? "medium") as Priority);

	const duration = isTask(item) ? item.estimatedMinutes : item.durationMinutes;

	const card = (
		<div
			className="group flex min-h-[88px] items-start gap-2.5 rounded-xl border border-border/55 bg-card/70 px-3.5 py-3 transition-colors hover:bg-card/95"
			style={{ borderLeftWidth: 3, borderLeftColor: color }}
			role={onOpenDetails ? "button" : undefined}
			tabIndex={onOpenDetails ? 0 : undefined}
			onClick={() => onOpenDetails?.()}
			onKeyDown={(event) => {
				if (!onOpenDetails) return;
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onOpenDetails();
			}}
		>
			{dragHandleProps ? (
				<button
					type="button"
					className="shrink-0 cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground active:cursor-grabbing"
					onClick={(event) => event.stopPropagation()}
					{...(dragHandleProps.listeners as Record<string, unknown>)}
					{...(dragHandleProps.attributes as Record<string, unknown>)}
				>
					<GripVertical className="size-3.5" />
				</button>
			) : null}

			<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />

			<div className="min-w-0 flex-1 pt-0.5">
				<p className="font-[family-name:var(--font-outfit)] truncate text-[0.9rem] font-semibold leading-snug">
					{item.title}
				</p>
				<div className="mt-1 flex flex-wrap items-center gap-2 font-[family-name:var(--font-cutive)] text-[0.68rem] text-muted-foreground">
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

			<div className="flex shrink-0 items-start gap-1.5 pt-0.5">
				<Badge
					className={`${priorityClass[priority]} font-[family-name:var(--font-cutive)] text-[0.58rem] px-1.5 py-0`}
				>
					{priorityLabels[priority]}
				</Badge>
				{type === "task" && isTask(item) && onTaskPriorityChange && onTaskStatusChange ? (
					<TaskActionsMenu
						priority={item.priority}
						status={item.status}
						onOpenDetails={onOpenDetails}
						onEdit={onEdit}
						onOpenInCalendar={onOpenInCalendar}
						onDelete={onDeleteTask}
						onChangePriority={onTaskPriorityChange}
						onChangeStatus={onTaskStatusChange}
					/>
				) : null}
				{type === "habit" && !isTask(item) && onToggleHabitActive && onHabitPriorityChange ? (
					<HabitActionsMenu
						priority={item.priority ?? "medium"}
						isActive={item.isActive}
						onOpenDetails={onOpenDetails}
						onEdit={onEdit}
						onOpenInCalendar={onOpenInCalendar}
						onToggleActive={onToggleHabitActive}
						onDelete={onDeleteHabit}
						onChangePriority={onHabitPriorityChange}
					/>
				) : null}
			</div>
		</div>
	);
	return card;
});
