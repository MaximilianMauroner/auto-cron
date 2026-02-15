"use client";

import { HabitActionsMenu } from "@/components/entity-actions";
import type { HabitDTO, HabitPriority } from "@auto-cron/types";
import { Clock3 } from "lucide-react";

export function AsideHabitItem({
	habit,
	onClick,
	onEdit,
	onDelete,
	onToggle,
	onChangePriority,
}: {
	habit: HabitDTO;
	onClick?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	onToggle?: (isActive: boolean) => void;
	onChangePriority?: (priority: HabitPriority) => void;
}) {
	return (
		<div
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={onClick}
			onKeyDown={(event) => {
				if (!onClick) return;
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onClick();
			}}
			className="flex w-full items-start gap-2.5 rounded-xl border border-border/60 bg-background/75 px-3.5 py-2.5 text-left transition-colors hover:bg-background/95"
		>
			<span
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: habit.effectiveColor ?? habit.color ?? "#6366f1" }}
			/>
			<div className="min-w-0 flex-1 pt-0.5">
				<p className="font-[family-name:var(--font-outfit)] truncate text-[0.82rem] font-medium">
					{habit.title}
				</p>
				<div className="mt-0.5 flex items-center gap-2 font-[family-name:var(--font-cutive)] text-[0.68rem] text-muted-foreground">
					{habit.frequency ? <span className="capitalize">{habit.frequency}</span> : null}
					<span className="inline-flex items-center gap-0.5">
						<Clock3 className="size-2.5" />
						{habit.minDurationMinutes && habit.maxDurationMinutes
							? `${habit.minDurationMinutes}-${habit.maxDurationMinutes}m`
							: `${habit.durationMinutes}m`}
					</span>
				</div>
			</div>
			{onToggle && onChangePriority ? (
				<HabitActionsMenu
					priority={habit.priority ?? "medium"}
					isActive={habit.isActive}
					onOpenDetails={onClick}
					onEdit={onEdit}
					onDelete={onDelete}
					onToggleActive={onToggle}
					onOpenInCalendar={() => {
						window.location.assign("/app/calendar");
					}}
					onChangePriority={onChangePriority}
				/>
			) : null}
		</div>
	);
}
