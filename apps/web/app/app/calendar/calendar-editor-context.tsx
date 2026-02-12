"use client";

import { type ReactNode, createContext, useContext } from "react";

type CalendarEditorContextValue = {
	editor: boolean; // true when an event is being edited/viewed
	renderAside: () => ReactNode;
};

const CalendarEditorContext = createContext<CalendarEditorContextValue | null>(null);

export function CalendarEditorProvider({
	editor,
	renderAside,
	children,
}: {
	editor: boolean;
	renderAside: () => ReactNode;
	children: ReactNode;
}) {
	return (
		<CalendarEditorContext.Provider value={{ editor, renderAside }}>
			{children}
		</CalendarEditorContext.Provider>
	);
}

export function useCalendarEditor() {
	return useContext(CalendarEditorContext);
}
