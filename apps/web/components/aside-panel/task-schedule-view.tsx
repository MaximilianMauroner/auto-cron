"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserPreferences } from "@/components/user-preferences-context";
import { useMutationWithStatus } from "@/hooks/use-convex-status";
import { formatDurationCompact } from "@/lib/duration";
import type { CalendarEventDTO } from "@auto-cron/types";
import { useAction } from "convex/react";
import { Clock3, MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

function formatDurationMs(ms: number) {
	return formatDurationCompact(Math.round(ms / 60_000));
}

function EventRow({
	event,
	hour12,
	muted,
	onViewDetails,
}: {
	event: CalendarEventDTO;
	hour12: boolean;
	muted?: boolean;
	onViewDetails?: (eventId: string) => void;
}) {
	const { mutate: setEventPinned } = useMutationWithStatus(api.calendar.mutations.setEventPinned);
	const { mutate: deleteEvent } = useMutationWithStatus(api.calendar.mutations.deleteEvent);
	const pushEventToGoogle = useAction(api.calendar.actions.pushEventToGoogle);

	const startDate = new Date(event.start);
	const endDate = new Date(event.end);
	const isTaskEvent = event.source === "task";
	const isPinned = event.pinned === true;

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
	const duration = formatDurationMs(event.end - event.start);

	const handlePin = () => {
		void setEventPinned({ id: event._id as Id<"calendarEvents">, pinned: true });
	};

	const handleUnpin = () => {
		void setEventPinned({ id: event._id as Id<"calendarEvents">, pinned: false });
	};

	const handleDeleteEvent = () => {
		void (async () => {
			const id = event._id as Id<"calendarEvents">;
			await pushEventToGoogle({ eventId: id, operation: "delete", scope: "single" }).catch(
				(deleteSyncError) => {
					console.warn(
						"Failed to delete event in Google calendar before local delete.",
						deleteSyncError,
					);
				},
			);
			await deleteEvent({ id });
		})();
	};

	const handleNavigate = () => {
		if (typeof window === "undefined") return;
		window.dispatchEvent(
			new CustomEvent("calendar:navigate-to-event", {
				detail: { eventId: event._id, start: event.start },
			}),
		);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: can't use <button> here — it would nest inside DropdownMenuTrigger's <button>
		<div
			role="button"
			tabIndex={0}
			onClick={handleNavigate}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleNavigate();
				}
			}}
			className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.7rem] cursor-pointer transition-colors hover:bg-accent/30 ${muted ? "opacity-60" : ""}`}
		>
			{isPinned && isTaskEvent ? <Pin className="size-3 shrink-0 text-amber-600" /> : null}
			<span className="w-[3.2rem] shrink-0 font-medium tabular-nums">{dateStr}</span>
			<span className="flex-1 tabular-nums text-muted-foreground">
				{startTime} – {endTime}
			</span>
			<span className="shrink-0 text-[0.62rem] text-muted-foreground/70 tabular-nums">
				{duration}
			</span>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation only */}
			<div onClick={(e) => e.stopPropagation()}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground/50">
							<MoreVertical className="size-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-40">
						{onViewDetails ? (
							<DropdownMenuItem onClick={() => onViewDetails(event._id)}>
								View details
							</DropdownMenuItem>
						) : null}
						{isTaskEvent ? (
							<>
								{isPinned ? (
									<DropdownMenuItem onClick={handleUnpin}>
										<PinOff className="mr-2 size-3.5" />
										Unpin
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem onClick={handlePin}>
										<Pin className="mr-2 size-3.5" />
										Pin to time
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
							</>
						) : null}
						<DropdownMenuItem
							onClick={handleDeleteEvent}
							className="text-destructive focus:text-destructive"
						>
							<Trash2 className="mr-2 size-3.5" />
							Delete event
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

export function TaskScheduleView({
	events,
	isLoading,
	estimatedMinutes,
	onViewDetails,
}: {
	events: CalendarEventDTO[];
	isLoading: boolean;
	estimatedMinutes?: number;
	onViewDetails?: (eventId: string) => void;
}) {
	const { hour12 } = useUserPreferences();
	const now = Date.now();

	const { upcoming, past, scheduledMinutes } = useMemo(() => {
		const taskEvents = events.filter(
			(e) => e.source === "task" && !e.sourceId?.includes(":travel:"),
		);
		const scheduled = taskEvents.reduce((sum, e) => sum + (e.end - e.start) / 60_000, 0);
		const upcoming = events.filter((e) => e.end >= now);
		const past = events
			.filter((e) => e.end < now)
			.slice()
			.reverse();
		return { upcoming, past, scheduledMinutes: Math.round(scheduled) };
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

	const total = estimatedMinutes ?? 0;
	const remaining = Math.max(0, total - scheduledMinutes);
	const percent = total > 0 ? Math.min(100, Math.round((scheduledMinutes / total) * 100)) : 0;

	return (
		<div className="mt-1 space-y-2 border-t border-border/40 pt-2">
			{total > 0 ? (
				<div className="px-2">
					<div className="flex items-center justify-between text-[0.66rem] text-muted-foreground">
						<span className="inline-flex items-center gap-1">
							<Clock3 className="size-3" />
							{formatDurationCompact(scheduledMinutes)} / {formatDurationCompact(total)}
						</span>
						<span>
							{remaining > 0 ? `${formatDurationCompact(remaining)} left` : "Fully scheduled"}
						</span>
					</div>
					<div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
						<div
							className="h-full rounded-full bg-primary/70 transition-all duration-300"
							style={{ width: `${percent}%` }}
						/>
					</div>
				</div>
			) : null}
			{upcoming.length > 0 ? (
				<div>
					<div className="mb-0.5 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
						Upcoming
					</div>
					<div className="rounded-lg border border-border/50 bg-background/60">
						{upcoming.map((event, i) => (
							<div key={event._id}>
								{i > 0 ? <div className="mx-2 border-t border-border/30" /> : null}
								<EventRow event={event} hour12={hour12} onViewDetails={onViewDetails} />
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
								<EventRow event={event} hour12={hour12} muted onViewDetails={onViewDetails} />
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
