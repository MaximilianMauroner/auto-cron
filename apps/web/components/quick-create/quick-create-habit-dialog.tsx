"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { CategoryPicker } from "@/components/category-picker";
import { DayPillGroup } from "@/components/recurrence/day-pill-group";
import { RecurrenceSelect } from "@/components/recurrence/recurrence-select";
import { Button } from "@/components/ui/button";
import { DurationInput } from "@/components/ui/duration-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useActionWithStatus, useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import {
	type RecurrenceState,
	defaultRecurrenceState,
	recurrenceStateToLegacyFrequency,
	recurrenceStateToRRule,
} from "@/lib/recurrence";
import type { HabitPriority } from "@auto-cron/types";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const priorityLabels: Record<HabitPriority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

const createRequestId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `habit-${Date.now()}-${Math.round(Math.random() * 10_000)}`;
};

type QuickCreateHabitDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function QuickCreateHabitDialog({ open, onOpenChange }: QuickCreateHabitDialogProps) {
	const [title, setTitle] = useState("");
	const [durationMinutes, setDurationMinutes] = useState("");
	const [categoryId, setCategoryId] = useState<string>("");
	const [recurrence, setRecurrence] = useState<RecurrenceState>(defaultRecurrenceState);
	const [priority, setPriority] = useState<HabitPriority>("medium");
	const [idealTime, setIdealTime] = useState("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [paywallOpen, setPaywallOpen] = useState(false);

	const { execute: createHabit, isPending } = useActionWithStatus(api.habits.actions.createHabit);
	const defaultCategoryQuery = useAuthenticatedQueryWithStatus(
		api.categories.queries.getDefaultCategory,
		{},
	);

	useEffect(() => {
		if (!open) return;
		setTitle("");
		setDurationMinutes(formatDurationFromMinutes(30));
		setCategoryId(defaultCategoryQuery.data?._id ?? "");
		setRecurrence(defaultRecurrenceState());
		setPriority("medium");
		setIdealTime("");
		setErrorMessage(null);
	}, [open, defaultCategoryQuery.data]);

	const onSubmit = async () => {
		const parsed = parseDurationToMinutes(durationMinutes);
		if (!title.trim() || parsed === null || parsed <= 0) {
			setErrorMessage("Please provide a title and valid duration.");
			return;
		}
		if (!categoryId) {
			setErrorMessage("Please select a category.");
			return;
		}
		setErrorMessage(null);

		const frequency = recurrenceStateToLegacyFrequency(recurrence);
		const recurrenceRule = recurrenceStateToRRule(recurrence);
		const preferredDays =
			recurrence.unit === "week" && recurrence.byDay.length > 0 ? recurrence.byDay : undefined;

		try {
			await createHabit({
				requestId: createRequestId(),
				input: {
					title: title.trim(),
					categoryId: categoryId as Id<"taskCategories">,
					frequency,
					recurrenceRule,
					priority,
					durationMinutes: parsed,
					minDurationMinutes: parsed,
					maxDurationMinutes: parsed,
					repeatsPerPeriod: 1,
					preferredDays,
					idealTime: idealTime || undefined,
					isActive: true,
				},
			});
			onOpenChange(false);
		} catch (error) {
			const payload = getConvexErrorPayload(error);
			if (payload?.code === "FEATURE_LIMIT_REACHED" && payload.featureId === "habits") {
				setPaywallOpen(true);
				setErrorMessage(payload.message ?? "Habit limit reached.");
				return;
			}
			setErrorMessage(payload?.message ?? "Could not create habit.");
		}
	};

	const showDayPills = recurrence.unit === "week";

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent side="right" className="w-80 p-0 sm:max-w-md" showCloseButton={false}>
					{/* ── Header ── */}
					<SheetHeader className="border-b border-border/60 px-6 py-5">
						<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							01 / New habit
						</p>
						<SheetTitle className="mt-1 font-[family-name:var(--font-outfit)] text-xl font-semibold tracking-tight">
							Quick create
						</SheetTitle>
					</SheetHeader>

					<div className="flex flex-col gap-0 px-6">
						{/* ── Habit name ── */}
						<div className="py-5">
							<Label
								htmlFor="qc-habit-title"
								className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70"
							>
								Habit name
							</Label>
							<Input
								id="qc-habit-title"
								value={title}
								onChange={(event) => {
									setTitle(event.target.value);
									if (errorMessage) setErrorMessage(null);
								}}
								onKeyDown={(event) => {
									if (event.key !== "Enter") return;
									event.preventDefault();
									void onSubmit();
								}}
								placeholder="What habit to build?"
								className="mt-2 border-0 border-b border-border/50 bg-transparent px-0 font-[family-name:var(--font-outfit)] text-[0.9rem] font-medium shadow-none ring-0 transition-colors placeholder:text-muted-foreground/40 focus-visible:border-accent focus-visible:ring-0"
								autoFocus
							/>
						</div>

						<div className="h-px bg-border/40" />

						{/* ── Timing ── */}
						<div className="space-y-3 py-5">
							<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
								Timing
							</p>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Duration
									</Label>
									<DurationInput
										value={durationMinutes}
										onChange={setDurationMinutes}
										placeholder="e.g. 30m"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Frequency
									</Label>
									<RecurrenceSelect value={recurrence} onChange={setRecurrence} />
								</div>
							</div>

							{/* ── Day pills (shown for weekly/biweekly) ── */}
							{showDayPills && (
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Preferred days
									</Label>
									<DayPillGroup
										selectedDays={recurrence.byDay}
										onChange={(byDay) => setRecurrence((r) => ({ ...r, byDay }))}
										size="sm"
									/>
								</div>
							)}

							{/* ── Ideal time (optional) ── */}
							<div className="space-y-1.5">
								<Label
									htmlFor="qc-habit-time"
									className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
								>
									Ideal time (optional)
								</Label>
								<Input
									id="qc-habit-time"
									type="time"
									value={idealTime}
									onChange={(e) => setIdealTime(e.target.value)}
									className="w-fit font-[family-name:var(--font-outfit)] text-[0.82rem]"
								/>
							</div>
						</div>

						<div className="h-px bg-border/40" />

						{/* ── Classification ── */}
						<div className="space-y-3 py-5">
							<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
								Classification
							</p>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Category
									</Label>
									<CategoryPicker value={categoryId} onValueChange={setCategoryId} />
								</div>
								<div className="space-y-1.5">
									<Label
										htmlFor="qc-habit-priority"
										className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
									>
										Priority
									</Label>
									<Select value={priority} onValueChange={(v) => setPriority(v as HabitPriority)}>
										<SelectTrigger id="qc-habit-priority">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(["low", "medium", "high", "critical"] as const).map((p) => (
												<SelectItem key={p} value={p}>
													{priorityLabels[p]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>

						{/* ── Error ── */}
						{errorMessage ? (
							<div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
								<p className="font-[family-name:var(--font-cutive)] text-[0.66rem] uppercase tracking-[0.05em] text-destructive">
									{errorMessage}
								</p>
							</div>
						) : null}
					</div>

					{/* ── Footer ── */}
					<SheetFooter className="mt-auto flex-row items-center gap-2 border-t border-border/60 px-6 py-4">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
							className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium tracking-[0.02em] text-muted-foreground hover:text-foreground"
						>
							Cancel
						</Button>
						<Button
							onClick={() => void onSubmit()}
							disabled={isPending}
							className="gap-2 bg-accent font-[family-name:var(--font-outfit)] text-[0.76rem] font-bold uppercase tracking-[0.1em] text-accent-foreground shadow-[0_2px_12px_-3px_rgba(252,163,17,0.3)] transition-all hover:bg-accent/90 hover:shadow-[0_4px_16px_-3px_rgba(252,163,17,0.4)]"
						>
							{isPending ? "Creating\u2026" : "Create"}
							<ArrowRight className="size-3.5" />
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="habits" />
		</>
	);
}
