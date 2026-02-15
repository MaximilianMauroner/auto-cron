"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HabitPriority } from "@auto-cron/types";
import { CalendarDays, MoreVertical, PauseCircle, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { PrioritySubmenu } from "./priority-submenu";

const habitPriorityOptions: HabitPriority[] = ["low", "medium", "high", "critical"];

export function HabitActionsMenu({
	priority,
	isActive,
	disabled,
	onOpenDetails,
	onEdit,
	onOpenInCalendar,
	onToggleActive,
	onDelete,
	onChangePriority,
}: {
	priority: HabitPriority;
	isActive: boolean;
	disabled?: boolean;
	onOpenDetails?: () => void;
	onEdit?: () => void;
	onOpenInCalendar?: () => void;
	onToggleActive: (nextActive: boolean) => void;
	onDelete?: () => void;
	onChangePriority: (priority: HabitPriority) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7"
					disabled={disabled}
					onClick={(event) => event.stopPropagation()}
				>
					<MoreVertical className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{onOpenDetails ? (
					<DropdownMenuItem onClick={onOpenDetails}>Open details</DropdownMenuItem>
				) : null}
				{onEdit ? (
					<DropdownMenuItem onClick={onEdit}>
						<Pencil className="mr-2 size-3.5" />
						Edit
					</DropdownMenuItem>
				) : null}
				{onOpenInCalendar ? (
					<DropdownMenuItem onClick={onOpenInCalendar}>
						<CalendarDays className="mr-2 size-3.5" />
						Open in calendar
					</DropdownMenuItem>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => onToggleActive(!isActive)}>
					{isActive ? (
						<>
							<PauseCircle className="mr-2 size-3.5" />
							Pause
						</>
					) : (
						<>
							<PlayCircle className="mr-2 size-3.5" />
							Resume
						</>
					)}
				</DropdownMenuItem>
				<PrioritySubmenu
					value={priority}
					options={habitPriorityOptions}
					onChange={(nextPriority) => onChangePriority(nextPriority)}
				/>
				{onDelete ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={onDelete}
						>
							<Trash2 className="mr-2 size-3.5" />
							Delete
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
