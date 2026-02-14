"use client";

import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";

type SortableItemProps = {
	id: string;
	disabled?: boolean;
	data?: Record<string, unknown>;
	children: ReactNode;
	className?: string;
};

export function SortableItem({ id, disabled, data, children, className }: SortableItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id,
		disabled,
		data,
	});

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(isDragging && "z-50 opacity-0", className)}
			{...attributes}
			{...listeners}
		>
			{children}
		</div>
	);
}
