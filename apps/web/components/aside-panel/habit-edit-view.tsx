"use client";

import { CategoryPicker } from "@/components/category-picker";
import { DayPillGroup } from "@/components/recurrence/day-pill-group";
import { RecurrenceSelect } from "@/components/recurrence/recurrence-select";
import { Button } from "@/components/ui/button";
import { ColorPaletteDropdown } from "@/components/ui/color-palette";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import { addMinutesToTime, habitColors, priorityLabels } from "@/lib/habit-editor";
import { getEditableCalendars, parseCsv, toDateTimeInput, toTimestamp } from "@/lib/habit-editor";
import type { HabitEditorState } from "@/lib/habit-editor";
import {
	recurrenceStateToLegacyFrequency,
	recurrenceStateToRRule,
	rruleToRecurrenceState,
} from "@/lib/recurrence";
import type { HabitPriority } from "@auto-cron/types";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsideContent } from "./aside-content-context";

export function HabitEditView({ habitId }: { habitId: string }) {
	const { goBack, openHabit } = useAsideContent();
	const habitQuery = useAuthenticatedQueryWithStatus(api.habits.queries.getHabit, {
		id: habitId as Id<"habits">,
	});
	const habit = habitQuery.data;
	const [draft, setDraft] = useState<HabitEditorState | null>(null);
	const [initialSnapshot, setInitialSnapshot] = useState("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const editableCalendars = getEditableCalendars(googleCalendarsQuery.data ?? []);
	const { mutate: updateHabit, isPending } = useMutationWithStatus(
		api.habits.mutations.updateHabit,
	);
	const { mutate: toggleHabitActive } = useMutationWithStatus(
		api.habits.mutations.toggleHabitActive,
	);

	useEffect(() => {
		if (!habit) return;
		const recurrenceState = rruleToRecurrenceState(habit.recurrenceRule, habit.frequency);
		const nextDraft = {
			id: habit._id,
			title: habit.title,
			description: habit.description ?? "",
			priority: habit.priority ?? "medium",
			categoryId: habit.categoryId,
			frequency: habit.frequency ?? recurrenceStateToLegacyFrequency(recurrenceState),
			recurrenceState,
			repeatsPerPeriod: String(habit.repeatsPerPeriod ?? 1),
			minDurationMinutes: formatDurationFromMinutes(
				habit.minDurationMinutes ?? habit.durationMinutes,
			),
			maxDurationMinutes: formatDurationFromMinutes(
				habit.maxDurationMinutes ?? habit.durationMinutes,
			),
			idealTime: habit.idealTime ?? habit.preferredWindowStart ?? "",
			preferredDays: habit.preferredDays ?? [],
			hoursSetId: habit.hoursSetId ?? "",
			preferredCalendarId: habit.preferredCalendarId ?? "primary",
			color: habit.color ?? habit.effectiveColor ?? "#f59e0b",
			location: habit.location ?? "",
			startDate: toDateTimeInput(habit.startDate),
			endDate: toDateTimeInput(habit.endDate),
			visibilityPreference: habit.visibilityPreference ?? "default",
			timeDefenseMode: habit.timeDefenseMode ?? "auto",
			reminderMode: habit.reminderMode ?? "default",
			customReminderMinutes: String(habit.customReminderMinutes ?? 15),
			unscheduledBehavior: habit.unscheduledBehavior ?? "remove_from_calendar",
			recoveryPolicy: habit.recoveryPolicy ?? "skip",
			autoDeclineInvites: habit.autoDeclineInvites ?? false,
			ccEmails: (habit.ccEmails ?? []).join(", "),
			duplicateAvoidKeywords: (habit.duplicateAvoidKeywords ?? []).join(", "),
			dependencyNote: habit.dependencyNote ?? "",
			publicDescription: habit.publicDescription ?? "",
			isActive: habit.isActive,
		};
		setDraft(nextDraft);
		setInitialSnapshot(JSON.stringify(nextDraft));
		setErrorMessage(null);
	}, [habit]);

	const dirty = useMemo(() => {
		if (!draft) return false;
		return JSON.stringify(draft) !== initialSnapshot;
	}, [draft, initialSnapshot]);

	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!dirty) return;
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [dirty]);

	if (habitQuery.isPending || !habit || !draft) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Loading habit editor...
			</div>
		);
	}

	const toPatch = (form: HabitEditorState) => {
		const repeatsPerPeriod = Number.parseInt(form.repeatsPerPeriod, 10);
		const minDurationMinutes = parseDurationToMinutes(form.minDurationMinutes);
		const maxDurationMinutes = parseDurationToMinutes(form.maxDurationMinutes);
		const customReminderMinutes = Number.parseInt(form.customReminderMinutes, 10);
		if (!form.title.trim()) return "Habit title is required.";
		if (
			minDurationMinutes === null ||
			maxDurationMinutes === null ||
			minDurationMinutes <= 0 ||
			maxDurationMinutes <= 0 ||
			maxDurationMinutes < minDurationMinutes
		) {
			return "Duration settings are invalid.";
		}
		if (!Number.isFinite(repeatsPerPeriod) || repeatsPerPeriod <= 0) {
			return "Repeat value must be greater than 0.";
		}
		const preferredWindowStart = form.idealTime || undefined;
		const preferredWindowEnd =
			form.idealTime && maxDurationMinutes
				? addMinutesToTime(form.idealTime, maxDurationMinutes)
				: undefined;
		return {
			title: form.title.trim(),
			description: form.description.trim() || null,
			priority: form.priority,
			categoryId: form.categoryId as Id<"taskCategories">,
			recurrenceRule: recurrenceStateToRRule(form.recurrenceState),
			recoveryPolicy: form.recoveryPolicy,
			frequency: recurrenceStateToLegacyFrequency(form.recurrenceState),
			durationMinutes: maxDurationMinutes,
			minDurationMinutes,
			maxDurationMinutes,
			repeatsPerPeriod,
			idealTime: form.idealTime || null,
			preferredWindowStart: preferredWindowStart ?? null,
			preferredWindowEnd: preferredWindowEnd ?? null,
			preferredDays: form.preferredDays.length > 0 ? form.preferredDays : null,
			hoursSetId: form.hoursSetId ? (form.hoursSetId as Id<"hoursSets">) : null,
			preferredCalendarId: form.preferredCalendarId || null,
			color: form.color,
			location: form.location.trim() || null,
			startDate: toTimestamp(form.startDate) ?? null,
			endDate: toTimestamp(form.endDate) ?? null,
			visibilityPreference: form.visibilityPreference,
			timeDefenseMode: form.timeDefenseMode,
			reminderMode: form.reminderMode,
			customReminderMinutes: form.reminderMode === "custom" ? customReminderMinutes : null,
			unscheduledBehavior: form.unscheduledBehavior,
			autoDeclineInvites: form.autoDeclineInvites,
			ccEmails: parseCsv(form.ccEmails),
			duplicateAvoidKeywords: parseCsv(form.duplicateAvoidKeywords),
			dependencyNote: form.dependencyNote.trim() || null,
			publicDescription: form.publicDescription.trim() || null,
			isActive: form.isActive,
		};
	};

	const onSave = async () => {
		const patch = toPatch(draft);
		if (typeof patch === "string") {
			setErrorMessage(patch);
			return;
		}
		setErrorMessage(null);
		await updateHabit({ id: habit._id, patch });
		openHabit(habit._id, "details", { replace: true });
	};

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border/60 px-3 py-2">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-[0.72rem]"
						onClick={() => {
							if (dirty && !window.confirm("Discard unsaved changes?")) return;
							goBack();
						}}
					>
						Back
					</Button>
					<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
						Edit habit
					</p>
				</div>
				<div className="mt-2 grid grid-cols-2 gap-2">
					<Button
						type="button"
						variant={habit.isActive ? "outline" : "default"}
						size="sm"
						onClick={() => toggleHabitActive({ id: habit._id, isActive: !habit.isActive })}
					>
						{habit.isActive ? "Pause" : "Resume"}
					</Button>
					<Select
						value={habit.priority ?? "medium"}
						onValueChange={(priority) =>
							updateHabit({
								id: habit._id,
								patch: { priority: priority as HabitPriority },
							})
						}
					>
						<SelectTrigger className="h-8">
							<SelectValue placeholder="Priority" />
						</SelectTrigger>
						<SelectContent>
							{(["low", "medium", "high", "critical"] as const).map((priority) => (
								<SelectItem key={priority} value={priority}>
									{priorityLabels[priority]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label>Habit name</Label>
						<Input
							value={draft.title}
							onChange={(event) => setDraft({ ...draft, title: event.target.value })}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Description</Label>
						<Textarea
							value={draft.description}
							onChange={(event) => setDraft({ ...draft, description: event.target.value })}
							rows={3}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Recurrence</Label>
							<RecurrenceSelect
								value={draft.recurrenceState}
								onChange={(recurrenceState) => setDraft({ ...draft, recurrenceState })}
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Repeats</Label>
							<Input
								type="number"
								min={1}
								value={draft.repeatsPerPeriod}
								onChange={(event) => setDraft({ ...draft, repeatsPerPeriod: event.target.value })}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label>Preferred days</Label>
						<DayPillGroup
							selectedDays={draft.preferredDays}
							onChange={(preferredDays) => setDraft({ ...draft, preferredDays })}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Min duration</Label>
							<DurationInput
								value={draft.minDurationMinutes}
								onChange={(minDurationMinutes) => setDraft({ ...draft, minDurationMinutes })}
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Max duration</Label>
							<DurationInput
								value={draft.maxDurationMinutes}
								onChange={(maxDurationMinutes) => setDraft({ ...draft, maxDurationMinutes })}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Ideal time</Label>
							<Input
								value={draft.idealTime}
								onChange={(event) => setDraft({ ...draft, idealTime: event.target.value })}
								placeholder="09:00"
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Location</Label>
							<Input
								value={draft.location}
								onChange={(event) => setDraft({ ...draft, location: event.target.value })}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Start date</Label>
							<DateTimePicker
								value={draft.startDate}
								onChange={(startDate) => setDraft({ ...draft, startDate })}
								placeholder="Anytime"
								minuteStep={15}
							/>
						</div>
						<div className="space-y-1.5">
							<Label>End date</Label>
							<DateTimePicker
								value={draft.endDate}
								onChange={(endDate) => setDraft({ ...draft, endDate })}
								placeholder="Anytime"
								minuteStep={15}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Category</Label>
							<CategoryPicker
								value={draft.categoryId}
								onValueChange={(categoryId) => setDraft({ ...draft, categoryId })}
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Color</Label>
							<ColorPaletteDropdown
								value={draft.color}
								onChange={(color) => setDraft({ ...draft, color })}
								colors={habitColors}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Hours set</Label>
							<Select
								value={draft.hoursSetId || "__none__"}
								onValueChange={(hoursSetId) =>
									setDraft({ ...draft, hoursSetId: hoursSetId === "__none__" ? "" : hoursSetId })
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Default" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__">Default</SelectItem>
									{(hoursSetsQuery.data ?? []).map((hoursSet) => (
										<SelectItem key={hoursSet._id} value={hoursSet._id}>
											{hoursSet.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>Calendar</Label>
							<Select
								value={draft.preferredCalendarId || "primary"}
								onValueChange={(preferredCalendarId) => setDraft({ ...draft, preferredCalendarId })}
							>
								<SelectTrigger>
									<SelectValue placeholder="Calendar" />
								</SelectTrigger>
								<SelectContent>
									{editableCalendars.map((calendar) => (
										<SelectItem key={calendar.id} value={calendar.id}>
											{calendar.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					{errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
				</div>
			</div>

			<div className="shrink-0 border-t border-border/60 px-3 py-2">
				<div className="flex items-center justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							if (dirty && !window.confirm("Discard unsaved changes?")) return;
							openHabit(habit._id, "details", { replace: true });
						}}
					>
						Cancel
					</Button>
					<Button type="button" size="sm" onClick={onSave} disabled={isPending}>
						{isPending ? "Saving..." : "Save"}
					</Button>
				</div>
			</div>
		</div>
	);
}
