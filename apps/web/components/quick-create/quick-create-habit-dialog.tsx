"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { useActionWithStatus } from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import type { HabitCategory, HabitFrequency, HabitPriority } from "@auto-cron/types";
import { Repeat2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";

const categoryLabels: Record<HabitCategory, string> = {
	health: "Health",
	fitness: "Fitness",
	learning: "Learning",
	mindfulness: "Mindfulness",
	productivity: "Productivity",
	social: "Social",
	other: "Other",
};

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
	const [category, setCategory] = useState<HabitCategory>("productivity");
	const [frequency, setFrequency] = useState<HabitFrequency>("weekly");
	const [priority, setPriority] = useState<HabitPriority>("medium");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [paywallOpen, setPaywallOpen] = useState(false);

	const { execute: createHabit, isPending } = useActionWithStatus(api.habits.actions.createHabit);

	useEffect(() => {
		if (!open) return;
		setTitle("");
		setDurationMinutes(formatDurationFromMinutes(30));
		setCategory("productivity");
		setFrequency("weekly");
		setPriority("medium");
		setErrorMessage(null);
	}, [open]);

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
					category,
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
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="gap-0 border-border/80 bg-card p-0 sm:max-w-md">
					<DialogHeader className="border-b border-border/70 px-5 py-4">
						<DialogTitle className="flex items-center gap-2 text-lg">
							<Repeat2 className="size-4 text-primary" />
							Quick create habit
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 px-5 py-4">
						<div className="space-y-1.5">
							<Label htmlFor="qc-habit-title" className="text-xs uppercase tracking-[0.1em]">
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
								autoFocus
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label className="text-xs uppercase tracking-[0.1em]">Duration</Label>
								<DurationInput
									value={durationMinutes}
									onChange={setDurationMinutes}
									placeholder="e.g. 30 mins"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="qc-habit-frequency" className="text-xs uppercase tracking-[0.1em]">
									Frequency
								</Label>
								<Select value={frequency} onValueChange={(v) => setFrequency(v as HabitFrequency)}>
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
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="qc-habit-category" className="text-xs uppercase tracking-[0.1em]">
									Category
								</Label>
								<Select value={category} onValueChange={(v) => setCategory(v as HabitCategory)}>
									<SelectTrigger id="qc-habit-category">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(
											[
												"health",
												"fitness",
												"learning",
												"mindfulness",
												"productivity",
												"social",
												"other",
											] as const
										).map((c) => (
											<SelectItem key={c} value={c}>
												{categoryLabels[c]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="qc-habit-priority" className="text-xs uppercase tracking-[0.1em]">
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
						{errorMessage ? (
							<p className="text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
						) : null}
					</div>
					<DialogFooter className="border-t border-border/70 px-5 py-3">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => void onSubmit()}
							disabled={isPending}
							className="gap-1.5 bg-accent text-accent-foreground shadow-[0_2px_8px_-2px_rgba(252,163,17,0.2)] hover:bg-accent/90"
						>
							<Repeat2 className="size-3.5" />
							{isPending ? "Creating..." : "Create habit"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="habits" />
		</>
	);
}
