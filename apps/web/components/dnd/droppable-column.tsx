"use client";

import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";

type DroppableColumnProps = {
	id: string;
	items: string[];
	children?: ReactNode;
	className?: string;
};

export function DroppableColumn({ id, items, children, className }: DroppableColumnProps) {
	const { setNodeRef, isOver } = useDroppable({ id });

	return (
		<SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
			<div
				ref={setNodeRef}
				className={cn(
					"min-h-[3rem] rounded-lg transition-colors duration-150",
					isOver && "ring-2 ring-accent/40 bg-accent/5",
					className,
				)}
			>
				{children}
			</div>
		</SortableContext>
	);
}
