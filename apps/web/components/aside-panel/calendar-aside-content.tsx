"use client";

import { useCalendarEditor } from "@/app/app/calendar/calendar-editor-context";
import { TasksPrioritiesAside } from "./tasks-priorities-aside";

export function CalendarAsideContent() {
	const editorContext = useCalendarEditor();

	// When no event is being edited, show priorities/tasks
	if (!editorContext?.editor) {
		return <TasksPrioritiesAside />;
	}

	// When an event is being edited, render the calendar aside
	// The calendar-client.tsx will render its aside content into the panel directly
	return <>{editorContext.renderAside()}</>;
}
