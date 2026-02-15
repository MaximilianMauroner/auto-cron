"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	type PresetOption,
	type RecurrenceState,
	buildContextualPresets,
	describeRecurrence,
} from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { CustomRecurrenceDialog } from "./custom-recurrence-dialog";

type RecurrenceSelectProps = {
	value: RecurrenceState;
	onChange: (state: RecurrenceState) => void;
	disabled?: boolean;
	className?: string;
};

export function RecurrenceSelect({ value, onChange, disabled, className }: RecurrenceSelectProps) {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [customDialogOpen, setCustomDialogOpen] = useState(false);

	const presets = useMemo(() => buildContextualPresets(), []);

	const displayLabel = useMemo(() => describeRecurrence(value), [value]);

	const selectPreset = (preset: PresetOption) => {
		onChange(preset.state);
		setPopoverOpen(false);
	};

	const openCustom = () => {
		setPopoverOpen(false);
		setCustomDialogOpen(true);
	};

	const handleCustomSave = (state: RecurrenceState) => {
		onChange(state);
	};

	const isActive = (preset: PresetOption) => {
		return describeRecurrence(value) === describeRecurrence(preset.state);
	};

	const isCustomActive = value.preset === "custom" && !presets.some((p) => isActive(p));

	return (
		<>
			<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger
					disabled={disabled}
					className={cn(
						"border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
				>
					<span className="truncate">{displayLabel}</span>
					<ChevronDownIcon className="size-4 shrink-0 opacity-50" />
				</PopoverTrigger>
				<PopoverContent align="start" className="w-auto min-w-[14rem] p-1">
					{presets.map((preset) => {
						const active = isActive(preset);
						return (
							<button
								key={preset.value}
								type="button"
								onClick={() => selectPreset(preset)}
								className={cn(
									"relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none transition-colors hover:bg-muted hover:text-foreground",
									active && "font-medium",
								)}
							>
								{preset.label}
								{active && (
									<span className="absolute right-2 flex size-3.5 items-center justify-center">
										<CheckIcon className="size-4" />
									</span>
								)}
							</button>
						);
					})}

					<div className="bg-border -mx-1 my-1 h-px" />

					<button
						type="button"
						onClick={openCustom}
						className={cn(
							"relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none transition-colors hover:bg-muted hover:text-foreground",
							isCustomActive && "font-medium",
						)}
					>
						Custom...
						{isCustomActive && (
							<span className="absolute right-2 flex size-3.5 items-center justify-center">
								<CheckIcon className="size-4" />
							</span>
						)}
					</button>
				</PopoverContent>
			</Popover>

			<CustomRecurrenceDialog
				open={customDialogOpen}
				onOpenChange={setCustomDialogOpen}
				value={value}
				onSave={handleCustomSave}
			/>
		</>
	);
}
