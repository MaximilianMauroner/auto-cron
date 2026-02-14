"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	busyStatusLabel,
	formatDuration,
	formatRecurrenceRule,
	normalizeDescription,
	prettifyCalendarName,
	resolveGoogleColor,
	visibilityLabel,
} from "@/lib/calendar-utils";
import {
	ArrowLeft,
	ArrowRight,
	Clock3,
	MapPin,
	Pencil,
	Pin,
	PinOff,
	Repeat2,
	Trash2,
} from "lucide-react";
import { useCallback } from "react";
import { type EventDetailData, useEventDetail } from "./event-detail-context";

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

export function EventDetailView() {
	const { eventDetail, clearEventDetail } = useEventDetail();

	const handleEdit = useCallback(() => {
		if (!eventDetail) return;
		window.dispatchEvent(
			new CustomEvent("calendar:event-edit", { detail: { eventId: eventDetail.eventId } }),
		);
		clearEventDetail();
	}, [eventDetail, clearEventDetail]);

	const handleDelete = useCallback(() => {
		if (!eventDetail) return;
		window.dispatchEvent(
			new CustomEvent("calendar:event-delete", { detail: { eventId: eventDetail.eventId } }),
		);
		clearEventDetail();
	}, [eventDetail, clearEventDetail]);

	const handlePin = useCallback(() => {
		if (!eventDetail) return;
		window.dispatchEvent(
			new CustomEvent("calendar:event-pin", {
				detail: { eventId: eventDetail.eventId, pinned: !eventDetail.pinned },
			}),
		);
	}, [eventDetail]);

	if (!eventDetail) return null;

	const isTaskBound = eventDetail.source === "task" && eventDetail.sourceId;
	const calendarColor = resolveGoogleColor(eventDetail.color);
	const calendarLabel =
		eventDetail.source !== "google"
			? eventDetail.source.charAt(0).toUpperCase() + eventDetail.source.slice(1)
			: prettifyCalendarName(eventDetail.calendarId);
	const recurrenceLabel = formatRecurrenceRule(
		eventDetail.recurrenceRule || undefined,
		eventDetail.start,
		Boolean(eventDetail.recurringEventId && !eventDetail.recurrenceRule),
	);
	const description = normalizeDescription(eventDetail.description);

	return (
		<div className="flex h-full flex-col">
			{/* Header: Back button */}
			<div className="border-b border-border/60 px-3 py-2">
				<Button
					variant="ghost"
					size="sm"
					className="gap-1.5 text-[0.76rem] text-muted-foreground hover:text-foreground -ml-1"
					onClick={clearEventDetail}
				>
					<ArrowLeft className="size-3.5" />
					Back
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				<div className="p-3 space-y-0">
					{/* Title */}
					<div className="rounded-xl border border-border/60 bg-card">
						<div className="px-3 py-3">
							<div
								className="font-[family-name:var(--font-outfit)] text-[1.3rem] leading-[1.15] font-semibold tracking-tight text-foreground break-words"
								style={{ textWrap: "balance" }}
							>
								{eventDetail.title || "Untitled"}
							</div>
						</div>

						{/* Task badge */}
						{isTaskBound ? (
							<div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
								<Badge className="bg-chart-3/15 text-chart-3 border-chart-3/25 font-[family-name:var(--font-cutive)] text-[0.5rem] uppercase tracking-[0.1em] px-1.5 py-0">
									Task
								</Badge>
								<div className="ml-auto flex items-center gap-1.5">
									{eventDetail.pinned === true ? (
										<Badge className="bg-amber-500/15 text-amber-700 border-amber-500/25 font-[family-name:var(--font-cutive)] text-[0.5rem] uppercase tracking-[0.1em] px-1.5 py-0">
											Pinned
										</Badge>
									) : null}
									<Button
										variant="ghost"
										size="sm"
										className="h-6 gap-1 text-[0.68rem]"
										onClick={handlePin}
									>
										{eventDetail.pinned === true ? (
											<>
												<PinOff className="size-3" />
												Unpin
											</>
										) : (
											<>
												<Pin className="size-3" />
												Pin
											</>
										)}
									</Button>
								</div>
							</div>
						) : null}

						{/* Time */}
						<div className="border-t border-border/60 px-3 py-3 space-y-2.5">
							<div className="grid grid-cols-[20px_1fr] items-center gap-3">
								<Clock3 className="size-4 text-muted-foreground" />
								<div>
									<div className="flex items-center gap-1.5 flex-wrap text-[0.88rem]">
										<span className="text-foreground">
											{timeOnlyFormatter.format(new Date(eventDetail.start))}
										</span>
										<ArrowRight className="size-3.5 text-muted-foreground" />
										<span className="text-foreground">
											{timeOnlyFormatter.format(new Date(eventDetail.end))}
										</span>
										<span className="text-muted-foreground text-[0.82rem]">
											{formatDuration(eventDetail.start, eventDetail.end)}
										</span>
									</div>
									<div className="text-[0.78rem] text-muted-foreground mt-0.5">
										{dateFormatter.format(new Date(eventDetail.start))}
									</div>
								</div>
							</div>

							{/* Recurrence */}
							{recurrenceLabel !== "Does not repeat" ? (
								<div className="grid grid-cols-[20px_1fr] items-center gap-3">
									<Repeat2 className="size-4 text-muted-foreground" />
									<div className="text-[0.85rem] text-foreground/80">{recurrenceLabel}</div>
								</div>
							) : null}

							{/* Location */}
							{eventDetail.location.trim() ? (
								<div className="grid grid-cols-[20px_1fr] items-center gap-3">
									<MapPin className="size-4 text-muted-foreground" />
									<div className="text-[0.85rem] text-foreground/85">{eventDetail.location}</div>
								</div>
							) : null}
						</div>

						{/* Description */}
						{description ? (
							<div className="border-t border-border/60 px-3 py-3">
								<div className="mb-1.5 font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
									Description
								</div>
								<div className="text-[0.85rem] text-foreground/80 whitespace-pre-wrap leading-relaxed">
									{description}
								</div>
							</div>
						) : null}

						{/* Calendar / Status */}
						<div className="border-t border-border/60 px-3 py-3 space-y-2">
							<div className="flex items-center gap-2 text-[0.85rem] text-foreground/90">
								<span
									className="size-3 rounded-[5px]"
									style={{ backgroundColor: calendarColor.main }}
								/>
								<span>{calendarLabel}</span>
							</div>
							<div className="flex gap-3 text-[0.78rem] text-foreground/70">
								<span>{busyStatusLabel(eventDetail.busyStatus)}</span>
								<span>{visibilityLabel(eventDetail.visibility)}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Footer: actions */}
			<div className="border-t border-border/60 px-3 py-2.5 flex items-center justify-between">
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1.5 text-[0.72rem] text-destructive hover:text-destructive hover:bg-destructive/10"
					onClick={handleDelete}
				>
					<Trash2 className="size-3" />
					Delete
				</Button>
				<div className="flex items-center gap-2">
					{isTaskBound ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 gap-1.5 text-[0.72rem] text-muted-foreground hover:text-foreground"
							onClick={handlePin}
						>
							{eventDetail.pinned ? (
								<>
									<PinOff className="size-3" />
									Unpin
								</>
							) : (
								<>
									<Pin className="size-3" />
									Pin
								</>
							)}
						</Button>
					) : null}
					<Button
						size="sm"
						variant="outline"
						className="h-7 gap-1.5 border-border text-[0.72rem] text-foreground hover:bg-accent"
						onClick={handleEdit}
					>
						<Pencil className="size-3" />
						Edit
					</Button>
				</div>
			</div>
		</div>
	);
}
