"use client";

import { CategoryPicker } from "@/components/category-picker";
import { DayPillGroup } from "@/components/recurrence/day-pill-group";
import { RecurrenceSelect } from "@/components/recurrence/recurrence-select";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
	type HabitEditorState,
	type HabitRecoveryPolicy,
	type HabitReminderMode,
	type HabitTimeDefenseMode,
	type HabitUnscheduledBehavior,
	type HabitVisibilityPreference,
	defenseModeLabels,
	habitColors,
	priorityLabels,
	recoveryLabels,
	reminderModeLabels,
	unscheduledLabels,
	visibilityLabels,
} from "@/lib/habit-editor";
import type { GoogleCalendarListItem } from "@/lib/habit-editor";
import { recurrenceStateToLegacyFrequency } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import type { HabitPriority, HoursSetDTO } from "@auto-cron/types";
import { useEffect, useState } from "react";

export function HabitDialog({
	open,
	onOpenChange,
	title,
	compactCreate = false,
	value,
	onChange,
	onSubmit,
	submitLabel,
	busy,
	hoursSets,
	calendars,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	compactCreate?: boolean;
	value: HabitEditorState;
	onChange: (value: HabitEditorState) => void;
	onSubmit: () => void;
	submitLabel: string;
	busy: boolean;
	hoursSets: HoursSetDTO[];
	calendars: GoogleCalendarListItem[];
}) {
	const selectedHoursSet = hoursSets.find((hoursSet) => hoursSet._id === value.hoursSetId);
	const [showAdvanced, setShowAdvanced] = useState(!compactCreate);

	useEffect(() => {
		if (!open) return;
		setShowAdvanced(!compactCreate);
	}, [compactCreate, open]);

	const stepDuration = (field: "minDurationMinutes" | "maxDurationMinutes", delta: number) => {
		const current = parseDurationToMinutes(value[field]);
		const base = current ?? 30;
		const next = Math.max(15, base + delta);
		onChange({ ...value, [field]: formatDurationFromMinutes(next) });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"max-h-[90vh] overflow-y-auto",
					compactCreate && !showAdvanced ? "sm:max-w-xl" : "sm:max-w-2xl",
				)}
			>
				{/* -- Header -- */}
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
							{compactCreate ? "01 / Habit" : title}
						</p>
					</div>
					<DialogTitle className="font-[family-name:var(--font-outfit)] text-xl font-semibold tracking-tight">
						{value.title || "New habit"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{compactCreate && !showAdvanced ? (
						<div className="space-y-5 rounded-xl border border-border/50 p-5">
							<div className="space-y-1.5">
								<Label
									htmlFor="quick-habit-name"
									className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80"
								>
									Habit name
								</Label>
								<Input
									id="quick-habit-name"
									placeholder="What routine do you want to build?"
									value={value.title}
									onChange={(event) => onChange({ ...value, title: event.target.value })}
									className="font-[family-name:var(--font-outfit)] text-[0.9rem] font-medium"
								/>
							</div>

							<div className="h-px bg-border/30" />

							<div className="grid gap-4 md:grid-cols-3">
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Repeat
									</Label>
									<RecurrenceSelect
										value={value.recurrenceState}
										onChange={(recurrenceState) =>
											onChange({
												...value,
												recurrenceState,
												frequency: recurrenceStateToLegacyFrequency(recurrenceState),
												preferredDays:
													recurrenceState.unit === "week"
														? recurrenceState.byDay
														: value.preferredDays,
											})
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Count
									</Label>
									<Input
										type="number"
										min={1}
										step={1}
										value={value.repeatsPerPeriod}
										onChange={(event) =>
											onChange({ ...value, repeatsPerPeriod: event.target.value })
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
										Duration
									</Label>
									<DurationInput
										value={value.minDurationMinutes}
										onChange={(minDurationMinutes) => onChange({ ...value, minDurationMinutes })}
										placeholder="e.g. 30m"
									/>
								</div>
							</div>

							<div className="space-y-1.5">
								<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
									Preferred days
								</Label>
								<DayPillGroup
									selectedDays={value.preferredDays}
									onChange={(days) => onChange({ ...value, preferredDays: days })}
								/>
							</div>

							<div className="h-px bg-border/30" />

							<div className="space-y-1.5">
								<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
									Color
								</Label>
								<ColorPaletteDropdown
									value={value.color}
									onChange={(color) => onChange({ ...value, color })}
									colors={habitColors}
								/>
							</div>

							<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
								Using account defaults for hours, calendar, visibility, and defense. Change these in{" "}
								<a href="/app/settings/scheduling" className="underline underline-offset-2">
									Settings
								</a>
								.
							</p>
						</div>
					) : null}

					{!compactCreate || showAdvanced ? (
						<Accordion type="multiple" defaultValue={["details"]}>
							{/* -- Section 1: Details -- */}
							<AccordionItem value="details" className="rounded-xl border border-border/50 px-5">
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											01 / Details
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											Habit details
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Name, priority, and general settings
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-5 pb-5">
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Habit name
										</Label>
										<Input
											value={value.title}
											onChange={(event) => onChange({ ...value, title: event.target.value })}
											placeholder="Enter a habit name..."
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
											onValueChange={(id) => onChange({ ...value, categoryId: id })}
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
												colors={habitColors}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Priority
											</Label>
											<Select
												value={value.priority}
												onValueChange={(priority) =>
													onChange({ ...value, priority: priority as HabitPriority })
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{Object.entries(priorityLabels).map(([priority, label]) => (
														<SelectItem key={priority} value={priority}>
															{label}
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
													<SelectValue placeholder="Select calendar" />
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
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Notes
										</Label>
										<Textarea
											value={value.description}
											onChange={(event) => onChange({ ...value, description: event.target.value })}
											placeholder="Add notes..."
											className="min-h-24 font-[family-name:var(--font-outfit)] text-[0.82rem]"
										/>
									</div>

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Location
										</Label>
										<Input
											value={value.location}
											onChange={(event) => onChange({ ...value, location: event.target.value })}
											placeholder="Add location"
											className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
										/>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* -- Section 2: Scheduling -- */}
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
											Hours, duration, and scheduling preferences
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-5 pb-5">
									<div className="grid gap-4 md:grid-cols-[minmax(260px,1fr)_auto] md:items-end">
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
										<Button
											variant="link"
											className="justify-start px-0 font-[family-name:var(--font-outfit)] text-[0.76rem]"
											asChild
										>
											<a href="/app/settings/hours">Edit your Working Hours</a>
										</Button>
									</div>

									<div className="space-y-2">
										<p className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Eligible days based on Hours selection
										</p>
										<EligibleHoursGrid hoursSet={selectedHoursSet} />
									</div>

									<div className="h-px bg-border/30" />

									<div className="grid gap-4 md:grid-cols-[1fr_140px_auto] md:items-end">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Repeat
											</Label>
											<RecurrenceSelect
												value={value.recurrenceState}
												onChange={(recurrenceState) =>
													onChange({
														...value,
														recurrenceState,
														frequency: recurrenceStateToLegacyFrequency(recurrenceState),
														preferredDays:
															recurrenceState.unit === "week"
																? recurrenceState.byDay
																: value.preferredDays,
													})
												}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Count
											</Label>
											<Input
												type="number"
												min={1}
												step={1}
												value={value.repeatsPerPeriod}
												onChange={(event) =>
													onChange({ ...value, repeatsPerPeriod: event.target.value })
												}
											/>
										</div>
										<p className="pb-2 font-[family-name:var(--font-outfit)] text-[0.76rem] text-muted-foreground">
											time{value.repeatsPerPeriod === "1" ? "" : "s"} a{" "}
											{value.frequency === "daily" ? "day" : "week"}
										</p>
									</div>

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Ideal days
										</Label>
										<DayPillGroup
											selectedDays={value.preferredDays}
											onChange={(days) => onChange({ ...value, preferredDays: days })}
										/>
									</div>

									<div className="h-px bg-border/30" />

									<div className="grid gap-4 md:grid-cols-3">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Ideal time
											</Label>
											<Input
												type="time"
												value={value.idealTime}
												onChange={(event) => onChange({ ...value, idealTime: event.target.value })}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Minimum duration
											</Label>
											<div className="flex items-center gap-2">
												<DurationInput
													value={value.minDurationMinutes}
													onChange={(minDurationMinutes) =>
														onChange({ ...value, minDurationMinutes })
													}
													placeholder="e.g. 30m"
													className="min-w-0"
												/>
												<Button
													type="button"
													size="icon"
													variant="outline"
													className="size-9 shrink-0"
													onClick={() => stepDuration("minDurationMinutes", -15)}
												>
													-
												</Button>
												<Button
													type="button"
													size="icon"
													variant="outline"
													className="size-9 shrink-0"
													onClick={() => stepDuration("minDurationMinutes", 15)}
												>
													+
												</Button>
											</div>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Maximum duration
											</Label>
											<div className="flex items-center gap-2">
												<DurationInput
													value={value.maxDurationMinutes}
													onChange={(maxDurationMinutes) =>
														onChange({ ...value, maxDurationMinutes })
													}
													placeholder="e.g. 2h"
													className="min-w-0"
												/>
												<Button
													type="button"
													size="icon"
													variant="outline"
													className="size-9 shrink-0"
													onClick={() => stepDuration("maxDurationMinutes", -15)}
												>
													-
												</Button>
												<Button
													type="button"
													size="icon"
													variant="outline"
													className="size-9 shrink-0"
													onClick={() => stepDuration("maxDurationMinutes", 15)}
												>
													+
												</Button>
											</div>
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Start date
											</Label>
											<DateTimePicker
												value={value.startDate}
												onChange={(startDate) => onChange({ ...value, startDate })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												End date
											</Label>
											<DateTimePicker
												value={value.endDate}
												onChange={(endDate) => onChange({ ...value, endDate })}
												placeholder="Anytime"
												minuteStep={15}
											/>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* -- Section 3: Options -- */}
							<AccordionItem
								value="options"
								className="mt-4 rounded-xl border border-border/50 px-5"
							>
								<AccordionTrigger className="py-4">
									<div className="text-left">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">
											03 / Options
										</p>
										<p className="mt-1 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
											Other options
										</p>
										<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal text-muted-foreground">
											Reminders, visibility, time defense, and delivery rules
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-5 pb-5">
									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Reminders
										</Label>
										<RadioGroup
											value={value.reminderMode}
											onValueChange={(reminderMode) =>
												onChange({
													...value,
													reminderMode: reminderMode as HabitReminderMode,
												})
											}
											className="rounded-lg border border-border/40"
										>
											{Object.entries(reminderModeLabels).map(([mode, label]) => (
												<div
													key={mode}
													className={cn(
														"flex cursor-pointer items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0",
														value.reminderMode === mode && "bg-muted/40",
													)}
												>
													<RadioGroupItem value={mode} id={`habit-reminder-${mode}`} />
													<Label
														htmlFor={`habit-reminder-${mode}`}
														className="cursor-pointer font-[family-name:var(--font-outfit)] text-[0.82rem]"
													>
														{label}
													</Label>
												</div>
											))}
										</RadioGroup>
										{value.reminderMode === "custom" ? (
											<div className="space-y-1.5 pt-2">
												<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
													Custom reminder minutes
												</Label>
												<Input
													type="number"
													min={1}
													step={1}
													value={value.customReminderMinutes}
													onChange={(event) =>
														onChange({
															...value,
															customReminderMinutes: event.target.value,
														})
													}
												/>
											</div>
										) : null}
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											If your habit can&apos;t be scheduled
										</Label>
										<RadioGroup
											value={value.unscheduledBehavior}
											onValueChange={(unscheduledBehavior) =>
												onChange({
													...value,
													unscheduledBehavior: unscheduledBehavior as HabitUnscheduledBehavior,
												})
											}
											className="rounded-lg border border-border/40"
										>
											{Object.entries(unscheduledLabels).map(([mode, label]) => (
												<div
													key={mode}
													className={cn(
														"flex cursor-pointer items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0",
														value.unscheduledBehavior === mode && "bg-muted/40",
													)}
												>
													<RadioGroupItem value={mode} id={`habit-unscheduled-${mode}`} />
													<Label
														htmlFor={`habit-unscheduled-${mode}`}
														className="cursor-pointer font-[family-name:var(--font-outfit)] text-[0.82rem]"
													>
														{label}
													</Label>
												</div>
											))}
										</RadioGroup>
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Recovery policy
										</Label>
										<p className="font-[family-name:var(--font-outfit)] text-[0.76rem] text-muted-foreground">
											Control whether missed occurrences should be recovered in later slots.
										</p>
										<RadioGroup
											value={value.recoveryPolicy}
											onValueChange={(recoveryPolicy) =>
												onChange({
													...value,
													recoveryPolicy: recoveryPolicy as HabitRecoveryPolicy,
												})
											}
											className="rounded-lg border border-border/40"
										>
											{Object.entries(recoveryLabels).map(([mode, label]) => (
												<div
													key={mode}
													className={cn(
														"flex cursor-pointer items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0",
														value.recoveryPolicy === mode && "bg-muted/40",
													)}
												>
													<RadioGroupItem value={mode} id={`habit-recovery-${mode}`} />
													<Label
														htmlFor={`habit-recovery-${mode}`}
														className="cursor-pointer font-[family-name:var(--font-outfit)] text-[0.82rem]"
													>
														{label}
													</Label>
												</div>
											))}
										</RadioGroup>
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Visibility
										</Label>
										<p className="font-[family-name:var(--font-outfit)] text-[0.76rem] text-muted-foreground">
											How others see this event on your calendar.
										</p>
										<RadioGroup
											value={value.visibilityPreference}
											onValueChange={(visibilityPreference) =>
												onChange({
													...value,
													visibilityPreference: visibilityPreference as HabitVisibilityPreference,
												})
											}
											className="rounded-lg border border-border/40"
										>
											{Object.entries(visibilityLabels).map(([mode, label]) => (
												<div
													key={mode}
													className={cn(
														"flex cursor-pointer items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0",
														value.visibilityPreference === mode && "bg-muted/40",
													)}
												>
													<RadioGroupItem value={mode} id={`habit-visibility-${mode}`} />
													<div className="space-y-1">
														<Label
															htmlFor={`habit-visibility-${mode}`}
															className="cursor-pointer font-[family-name:var(--font-outfit)] text-[0.82rem] font-normal"
														>
															{label}
														</Label>
														{mode === "public" ? (
															<Textarea
																value={value.publicDescription}
																onChange={(event) =>
																	onChange({
																		...value,
																		publicDescription: event.target.value,
																	})
																}
																placeholder="Optional public description for defended events"
																className="mt-1 min-h-16 font-[family-name:var(--font-outfit)] text-[0.82rem]"
															/>
														) : null}
													</div>
												</div>
											))}
										</RadioGroup>
									</div>

									<div className="h-px bg-border/30" />

									<div className="space-y-1.5">
										<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
											Time defense
										</Label>
										<p className="font-[family-name:var(--font-outfit)] text-[0.76rem] text-muted-foreground">
											How aggressively Auto Cron should defend this event on your calendar.
										</p>
										<RadioGroup
											value={value.timeDefenseMode}
											onValueChange={(timeDefenseMode) =>
												onChange({
													...value,
													timeDefenseMode: timeDefenseMode as HabitTimeDefenseMode,
												})
											}
											className="rounded-lg border border-border/40"
										>
											{Object.entries(defenseModeLabels).map(([mode, label]) => (
												<div
													key={mode}
													className={cn(
														"flex cursor-pointer items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0",
														value.timeDefenseMode === mode && "bg-muted/40",
													)}
												>
													<RadioGroupItem value={mode} id={`habit-defense-${mode}`} />
													<Label
														htmlFor={`habit-defense-${mode}`}
														className="cursor-pointer font-[family-name:var(--font-outfit)] text-[0.82rem]"
													>
														{label}
													</Label>
												</div>
											))}
										</RadioGroup>
									</div>

									<div className="h-px bg-border/30" />

									<div className="rounded-lg border border-border/40 px-3.5 py-3">
										<div className="flex items-center space-x-2.5">
											<Checkbox
												id="auto-decline"
												checked={value.autoDeclineInvites}
												onCheckedChange={(checked) =>
													onChange({ ...value, autoDeclineInvites: checked === true })
												}
											/>
											<Label
												htmlFor="auto-decline"
												className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
											>
												Auto-decline invites
											</Label>
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-3">
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												CC others
											</Label>
											<Input
												value={value.ccEmails}
												onChange={(event) => onChange({ ...value, ccEmails: event.target.value })}
												placeholder="a@x.com, b@y.com"
												className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Avoid duplicate keywords
											</Label>
											<Input
												value={value.duplicateAvoidKeywords}
												onChange={(event) =>
													onChange({
														...value,
														duplicateAvoidKeywords: event.target.value,
													})
												}
												placeholder="meeting, class"
												className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="font-[family-name:var(--font-cutive)] text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80">
												Dependency note
											</Label>
											<Input
												value={value.dependencyNote}
												onChange={(event) =>
													onChange({ ...value, dependencyNote: event.target.value })
												}
												placeholder="Depends on..."
												className="font-[family-name:var(--font-outfit)] text-[0.82rem]"
											/>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					) : null}

					{/* Active toggle */}
					<div className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-3">
						<div>
							<p className="font-[family-name:var(--font-outfit)] text-[0.82rem] font-medium">
								Active
							</p>
							<p className="font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground">
								Enable this habit for scheduling
							</p>
						</div>
						<Switch
							checked={value.isActive}
							onCheckedChange={(isActive) => onChange({ ...value, isActive })}
						/>
					</div>
				</div>

				{/* -- Footer -- */}
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

function EligibleHoursGrid({ hoursSet }: { hoursSet?: HoursSetDTO }) {
	const dayOptions = [
		{ value: 0, short: "Sun" },
		{ value: 1, short: "Mon" },
		{ value: 2, short: "Tue" },
		{ value: 3, short: "Wed" },
		{ value: 4, short: "Thu" },
		{ value: 5, short: "Fri" },
		{ value: 6, short: "Sat" },
	];

	return (
		<div className="rounded-lg border border-border/70 bg-background/40 p-3">
			<div className="space-y-1.5">
				{dayOptions.map((day) => (
					<div key={day.value} className="grid grid-cols-[40px_1fr] items-center gap-2">
						<div className="text-sm text-muted-foreground">{day.short}</div>
						<div className="grid grid-cols-24 gap-1">
							{Array.from({ length: 24 }).map((_, hour) => {
								const cellStart = hour * 60;
								const cellEnd = cellStart + 60;
								const active =
									hoursSet?.windows.some(
										(window) =>
											window.day === day.value &&
											cellStart < window.endMinute &&
											cellEnd > window.startMinute,
									) ?? false;
								return (
									<div
										key={`${day.value}-${hour}`}
										className={cn(
											"h-4 rounded-[4px] border border-border/30",
											active ? "bg-emerald-400/60" : "bg-muted/40",
										)}
									/>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
