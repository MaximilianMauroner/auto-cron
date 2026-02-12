"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
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
import { Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";

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

	const { execute: createTask, isPending } = useActionWithStatus(api.tasks.actions.createTask);

	useEffect(() => {
		if (!open) return;
		setTitle("");
		setEstimatedMinutes(formatDurationFromMinutes(defaults.estimatedMinutes));
		setDeadline("");
		setPriority(defaults.priority);
		setSendToUpNext(defaults.sendToUpNext);
		setErrorMessage(null);
	}, [open, defaults]);

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
					<SheetHeader className="border-b border-border/70 px-5 py-4">
						<SheetTitle className="flex items-center gap-2 text-lg">
							<Rocket className="size-4 text-primary" />
							Quick create task
						</SheetTitle>
					</SheetHeader>
					<div className="space-y-4 px-5 py-4">
						<div className="space-y-1.5">
							<Label htmlFor="qc-task-title" className="text-xs uppercase tracking-[0.1em]">
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
								autoFocus
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label className="text-xs uppercase tracking-[0.1em]">Time needed</Label>
								<DurationInput
									value={estimatedMinutes}
									onChange={setEstimatedMinutes}
									placeholder="e.g. 30 mins"
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs uppercase tracking-[0.1em]">Due date</Label>
								<DateTimePicker value={deadline} onChange={setDeadline} placeholder="No deadline" />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="qc-task-priority" className="text-xs uppercase tracking-[0.1em]">
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
							<div className="flex items-end pb-1">
								<div className="flex items-center gap-2">
									<Switch
										id="qc-task-upnext"
										checked={sendToUpNext}
										onCheckedChange={setSendToUpNext}
									/>
									<Label htmlFor="qc-task-upnext" className="text-sm">
										Send to Up Next
									</Label>
								</div>
							</div>
						</div>
						{errorMessage ? (
							<p className="text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
						) : null}
					</div>
					<SheetFooter className="border-t border-border/70 px-5 py-3">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => void onSubmit()}
							disabled={isPending}
							className="gap-1.5 bg-accent text-accent-foreground shadow-[0_2px_8px_-2px_rgba(252,163,17,0.2)] hover:bg-accent/90"
						>
							<Rocket className="size-3.5" />
							{isPending ? "Creating..." : "Create task"}
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="tasks" />
		</>
	);
}
