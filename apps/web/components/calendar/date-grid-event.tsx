"use client";

import { cn } from "@/lib/utils";
import { Pencil, Repeat } from "lucide-react";
import { memo } from "react";

type ScheduleXEventLike = {
	id?: string | number;
	title?: string;
	start: string;
	calendarId?: string;
	isRecurring?: boolean;
	busyStatus?: "free" | "busy" | "tentative";
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
});

const formatTime = (value: string) => {
	const date = new Date(value.replace(" ", "T"));
	return timeFormatter.format(date);
};

const sanitizeDenseTitle = (title?: string) => (title ?? "Untitled").replace(/\s+/g, " ").trim();

const openEditFromEvent = (eventId?: string | number) => {
	if (!eventId || typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent("calendar:event-edit", {
			detail: { eventId: String(eventId) },
		}),
	);
};

const openPreviewFromEvent = (eventId?: string | number) => {
	if (!eventId || typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent("calendar:event-preview", {
			detail: { eventId: String(eventId) },
		}),
	);
};

function DateGridEventComponent({ calendarEvent }: { calendarEvent: ScheduleXEventLike }) {
	const colorKey = calendarEvent.calendarId ?? "google-default";
	const isFree = calendarEvent.busyStatus === "free";
	const eventStyle = {
		backgroundColor: isFree ? "transparent" : `var(--sx-color-${colorKey}-container, #1b2640)`,
		color: `var(--sx-color-on-${colorKey}-container, #b8d0ff)`,
		borderInlineStart: isFree
			? `2px dashed var(--sx-color-${colorKey}, #5b8def)`
			: `2px solid var(--sx-color-${colorKey}, #5b8def)`,
	};

	return (
		<div
			className={cn(
				"group relative inline-flex items-center gap-1 max-w-full rounded-[4px] h-full w-full pl-2 pr-1.5 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing",
				isFree && "outline outline-1 outline-dashed -outline-offset-1",
			)}
			style={{
				...eventStyle,
				...(isFree ? { outlineColor: `var(--sx-color-${colorKey}, #5b8def)` } : {}),
			}}
			title={calendarEvent.title ?? "Untitled"}
			onMouseUp={() => {
				openPreviewFromEvent(calendarEvent.id);
			}}
			onDoubleClick={(event) => {
				event.stopPropagation();
				openEditFromEvent(calendarEvent.id);
			}}
		>
			<button
				type="button"
				className="absolute top-0.5 right-0.5 hidden h-4 w-4 items-center justify-center rounded-sm border border-black/20 bg-black/35 text-white/85 backdrop-blur-sm transition hover:bg-black/55 group-hover:flex"
				onClick={(event) => {
					event.stopPropagation();
					openEditFromEvent(calendarEvent.id);
				}}
				aria-label="Edit event"
				title="Edit event"
			>
				<Pencil className="size-2.5" />
			</button>
			{calendarEvent.isRecurring ? <Repeat className="size-2 shrink-0 opacity-40" /> : null}
			<span
				className={cn(
					"truncate text-[0.7rem] font-semibold tracking-tight",
					isFree && "opacity-60",
				)}
			>
				{sanitizeDenseTitle(calendarEvent.title)}
			</span>
			<span className="text-[0.6rem] opacity-40 shrink-0">{formatTime(calendarEvent.start)}</span>
		</div>
	);
}

export const DateGridEvent = memo(DateGridEventComponent);
