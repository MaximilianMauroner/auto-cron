"use client";

import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Button } from "@/components/ui/button";
import { ColorPalette } from "@/components/ui/color-palette";
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
import { cn } from "@/lib/utils";
import type { HabitFrequency, HabitRecoveryPolicy } from "@auto-cron/types";
import type { Priority, TaskSchedulingMode, TaskVisibilityPreference } from "@auto-cron/types";
import { Check, ListChecks, Repeat, Save, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";

const schedulingModes: { mode: TaskSchedulingMode; label: string; description: string }[] = [
	{
		mode: "fastest",
		label: "Fastest",
		description: "Places tasks as early as possible to finish before due time.",
	},
	{
		mode: "balanced",
		label: "Balanced",
		description: "Balances completion speed with stability and preferences.",
	},
	{
		mode: "packed",
		label: "Packed",
		description: "Packs work later in the horizon while keeping hard constraints.",
	},
];

const priorityOptions: Priority[] = ["low", "medium", "high", "critical", "blocker"];
const frequencyOptions: { value: HabitFrequency; label: string }[] = [
	{ value: "daily", label: "Daily" },
	{ value: "weekly", label: "Weekly" },
	{ value: "biweekly", label: "Bi-weekly" },
	{ value: "monthly", label: "Monthly" },
];
const recoveryPolicyOptions: { value: HabitRecoveryPolicy; label: string }[] = [
	{ value: "skip", label: "Skip missed" },
	{ value: "recover", label: "Recover missed" },
];
const stepOptions = [15, 30, 60] as const;

type TaskDefaultsFormState = {
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

type HabitDefaultsFormState = {
	priority: Priority;
	durationMinutes: string;
	frequency: HabitFrequency;
	recoveryPolicy: HabitRecoveryPolicy;
	visibilityPreference: TaskVisibilityPreference;
	color: string;
};

type SchedulingStepMinutes = 15 | 30 | 60;

const toTaskDefaultsForm = (defaults: {
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
}): TaskDefaultsFormState => ({
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

const toHabitDefaultsForm = (defaults: {
	priority: Priority;
	durationMinutes: number;
	frequency: HabitFrequency;
	recoveryPolicy: HabitRecoveryPolicy;
	visibilityPreference: TaskVisibilityPreference;
	color: string;
}): HabitDefaultsFormState => ({
	priority: defaults.priority,
	durationMinutes: formatDurationFromMinutes(defaults.durationMinutes),
	frequency: defaults.frequency,
	recoveryPolicy: defaults.recoveryPolicy,
	visibilityPreference: defaults.visibilityPreference,
	color: defaults.color,
});

export default function SchedulingSettingsPage() {
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [taskDefaultsSaved, setTaskDefaultsSaved] = useState(false);
	const [habitDefaultsSaved, setHabitDefaultsSaved] = useState(false);
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

	const [taskForm, setTaskForm] = useState<TaskDefaultsFormState>(
		toTaskDefaultsForm(
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

	const [habitForm, setHabitForm] = useState<HabitDefaultsFormState>(
		toHabitDefaultsForm(
			schedulingDefaultsQuery.data?.habitQuickCreateDefaults ?? {
				priority: "medium",
				durationMinutes: 30,
				frequency: "daily",
				recoveryPolicy: "skip",
				visibilityPreference: "private",
				color: "#22c55e",
			},
		),
	);

	useEffect(() => {
		if (!schedulingDefaultsQuery.data?.taskQuickCreateDefaults) return;
		setTaskForm(toTaskDefaultsForm(schedulingDefaultsQuery.data.taskQuickCreateDefaults));
	}, [schedulingDefaultsQuery.data?.taskQuickCreateDefaults]);

	useEffect(() => {
		if (!schedulingDefaultsQuery.data?.habitQuickCreateDefaults) return;
		setHabitForm(toHabitDefaultsForm(schedulingDefaultsQuery.data.habitQuickCreateDefaults));
	}, [schedulingDefaultsQuery.data?.habitQuickCreateDefaults]);

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
	const { mutate: setTaskQuickCreateDefaults, isPending: isSavingTaskDefaults } =
		useMutationWithStatus(api.hours.mutations.setTaskQuickCreateDefaults);
	const { mutate: setHabitQuickCreateDefaults, isPending: isSavingHabitDefaults } =
		useMutationWithStatus(api.hours.mutations.setHabitQuickCreateDefaults);

	const onChangeTaskSchedulingMode = async (mode: TaskSchedulingMode) => {
		setErrorMessage(null);
		try {
			await setDefaultTaskSchedulingMode({ mode });
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update task mode.");
		}
	};

	const onSaveTaskDefaults = async () => {
		setErrorMessage(null);
		setTaskDefaultsSaved(false);

		const estimatedMinutes = parseDurationToMinutes(taskForm.estimatedMinutes);
		const minChunkMinutes = parseDurationToMinutes(taskForm.minChunkMinutes);
		const maxChunkMinutes = parseDurationToMinutes(taskForm.maxChunkMinutes);
		const restMinutes = parseDurationToMinutes(taskForm.restMinutes);
		const travelMinutes = parseDurationToMinutes(taskForm.travelMinutes);

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
				"Task durations are invalid. Ensure values are valid and max chunk >= min chunk.",
			);
			return;
		}

		try {
			await setTaskQuickCreateDefaults({
				defaults: {
					priority: taskForm.priority,
					status: taskForm.status,
					estimatedMinutes,
					splitAllowed: taskForm.splitAllowed,
					minChunkMinutes,
					maxChunkMinutes,
					restMinutes,
					travelMinutes,
					sendToUpNext: taskForm.sendToUpNext,
					visibilityPreference: taskForm.visibilityPreference,
					color: taskForm.color,
				},
			});
			setTaskDefaultsSaved(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update task defaults.");
		}
	};

	const onSaveHabitDefaults = async () => {
		setErrorMessage(null);
		setHabitDefaultsSaved(false);

		const durationMinutes = parseDurationToMinutes(habitForm.durationMinutes);
		if (durationMinutes === null || durationMinutes <= 0) {
			setErrorMessage("Habit duration must be a positive value.");
			return;
		}

		try {
			await setHabitQuickCreateDefaults({
				defaults: {
					priority: habitForm.priority,
					durationMinutes,
					frequency: habitForm.frequency,
					recoveryPolicy: habitForm.recoveryPolicy,
					visibilityPreference: habitForm.visibilityPreference,
					color: habitForm.color,
				},
			});
			setHabitDefaultsSaved(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update habit defaults.");
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

	const onSaveStepMinutes = async (step: SchedulingStepMinutes) => {
		setErrorMessage(null);
		setStepSaved(false);
		setSchedulingStepMinutesDraft(step);
		try {
			const savedStep = await persistSchedulingStepMinutes({ minutes: step });
			setSchedulingStepMinutesDraft(savedStep);
			setStepSaved(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update time step.");
		}
	};

	return (
		<>
			<SettingsSectionHeader
				sectionNumber="02"
				sectionLabel="Scheduling"
				title="Scheduling Engine"
				description="Configure how the scheduler places work, and set defaults for new tasks and habits."
			/>

			<div className="space-y-4">
				{/* ── Engine: Mode selector ── */}
				<div className="rounded-xl border border-border/60 p-5">
					<div className="mb-4 flex items-center gap-2.5">
						<Zap className="size-4 text-muted-foreground/60" />
						<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							Scheduling mode
						</p>
					</div>

					<div className="space-y-1.5">
						{schedulingModes.map(({ mode, label, description }) => {
							const isActive = defaultTaskSchedulingMode === mode;
							return (
								<button
									key={mode}
									type="button"
									onClick={() => void onChangeTaskSchedulingMode(mode)}
									disabled={isSavingMode}
									className={cn(
										"group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
										isActive
											? "border-primary/40 bg-primary/5"
											: "border-border/50 hover:border-border/80 hover:bg-muted/20",
									)}
								>
									<div
										className={cn(
											"flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
											isActive
												? "border-primary bg-primary text-primary-foreground"
												: "border-border/60 bg-background",
										)}
									>
										{isActive ? <Check className="size-3" /> : null}
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium">{label}</p>
										<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
									</div>
								</button>
							);
						})}
					</div>

					{/* Step + Downtime */}
					<div className="mt-5 border-t border-border/40 pt-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-xs">Calendar time step</Label>
								<div className="flex items-center gap-1.5">
									{stepOptions.map((step) => (
										<button
											key={step}
											type="button"
											onClick={() => void onSaveStepMinutes(step)}
											disabled={isSavingStep}
											className={cn(
												"h-8 min-w-[52px] rounded-md border px-3 text-xs font-medium transition-colors",
												schedulingStepMinutes === step
													? "border-primary/40 bg-primary/10 text-primary"
													: "border-border/60 bg-background text-muted-foreground/60 hover:border-border hover:text-muted-foreground",
											)}
										>
											{step}m
										</button>
									))}
								</div>
								{stepSaved ? <p className="text-[11px] text-accent">Saved.</p> : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor="downtime-minutes" className="text-xs">
									Downtime between blocks
								</Label>
								<div className="flex items-center gap-2">
									<Input
										id="downtime-minutes"
										type="number"
										min={0}
										step={1}
										value={downtimeMinutes}
										onChange={(event) => setDowntimeMinutes(event.target.value)}
										className="w-20"
									/>
									<span className="text-[11px] text-muted-foreground">min</span>
									<Button
										variant="outline"
										size="sm"
										className="ml-auto h-8 gap-1 px-2 text-xs"
										disabled={isSavingDowntime}
										onClick={() => void onSaveDowntime()}
									>
										<Save className="size-3" />
										{isSavingDowntime ? "..." : "Save"}
									</Button>
								</div>
								{downtimeSaved ? <p className="text-[11px] text-accent">Saved.</p> : null}
							</div>
						</div>
					</div>
				</div>

				{/* ── Task defaults ── */}
				<div
					className="overflow-hidden rounded-xl border border-border/60"
					style={{ borderLeftColor: taskForm.color, borderLeftWidth: 3 }}
				>
					<div className="p-5">
						<div className="mb-4 flex items-center gap-2.5">
							<ListChecks className="size-4 text-muted-foreground/60" />
							<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
								Task defaults
							</p>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-xs">Priority</Label>
								<Select
									value={taskForm.priority}
									onValueChange={(priority) =>
										setTaskForm((c) => ({ ...c, priority: priority as Priority }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{priorityOptions.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Status</Label>
								<Select
									value={taskForm.status}
									onValueChange={(status) =>
										setTaskForm((c) => ({
											...c,
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

						<div className="mt-3 grid gap-3 sm:grid-cols-3">
							<div className="space-y-1.5">
								<Label className="text-xs">Time needed</Label>
								<DurationInput
									value={taskForm.estimatedMinutes}
									onChange={(estimatedMinutes) => setTaskForm((c) => ({ ...c, estimatedMinutes }))}
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Min chunk</Label>
								<DurationInput
									value={taskForm.minChunkMinutes}
									onChange={(minChunkMinutes) => setTaskForm((c) => ({ ...c, minChunkMinutes }))}
									className={!taskForm.splitAllowed ? "pointer-events-none opacity-60" : ""}
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Max chunk</Label>
								<DurationInput
									value={taskForm.maxChunkMinutes}
									onChange={(maxChunkMinutes) => setTaskForm((c) => ({ ...c, maxChunkMinutes }))}
									className={!taskForm.splitAllowed ? "pointer-events-none opacity-60" : ""}
								/>
							</div>
						</div>

						<div className="mt-3 grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-xs">Rest time</Label>
								<DurationInput
									value={taskForm.restMinutes}
									onChange={(restMinutes) => setTaskForm((c) => ({ ...c, restMinutes }))}
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Travel (each side)</Label>
								<DurationInput
									value={taskForm.travelMinutes}
									onChange={(travelMinutes) => setTaskForm((c) => ({ ...c, travelMinutes }))}
								/>
							</div>
						</div>

						<div className="mt-4 space-y-1.5">
							<Label className="text-xs">Color</Label>
							<ColorPalette
								value={taskForm.color}
								onChange={(color) => setTaskForm((c) => ({ ...c, color }))}
							/>
						</div>

						{/* Toggles */}
						<div className="mt-5 space-y-3 border-t border-border/40 pt-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs font-medium">Split tasks</p>
									<p className="text-[11px] text-muted-foreground">
										Allow scheduler to chunk automatically
									</p>
								</div>
								<Switch
									checked={taskForm.splitAllowed}
									onCheckedChange={(splitAllowed) => setTaskForm((c) => ({ ...c, splitAllowed }))}
								/>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs font-medium">Send to Up Next</p>
									<p className="text-[11px] text-muted-foreground">
										Queue items immediately on creation
									</p>
								</div>
								<Switch
									checked={taskForm.sendToUpNext}
									onCheckedChange={(sendToUpNext) => setTaskForm((c) => ({ ...c, sendToUpNext }))}
								/>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs font-medium">Private visibility</p>
									<p className="text-[11px] text-muted-foreground">
										Hide details in connected calendars
									</p>
								</div>
								<Switch
									checked={taskForm.visibilityPreference === "private"}
									onCheckedChange={(isPrivate) =>
										setTaskForm((c) => ({
											...c,
											visibilityPreference: isPrivate ? "private" : "default",
										}))
									}
								/>
							</div>
						</div>
					</div>

					{/* Save footer */}
					<div className="flex items-center justify-between border-t border-border/40 bg-muted/5 px-5 py-3">
						<p className="text-[11px] text-muted-foreground">Applied when quick-creating tasks</p>
						<div className="flex items-center gap-2">
							{taskDefaultsSaved ? <p className="text-[11px] text-accent">Saved.</p> : null}
							<Button
								size="sm"
								className="h-8 gap-1.5 px-3 text-xs"
								disabled={isSavingTaskDefaults}
								onClick={() => void onSaveTaskDefaults()}
							>
								<Save className="size-3" />
								{isSavingTaskDefaults ? "Saving..." : "Save defaults"}
							</Button>
						</div>
					</div>
				</div>

				{/* ── Habit defaults ── */}
				<div
					className="overflow-hidden rounded-xl border border-border/60"
					style={{ borderLeftColor: habitForm.color, borderLeftWidth: 3 }}
				>
					<div className="p-5">
						<div className="mb-4 flex items-center gap-2.5">
							<Repeat className="size-4 text-muted-foreground/60" />
							<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
								Habit defaults
							</p>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-xs">Priority</Label>
								<Select
									value={habitForm.priority}
									onValueChange={(priority) =>
										setHabitForm((c) => ({
											...c,
											priority: priority as Priority,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{priorityOptions.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Duration</Label>
								<DurationInput
									value={habitForm.durationMinutes}
									onChange={(durationMinutes) => setHabitForm((c) => ({ ...c, durationMinutes }))}
								/>
							</div>
						</div>

						<div className="mt-3 grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-xs">Frequency</Label>
								<Select
									value={habitForm.frequency}
									onValueChange={(frequency) =>
										setHabitForm((c) => ({
											...c,
											frequency: frequency as HabitFrequency,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{frequencyOptions.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Recovery policy</Label>
								<Select
									value={habitForm.recoveryPolicy}
									onValueChange={(policy) =>
										setHabitForm((c) => ({
											...c,
											recoveryPolicy: policy as HabitRecoveryPolicy,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{recoveryPolicyOptions.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="mt-4 space-y-1.5">
							<Label className="text-xs">Color</Label>
							<ColorPalette
								value={habitForm.color}
								onChange={(color) => setHabitForm((c) => ({ ...c, color }))}
							/>
						</div>

						{/* Toggles */}
						<div className="mt-5 border-t border-border/40 pt-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs font-medium">Private visibility</p>
									<p className="text-[11px] text-muted-foreground">
										Hide details in connected calendars
									</p>
								</div>
								<Switch
									checked={habitForm.visibilityPreference === "private"}
									onCheckedChange={(isPrivate) =>
										setHabitForm((c) => ({
											...c,
											visibilityPreference: isPrivate ? "private" : "default",
										}))
									}
								/>
							</div>
						</div>
					</div>

					{/* Save footer */}
					<div className="flex items-center justify-between border-t border-border/40 bg-muted/5 px-5 py-3">
						<p className="text-[11px] text-muted-foreground">Applied when quick-creating habits</p>
						<div className="flex items-center gap-2">
							{habitDefaultsSaved ? <p className="text-[11px] text-accent">Saved.</p> : null}
							<Button
								size="sm"
								className="h-8 gap-1.5 px-3 text-xs"
								disabled={isSavingHabitDefaults}
								onClick={() => void onSaveHabitDefaults()}
							>
								<Save className="size-3" />
								{isSavingHabitDefaults ? "Saving..." : "Save defaults"}
							</Button>
						</div>
					</div>
				</div>

				{/* Reference */}
				<details className="rounded-xl border border-border/60">
					<summary className="cursor-pointer px-5 py-3 text-xs font-medium text-muted-foreground">
						How it works
					</summary>
					<div className="space-y-1.5 border-t border-border/40 px-5 py-3 text-[11px] text-muted-foreground">
						<p>Scheduling mode applies when a task uses "default" mode.</p>
						<p>Downtime inserts buffer between scheduled blocks.</p>
						<p>Time step controls calendar snapping (15, 30, or 60 min).</p>
						<p>
							Task defaults load each time you quick-create a task. Rest and travel can be
							overridden per task.
						</p>
						<p>
							Habit defaults load each time you quick-create a habit. Recovery policy controls
							whether missed sessions are rescheduled.
						</p>
					</div>
				</details>

				{errorMessage ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
						{errorMessage}
					</div>
				) : null}
			</div>
		</>
	);
}
