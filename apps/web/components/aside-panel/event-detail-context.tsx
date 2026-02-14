"use client";

import type { CalendarEventDTO, CalendarSource } from "@auto-cron/types";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAsidePanel } from "./aside-panel-context";

export type EventDetailData = {
	eventId: string;
	title: string;
	description: string;
	start: number;
	end: number;
	allDay: boolean;
	calendarId: string;
	busyStatus: "free" | "busy" | "tentative";
	visibility: "default" | "public" | "private" | "confidential";
	location: string;
	recurrenceRule: string;
	source: CalendarSource;
	sourceId?: string;
	color?: string;
	pinned?: boolean;
	recurringEventId?: string;
};

type EventDetailContextValue = {
	eventDetail: EventDetailData | null;
	showEventDetail: (data: EventDetailData) => void;
	clearEventDetail: () => void;
};

const EventDetailContext = createContext<EventDetailContextValue | null>(null);

export function EventDetailProvider({ children }: { children: React.ReactNode }) {
	const [eventDetail, setEventDetail] = useState<EventDetailData | null>(null);
	const { setOpen } = useAsidePanel();
	const pathname = usePathname();
	const prevPathRef = useRef(pathname);

	const showEventDetail = useCallback(
		(data: EventDetailData) => {
			setEventDetail(data);
			setOpen(true);
		},
		[setOpen],
	);

	const clearEventDetail = useCallback(() => {
		setEventDetail(null);
	}, []);

	// Auto-clear when navigating away from calendar
	useEffect(() => {
		if (pathname === prevPathRef.current) return;
		prevPathRef.current = pathname;
		if (!pathname.startsWith("/app/calendar")) {
			setEventDetail(null);
		}
	}, [pathname]);

	return (
		<EventDetailContext.Provider value={{ eventDetail, showEventDetail, clearEventDetail }}>
			{children}
		</EventDetailContext.Provider>
	);
}

export function useEventDetail() {
	const context = useContext(EventDetailContext);
	if (!context) {
		throw new Error("useEventDetail must be used within an EventDetailProvider");
	}
	return context;
}

export function eventDetailFromDTO(event: CalendarEventDTO): EventDetailData {
	return {
		eventId: event._id,
		title: event.title,
		description: event.description ?? "",
		start: event.start,
		end: event.end,
		allDay: event.allDay,
		calendarId: event.calendarId ?? "primary",
		busyStatus: event.busyStatus ?? "busy",
		visibility: event.visibility ?? "default",
		location: event.location ?? "",
		recurrenceRule: event.recurrenceRule ?? "",
		source: event.source,
		sourceId: event.sourceId,
		color: event.color,
		pinned: event.pinned,
		recurringEventId: event.recurringEventId,
	};
}
