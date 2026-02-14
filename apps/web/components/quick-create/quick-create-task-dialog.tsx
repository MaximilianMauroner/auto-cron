"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { CategoryPicker } from "@/components/category-picker";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
import { Switch } from "@/components/ui/switch";
import { useActionWithStatus, useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import type { Priority, TaskVisibilityPreference } from "@auto-cron/types";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type TaskQuickCreateDefaults = {
	priority: Priority;
	status: "backlog" | "queued";
	estimatedMinutes: number;
	splitAllowed: boolean;
	minChunkMinutes: number;
	maxChunkMinutes: number;
	restMinutes: number;
	travelMinutes: number;
	sendToUpNext: boolean;
	visibilityPreference: TaskVisibilityPreference;
	color: string;
};

const fallbackDefaults: TaskQuickCreateDefaults = {
	priority: "medium",
	status: "backlog",
	estimatedMinutes: 30,
	splitAllowed: true,
	minChunkMinutes: 30,
	maxChunkMinutes: 180,
	restMinutes: 0,
	travelMinutes: 0,
	sendToUpNext: false,
	visibilityPreference: "private",
	color: "#f59e0b",
};

const createRequestId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `task-${Date.now()}-${Math.round(Math.random() * 10_000)}`;
};

const toTimestamp = (value: string) => {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

const priorityLabels: Record<Priority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
	blocker: "Blocker",
};

type QuickCreateTaskDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function QuickCreateTaskDialog({ open, onOpenChange }: QuickCreateTaskDialogProps) {
	const [title, setTitle] = useState("");
	const [estimatedMinutes, setEstimatedMinutes] = useState("");
	const [deadline, setDeadline] = useState("");
	const [priority, setPriority] = useState<Priority>("medium");
	const [sendToUpNext, setSendToUpNext] = useState(false);
	const [categoryId, setCategoryId] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [paywallOpen, setPaywallOpen] = useState(false);

	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);
	const defaults = useMemo(
		() => schedulingDefaultsQuery.data?.taskQuickCreateDefaults ?? fallbackDefaults,
		[schedulingDefaultsQuery.data?.taskQuickCreateDefaults],
	);
	const defaultCategoryQuery = useAuthenticatedQueryWithStatus(
		api.categories.queries.getDefaultCategory,
		{},
	);

	const { execute: createTask, isPending } = useActionWithStatus(api.tasks.actions.createTask);

	useEffect(() => {
		if (!open) return;
		setTitle("");
		setEstimatedMinutes(formatDurationFromMinutes(defaults.estimatedMinutes));
		setDeadline("");
		setPriority(defaults.priority);
		setSendToUpNext(defaults.sendToUpNext);
		setCategoryId(defaultCategoryQuery.data?._id ?? "");
		setErrorMessage(null);
	}, [open, defaults, defaultCategoryQuery.data]);

	const onSubmit = async () => {
		const parsed = parseDurationToMinutes(estimatedMinutes);
		if (!title.trim() || parsed === null || parsed <= 0) {
			setErrorMessage("Please provide a title and valid estimated duration.");
			return;
		}
		setErrorMessage(null);
		try {
			await createTask({
				requestId: createRequestId(),
				input: {
					title: title.trim(),
					priority,
					status: sendToUpNext ? "queued" : "backlog",
					estimatedMinutes: parsed,
					deadline: toTimestamp(deadline),
					sendToUpNext,
					splitAllowed: defaults.splitAllowed,
					minChunkMinutes: defaults.splitAllowed ? defaults.minChunkMinutes : undefined,
					maxChunkMinutes: defaults.splitAllowed ? defaults.maxChunkMinutes : undefined,
					restMinutes: defaults.restMinutes,
					travelMinutes: defaults.travelMinutes,
					visibilityPreference: defaults.visibilityPreference,
					color: defaults.color,
					categoryId: categoryId ? (categoryId as Id<"taskCategories">) : undefined,
				},
			});
			onOpenChange(false);
		} catch (error) {
			const payload = getConvexErrorPayload(error);
			if (payload?.code === "FEATURE_LIMIT_REACHED" && payload.featureId === "tasks") {
				setPaywallOpen(true);
				setErrorMessage(payload.message ?? "Task limit reached.");
				return;
			}
			setErrorMessage(payload?.message ?? "Could not create task.");
		}
	};

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent side="right" className="w-80 p-0 sm:max-w-md" showCloseButton={false}>
					{/* ── Header ── */}
					<SheetHeader className="border-b border-border/60 px-6 py-5">
						<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							01 / New task
						</p>
						<SheetTitle className="mt-1 font-[family-name:var(--font-outfit)] text-xl font-semibold tracking-tight">
							Quick create
						</SheetTitle>
					</SheetHeader>

					<div className="flex flex-col gap-0 px-6">
						{/* ── Task name ── */}
						<div className="py-5">
							<Label
								htmlFor="qc-task-title"
								className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70"
							>
								Task name
							</Label>
							<Input
								id="qc-task-title"
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
								placeholder="What needs to get done?"
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
										value={estimatedMinutes}
										onChange={setEstimatedMinutes}
										placeholder="e.g. 30m"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60">
										Deadline
									</Label>
									<DateTimePicker value={deadline} onChange={setDeadline} placeholder="None" />
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
									<Label
										htmlFor="qc-task-priority"
										className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60"
									>
										Priority
									</Label>
									<Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
										<SelectTrigger id="qc-task-priority">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(["low", "medium", "high", "critical", "blocker"] as const).map((p) => (
												<SelectItem key={p} value={p}>
													{priorityLabels[p]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60">
										Category
									</Label>
									<CategoryPicker value={categoryId} onValueChange={setCategoryId} />
								</div>
							</div>
						</div>

						<div className="h-px bg-border/40" />

						{/* ── Options ── */}
						<div className="py-5">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-[family-name:var(--font-outfit)] text-[0.8rem] font-medium">
										Send to Up Next
									</p>
									<p className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.1em] text-muted-foreground/50">
										Queue immediately
									</p>
								</div>
								<Switch
									id="qc-task-upnext"
									checked={sendToUpNext}
									onCheckedChange={setSendToUpNext}
								/>
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
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="tasks" />
		</>
	);
}
