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
	calendarId?: string;
	isRecurring?: boolean;
	busyStatus?: "free" | "busy" | "tentative";
};
export type DateGridEventProps = {
	calendarEvent: ScheduleXEventLike;
	timeZone?: string;
	hour12?: boolean;
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

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const getTimeFormatter = (timeZone?: string, hour12?: boolean) => {
	const key = `${timeZone ?? "local"}:${hour12 ? "h12" : "h24"}`;
	const existing = formatterCache.get(key);
	if (existing) return existing;
	const formatter = new Intl.DateTimeFormat(undefined, {
		timeZone,
		hour: "numeric",
		minute: "2-digit",
		hour12,
	});
	formatterCache.set(key, formatter);
	return formatter;
};

const formatTime = (value: unknown, timeZone?: string, hour12?: boolean) => {
	const date = new Date(toMillis(value));
	return getTimeFormatter(timeZone, hour12).format(date);
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

function DateGridEventComponent({ calendarEvent, timeZone, hour12 }: DateGridEventProps) {
	const colorKey = toCssSafeColorKey(calendarEvent.calendarId);
	const isFree = calendarEvent.busyStatus === "free";
	const eventStyle = {
		backgroundColor: isFree ? "transparent" : `var(--sx-color-${colorKey}-container, #1b2640)`,
		color: `var(--sx-color-on-${colorKey}-container, #b8d0ff)`,
		borderInlineStart: isFree
			? `2px dashed var(--sx-color-${colorKey}, #5b8def)`
			: `2px solid var(--sx-color-${colorKey}, #5b8def)`,
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					data-event-id={calendarEvent.id ? String(calendarEvent.id) : undefined}
					className={cn(
						"group relative inline-flex items-center gap-1 max-w-full rounded-[6px] h-full w-full pl-2 pr-1.5 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing transition-[filter,box-shadow] duration-200 hover:brightness-[1.12]",
						isFree && "outline outline-1 outline-dashed -outline-offset-1",
					)}
					style={{
						...eventStyle,
						...(isFree ? { outlineColor: `var(--sx-color-${colorKey}, #5b8def)` } : {}),
					}}
					title={calendarEvent.title ?? "Untitled"}
					onMouseUp={(event) => {
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
						className="absolute top-0.5 right-0.5 hidden h-4 w-4 items-center justify-center rounded-sm border border-white/10 bg-black/30 text-white/80 backdrop-blur-sm transition hover:bg-black/55 group-hover:flex"
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
							"truncate font-[family-name:var(--font-outfit)] text-[0.68rem] font-semibold tracking-tight",
							isFree && "opacity-60",
						)}
					>
						{sanitizeDenseTitle(calendarEvent.title)}
					</span>
					<span className="font-[family-name:var(--font-cutive)] text-[0.52rem] tracking-[0.02em] opacity-40 shrink-0">
						{formatTime(calendarEvent.start, timeZone, hour12)}
					</span>
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

export const DateGridEvent = memo(DateGridEventComponent);
