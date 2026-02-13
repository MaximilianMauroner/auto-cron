"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

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
	children,
}: {
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const isMobile = useIsMobile();
	const [open, _setOpen] = useState(defaultOpen);

	const setOpen = useCallback((value: boolean) => {
		_setOpen(value);
		document.cookie = `${ASIDE_COOKIE_NAME}=${value}; path=/; max-age=${ASIDE_COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
	}, []);

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
