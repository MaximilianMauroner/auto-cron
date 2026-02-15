"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserPreferences } from "@/components/user-preferences-context";
import { cn } from "@/lib/utils";
import { isValid, parse } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const displayFormatterCache = new Map<string, Intl.DateTimeFormat>();
const getDisplayFormatter = (hour12: boolean) => {
	const key = hour12 ? "h12" : "h24";
	const existing = displayFormatterCache.get(key);
	if (existing) return existing;
	const formatter = new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12,
	});
	displayFormatterCache.set(key, formatter);
	return formatter;
};

const parseLocalDateTime = (value: string): Date | null => {
	const match =
		value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/) ??
		value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
	if (!match) return null;
	const year = Number.parseInt(match[1] ?? "0", 10);
	const month = Number.parseInt(match[2] ?? "0", 10);
	const day = Number.parseInt(match[3] ?? "0", 10);
	const hour = Number.parseInt(match[4] ?? "0", 10);
	const minute = Number.parseInt(match[5] ?? "0", 10);
	if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) return null;
	const date = new Date(year, month - 1, day, hour, minute, 0, 0);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day ||
		date.getHours() !== hour ||
		date.getMinutes() !== minute
	) {
		return null;
	}
	return date;
};

const toDateTimeValue = (date: Date) => {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	const hour = `${date.getHours()}`.padStart(2, "0");
	const minute = `${date.getMinutes()}`.padStart(2, "0");
	return `${year}-${month}-${day}T${hour}:${minute}`;
};

const parseManualValue = (value: string): Date | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const directLocal = parseLocalDateTime(trimmed);
	if (directLocal) return directLocal;

	const formats = [
		"MMM d, yyyy HH:mm",
		"MMM d, yyyy H:mm",
		"MMM d yyyy HH:mm",
		"MMM d yyyy H:mm",
		"MMM d, yyyy h:mm a",
		"MMM d yyyy h:mm a",
		"M/d/yyyy HH:mm",
		"M/d/yyyy H:mm",
		"M/d/yyyy h:mm a",
		"yyyy-MM-dd HH:mm",
		"yyyy-MM-dd'T'HH:mm",
	] as const;

	for (const format of formats) {
		const candidate = parse(trimmed, format, new Date());
		if (isValid(candidate)) return candidate;
	}

	const fallback = new Date(trimmed);
	return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const parseTime = (value: string): { hours: number; minutes: number } | null => {
	const match = value.match(/^(\d{2}):(\d{2})$/);
	if (!match) return null;
	const hours = Number.parseInt(match[1] ?? "0", 10);
	const minutes = Number.parseInt(match[2] ?? "0", 10);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
	return { hours, minutes };
};

type DateTimePickerProps = {
	value: string;
	onChange: (nextValue: string) => void;
	placeholder?: string;
	minuteStep?: number;
	className?: string;
	allowClear?: boolean;
};

export function DateTimePicker({
	value,
	onChange,
	placeholder = "Anytime",
	minuteStep = 15,
	className,
	allowClear = true,
}: DateTimePickerProps) {
	const { hour12, weekStartsOn } = useUserPreferences();
	const [open, setOpen] = useState(false);
	const [draftText, setDraftText] = useState("");
	const [error, setError] = useState<string | null>(null);

	const selectedDate = useMemo(() => parseLocalDateTime(value), [value]);
	const selectedTime = useMemo(() => {
		if (!selectedDate) return "09:00";
		return `${String(selectedDate.getHours()).padStart(2, "0")}:${String(selectedDate.getMinutes()).padStart(2, "0")}`;
	}, [selectedDate]);

	useEffect(() => {
		if (!selectedDate) {
			setDraftText("");
			return;
		}
		setDraftText(getDisplayFormatter(hour12).format(selectedDate));
	}, [selectedDate, hour12]);

	const validateStep = (date: Date) => {
		if (minuteStep <= 1) return true;
		return date.getMinutes() % minuteStep === 0;
	};

	const applyDate = (date: Date) => {
		if (!validateStep(date)) {
			setError(`Minutes must be in ${minuteStep}-minute steps.`);
			return false;
		}
		setError(null);
		onChange(toDateTimeValue(date));
		return true;
	};

	const commitDraft = () => {
		const trimmed = draftText.trim();
		if (!trimmed) {
			if (!allowClear) {
				setError("A date and time is required.");
				return;
			}
			setError(null);
			onChange("");
			return;
		}

		const parsed = parseManualValue(trimmed);
		if (!parsed) {
			setError("Invalid date/time. Example: Feb 13, 2026 20:00");
			return;
		}
		applyDate(parsed);
	};

	const onSelectDay = (day?: Date) => {
		if (!day) return;
		const time = parseTime(selectedTime) ?? { hours: 9, minutes: 0 };
		const next = new Date(day);
		next.setHours(time.hours, time.minutes, 0, 0);
		if (applyDate(next)) setOpen(false);
	};

	const onChangeTime = (time: string) => {
		if (!selectedDate) return;
		const parsed = parseTime(time);
		if (!parsed) {
			setError("Time must be valid.");
			return;
		}
		const next = new Date(selectedDate);
		next.setHours(parsed.hours, parsed.minutes, 0, 0);
		applyDate(next);
	};

	return (
		<div className={cn("space-y-1.5", className)}>
			<div
				className={cn(
					"flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
					error ? "border-rose-500/70 ring-1 ring-rose-500/30" : "border-border",
				)}
			>
				<Input
					value={draftText}
					onChange={(event) => {
						setDraftText(event.target.value);
						if (error) setError(null);
					}}
					onFocus={() => setOpen(true)}
					onBlur={commitDraft}
					onKeyDown={(event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						commitDraft();
					}}
					placeholder={placeholder}
					className="h-9 border-0 px-1 shadow-none focus-visible:ring-0"
				/>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button type="button" size="icon" variant="ghost" className="size-8 shrink-0">
							<CalendarIcon className="size-4" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-auto p-3">
						<Calendar
							mode="single"
							selected={selectedDate ?? undefined}
							onSelect={onSelectDay}
							weekStartsOn={weekStartsOn}
						/>
						<div className="mt-3 flex items-center gap-2">
							<Input
								type="time"
								step={minuteStep * 60}
								value={selectedTime}
								onChange={(event) => onChangeTime(event.target.value)}
								className="h-9"
							/>
							{allowClear ? (
								<Button
									type="button"
									size="icon"
									variant="ghost"
									className="size-8"
									onClick={() => {
										onChange("");
										setError(null);
										setOpen(false);
									}}
								>
									<X className="size-4" />
								</Button>
							) : null}
						</div>
					</PopoverContent>
				</Popover>
			</div>
			{error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
		</div>
	);
}
