"use client";

import { CategoryPicker } from "@/components/category-picker";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ColorPaletteDropdown } from "@/components/ui/color-palette";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import {
	manuallyAssignableTaskStatuses,
	priorityClass,
	priorityLabels,
	statusPipelineOrder,
} from "@/lib/scheduling-constants";
import {
	schedulingModeLabels,
	statusTitles,
	taskColors,
	visibilityLabels,
} from "@/lib/task-editor";
import type { GoogleCalendarListItem, TaskEditorState } from "@/lib/task-editor";
import { cn } from "@/lib/utils";
import type {
	HoursSetDTO,
	Priority,
	TaskSchedulingMode,
	TaskStatus,
	TaskVisibilityPreference,
} from "@auto-cron/types";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function TaskDialog({
	open,
	onOpenChange,
	title,
	compactCreate = false,
	value,
	onChange,
	onSubmit,
	submitLabel,
	busy,
	calendars,
	hoursSets,
	defaultTaskSchedulingMode,
	errorMessage,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	compactCreate?: boolean;
	value: TaskEditorState;
	onChange: (value: TaskEditorState) => void;
	onSubmit: () => void;
	submitLabel: string;
	busy: boolean;
	calendars: GoogleCalendarListItem[];
	hoursSets: HoursSetDTO[];
	defaultTaskSchedulingMode: TaskSchedulingMode;
	errorMessage?: string | null;
}) {
	const updateEstimatedMinutes = (next: number) => {
		const clamped = Math.max(15, next);
		onChange({
			...value,
			estimatedMinutes: formatDurationFromMinutes(clamped),
		});
	};

	const bumpEstimatedMinutes = (delta: number) => {
		const current = parseDurationToMinutes(value.estimatedMinutes ?? "");
		const base = current ?? 30;
		updateEstimatedMinutes(base + delta);
	};
	const [showAdvanced, setShowAdvanced] = useState(!compactCreate);

	useEffect(() => {
		if (!open) return;
		setShowAdvanced(!compactCreate);
	}, [compactCreate, open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				{/* ── Header ── */}
				<DialogHeader className="space-y-1">
					<div className="flex items-center gap-2.5">
						<span
							className="size-2.5 rounded-full ring-2 ring-offset-1 ring-offset-background"
							style={{
								backgroundColor: value.color || "#f59e0b",
								boxShadow: `0 0 8px ${value.color || "#f59e0b"}30`,
								// biome-ignore lint/suspicious/noExplicitAny: ring color via style
								["--tw-ring-color" as any]: `${value.color || "#f59e0b"}40`,
							}}
						/>
						<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							{compactCreate ? "01 / Task" : title}
						</p>
					</div>
					<DialogTitle className="font-[family-name:var(--font-outfit)] text-xl font-semibold tracking-tight">
						{value.title || "New task"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{compactCreate && !showAdvanced ? (
						<div className="space-y-5 rounded-xl border border-border/50 p-5">
							<div className="space-y-1.5">
								<Label
									htmlFor="quick-task-name"
									className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
								>
									Task name
								</Label>
								<Input
									id="quick-task-name"
									placeholder="What needs to get done?"
									value={value.title}
									onChange={(event) => onChange({ ...value, title: event.target.value })}
									className="font-[family-name:var(--font-outfit)] text-[0.9rem] font-medium"
								/>
							</div>
							<div className="space-y-1.5">
								<Label
									htmlFor="quick-task-location"
									className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
								>
									Location (optional)
								</Label>
								<Input
									id="quick-task-location"
									placeholder="Office, gym, client site..."
									value={value.location}
									onChange={(event) => onChange({ ...value, location: event.target.value })}
									className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
								/>
							</div>

							<div className="h-px bg-border/30" />

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Time needed
									</Label>
									<DurationInput
										value={value.estimatedMinutes}
										onChange={(estimatedMinutes) => onChange({ ...value, estimatedMinutes })}
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Due date
									</Label>
									<DateTimePicker
										value={value.deadline}
										onChange={(deadline) => onChange({ ...value, deadline })}
										placeholder="Anytime"
										minuteStep={15}
									/>
								</div>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Priority
									</Label>
									<Select
										value={value.priority}
										onValueChange={(priority) =>
											onChange({ ...value, priority: priority as Priority })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Priority" />
										</SelectTrigger>
										<SelectContent>
											{(Object.keys(priorityLabels) as Priority[]).map((p) => (
												<SelectItem key={p} value={p}>
													{priorityLabels[p]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-end">
									<div className="flex w-full items-center justify-between rounded-lg border border-border/40 px-3.5 py-3">
										<div>
											<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-medium">
												Send to Up Next
											</p>
											<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
												Queue it immediately.
											</p>
										</div>
										<Switch
											checked={value.sendToUpNext}
											onCheckedChange={(sendToUpNext) => onChange({ ...value, sendToUpNext })}
										/>
									</div>
								</div>
							</div>

							<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
								Using account defaults for split, rest, travel, visibility, color, hours, and
								calendar. Change these in{" "}
								<a href="/app/settings/scheduling" className="underline underline-offset-2">
									Settings
								</a>
								.
							</p>
						</div>
					) : null}

					{!compactCreate || showAdvanced ? (
						<Accordion type="multiple" defaultValue={["general"]}>
							{/* ── Section 1: General ── */}
							<AccordionItem value="general" className="rounded-xl border border-border/50 px-5">
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											01 / General
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											General details
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Name, category, color, and notes
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-5 pb-5">
									<div className="space-y-1.5">
										<Label
											htmlFor="task-name"
											className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
										>
											Task name
										</Label>
										<Input
											id="task-name"
											placeholder="Task name..."
											value={value.title}
											onChange={(event) => onChange({ ...value, title: event.target.value })}
											className="border-0 border-b border-border/50 bg-transparent px-0 font-[family-name:var(--font-outfit)] text-[0.9rem] font-medium shadow-none ring-0 transition-colors placeholder:text-muted-foreground/40 focus-visible:border-accent focus-visible:ring-0"
										/>
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Category
										</Label>
										<CategoryPicker
											value={value.categoryId}
											onValueChange={(categoryId) => onChange({ ...value, categoryId })}
										/>
									</div>
									<div className="grid gap-4 md:grid-cols-3">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Color
											</Label>
											<ColorPaletteDropdown
												value={value.color}
												onChange={(color) => onChange({ ...value, color })}
												colors={taskColors}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Hours
											</Label>
											<Select
												value={value.hoursSetId || undefined}
												onValueChange={(hoursSetId) => onChange({ ...value, hoursSetId })}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select hours set" />
												</SelectTrigger>
												<SelectContent>
													{hoursSets.map((hoursSet) => (
														<SelectItem key={hoursSet._id} value={hoursSet._id}>
															{hoursSet.name}
															{hoursSet.isDefault ? " (Default)" : ""}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="min-w-0 space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Calendar
											</Label>
											<Select
												value={value.preferredCalendarId}
												onValueChange={(preferredCalendarId) =>
													onChange({ ...value, preferredCalendarId })
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{calendars.map((calendar) => (
														<SelectItem key={calendar.id} value={calendar.id}>
															{calendar.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label
											htmlFor="task-notes"
											className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
										>
											Notes
										</Label>
										<Textarea
											id="task-notes"
											placeholder="Add notes..."
											value={value.description}
											onChange={(event) => onChange({ ...value, description: event.target.value })}
											className="min-h-24 font-[family-name:var(--font-outfit)] text-[0.82rem]"
										/>
									</div>
									<div className="space-y-1.5">
										<Label
											htmlFor="task-location"
											className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
										>
											Location
										</Label>
										<Input
											id="task-location"
											placeholder="Office, gym, client site..."
											value={value.location}
											onChange={(event) => onChange({ ...value, location: event.target.value })}
											className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
										/>
										<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
											If set, scheduler can add travel events before and after this task.
										</p>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* ── Section 2: Scheduling ── */}
							<AccordionItem
								value="scheduling"
								className="mt-4 rounded-xl border border-border/50 px-5"
							>
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											02 / Scheduling
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											Scheduling
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Priority, timing, duration, and split settings
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-5 pb-5">
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Priority
											</Label>
											<Select
												value={value.priority}
												onValueChange={(priority) =>
													onChange({ ...value, priority: priority as Priority })
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Priority" />
												</SelectTrigger>
												<SelectContent>
													{Object.keys(priorityClass).map((priority) => (
														<SelectItem key={priority} value={priority}>
															{priority}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Status
											</Label>
											<Select
												value={value.status}
												onValueChange={(status) =>
													onChange({ ...value, status: status as TaskStatus })
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Status" />
												</SelectTrigger>
												<SelectContent>
													{statusPipelineOrder.map((status) => (
														<SelectItem
															key={status}
															value={status}
															disabled={!manuallyAssignableTaskStatuses.includes(status)}
														>
															{statusTitles[status]}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Scheduling mode
										</Label>
										<Select
											value={value.schedulingMode}
											onValueChange={(schedulingMode) =>
												onChange({
													...value,
													schedulingMode: schedulingMode as "default" | TaskSchedulingMode,
												})
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Scheduling mode" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="default">
													Use default ({schedulingModeLabels[defaultTaskSchedulingMode]})
												</SelectItem>
												{Object.entries(schedulingModeLabels).map(([mode, label]) => (
													<SelectItem key={mode} value={mode}>
														{label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
											This stores mode intent for the scheduler. Algorithms remain unchanged.
										</p>
									</div>

									<div className="h-px bg-border/30" />

									<div className="grid gap-4 md:grid-cols-[1fr_auto]">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Time needed
											</Label>
											<div className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-7"
													onClick={() => bumpEstimatedMinutes(-15)}
												>
													<ArrowDown className="size-3.5" />
												</Button>
												<Input
													type="text"
													inputMode="text"
													value={value.estimatedMinutes}
													onChange={(event) =>
														onChange({ ...value, estimatedMinutes: event.target.value })
													}
													className="h-9 border-0 shadow-none focus-visible:ring-0"
												/>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-7"
													onClick={() => bumpEstimatedMinutes(15)}
												>
													<ArrowUp className="size-3.5" />
												</Button>
											</div>
										</div>
										<div className="flex items-end">
											<div className="flex items-center gap-2 rounded-lg border border-border/40 px-3.5 py-3">
												<Switch
													checked={value.splitAllowed}
													onCheckedChange={(splitAllowed) => onChange({ ...value, splitAllowed })}
												/>
												<Label className="font-[family-name:var(--font-outfit)] text-[0.82rem]">
													Split up
												</Label>
											</div>
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Min chunk
											</Label>
											<DurationInput
												value={value.minChunkMinutes}
												onChange={(minChunkMinutes) => onChange({ ...value, minChunkMinutes })}
												className={cn(!value.splitAllowed && "pointer-events-none opacity-60")}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Max chunk
											</Label>
											<DurationInput
												value={value.maxChunkMinutes}
												onChange={(maxChunkMinutes) => onChange({ ...value, maxChunkMinutes })}
												className={cn(!value.splitAllowed && "pointer-events-none opacity-60")}
											/>
										</div>
									</div>
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Rest time
											</Label>
											<DurationInput
												value={value.restMinutes}
												onChange={(restMinutes) => onChange({ ...value, restMinutes })}
												allowZero
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Travel duration (each side)
											</Label>
											<DurationInput
												value={value.travelMinutes}
												onChange={(travelMinutes) => onChange({ ...value, travelMinutes })}
												allowZero
											/>
											<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
												Adds before/after travel blocks around each scheduled task block.
											</p>
										</div>
									</div>

									<div className="h-px bg-border/30" />

									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Schedule after
											</Label>
											<DateTimePicker
												value={value.scheduleAfter}
												onChange={(scheduleAfter) => onChange({ ...value, scheduleAfter })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Due date
											</Label>
											<DateTimePicker
												value={value.deadline}
												onChange={(deadline) => onChange({ ...value, deadline })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
									</div>

									<div className="flex items-center justify-between rounded-lg border border-border/40 px-3.5 py-3">
										<div>
											<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-medium">
												Send to Up Next
											</p>
											<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
												Push this task to queued immediately.
											</p>
										</div>
										<Switch
											checked={value.sendToUpNext}
											onCheckedChange={(sendToUpNext) => onChange({ ...value, sendToUpNext })}
										/>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* ── Section 3: Visibility ── */}
							<AccordionItem
								value="visibility"
								className="mt-4 rounded-xl border border-border/50 px-5"
							>
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											03 / Visibility
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											Visibility
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Calendar privacy and event visibility
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-3 pb-5">
									<RadioGroup
										value={value.visibilityPreference}
										onValueChange={(visibilityPreference) =>
											onChange({
												...value,
												visibilityPreference: visibilityPreference as TaskVisibilityPreference,
											})
										}
										className="rounded-lg border border-border/40"
									>
										{Object.entries(visibilityLabels).map(([key, label]) => (
											<div
												key={key}
												className={cn(
													"flex cursor-pointer items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0",
													value.visibilityPreference === key && "bg-muted/40",
												)}
											>
												<RadioGroupItem id={`visibility-${key}`} value={key} />
												<div>
													<Label
														htmlFor={`visibility-${key}`}
														className="cursor-pointer font-[family-name:var(--font-outfit)] text-[0.82rem]"
													>
														{label}
													</Label>
													<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
														{key === "private"
															? "Task events are marked private and busy."
															: "Task events follow the calendar's default privacy settings."}
													</p>
												</div>
											</div>
										))}
									</RadioGroup>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					) : null}
				</div>

				{errorMessage ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
						{errorMessage}
					</div>
				) : null}

				{/* ── Footer ── */}
				<DialogFooter>
					{compactCreate ? (
						<Button
							variant="ghost"
							onClick={() => setShowAdvanced((current) => !current)}
							disabled={busy}
							className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium tracking-[0.02em] text-muted-foreground hover:text-foreground"
						>
							{showAdvanced ? "Back to quick form" : "Show advanced fields"}
						</Button>
					) : null}
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={busy}
						className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium tracking-[0.02em] text-muted-foreground hover:text-foreground"
					>
						Cancel
					</Button>
					<Button
						onClick={onSubmit}
						disabled={busy}
						className="gap-2 bg-accent font-[family-name:var(--font-outfit)] text-[0.76rem] font-bold uppercase tracking-[0.1em] text-accent-foreground shadow-[0_2px_12px_-3px_rgba(252,163,17,0.3)] transition-all hover:bg-accent/90 hover:shadow-[0_4px_16px_-3px_rgba(252,163,17,0.4)]"
					>
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
