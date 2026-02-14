"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type DragOverlayCardProps = {
	children: ReactNode;
	className?: string;
};

export function DragOverlayCard({ children, className }: DragOverlayCardProps) {
	return (
		<div
			className={cn(
				"rounded-xl border border-border/80 bg-card shadow-lg shadow-black/10",
				"rotate-[1.5deg] scale-[1.02]",
				className,
			)}
		>
			{children}
		</div>
	);
}
