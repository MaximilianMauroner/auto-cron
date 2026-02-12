"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import type { Priority, TaskSchedulingMode, TaskVisibilityPreference } from "@auto-cron/types";
import { Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";

const schedulingModeLabels: Record<TaskSchedulingMode, string> = {
	fastest: "Fastest",
	balanced: "Balanced",
	packed: "Packed",
};

const schedulingModeDescriptions: Record<TaskSchedulingMode, string> = {
	fastest: "Schedules tasks as early as possible to finish soonest before due time.",
	balanced: "Balances earlier completion with stability and preference adherence.",
	packed: "Packs work later in the horizon while preserving hard constraints.",
};

const priorityOptions: Priority[] = ["low", "medium", "high", "critical", "blocker"];
const taskColors = [
	"#f59e0b",
	"#ef4444",
	"#22c55e",
	"#0ea5e9",
	"#6366f1",
	"#a855f7",
	"#ec4899",
	"#14b8a6",
] as const;

type QuickDefaultsFormState = {
	priority: Priority;
	status: "backlog" | "queued";
	estimatedMinutes: string;
	splitAllowed: boolean;
	minChunkMinutes: string;
	maxChunkMinutes: string;
	restMinutes: string;
	travelMinutes: string;
	sendToUpNext: boolean;
	visibilityPreference: TaskVisibilityPreference;
	color: string;
};
type SchedulingStepMinutes = 15 | 30 | 60;

const toQuickDefaultsForm = (defaults: {
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
}): QuickDefaultsFormState => ({
	priority: defaults.priority,
	status: defaults.status,
	estimatedMinutes: formatDurationFromMinutes(defaults.estimatedMinutes),
	splitAllowed: defaults.splitAllowed,
	minChunkMinutes: formatDurationFromMinutes(defaults.minChunkMinutes),
	maxChunkMinutes: formatDurationFromMinutes(defaults.maxChunkMinutes),
	restMinutes: formatDurationFromMinutes(defaults.restMinutes),
	travelMinutes: formatDurationFromMinutes(defaults.travelMinutes),
	sendToUpNext: defaults.sendToUpNext,
	visibilityPreference: defaults.visibilityPreference,
	color: defaults.color,
});

export default function SchedulingSettingsPage() {
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [quickDefaultsSaved, setQuickDefaultsSaved] = useState(false);
	const [downtimeSaved, setDowntimeSaved] = useState(false);
	const [stepSaved, setStepSaved] = useState(false);

	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);

	const defaultTaskSchedulingMode: TaskSchedulingMode =
		schedulingDefaultsQuery.data?.defaultTaskSchedulingMode ?? "fastest";
	const [downtimeMinutes, setDowntimeMinutes] = useState(
		String(schedulingDefaultsQuery.data?.schedulingDowntimeMinutes ?? 0),
	);
	const [schedulingStepMinutes, setSchedulingStepMinutesDraft] = useState<SchedulingStepMinutes>(
		schedulingDefaultsQuery.data?.schedulingStepMinutes ?? 15,
	);

	const [quickDefaultsForm, setQuickDefaultsForm] = useState<QuickDefaultsFormState>(
		toQuickDefaultsForm(
			schedulingDefaultsQuery.data?.taskQuickCreateDefaults ?? {
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
			},
		),
	);

	useEffect(() => {
		if (!schedulingDefaultsQuery.data?.taskQuickCreateDefaults) return;
		setQuickDefaultsForm(toQuickDefaultsForm(schedulingDefaultsQuery.data.taskQuickCreateDefaults));
	}, [schedulingDefaultsQuery.data?.taskQuickCreateDefaults]);

	useEffect(() => {
		if (schedulingDefaultsQuery.data?.schedulingDowntimeMinutes === undefined) return;
		setDowntimeMinutes(String(schedulingDefaultsQuery.data.schedulingDowntimeMinutes));
	}, [schedulingDefaultsQuery.data?.schedulingDowntimeMinutes]);
	useEffect(() => {
		if (schedulingDefaultsQuery.data?.schedulingStepMinutes === undefined) return;
		setSchedulingStepMinutesDraft(schedulingDefaultsQuery.data.schedulingStepMinutes);
	}, [schedulingDefaultsQuery.data?.schedulingStepMinutes]);

	const { mutate: setDefaultTaskSchedulingMode, isPending: isSavingMode } = useMutationWithStatus(
		api.hours.mutations.setDefaultTaskSchedulingMode,
	);
	const { mutate: setSchedulingDowntimeMinutes, isPending: isSavingDowntime } =
		useMutationWithStatus(api.hours.mutations.setSchedulingDowntimeMinutes);
	const { mutate: persistSchedulingStepMinutes, isPending: isSavingStep } = useMutationWithStatus(
		api.hours.mutations.setSchedulingStepMinutes,
	);
	const { mutate: setTaskQuickCreateDefaults, isPending: isSavingQuickDefaults } =
		useMutationWithStatus(api.hours.mutations.setTaskQuickCreateDefaults);

	const onChangeTaskSchedulingMode = async (mode: TaskSchedulingMode) => {
		setErrorMessage(null);
		try {
			await setDefaultTaskSchedulingMode({ mode });
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update task mode.");
		}
	};

	const onSaveQuickDefaults = async () => {
		setErrorMessage(null);
		setQuickDefaultsSaved(false);

		const estimatedMinutes = parseDurationToMinutes(quickDefaultsForm.estimatedMinutes);
		const minChunkMinutes = parseDurationToMinutes(quickDefaultsForm.minChunkMinutes);
		const maxChunkMinutes = parseDurationToMinutes(quickDefaultsForm.maxChunkMinutes);
		const restMinutes = parseDurationToMinutes(quickDefaultsForm.restMinutes);
		const travelMinutes = parseDurationToMinutes(quickDefaultsForm.travelMinutes);

		if (
			estimatedMinutes === null ||
			minChunkMinutes === null ||
			maxChunkMinutes === null ||
			restMinutes === null ||
			travelMinutes === null ||
			estimatedMinutes <= 0 ||
			minChunkMinutes <= 0 ||
			maxChunkMinutes < minChunkMinutes ||
			restMinutes < 0 ||
			travelMinutes < 0
		) {
			setErrorMessage(
				"Quick-create durations are invalid. Ensure values are valid and max chunk >= min chunk.",
			);
			return;
		}

		try {
			await setTaskQuickCreateDefaults({
				defaults: {
					priority: quickDefaultsForm.priority,
					status: quickDefaultsForm.status,
					estimatedMinutes,
					splitAllowed: quickDefaultsForm.splitAllowed,
					minChunkMinutes,
					maxChunkMinutes,
					restMinutes,
					travelMinutes,
					sendToUpNext: quickDefaultsForm.sendToUpNext,
					visibilityPreference: quickDefaultsForm.visibilityPreference,
					color: quickDefaultsForm.color,
				},
			});
			setQuickDefaultsSaved(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update quick defaults.");
		}
	};

	const onSaveDowntime = async () => {
		setErrorMessage(null);
		setDowntimeSaved(false);
		const parsed = Number.parseInt(downtimeMinutes.trim(), 10);
		if (!Number.isFinite(parsed) || parsed < 0) {
			setErrorMessage("Downtime must be a whole number of minutes (0 or greater).");
			return;
		}
		try {
			const savedMinutes = await setSchedulingDowntimeMinutes({ minutes: parsed });
			setDowntimeMinutes(String(savedMinutes));
			setDowntimeSaved(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update downtime.");
		}
	};

	const onSaveStepMinutes = async () => {
		setErrorMessage(null);
		setStepSaved(false);
		try {
			const savedStep = await persistSchedulingStepMinutes({
				minutes: schedulingStepMinutes,
			});
			setSchedulingStepMinutesDraft(savedStep);
			setStepSaved(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update time step.");
		}
	};

	return (
		<div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
			<div className="space-y-4">
				<Card className="border-border/70 bg-card/70">
					<CardHeader>
						<CardDescription className="text-xs uppercase tracking-[0.14em]">Tasks</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl">
							<SlidersHorizontal className="size-4 text-primary" />
							Default Scheduling Mode
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Select
							value={defaultTaskSchedulingMode}
							onValueChange={(value) =>
								void onChangeTaskSchedulingMode(value as TaskSchedulingMode)
							}
							disabled={isSavingMode}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(schedulingModeLabels).map(([mode, label]) => (
									<SelectItem key={mode} value={mode}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-sm text-muted-foreground">
							{defaultTaskSchedulingMode
								? schedulingModeDescriptions[defaultTaskSchedulingMode]
								: "Choose how tasks should be placed by default."}
						</p>
						<div className="space-y-2 border-t border-border/60 pt-3">
							<Label htmlFor="downtime-minutes">Downtime between scheduled blocks</Label>
							<div className="flex items-center gap-2">
								<Input
									id="downtime-minutes"
									type="number"
									min={0}
									step={1}
									value={downtimeMinutes}
									onChange={(event) => setDowntimeMinutes(event.target.value)}
									className="max-w-[140px]"
								/>
								<span className="text-xs text-muted-foreground">minutes</span>
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5"
									disabled={isSavingDowntime}
									onClick={() => void onSaveDowntime()}
								>
									<Save className="size-3.5" />
									{isSavingDowntime ? "Saving..." : "Save"}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Adds buffer time between scheduled tasks and habits.
							</p>
							{downtimeSaved ? (
								<p className="text-sm text-emerald-600 dark:text-emerald-300">Downtime saved.</p>
							) : null}
						</div>
						<div className="space-y-2 border-t border-border/60 pt-3">
							<Label htmlFor="scheduling-step-minutes">Global calendar time step</Label>
							<div className="flex items-center gap-2">
								<Select
									value={String(schedulingStepMinutes)}
									onValueChange={(value) => {
										setSchedulingStepMinutesDraft(
											Number.parseInt(value, 10) as SchedulingStepMinutes,
										);
										setStepSaved(false);
									}}
								>
									<SelectTrigger id="scheduling-step-minutes" className="max-w-[160px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="15">15 minutes</SelectItem>
										<SelectItem value="30">30 minutes</SelectItem>
										<SelectItem value="60">60 minutes</SelectItem>
									</SelectContent>
								</Select>
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5"
									disabled={isSavingStep}
									onClick={() => void onSaveStepMinutes()}
								>
									<Save className="size-3.5" />
									{isSavingStep ? "Saving..." : "Save"}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Controls drag, resize, and time input snapping in Calendar and Hours settings.
							</p>
							{stepSaved ? (
								<p className="text-sm text-emerald-600 dark:text-emerald-300">Time step saved.</p>
							) : null}
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-card/70">
					<CardHeader>
						<CardDescription className="text-xs uppercase tracking-[0.14em]">
							Task creation
						</CardDescription>
						<CardTitle className="text-xl">Quick Create Defaults</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Default priority</Label>
								<Select
									value={quickDefaultsForm.priority}
									onValueChange={(priority) =>
										setQuickDefaultsForm((current) => ({
											...current,
											priority: priority as Priority,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{priorityOptions.map((priority) => (
											<SelectItem key={priority} value={priority}>
												{priority}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>Default status</Label>
								<Select
									value={quickDefaultsForm.status}
									onValueChange={(status) =>
										setQuickDefaultsForm((current) => ({
											...current,
											status: status as "backlog" | "queued",
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="backlog">Backlog</SelectItem>
										<SelectItem value="queued">Queued</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid gap-3 md:grid-cols-3">
							<div className="space-y-2">
								<Label>Time needed</Label>
								<DurationInput
									value={quickDefaultsForm.estimatedMinutes}
									onChange={(estimatedMinutes) =>
										setQuickDefaultsForm((current) => ({ ...current, estimatedMinutes }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Min chunk</Label>
								<DurationInput
									value={quickDefaultsForm.minChunkMinutes}
									onChange={(minChunkMinutes) =>
										setQuickDefaultsForm((current) => ({ ...current, minChunkMinutes }))
									}
									className={
										!quickDefaultsForm.splitAllowed ? "pointer-events-none opacity-60" : ""
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Max chunk</Label>
								<DurationInput
									value={quickDefaultsForm.maxChunkMinutes}
									onChange={(maxChunkMinutes) =>
										setQuickDefaultsForm((current) => ({ ...current, maxChunkMinutes }))
									}
									className={
										!quickDefaultsForm.splitAllowed ? "pointer-events-none opacity-60" : ""
									}
								/>
							</div>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Rest time</Label>
								<DurationInput
									value={quickDefaultsForm.restMinutes}
									onChange={(restMinutes) =>
										setQuickDefaultsForm((current) => ({ ...current, restMinutes }))
									}
								/>
								<p className="text-xs text-muted-foreground">
									Extra buffer applied around this task type when scheduling.
								</p>
							</div>
							<div className="space-y-2">
								<Label>Travel duration (each side)</Label>
								<DurationInput
									value={quickDefaultsForm.travelMinutes}
									onChange={(travelMinutes) =>
										setQuickDefaultsForm((current) => ({ ...current, travelMinutes }))
									}
								/>
								<p className="text-xs text-muted-foreground">
									For tasks with a location, adds Travel blocks before and after.
								</p>
							</div>
						</div>

						<div className="space-y-2">
							<Label>Default color</Label>
							<div className="flex flex-wrap gap-2 rounded-lg border border-border p-2">
								{taskColors.map((color) => (
									<button
										key={color}
										type="button"
										onClick={() => setQuickDefaultsForm((current) => ({ ...current, color }))}
										className={`size-6 rounded-full border transition-transform hover:scale-105 ${
											quickDefaultsForm.color === color
												? "border-foreground ring-2 ring-foreground/20"
												: "border-border"
										}`}
										style={{ backgroundColor: color }}
										aria-label={`Select ${color}`}
									/>
								))}
							</div>
						</div>

						<div className="grid gap-2">
							<div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
								<div>
									<p className="text-sm font-medium">Split tasks by default</p>
									<p className="text-xs text-muted-foreground">
										Allow scheduler chunking automatically.
									</p>
								</div>
								<Switch
									checked={quickDefaultsForm.splitAllowed}
									onCheckedChange={(splitAllowed) =>
										setQuickDefaultsForm((current) => ({ ...current, splitAllowed }))
									}
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
								<div>
									<p className="text-sm font-medium">Send new tasks to Up Next</p>
									<p className="text-xs text-muted-foreground">
										Queue items immediately on creation.
									</p>
								</div>
								<Switch
									checked={quickDefaultsForm.sendToUpNext}
									onCheckedChange={(sendToUpNext) =>
										setQuickDefaultsForm((current) => ({ ...current, sendToUpNext }))
									}
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
								<div>
									<p className="text-sm font-medium">Private visibility by default</p>
									<p className="text-xs text-muted-foreground">
										Private events hide task details in connected calendars.
									</p>
								</div>
								<Switch
									checked={quickDefaultsForm.visibilityPreference === "private"}
									onCheckedChange={(isPrivate) =>
										setQuickDefaultsForm((current) => ({
											...current,
											visibilityPreference: isPrivate ? "private" : "default",
										}))
									}
								/>
							</div>
						</div>

						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								These defaults are account-level and power the quick create dialog in Tasks.
							</p>
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5"
								disabled={isSavingQuickDefaults}
								onClick={() => void onSaveQuickDefaults()}
							>
								<Save className="size-3.5" />
								{isSavingQuickDefaults ? "Saving..." : "Save defaults"}
							</Button>
						</div>
						{quickDefaultsSaved ? (
							<p className="text-sm text-emerald-600 dark:text-emerald-300">
								Quick defaults saved.
							</p>
						) : null}
					</CardContent>
				</Card>
			</div>

			<Card className="border-border/70 bg-card/70">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">How it works</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>Scheduling mode is global and applies when a task uses "default" mode.</p>
					<p>Downtime inserts a configurable buffer between scheduled blocks.</p>
					<p>Time step controls global calendar snapping (15, 30, or 60 minute increments).</p>
					<p>Rest and travel defaults are applied to newly created tasks and can be overridden.</p>
					<p>Quick create defaults are account-specific and loaded each time you open New task.</p>
					<p>Advanced task fields are still available in the task dialog when needed.</p>
				</CardContent>
			</Card>

			{errorMessage ? (
				<div className="lg:col-span-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
					{errorMessage}
				</div>
			) : null}
		</div>
	);
}
