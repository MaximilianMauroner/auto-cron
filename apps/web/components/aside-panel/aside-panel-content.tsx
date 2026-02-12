"use client";

import { usePathname } from "next/navigation";
import { CalendarAsideContent } from "./calendar-aside-content";
import { TasksPrioritiesAside } from "./tasks-priorities-aside";

export function AsidePanelContent() {
	const pathname = usePathname();
	const isCalendarRoute = pathname.startsWith("/app/calendar");

	if (isCalendarRoute) {
		return <CalendarAsideContent />;
	}

	return <TasksPrioritiesAside />;
}
