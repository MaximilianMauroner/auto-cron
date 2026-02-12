"use client";

import { toCssSafeColorKey } from "@/components/calendar/color-key";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { Eye, Pencil, Repeat, Trash2 } from "lucide-react";
import { memo } from "react";

type ScheduleXEventLike = {
	id?: string | number;
	title?: string;
	start: unknown;
	end: unknown;
	calendarId?: string;
	description?: string;
	isRecurring?: boolean;
	source?: string;
	busyStatus?: "free" | "busy" | "tentative";
};

const toMillis = (value: unknown) => {
	if (!value) return Date.now();
	if (typeof value === "string") {
		const normalized = value.replace(" ", "T").replace(/\[[^\]]+\]$/, "");
		const parsed = Date.parse(normalized);
		return Number.isFinite(parsed) ? parsed : Date.now();
	}
	if (typeof value === "object") {
		const maybeTemporal = value as {
			epochMilliseconds?: unknown;
			toInstant?: () => { epochMilliseconds?: unknown };
			toString?: () => string;
		};
		if (
			typeof maybeTemporal.epochMilliseconds === "number" &&
			Number.isFinite(maybeTemporal.epochMilliseconds)
		) {
			return maybeTemporal.epochMilliseconds;
		}
		if (typeof maybeTemporal.toInstant === "function") {
			const instant = maybeTemporal.toInstant();
			if (
				instant &&
				typeof instant.epochMilliseconds === "number" &&
				Number.isFinite(instant.epochMilliseconds)
			) {
				return instant.epochMilliseconds;
			}
		}
		if (typeof maybeTemporal.toString === "function") {
			const asString = maybeTemporal.toString();
			const normalized = asString.replace(/\[[^\]]+\]$/, "");
			const parsed = Date.parse(normalized);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	return Date.now();
};
const timeFormatter = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
});

const formatTime = (value: unknown) => {
	const date = new Date(toMillis(value));
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

const deleteFromEvent = (eventId?: string | number) => {
	if (!eventId || typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent("calendar:event-delete", {
			detail: { eventId: String(eventId) },
		}),
	);
};

function TimeGridEventComponent({ calendarEvent }: { calendarEvent: ScheduleXEventLike }) {
	const start = toMillis(calendarEvent.start);
	const end = toMillis(calendarEvent.end);
	const minutes = Math.max(0, Math.round((end - start) / (1000 * 60)));

	const compact = minutes < 45;
	const semiCompact = minutes >= 45 && minutes < 90;
	const full = minutes >= 90;
	const timeLabel = `${formatTime(calendarEvent.start)} – ${formatTime(calendarEvent.end)}`;
	const colorKey = toCssSafeColorKey(calendarEvent.calendarId);
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
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className={cn(
						"group relative grid gap-px leading-tight content-start rounded-[4px] h-full w-full pl-2 pr-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing",
						isFree && "bg-transparent",
					)}
					style={{ ...eventStyle, ...freeStyle }}
					onMouseUp={(event) => {
						if ((event.target as HTMLElement).closest<HTMLElement>('[data-resize-handle="true"]')) {
							return;
						}
						if (event.button !== 0) return;
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
					<button
						type="button"
						data-resize-handle="true"
						className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize touch-none"
						onPointerDown={(event) => {
							if (event.pointerType === "mouse" && event.button !== 0) return;
							event.preventDefault();
							event.stopPropagation();
							try {
								(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
							} catch {
								// Pointer capture can fail in some browsers if not active yet.
							}
							const day =
								(event.currentTarget as HTMLElement).closest<HTMLElement>(".sx__time-grid-day")
									?.dataset.timeGridDate ?? undefined;
							window.dispatchEvent(
								new CustomEvent("calendar:event-resize-start", {
									detail: {
										eventId: String(calendarEvent.id),
										eventDay: day,
										pointerY: event.clientY,
										pointerId: event.pointerId,
									},
								}),
							);
						}}
						onPointerUp={(event) => {
							try {
								(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
							} catch {
								// Ignore release errors if capture is already gone.
							}
						}}
						onPointerCancel={(event) => {
							try {
								(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
							} catch {
								// Ignore release errors if capture is already gone.
							}
						}}
						aria-label="Resize event"
						title="Resize event"
					>
						<span className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35 opacity-75" />
					</button>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-52">
				<ContextMenuItem onSelect={() => openPreviewFromEvent(calendarEvent.id)}>
					<Eye className="size-4" />
					Open details
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => openEditFromEvent(calendarEvent.id)}>
					<Pencil className="size-4" />
					Edit event
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem variant="destructive" onSelect={() => deleteFromEvent(calendarEvent.id)}>
					<Trash2 className="size-4" />
					Delete event
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

export const TimeGridEvent = memo(TimeGridEventComponent);
