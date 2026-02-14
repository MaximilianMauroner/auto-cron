"use client";

import {
	type CollisionDetection,
	type DragEndEvent,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	closestCorners,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useState } from "react";

type UseDndKanbanOptions = {
	onMoveItem: (itemId: string, fromColumn: string, toColumn: string) => void;
	onReorderInColumn?: (columnId: string, activeId: string, overId: string) => void;
	getColumnForItem: (itemId: string) => string | null;
};

/** pointerWithin first (reliable for kanban), closestCorners fallback */
const kanbanCollisionDetection: CollisionDetection = (args) => {
	const pointerCollisions = pointerWithin(args);
	if (pointerCollisions.length > 0) return pointerCollisions;
	return closestCorners(args);
};

export function useDndKanban({
	onMoveItem,
	onReorderInColumn,
	getColumnForItem,
}: UseDndKanbanOptions) {
	const [activeId, setActiveId] = useState<string | null>(null);
	const [pendingMoves, setPendingMoves] = useState<Map<string, string>>(new Map());

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	// Auto-clear pending moves once server data reflects the move
	useEffect(() => {
		if (pendingMoves.size === 0) return;
		let changed = false;
		const next = new Map(pendingMoves);
		for (const [itemId, targetColumn] of pendingMoves) {
			if (getColumnForItem(itemId) === targetColumn) {
				next.delete(itemId);
				changed = true;
			}
		}
		if (changed) setPendingMoves(next);
	}, [pendingMoves, getColumnForItem]);

	const handleDragStart = useCallback((event: DragStartEvent) => {
		setActiveId(String(event.active.id));
	}, []);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			setActiveId(null);

			if (!over) return;

			const activeItemId = String(active.id);
			const overId = String(over.id);

			if (activeItemId === overId) return;

			const fromColumn = getColumnForItem(activeItemId);
			if (!fromColumn) return;

			// Determine target column: either the over item's column or the over id IS a column
			const overColumn = getColumnForItem(overId);
			const toColumn = overColumn ?? overId;

			if (fromColumn !== toColumn) {
				// Track optimistic move before firing mutation
				setPendingMoves((prev) => {
					const next = new Map(prev);
					next.set(activeItemId, toColumn);
					return next;
				});
				onMoveItem(activeItemId, fromColumn, toColumn);
			} else if (onReorderInColumn) {
				onReorderInColumn(fromColumn, activeItemId, overId);
			}
		},
		[onMoveItem, onReorderInColumn, getColumnForItem],
	);

	const handleDragCancel = useCallback(() => {
		setActiveId(null);
	}, []);

	return {
		activeId,
		pendingMoves,
		sensors,
		collisionDetection: kanbanCollisionDetection,
		handleDragStart,
		handleDragEnd,
		handleDragCancel,
	};
}
