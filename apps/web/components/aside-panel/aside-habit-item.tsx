"use client";

import type { HabitDTO } from "@auto-cron/types";
import { Clock3 } from "lucide-react";

export function AsideHabitItem({ habit }: { habit: HabitDTO }) {
	return (
		<div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50">
			<span
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: habit.effectiveColor ?? habit.color ?? "#6366f1" }}
			/>
			<div className="min-w-0 flex-1">
				<p className="font-[family-name:var(--font-outfit)] truncate text-[0.76rem] font-medium">
					{habit.title}
				</p>
				<div className="flex items-center gap-2 font-[family-name:var(--font-cutive)] text-[0.66rem] text-muted-foreground">
					{habit.frequency ? <span className="capitalize">{habit.frequency}</span> : null}
					<span className="inline-flex items-center gap-0.5">
						<Clock3 className="size-2.5" />
						{habit.minDurationMinutes && habit.maxDurationMinutes
							? `${habit.minDurationMinutes}-${habit.maxDurationMinutes}m`
							: `${habit.durationMinutes}m`}
					</span>
				</div>
			</div>
		</div>
	);
}
