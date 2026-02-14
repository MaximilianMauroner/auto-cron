"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAsidePanel } from "./aside-panel-context";

export function AsidePanel({ children }: { children: React.ReactNode }) {
	const { open, setOpen, isMobile } = useAsidePanel();

	if (isMobile) {
		return (
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent
					side="right"
					className="w-80 border-border/80 bg-card/95 p-0"
					showCloseButton={false}
				>
					<div className="flex h-full flex-col overflow-hidden">{children}</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<aside
			className={`border-l border-border/60 bg-card/95 transition-[width] duration-200 ease-in-out overflow-hidden shrink-0 ${
				open ? "w-80" : "w-0"
			}`}
		>
			<div className="flex h-full min-w-80 flex-col overflow-hidden">{children}</div>
		</aside>
	);
}
