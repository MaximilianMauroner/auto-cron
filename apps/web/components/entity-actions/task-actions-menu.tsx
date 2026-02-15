"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statusLabels } from "@/lib/scheduling-constants";
import type { Priority, TaskStatus } from "@auto-cron/types";
import {
	CalendarDays,
	CheckCircle2,
	Circle,
	CircleDot,
	MoreVertical,
	Pencil,
	Trash2,
} from "lucide-react";
import { PrioritySubmenu } from "./priority-submenu";

const taskPriorityOptions: Priority[] = ["low", "medium", "high", "critical", "blocker"];

export function TaskActionsMenu({
	priority,
	status,
	disabled,
	onOpenDetails,
	onEdit,
	onOpenInCalendar,
	onDelete,
	onChangePriority,
	onChangeStatus,
}: {
	priority: Priority;
	status: TaskStatus;
	disabled?: boolean;
	onOpenDetails?: () => void;
	onEdit?: () => void;
	onOpenInCalendar?: () => void;
	onDelete?: () => void;
	onChangePriority: (priority: Priority) => void;
	onChangeStatus: (status: TaskStatus) => void;
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
				<DropdownMenuItem onClick={() => onChangeStatus("backlog")} disabled={status === "backlog"}>
					<Circle className="mr-2 size-3.5" />
					{statusLabels.backlog}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onChangeStatus("queued")} disabled={status === "queued"}>
					<CircleDot className="mr-2 size-3.5" />
					{statusLabels.queued}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onChangeStatus("done")} disabled={status === "done"}>
					<CheckCircle2 className="mr-2 size-3.5" />
					{statusLabels.done}
				</DropdownMenuItem>
				<PrioritySubmenu
					value={priority}
					options={taskPriorityOptions}
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
