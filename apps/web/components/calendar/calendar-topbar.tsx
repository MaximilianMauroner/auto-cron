import { Button } from "@/components/ui/button";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CalendarSource } from "@auto-cron/types";
import {
	CalendarDays,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	Repeat2,
	Rocket,
	Sparkles,
} from "lucide-react";
import type { ComponentProps } from "react";
import { SchedulingDiagnostics } from "../../app/app/calendar/scheduling-diagnostics";

type CalendarTopbarProps = {
	monthLabel: string;
	activeView: "week" | "day" | "month-grid";
	onViewChange: (view: "week" | "day" | "month-grid") => void;
	onShiftDate: (direction: 1 | -1) => void;
	onToday: () => void;
	onCreateTask: () => void;
	onCreateEvent: () => void;
	onCreateHabit: () => void;
	onSync: () => void;
	syncStatus: "idle" | "syncing" | "error";
	selectedDate: string;
	selectedDateValue: Date;
	onSelectDate: (date: Date) => void;
	googleSyncHealth: ComponentProps<typeof SchedulingDiagnostics>["googleSyncHealth"];
	sourceFilter: CalendarSource[];
	onSourceFilterChange: (value: CalendarSource[]) => void;
	defaultSourceFilter: CalendarSource[];
	visibleEventCount: number;
	syncStatusLabel: string;
};

const sourceButtons: CalendarSource[] = ["google", "task", "habit", "manual"];
const sourceColorDot: Record<CalendarSource, string> = {
	google: "bg-chart-1",
	task: "bg-chart-3",
	habit: "bg-chart-2",
	manual: "bg-chart-5",
};

export function CalendarTopbar({
	monthLabel,
	activeView,
	onViewChange,
	onShiftDate,
	onToday,
	onCreateTask,
	onCreateEvent,
	onCreateHabit,
	onSync,
	syncStatus,
	selectedDate,
	selectedDateValue,
	onSelectDate,
	googleSyncHealth,
	sourceFilter,
	onSourceFilterChange,
	defaultSourceFilter,
	visibleEventCount,
	syncStatusLabel,
}: CalendarTopbarProps) {
	return (
		<header className="shrink-0 sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-2.5 flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div className="flex items-center gap-3">
					<h1 className="font-[family-name:var(--font-bebas)] text-xl uppercase tracking-wide text-foreground/80 min-w-[8.5rem]">
						{monthLabel}
					</h1>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon-sm"
							className="size-7 border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
							onClick={() => onShiftDate(-1)}
							aria-label="Previous period"
						>
							<ChevronLeft className="size-3.5" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2.5 border-border/60 bg-background text-foreground/80 text-[0.72rem] hover:border-border hover:bg-accent hover:text-foreground"
							onClick={onToday}
						>
							Today
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							className="size-7 border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
							onClick={() => onShiftDate(1)}
							aria-label="Next period"
						>
							<ChevronRight className="size-3.5" />
						</Button>
					</div>
				</div>

				<div className="flex items-center gap-2 flex-wrap" suppressHydrationWarning>
					<ToggleGroup
						type="single"
						value={activeView}
						onValueChange={(value) => {
							if (value) onViewChange(value as "week" | "day" | "month-grid");
						}}
						className="gap-0 rounded-lg border border-border bg-secondary p-0.5"
					>
						{[
							{ key: "week", label: "Week" },
							{ key: "day", label: "Day" },
							{ key: "month-grid", label: "Month" },
						].map((tab) => (
							<ToggleGroupItem
								key={tab.key}
								value={tab.key}
								variant="outline"
								size="sm"
								className="h-6 px-2.5 border-0 bg-transparent font-[family-name:var(--font-cutive)] text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:bg-transparent data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:shadow-sm rounded-md"
							>
								{tab.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>

					<div className="w-px h-4 bg-border" />

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="sm"
								className="h-7 px-2.5 bg-accent text-accent-foreground text-[0.72rem] font-semibold uppercase tracking-[0.04em] gap-1.5 border-accent hover:bg-accent/90 shadow-[0_2px_8px_-2px_rgba(252,163,17,0.3)]"
							>
								<Sparkles className="size-3" />
								Create new
								<ChevronDown className="size-3 opacity-60" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-44">
							<DropdownMenuItem onSelect={onCreateTask} className="gap-2">
								<Rocket className="size-3.5" />
								New task
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onCreateEvent} className="gap-2">
								<Sparkles className="size-3.5" />
								New event
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onCreateHabit} className="gap-2">
								<Repeat2 className="size-3.5" />
								New habit
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Button
						variant="outline"
						size="icon-sm"
						className="size-7 border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
						onClick={onSync}
						disabled={syncStatus === "syncing"}
						aria-label="Sync"
					>
						<RefreshCw className={`size-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
					</Button>

					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								aria-label="Choose date"
								className="h-8 px-2.5 border-border/60 bg-background text-foreground/70 text-[0.72rem] gap-1.5 hover:border-border hover:bg-accent hover:text-foreground"
							>
								<CalendarDays className="size-3.5" />
								{selectedDate}
							</Button>
						</PopoverTrigger>
						<PopoverContent
							align="end"
							className="w-auto border-border bg-popover p-0 text-popover-foreground"
						>
							<DatePickerCalendar
								mode="single"
								selected={selectedDateValue}
								onSelect={(date) => {
									if (!date) return;
									onSelectDate(date);
								}}
								initialFocus
								className="rounded-md border-0 bg-transparent"
							/>
						</PopoverContent>
					</Popover>

					<SchedulingDiagnostics googleSyncHealth={googleSyncHealth ?? null} />
				</div>
			</div>

			<div className="flex items-center justify-between gap-2 flex-wrap">
				<ToggleGroup
					type="multiple"
					value={sourceFilter}
					onValueChange={(value) =>
						onSourceFilterChange(value.length ? (value as CalendarSource[]) : defaultSourceFilter)
					}
					className="gap-1"
				>
					{sourceButtons.map((source) => (
						<ToggleGroupItem
							key={source}
							value={source}
							variant="outline"
							size="sm"
							className="h-7 rounded-md border border-border/40 bg-secondary/30 px-2 font-[family-name:var(--font-cutive)] text-[0.56rem] uppercase tracking-[0.12em] text-muted-foreground/45 data-[state=on]:bg-accent/15 data-[state=on]:text-foreground data-[state=on]:border-accent/40 gap-1.5 transition-all"
						>
							<span className={`size-2 rounded-full ${sourceColorDot[source]}`} />
							{source}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				<div className="flex items-center gap-2 font-[family-name:var(--font-cutive)] text-[0.56rem] uppercase tracking-[0.1em] text-muted-foreground/70">
					<span className="tabular-nums">{visibleEventCount} events</span>
					<span className="text-border">·</span>
					<div
						className={`flex items-center gap-1.5 ${
							syncStatus === "error"
								? "text-destructive"
								: syncStatus === "syncing"
									? "text-chart-1"
									: "text-muted-foreground/70"
						}`}
					>
						<span
							aria-hidden="true"
							className={`inline-block size-1.5 rounded-full ${
								syncStatus === "error"
									? "bg-destructive"
									: syncStatus === "syncing"
										? "bg-chart-1 animate-pulse"
										: "bg-chart-2"
							}`}
						/>
						{syncStatusLabel}
					</div>
				</div>
			</div>
		</header>
	);
}
