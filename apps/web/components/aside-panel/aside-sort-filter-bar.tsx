"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Calendar, Clock3 } from "lucide-react";

export type SortOption = "default" | "due_asc" | "due_desc";

export type DurationFilter = "all" | "lt30m" | "30m_1h" | "1h_2h" | "2h_4h" | "gt4h";

export type HoursSetOption = { id: string; name: string };

const sortLabels: Record<SortOption, string> = {
	default: "Default",
	due_asc: "Due date (earliest)",
	due_desc: "Due date (latest)",
};

const durationFilterLabels: Record<DurationFilter, string> = {
	all: "All durations",
	lt30m: "< 30 min",
	"30m_1h": "30 min \u2013 1 h",
	"1h_2h": "1 \u2013 2 h",
	"2h_4h": "2 \u2013 4 h",
	gt4h: "4 h+",
};

export function matchesDurationFilter(minutes: number, filter: DurationFilter): boolean {
	switch (filter) {
		case "all":
			return true;
		case "lt30m":
			return minutes < 30;
		case "30m_1h":
			return minutes >= 30 && minutes <= 60;
		case "1h_2h":
			return minutes > 60 && minutes <= 120;
		case "2h_4h":
			return minutes > 120 && minutes <= 240;
		case "gt4h":
			return minutes > 240;
	}
}

export function sortByDueDate<T extends { deadline?: number }>(
	items: T[],
	direction: "asc" | "desc",
): T[] {
	return [...items].sort((a, b) => {
		const aDeadline = a.deadline ?? Number.MAX_SAFE_INTEGER;
		const bDeadline = b.deadline ?? Number.MAX_SAFE_INTEGER;
		return direction === "asc" ? aDeadline - bDeadline : bDeadline - aDeadline;
	});
}

export function AsideSortFilterBar({
	sort,
	onSortChange,
	durationFilter,
	onDurationFilterChange,
	hoursSetFilter,
	onHoursSetFilterChange,
	hoursSets,
}: {
	sort: SortOption;
	onSortChange: (value: SortOption) => void;
	durationFilter: DurationFilter;
	onDurationFilterChange: (value: DurationFilter) => void;
	hoursSetFilter: string;
	onHoursSetFilterChange: (value: string) => void;
	hoursSets: HoursSetOption[];
}) {
	const activeHoursSet = hoursSets.find((h) => h.id === hoursSetFilter);

	return (
		<div className="flex flex-wrap items-center gap-1">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={`h-7 gap-1 px-2 font-[family-name:var(--font-outfit)] text-[0.68rem] ${sort !== "default" ? "text-foreground" : "text-muted-foreground"}`}
					>
						<ArrowUpDown className="size-3" />
						{sort === "default" ? "Sort" : sortLabels[sort]}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-44">
					<DropdownMenuLabel className="font-[family-name:var(--font-outfit)] text-[0.68rem]">
						Sort within groups
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
						{(Object.keys(sortLabels) as SortOption[]).map((key) => (
							<DropdownMenuRadioItem
								key={key}
								value={key}
								className="font-[family-name:var(--font-outfit)] text-[0.72rem]"
							>
								{sortLabels[key]}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={`h-7 gap-1 px-2 font-[family-name:var(--font-outfit)] text-[0.68rem] ${durationFilter !== "all" ? "text-foreground" : "text-muted-foreground"}`}
					>
						<Clock3 className="size-3" />
						{durationFilter === "all" ? "Duration" : durationFilterLabels[durationFilter]}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-40">
					<DropdownMenuLabel className="font-[family-name:var(--font-outfit)] text-[0.68rem]">
						Filter by duration
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuRadioGroup
						value={durationFilter}
						onValueChange={(v) => onDurationFilterChange(v as DurationFilter)}
					>
						{(Object.keys(durationFilterLabels) as DurationFilter[]).map((key) => (
							<DropdownMenuRadioItem
								key={key}
								value={key}
								className="font-[family-name:var(--font-outfit)] text-[0.72rem]"
							>
								{durationFilterLabels[key]}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			{hoursSets.length > 0 && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className={`h-7 gap-1 px-2 font-[family-name:var(--font-outfit)] text-[0.68rem] ${hoursSetFilter !== "all" ? "text-foreground" : "text-muted-foreground"}`}
						>
							<Calendar className="size-3" />
							{activeHoursSet ? activeHoursSet.name : "Hours"}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-44">
						<DropdownMenuLabel className="font-[family-name:var(--font-outfit)] text-[0.68rem]">
							Filter by hours set
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuRadioGroup value={hoursSetFilter} onValueChange={onHoursSetFilterChange}>
							<DropdownMenuRadioItem
								value="all"
								className="font-[family-name:var(--font-outfit)] text-[0.72rem]"
							>
								All hours sets
							</DropdownMenuRadioItem>
							{hoursSets.map((hs) => (
								<DropdownMenuRadioItem
									key={hs.id}
									value={hs.id}
									className="font-[family-name:var(--font-outfit)] text-[0.72rem]"
								>
									{hs.name}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
