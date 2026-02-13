"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserPreferences } from "@/components/user-preferences-context";
import type { CalendarEventDTO } from "@auto-cron/types";
import { MoreVertical } from "lucide-react";
import { useMemo } from "react";

function formatDurationMinutes(ms: number) {
	const minutes = Math.round(ms / 60_000);
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function EventRow({
	event,
	hour12,
	muted,
}: { event: CalendarEventDTO; hour12: boolean; muted?: boolean }) {
	const startDate = new Date(event.start);
	const endDate = new Date(event.end);

	const dateStr = new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
	}).format(startDate);

	const timeOpts: Intl.DateTimeFormatOptions = {
		hour: "numeric",
		minute: "2-digit",
		hour12,
	};
	const startTime = new Intl.DateTimeFormat(undefined, timeOpts).format(startDate);
	const endTime = new Intl.DateTimeFormat(undefined, timeOpts).format(endDate);
	const duration = formatDurationMinutes(event.end - event.start);

	return (
		<div
			className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.7rem] transition-colors hover:bg-accent/30 ${muted ? "opacity-60" : ""}`}
		>
			<span className="w-[3.2rem] shrink-0 font-medium tabular-nums">{dateStr}</span>
			<span className="flex-1 tabular-nums text-muted-foreground">
				{startTime} – {endTime}
			</span>
			<span className="shrink-0 text-[0.62rem] text-muted-foreground/70 tabular-nums">
				{duration}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground/50">
						<MoreVertical className="size-3" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-36">
					<DropdownMenuItem>View details</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export function TaskScheduleView({
	events,
	isLoading,
}: { events: CalendarEventDTO[]; isLoading: boolean }) {
	const { hour12 } = useUserPreferences();
	const now = Date.now();

	const { upcoming, past } = useMemo(() => {
		const upcoming = events.filter((e) => e.end >= now);
		const past = events
			.filter((e) => e.end < now)
			.slice()
			.reverse();
		return { upcoming, past };
	}, [events, now]);

	if (isLoading) {
		return (
			<div className="px-2.5 py-3 text-[0.68rem] text-muted-foreground">Loading schedule...</div>
		);
	}

	if (events.length === 0) {
		return (
			<div className="px-2.5 py-3 text-center text-[0.68rem] text-muted-foreground/70">
				No scheduled events yet.
			</div>
		);
	}

	return (
		<div className="mt-1 space-y-2 border-t border-border/40 pt-2">
			{upcoming.length > 0 ? (
				<div>
					<div className="mb-0.5 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
						Upcoming
					</div>
					<div className="rounded-lg border border-border/50 bg-background/60">
						{upcoming.map((event, i) => (
							<div key={event._id}>
								{i > 0 ? <div className="mx-2 border-t border-border/30" /> : null}
								<EventRow event={event} hour12={hour12} />
							</div>
						))}
					</div>
				</div>
			) : null}

			{past.length > 0 ? (
				<div>
					<div className="mb-0.5 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
						Past
					</div>
					<div className="rounded-lg border border-border/50 bg-background/40">
						{past.map((event, i) => (
							<div key={event._id}>
								{i > 0 ? <div className="mx-2 border-t border-border/30" /> : null}
								<EventRow event={event} hour12={hour12} muted />
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
