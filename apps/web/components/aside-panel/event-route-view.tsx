"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutationWithStatus } from "@/hooks/use-convex-status";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import {
	formatDuration,
	formatRecurrenceRule,
	normalizeDescription,
	prettifyCalendarName,
	resolveGoogleColor,
} from "@/lib/calendar-utils";
import { ArrowRight, Clock3, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsideContent } from "./aside-content-context";

const timeOnlyFormatter = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
	hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric",
});

export function EventRouteView({ eventId, mode }: { eventId: string; mode: "details" | "edit" }) {
	const { goBack, openTask, openHabit } = useAsideContent();
	const eventQuery = useAuthenticatedQueryWithStatus(api.calendar.queries.getEvent, {
		id: eventId as Id<"calendarEvents">,
	});
	const event = eventQuery.data;
	const { mutate: setEventPinned } = useMutationWithStatus(api.calendar.mutations.setEventPinned);
	const { mutate: deleteEvent } = useMutationWithStatus(api.calendar.mutations.deleteEvent);

	if (eventQuery.isPending) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Loading event...
			</div>
		);
	}

	if (!event) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Event not found.
			</div>
		);
	}

	const calendarLabel =
		event.source === "google"
			? prettifyCalendarName(event.calendarId)
			: event.source.charAt(0).toUpperCase() + event.source.slice(1);
	const recurrence = formatRecurrenceRule(event.recurrenceRule, event.start, false);
	const description = normalizeDescription(event.description);

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border/60 px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<Button variant="ghost" size="sm" className="h-7 text-[0.72rem]" onClick={goBack}>
						Back
					</Button>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							className="h-7 gap-1 text-[0.72rem]"
							onClick={() => {
								if (event.source === "task" && event.sourceId) {
									openTask(event.sourceId, "edit");
									return;
								}
								if (event.source === "habit" && event.sourceId) {
									openHabit(event.sourceId, "edit");
									return;
								}
								window.dispatchEvent(
									new CustomEvent("calendar:event-edit", {
										detail: { eventId: event._id },
									}),
								);
							}}
						>
							<Pencil className="size-3.5" />
							{mode === "edit" ? "Editing" : "Edit"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-7"
							onClick={() => setEventPinned({ id: event._id, pinned: !event.pinned })}
						>
							{event.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-7 text-destructive"
							onClick={() => deleteEvent({ id: event._id, scope: "single" })}
						>
							<Trash2 className="size-3.5" />
						</Button>
					</div>
				</div>
				<div className="mt-2 flex items-start gap-2">
					<span
						className="mt-1 size-2 shrink-0 rounded-full"
						style={{ backgroundColor: resolveGoogleColor(event.color).main }}
					/>
					<div className="min-w-0">
						<p className="truncate font-[family-name:var(--font-outfit)] text-[0.95rem] font-semibold">
							{event.title}
						</p>
						<div className="mt-1 flex items-center gap-1.5">
							<Badge variant="outline" className="text-[0.58rem]">
								{calendarLabel}
							</Badge>
							{event.pinned ? (
								<Badge variant="secondary" className="text-[0.58rem]">
									Pinned
								</Badge>
							) : null}
						</div>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
				<div className="rounded-xl border border-border/60 bg-card/60 p-3">
					<div className="flex items-center gap-2 text-[0.82rem]">
						<Clock3 className="size-4 text-muted-foreground" />
						<span>{timeOnlyFormatter.format(new Date(event.start))}</span>
						<ArrowRight className="size-3 text-muted-foreground" />
						<span>{timeOnlyFormatter.format(new Date(event.end))}</span>
						<span className="text-muted-foreground">{formatDuration(event.start, event.end)}</span>
					</div>
					<p className="mt-1 text-[0.74rem] text-muted-foreground">
						{dateFormatter.format(new Date(event.start))}
					</p>
					<p className="mt-3 text-[0.78rem] text-muted-foreground">{recurrence}</p>
					{description ? (
						<div className="mt-3 border-t border-border/50 pt-3 text-[0.78rem] text-foreground/80">
							{description}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
