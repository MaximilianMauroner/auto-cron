"use client";

import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "./input";

type DurationInputProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
};

export function DurationInput({
	value,
	onChange,
	placeholder = "e.g. 30 mins, 2 hrs, 1h30m",
	className,
}: DurationInputProps) {
	const [error, setError] = useState<string | null>(null);

	const apply = () => {
		const trimmed = value.trim();
		if (!trimmed) {
			setError(null);
			onChange("");
			return;
		}
		const parsed = parseDurationToMinutes(trimmed);
		if (!parsed || parsed <= 0) {
			setError("Invalid duration. Use formats like 30 mins, 2 hrs, 1h30m.");
			return;
		}
		setError(null);
		onChange(formatDurationFromMinutes(parsed));
	};

	return (
		<div className="space-y-1">
			<Input
				type="text"
				inputMode="text"
				value={value}
				placeholder={placeholder}
				onChange={(event) => {
					if (error) setError(null);
					onChange(event.target.value);
				}}
				onBlur={apply}
				onKeyDown={(event) => {
					if (event.key !== "Enter") return;
					event.preventDefault();
					apply();
				}}
				aria-invalid={Boolean(error)}
				className={cn(error && "border-rose-500/70 ring-1 ring-rose-500/25", className)}
			/>
			{error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
		</div>
	);
}
