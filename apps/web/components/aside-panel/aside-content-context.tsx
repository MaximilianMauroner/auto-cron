"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAsidePanel } from "./aside-panel-context";

export type AsideInboxTab = "tasks" | "priorities";
export type AsideBucket = "upcoming" | "past";
export type AsideMode = "details" | "edit";

type AsideRoute =
	| {
			kind: "inbox";
			tab: AsideInboxTab;
	  }
	| {
			kind: "taskDetails" | "taskEdit";
			taskId: string;
	  }
	| {
			kind: "habitDetails" | "habitEdit";
			habitId: string;
	  }
	| {
			kind: "eventDetails" | "eventEdit";
			eventId: string;
	  };

type OpenOptions = {
	replace?: boolean;
};

type AsideContentContextValue = {
	route: AsideRoute;
	canGoBack: boolean;
	openInbox: (tab?: AsideInboxTab, opts?: OpenOptions) => void;
	openTask: (taskId: string, mode?: AsideMode, opts?: OpenOptions) => void;
	openHabit: (habitId: string, mode?: AsideMode, opts?: OpenOptions) => void;
	openEvent: (eventId: string, mode?: AsideMode, opts?: OpenOptions) => void;
	goBack: () => void;
	close: () => void;
};

const INITIAL_ROUTE: AsideRoute = { kind: "inbox", tab: "tasks" };

const AsideContentContext = createContext<AsideContentContextValue | null>(null);

const updateRouteForMode = (current: AsideRoute, mode: AsideMode): AsideRoute => {
	if (current.kind === "taskDetails" || current.kind === "taskEdit") {
		return { kind: mode === "edit" ? "taskEdit" : "taskDetails", taskId: current.taskId };
	}
	if (current.kind === "habitDetails" || current.kind === "habitEdit") {
		return { kind: mode === "edit" ? "habitEdit" : "habitDetails", habitId: current.habitId };
	}
	if (current.kind === "eventDetails" || current.kind === "eventEdit") {
		return { kind: mode === "edit" ? "eventEdit" : "eventDetails", eventId: current.eventId };
	}
	return current;
};

export function AsideContentProvider({ children }: { children: React.ReactNode }) {
	const { setOpen } = useAsidePanel();
	const [route, setRoute] = useState<AsideRoute>(INITIAL_ROUTE);
	const [history, setHistory] = useState<AsideRoute[]>([]);

	const transition = useCallback(
		(nextRoute: AsideRoute, opts?: OpenOptions) => {
			setHistory((prev) => {
				if (opts?.replace) return prev;
				return [...prev, route];
			});
			setRoute(nextRoute);
			setOpen(true);
		},
		[route, setOpen],
	);

	const openInbox = useCallback(
		(tab: AsideInboxTab = "tasks", opts?: OpenOptions) => {
			if (route.kind === "inbox" && route.tab === tab) {
				setOpen(true);
				return;
			}
			transition({ kind: "inbox", tab }, opts);
		},
		[route, setOpen, transition],
	);

	const openTask = useCallback(
		(taskId: string, mode: AsideMode = "details", opts?: OpenOptions) => {
			transition({ kind: mode === "edit" ? "taskEdit" : "taskDetails", taskId }, opts);
		},
		[transition],
	);

	const openHabit = useCallback(
		(habitId: string, mode: AsideMode = "details", opts?: OpenOptions) => {
			transition({ kind: mode === "edit" ? "habitEdit" : "habitDetails", habitId }, opts);
		},
		[transition],
	);

	const openEvent = useCallback(
		(eventId: string, mode: AsideMode = "details", opts?: OpenOptions) => {
			transition({ kind: mode === "edit" ? "eventEdit" : "eventDetails", eventId }, opts);
		},
		[transition],
	);

	const goBack = useCallback(() => {
		setHistory((prev) => {
			if (prev.length === 0) {
				setRoute(INITIAL_ROUTE);
				return prev;
			}
			const next = [...prev];
			const previousRoute = next.pop();
			if (previousRoute) {
				setRoute(previousRoute);
			}
			return next;
		});
	}, []);

	const close = useCallback(() => {
		setOpen(false);
	}, [setOpen]);

	const value = useMemo<AsideContentContextValue>(
		() => ({
			route,
			canGoBack: history.length > 0,
			openInbox,
			openTask,
			openHabit,
			openEvent,
			goBack,
			close,
		}),
		[close, goBack, history.length, openEvent, openHabit, openInbox, openTask, route],
	);

	return <AsideContentContext.Provider value={value}>{children}</AsideContentContext.Provider>;
}

export function useAsideContent() {
	const context = useContext(AsideContentContext);
	if (!context) {
		throw new Error("useAsideContent must be used within an AsideContentProvider");
	}
	return context;
}

export function useAsideModeSwitch() {
	const { route, openTask, openHabit, openEvent } = useAsideContent();
	return useCallback(
		(mode: AsideMode) => {
			const nextRoute = updateRouteForMode(route, mode);
			if (nextRoute.kind === "taskDetails" || nextRoute.kind === "taskEdit") {
				openTask(nextRoute.taskId, mode, { replace: true });
				return;
			}
			if (nextRoute.kind === "habitDetails" || nextRoute.kind === "habitEdit") {
				openHabit(nextRoute.habitId, mode, { replace: true });
				return;
			}
			if (nextRoute.kind === "eventDetails" || nextRoute.kind === "eventEdit") {
				openEvent(nextRoute.eventId, mode, { replace: true });
			}
		},
		[openEvent, openHabit, openTask, route],
	);
}
