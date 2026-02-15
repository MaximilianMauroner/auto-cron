"use client";

import {
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { priorityLabels } from "@/lib/scheduling-constants";
import type { Priority } from "@auto-cron/types";
import { Check, Flag } from "lucide-react";

export function PrioritySubmenu<TPriority extends Priority>({
	value,
	options,
	onChange,
}: {
	value: TPriority;
	options: TPriority[];
	onChange: (priority: TPriority) => void;
}) {
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<Flag className="mr-2 size-3.5" />
				Priority
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="w-44">
				{options.map((priority) => (
					<DropdownMenuItem
						key={priority}
						onClick={() => onChange(priority)}
						className="flex items-center justify-between"
					>
						<span>{priorityLabels[priority]}</span>
						{value === priority ? <Check className="size-3.5" /> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
