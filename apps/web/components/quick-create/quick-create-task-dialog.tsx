"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { CategoryPicker } from "@/components/category-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ColorPaletteDropdown } from "@/components/ui/color-palette";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { useActionWithStatus, useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import type { Priority, TaskVisibilityPreference } from "@auto-cron/types";
import { ChevronDown, Minus, Plus, Settings } from "lucide-react";
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

const priorityIcons: Record<Priority, string> = {
	low: "!",
	medium: "!!",
	high: "!!!",
	critical: "!!!!",
	blocker: "!!!!!",
};

const DURATION_STEP = 15; // minutes

type QuickCreateTaskDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function QuickCreateTaskDialog({ open, onOpenChange }: QuickCreateTaskDialogProps) {
	const [title, setTitle] = useState("");
	const [estimatedMinutes, setEstimatedMinutes] = useState("");
	const [deadline, setDeadline] = useState("");
	const [scheduleAfter, setScheduleAfter] = useState("");
	const [priority, setPriority] = useState<Priority>("medium");
	const [sendToUpNext, setSendToUpNext] = useState(false);
	const [categoryId, setCategoryId] = useState<string>("");
	const [splitAllowed, setSplitAllowed] = useState(true);
	const [minChunkMinutes, setMinChunkMinutes] = useState("");
	const [maxChunkMinutes, setMaxChunkMinutes] = useState("");
	const [visibilityPreference, setVisibilityPreference] =
		useState<TaskVisibilityPreference>("private");
	const [color, setColor] = useState("#f59e0b");
	const [moreOpen, setMoreOpen] = useState(false);
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
		setScheduleAfter("");
		setPriority(defaults.priority);
		setSendToUpNext(defaults.sendToUpNext);
		setCategoryId(defaultCategoryQuery.data?._id ?? "");
		setSplitAllowed(defaults.splitAllowed);
		setMinChunkMinutes(formatDurationFromMinutes(defaults.minChunkMinutes));
		setMaxChunkMinutes(formatDurationFromMinutes(defaults.maxChunkMinutes));
		setVisibilityPreference(defaults.visibilityPreference);
		setColor(defaults.color);
		setMoreOpen(false);
		setErrorMessage(null);
	}, [open, defaults, defaultCategoryQuery.data]);

	const durationMinutes = parseDurationToMinutes(estimatedMinutes) ?? 0;

	const stepDuration = (delta: number) => {
		const next = Math.max(DURATION_STEP, durationMinutes + delta * DURATION_STEP);
		setEstimatedMinutes(formatDurationFromMinutes(next));
	};

	const onSubmit = async () => {
		const parsed = parseDurationToMinutes(estimatedMinutes);
		if (!title.trim() || parsed === null || parsed <= 0) {
			setErrorMessage("Please provide a title and valid estimated duration.");
			return;
		}
		setErrorMessage(null);
		const parsedMinChunk = parseDurationToMinutes(minChunkMinutes);
		const parsedMaxChunk = parseDurationToMinutes(maxChunkMinutes);
		try {
			await createTask({
				requestId: createRequestId(),
				input: {
					title: title.trim(),
					priority,
					status: sendToUpNext ? "queued" : "backlog",
					estimatedMinutes: parsed,
					deadline: toTimestamp(deadline),
					scheduleAfter: toTimestamp(scheduleAfter),
					sendToUpNext,
					splitAllowed,
					minChunkMinutes: splitAllowed && parsedMinChunk ? parsedMinChunk : undefined,
					maxChunkMinutes: splitAllowed && parsedMaxChunk ? parsedMaxChunk : undefined,
					restMinutes: defaults.restMinutes,
					travelMinutes: defaults.travelMinutes,
					visibilityPreference,
					color,
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
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-[420px] p-0 gap-0" showCloseButton={false}>
					<DialogTitle className="sr-only">Quick create task</DialogTitle>
					<DialogDescription className="sr-only">Create a new task</DialogDescription>

					{/* ── Title row: input + priority ── */}
					<div className="flex items-center gap-2 px-4 py-3">
						<Input
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
							placeholder="Task name..."
							className="flex-1 border-0 bg-transparent px-0 font-[family-name:var(--font-outfit)] text-[0.95rem] font-medium shadow-none ring-0 placeholder:text-muted-foreground/40 focus-visible:ring-0"
							autoFocus
						/>
						<Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
							<SelectTrigger className="w-auto h-7 gap-1 border-border/50 bg-muted/50 px-2 text-[0.72rem] font-medium">
								<span className="text-accent font-bold">{priorityIcons[priority]}</span>
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

					<div className="h-px bg-border/40" />

					{/* ── Duration section ── */}
					<div className="px-4 py-3 space-y-2.5">
						<Label className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
							Duration
						</Label>
						<div className="flex items-center gap-3">
							<DurationInput
								value={estimatedMinutes}
								onChange={setEstimatedMinutes}
								placeholder="e.g. 2h"
								className="w-36"
							/>
							<div className="flex items-center gap-1">
								<Button
									variant="outline"
									size="icon"
									className="size-7 border-border/50"
									onClick={() => stepDuration(-1)}
								>
									<Minus className="size-3" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									className="size-7 border-border/50"
									onClick={() => stepDuration(1)}
								>
									<Plus className="size-3" />
								</Button>
							</div>
							<div className="flex items-center gap-2 ml-auto">
								<Checkbox
									id="qc-split"
									checked={splitAllowed}
									onCheckedChange={(v) => setSplitAllowed(v === true)}
								/>
								<Label
									htmlFor="qc-split"
									className="text-[0.78rem] text-foreground/80 cursor-pointer"
								>
									Split up
								</Label>
							</div>
						</div>
						{splitAllowed ? (
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Min duration
									</Label>
									<DurationInput
										value={minChunkMinutes}
										onChange={setMinChunkMinutes}
										placeholder="30m"
									/>
								</div>
								<div className="space-y-1">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Max duration
									</Label>
									<DurationInput
										value={maxChunkMinutes}
										onChange={setMaxChunkMinutes}
										placeholder="3h"
									/>
								</div>
							</div>
						) : null}
					</div>

					<div className="h-px bg-border/40" />

					{/* ── Schedule after / Due date ── */}
					<div className="px-4 py-3">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
									Schedule after
								</Label>
								<DateTimePicker
									value={scheduleAfter}
									onChange={setScheduleAfter}
									placeholder="Now"
								/>
							</div>
							<div className="space-y-1">
								<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
									Due date
								</Label>
								<DateTimePicker value={deadline} onChange={setDeadline} placeholder="Anytime" />
							</div>
						</div>
					</div>

					<div className="h-px bg-border/40" />

					{/* ── More options (collapsible) ── */}
					<Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
						<div className="px-4 py-2.5 flex items-center justify-between">
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="gap-1.5 text-[0.76rem] text-muted-foreground hover:text-foreground -ml-2 h-7"
								>
									<Settings className="size-3" />
									More options
									<ChevronDown
										className={`size-3 transition-transform ${moreOpen ? "rotate-180" : ""}`}
									/>
								</Button>
							</CollapsibleTrigger>
							<Button
								onClick={() => void onSubmit()}
								disabled={isPending}
								size="sm"
								className="h-8 px-5 bg-accent font-[family-name:var(--font-outfit)] text-[0.76rem] font-bold uppercase tracking-[0.08em] text-accent-foreground shadow-[0_2px_12px_-3px_rgba(252,163,17,0.3)] hover:bg-accent/90 hover:shadow-[0_4px_16px_-3px_rgba(252,163,17,0.4)]"
							>
								{isPending ? "Creating..." : "Create"}
							</Button>
						</div>
						<CollapsibleContent>
							<div className="px-4 pb-3 space-y-3">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Category
										</Label>
										<CategoryPicker value={categoryId} onValueChange={setCategoryId} />
									</div>
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Send to Up Next
										</Label>
										<div className="flex items-center h-9">
											<Switch checked={sendToUpNext} onCheckedChange={setSendToUpNext} />
										</div>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Visibility
										</Label>
										<Select
											value={visibilityPreference}
											onValueChange={(v) => setVisibilityPreference(v as TaskVisibilityPreference)}
										>
											<SelectTrigger className="h-9">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="private">Private</SelectItem>
												<SelectItem value="public">Public</SelectItem>
												<SelectItem value="default">Default</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Color
										</Label>
										<ColorPaletteDropdown value={color} onChange={setColor} />
									</div>
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>

					{/* ── Error ── */}
					{errorMessage ? (
						<div className="mx-4 mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
							<p className="font-[family-name:var(--font-cutive)] text-[0.66rem] uppercase tracking-[0.05em] text-destructive">
								{errorMessage}
							</p>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="tasks" />
		</>
	);
}
