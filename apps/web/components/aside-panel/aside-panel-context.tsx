"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ASIDE_COOKIE_NAME = "aside_panel_state";
const ASIDE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type AsidePanelContextValue = {
	open: boolean;
	setOpen: (value: boolean) => void;
	toggle: () => void;
	isMobile: boolean;
};

const AsidePanelContext = createContext<AsidePanelContextValue | null>(null);

export function AsidePanelProvider({
	defaultOpen = true,
	open: openProp,
	onOpenChange: setOpenProp,
	children,
}: {
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactNode;
}) {
	const isMobile = useIsMobile();
	const pathname = usePathname();
	const isCalendar = pathname.startsWith("/app/calendar");
	const [_open, _setOpen] = useState(defaultOpen);
	const open = openProp ?? _open;
	const prevPathRef = useRef(pathname);

	const setOpen = useCallback(
		(value: boolean) => {
			if (setOpenProp) {
				setOpenProp(value);
			} else {
				_setOpen(value);
			}
			document.cookie = `${ASIDE_COOKIE_NAME}=${value}; path=/; max-age=${ASIDE_COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
		},
		[setOpenProp],
	);

	// Auto-open on calendar, auto-close on other routes
	useEffect(() => {
		if (pathname === prevPathRef.current) return;
		prevPathRef.current = pathname;
		setOpen(isCalendar);
	}, [pathname, isCalendar, setOpen]);

	const toggle = useCallback(() => {
		setOpen(!open);
	}, [open, setOpen]);

	// Keyboard shortcut: Cmd+. to toggle
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "." && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				toggle();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [toggle]);

	return (
		<AsidePanelContext.Provider value={{ open, setOpen, toggle, isMobile }}>
			{children}
		</AsidePanelContext.Provider>
	);
}

export function useAsidePanel() {
	const context = useContext(AsidePanelContext);
	if (!context) {
		throw new Error("useAsidePanel must be used within an AsidePanelProvider");
	}
	return context;
}
