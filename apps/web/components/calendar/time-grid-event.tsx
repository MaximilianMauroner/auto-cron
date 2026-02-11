"use client";

import { cn } from "@/lib/utils";
import { Pencil, Repeat } from "lucide-react";
import { memo } from "react";

type ScheduleXEventLike = {
	id?: string | number;
	title?: string;
	start: string;
	end: string;
	calendarId?: string;
	description?: string;
	isRecurring?: boolean;
	source?: string;
	busyStatus?: "free" | "busy" | "tentative";
};

const parseScheduleXDateTime = (value: string) => new Date(value.replace(" ", "T"));
const timeFormatter = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
});

const formatTime = (value: string) => {
	const date = parseScheduleXDateTime(value);
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

function TimeGridEventComponent({ calendarEvent }: { calendarEvent: ScheduleXEventLike }) {
	const start = parseScheduleXDateTime(calendarEvent.start).getTime();
	const end = parseScheduleXDateTime(calendarEvent.end).getTime();
	const minutes = Math.max(0, Math.round((end - start) / (1000 * 60)));

	const compact = minutes < 45;
	const semiCompact = minutes >= 45 && minutes < 90;
	const full = minutes >= 90;
	const timeLabel = `${formatTime(calendarEvent.start)} – ${formatTime(calendarEvent.end)}`;
	const colorKey = calendarEvent.calendarId ?? "google-default";
	const eventStyle = {
		backgroundColor: `var(--sx-color-${colorKey}-container, #1b2640)`,
		color: `var(--sx-color-on-${colorKey}-container, #b8d0ff)`,
		borderInlineStart: `2px solid var(--sx-color-${colorKey}, #5b8def)`,
	};

	const descriptionFirstLine = calendarEvent.description?.split("\n")[0]?.trim();
	const isFree = calendarEvent.busyStatus === "free";
	const isTentative = calendarEvent.busyStatus === "tentative";

	const freeStyle = isFree
		? {
				backgroundColor: "transparent",
				borderInlineStart: `2px dashed var(--sx-color-${colorKey}, #5b8def)`,
				outline: `1px dashed var(--sx-color-${colorKey}, #5b8def)`,
				outlineOffset: "-1px",
			}
		: isTentative
			? {
					opacity: 0.7,
				}
			: {};

	return (
		<div
			className={cn(
				"group relative grid gap-px leading-tight content-start rounded-[4px] h-full w-full pl-2 pr-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing",
				isFree && "bg-transparent",
			)}
			style={{ ...eventStyle, ...freeStyle }}
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
				className="absolute top-1 right-1 hidden h-5 w-5 items-center justify-center rounded-md border border-black/20 bg-black/35 text-white/85 backdrop-blur-sm transition hover:bg-black/55 group-hover:flex"
				onClick={(event) => {
					event.stopPropagation();
					openEditFromEvent(calendarEvent.id);
				}}
				aria-label="Edit event"
				title="Edit event"
			>
				<Pencil className="size-3" />
			</button>
			<div className="flex items-center gap-1 min-w-0">
				<span
					className={cn(
						"text-[0.74rem] font-semibold tracking-tight truncate",
						compact && "text-[0.68rem]",
						isFree && "opacity-60",
					)}
				>
					{sanitizeDenseTitle(calendarEvent.title)}
				</span>
				{calendarEvent.isRecurring ? <Repeat className="size-2.5 shrink-0 opacity-40" /> : null}
			</div>
			{!compact ? (
				<div
					className={cn(
						"text-[0.62rem] font-normal opacity-50 truncate",
						semiCompact && "text-[0.6rem]",
						isFree && "opacity-35",
					)}
				>
					{timeLabel}
				</div>
			) : null}
			{full && descriptionFirstLine ? (
				<div className="text-[0.58rem] font-normal opacity-35 truncate mt-px">
					{descriptionFirstLine}
				</div>
			) : null}
		</div>
	);
}

export const TimeGridEvent = memo(TimeGridEventComponent);
