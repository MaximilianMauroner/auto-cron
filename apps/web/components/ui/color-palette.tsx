"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

export const PALETTE_COLORS = [
	"#f59e0b",
	"#ef4444",
	"#22c55e",
	"#0ea5e9",
	"#6366f1",
	"#a855f7",
	"#ec4899",
	"#14b8a6",
] as const;

export const GOOGLE_CALENDAR_COLORS = [
	"#7ba0e6",
	"#5cc9a0",
	"#b08ce6",
	"#d97b74",
	"#d4b84e",
	"#d9a066",
	"#4bb8bd",
	"#a0a4aa",
	"#5b82d4",
	"#3aad72",
	"#c44a4e",
	"#d47e9a",
] as const;

type ColorPaletteProps = {
	value: string;
	onChange: (color: string) => void;
	colors?: readonly string[];
};

export function ColorPalette({ value, onChange, colors = PALETTE_COLORS }: ColorPaletteProps) {
	return (
		<div className="flex flex-wrap gap-2">
			{colors.map((color) => (
				<button
					key={color}
					type="button"
					onClick={() => onChange(color)}
					className={cn(
						"relative size-7 rounded-full shadow-sm ring-1 ring-black/10 transition-all hover:scale-110 hover:shadow-md",
						value === color && "ring-2 ring-primary ring-offset-2 ring-offset-background",
					)}
					style={{ backgroundColor: color }}
					aria-label={`Select ${color}`}
				>
					{value === color ? (
						<Check className="absolute inset-0 m-auto size-3 text-white drop-shadow-sm" />
					) : null}
				</button>
			))}
		</div>
	);
}

export function ColorPaletteDropdown({
	value,
	onChange,
	colors = PALETTE_COLORS,
}: ColorPaletteProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 transition-colors hover:bg-muted/50"
				>
					<span
						className="size-5 rounded-full ring-1 ring-black/10"
						style={{ backgroundColor: value }}
					/>
					<ChevronDown className="size-3.5 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-3">
				<div className="flex flex-wrap gap-2">
					{colors.map((color) => (
						<button
							key={color}
							type="button"
							onClick={() => {
								onChange(color);
								setOpen(false);
							}}
							className={cn(
								"relative size-7 rounded-full shadow-sm ring-1 ring-black/10 transition-all hover:scale-110 hover:shadow-md",
								value === color && "ring-2 ring-primary ring-offset-2 ring-offset-background",
							)}
							style={{ backgroundColor: color }}
							aria-label={`Select ${color}`}
						>
							{value === color ? (
								<Check className="absolute inset-0 m-auto size-3 text-white drop-shadow-sm" />
							) : null}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
