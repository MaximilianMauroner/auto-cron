"use client";

import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { EndCondition, RecurrenceState, RecurrenceUnit } from "@/lib/recurrence";
import { useState } from "react";
import { DayPillGroup } from "./day-pill-group";

type CustomRecurrenceDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: RecurrenceState;
	onSave: (state: RecurrenceState) => void;
};

const unitLabels: Record<RecurrenceUnit, { singular: string; plural: string }> = {
	day: { singular: "day", plural: "days" },
	week: { singular: "week", plural: "weeks" },
	month: { singular: "month", plural: "months" },
};

const toDateTimeInput = (date?: string) => {
	if (!date) return "";
	return `${date}T00:00`;
};

const fromDateTimeInput = (value: string) => {
	if (!value) return undefined;
	return value.split("T")[0];
};

export function CustomRecurrenceDialog({
	open,
	onOpenChange,
	value,
	onSave,
}: CustomRecurrenceDialogProps) {
	const [draft, setDraft] = useState<RecurrenceState>(value);

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraft(value);
		}
		onOpenChange(nextOpen);
	};

	const handleSave = () => {
		onSave({ ...draft, preset: "custom" });
		onOpenChange(false);
	};

	const unitLabel =
		draft.interval === 1 ? unitLabels[draft.unit].singular : unitLabels[draft.unit].plural;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
						Custom recurrence
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-5">
					{/* ── Repeat every N unit ── */}
					<div className="space-y-2">
						<Label className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
							Repeat every
						</Label>
						<div className="flex items-center gap-2">
							<Input
								type="number"
								min={1}
								max={99}
								value={draft.interval}
								onChange={(e) => {
									const val = Number.parseInt(e.target.value, 10);
									if (Number.isFinite(val) && val > 0) {
										setDraft((d) => ({ ...d, interval: val }));
									}
								}}
								className="w-20 text-center font-[family-name:var(--font-outfit)]"
							/>
							<Select
								value={draft.unit}
								onValueChange={(unit) =>
									setDraft((d) => ({
										...d,
										unit: unit as RecurrenceUnit,
										byDay: unit !== "week" ? [] : d.byDay,
									}))
								}
							>
								<SelectTrigger className="w-28">
									<SelectValue>{unitLabel}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="day">{draft.interval === 1 ? "day" : "days"}</SelectItem>
									<SelectItem value="week">{draft.interval === 1 ? "week" : "weeks"}</SelectItem>
									<SelectItem value="month">{draft.interval === 1 ? "month" : "months"}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* ── Repeat on (days) — only for weekly ── */}
					{draft.unit === "week" && (
						<div className="space-y-2">
							<Label className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
								Repeat on
							</Label>
							<DayPillGroup
								selectedDays={draft.byDay}
								onChange={(byDay) => setDraft((d) => ({ ...d, byDay }))}
							/>
						</div>
					)}

					{/* ── Ends ── */}
					<div className="space-y-3">
						<Label className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
							Ends
						</Label>
						<RadioGroup
							value={draft.endCondition}
							onValueChange={(v) => setDraft((d) => ({ ...d, endCondition: v as EndCondition }))}
							className="gap-3"
						>
							{/* Never */}
							<div className="flex items-center gap-3">
								<RadioGroupItem value="never" id="end-never" />
								<Label
									htmlFor="end-never"
									className="font-[family-name:var(--font-outfit)] text-sm font-normal"
								>
									Never
								</Label>
							</div>

							{/* On date */}
							<div className="flex items-center gap-3">
								<RadioGroupItem value="on_date" id="end-on-date" />
								<Label
									htmlFor="end-on-date"
									className="font-[family-name:var(--font-outfit)] text-sm font-normal"
								>
									On
								</Label>
								{draft.endCondition === "on_date" ? (
									<DateTimePicker
										value={toDateTimeInput(draft.endDate)}
										onChange={(v) =>
											setDraft((d) => ({
												...d,
												endDate: fromDateTimeInput(v),
												endCondition: "on_date",
											}))
										}
										minuteStep={60}
									/>
								) : (
									<span className="font-[family-name:var(--font-outfit)] text-sm text-muted-foreground">
										{draft.endDate ?? "Select a date"}
									</span>
								)}
							</div>

							{/* After N occurrences */}
							<div className="flex items-center gap-3">
								<RadioGroupItem value="after_count" id="end-after-count" />
								<Label
									htmlFor="end-after-count"
									className="font-[family-name:var(--font-outfit)] text-sm font-normal"
								>
									After
								</Label>
								<Input
									type="number"
									min={1}
									max={999}
									value={draft.endCount ?? 13}
									onChange={(e) => {
										const val = Number.parseInt(e.target.value, 10);
										if (Number.isFinite(val) && val > 0) {
											setDraft((d) => ({
												...d,
												endCount: val,
												endCondition: "after_count",
											}));
										}
									}}
									disabled={draft.endCondition !== "after_count"}
									className="w-20 text-center font-[family-name:var(--font-outfit)]"
								/>
								<span className="font-[family-name:var(--font-outfit)] text-sm text-muted-foreground">
									occurrences
								</span>
							</div>
						</RadioGroup>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium text-muted-foreground hover:text-foreground"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						className="bg-accent font-[family-name:var(--font-outfit)] text-[0.76rem] font-bold uppercase tracking-[0.1em] text-accent-foreground hover:bg-accent/90"
					>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
