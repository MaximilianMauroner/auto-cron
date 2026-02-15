"use client";

import { Button } from "@/components/ui/button";
import { DAY_OPTIONS } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

type DayPillGroupProps = {
	selectedDays: number[];
	onChange: (days: number[]) => void;
	disabled?: boolean;
	size?: "sm" | "default";
};

export function DayPillGroup({
	selectedDays,
	onChange,
	disabled,
	size = "default",
}: DayPillGroupProps) {
	const toggleDay = (day: number) => {
		const set = new Set(selectedDays);
		if (set.has(day)) {
			set.delete(day);
		} else {
			set.add(day);
		}
		onChange(Array.from(set));
	};

	return (
		<div className="flex flex-wrap gap-1.5">
			{DAY_OPTIONS.map((day) => {
				const selected = selectedDays.includes(day.value);
				return (
					<Button
						key={day.value}
						type="button"
						size="sm"
						variant={selected ? "default" : "outline"}
						disabled={disabled}
						className={cn(
							"rounded-full font-[family-name:var(--font-outfit)] font-medium transition-colors",
							size === "sm"
								? "h-8 min-w-8 px-2.5 text-[0.72rem]"
								: "h-9 min-w-9 px-3 text-[0.76rem]",
							selected
								? "bg-accent text-accent-foreground hover:bg-accent/90"
								: "hover:bg-muted hover:text-foreground hover:border-border",
						)}
						onClick={() => toggleDay(day.value)}
					>
						{day.short}
					</Button>
				);
			})}
		</div>
	);
}
