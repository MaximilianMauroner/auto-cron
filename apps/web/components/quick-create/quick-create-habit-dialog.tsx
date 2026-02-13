"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { CategoryPicker } from "@/components/category-picker";
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
import type { HabitFrequency, HabitPriority } from "@auto-cron/types";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const frequencyLabels: Record<HabitFrequency, string> = {
	daily: "Daily",
	weekly: "Weekly",
	biweekly: "Biweekly",
	monthly: "Monthly",
};

const priorityLabels: Record<HabitPriority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

const recurrenceFromFrequency = (frequency: HabitFrequency) => {
	switch (frequency) {
		case "daily":
			return "RRULE:FREQ=DAILY;INTERVAL=1";
		case "weekly":
			return "RRULE:FREQ=WEEKLY;INTERVAL=1";
		case "biweekly":
			return "RRULE:FREQ=WEEKLY;INTERVAL=2";
		case "monthly":
			return "RRULE:FREQ=MONTHLY;INTERVAL=1";
		default:
			return "RRULE:FREQ=WEEKLY;INTERVAL=1";
	}
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
	const [frequency, setFrequency] = useState<HabitFrequency>("weekly");
	const [priority, setPriority] = useState<HabitPriority>("medium");
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
		setFrequency("weekly");
		setPriority("medium");
		setErrorMessage(null);
	}, [open, defaultCategoryQuery.data]);

	const onSubmit = async () => {
		const parsed = parseDurationToMinutes(durationMinutes);
		if (!title.trim() || parsed === null || parsed <= 0) {
			setErrorMessage("Please provide a title and valid duration.");
			return;
		}
		setErrorMessage(null);
		try {
			await createHabit({
				requestId: createRequestId(),
				input: {
					title: title.trim(),
					categoryId: categoryId as Id<"taskCategories">,
					frequency,
					recurrenceRule: recurrenceFromFrequency(frequency),
					priority,
					durationMinutes: parsed,
					minDurationMinutes: parsed,
					maxDurationMinutes: parsed,
					repeatsPerPeriod: 1,
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
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60">
										Duration
									</Label>
									<DurationInput
										value={durationMinutes}
										onChange={setDurationMinutes}
										placeholder="e.g. 30m"
									/>
								</div>
								<div className="space-y-1.5">
									<Label
										htmlFor="qc-habit-frequency"
										className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60"
									>
										Frequency
									</Label>
									<Select
										value={frequency}
										onValueChange={(v) => setFrequency(v as HabitFrequency)}
									>
										<SelectTrigger id="qc-habit-frequency">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(["daily", "weekly", "biweekly", "monthly"] as const).map((f) => (
												<SelectItem key={f} value={f}>
													{frequencyLabels[f]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
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
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60">
										Category
									</Label>
									<CategoryPicker value={categoryId} onValueChange={setCategoryId} />
								</div>
								<div className="space-y-1.5">
									<Label
										htmlFor="qc-habit-priority"
										className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60"
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
							{isPending ? "Creating…" : "Create"}
							<ArrowRight className="size-3.5" />
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="habits" />
		</>
	);
}
