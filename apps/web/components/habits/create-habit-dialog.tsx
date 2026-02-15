"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { HabitDialog } from "@/components/habits/habit-dialog";
import { useActionWithStatus, useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { parseDurationToMinutes } from "@/lib/duration";
import {
	type HabitEditorState,
	addMinutesToTime,
	createRequestId,
	getEditableCalendars,
	initialHabitForm,
	parseCsv,
	toTimestamp,
} from "@/lib/habit-editor";
import type { GoogleCalendarListItem } from "@/lib/habit-editor";
import { recurrenceStateToLegacyFrequency, recurrenceStateToRRule } from "@/lib/recurrence";
import type { HoursSetDTO } from "@auto-cron/types";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type CreateHabitDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function CreateHabitDialog({ open, onOpenChange }: CreateHabitDialogProps) {
	const [form, setForm] = useState<HabitEditorState>(initialHabitForm);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [paywallOpen, setPaywallOpen] = useState(false);

	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const hoursSets = (hoursSetsQuery.data ?? []) as HoursSetDTO[];
	const defaultHoursSetId = hoursSets.find((hs) => hs.isDefault)?._id ?? "";

	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const googleCalendars = (googleCalendarsQuery.data ?? []) as GoogleCalendarListItem[];
	const editableGoogleCalendars = useMemo(
		() => getEditableCalendars(googleCalendars),
		[googleCalendars],
	);
	const defaultCalendarId = editableGoogleCalendars.find((c) => c.primary)?.id ?? "primary";

	const defaultCategoryQuery = useAuthenticatedQueryWithStatus(
		api.categories.queries.getDefaultCategory,
		{},
	);
	const defaultCategoryId = defaultCategoryQuery.data?._id ?? "";

	// Reset form when dialog opens
	useEffect(() => {
		if (!open) return;
		setForm({
			...initialHabitForm,
			hoursSetId: defaultHoursSetId,
			preferredCalendarId: defaultCalendarId,
			categoryId: defaultCategoryId,
		});
		setErrorMessage(null);
	}, [open, defaultHoursSetId, defaultCalendarId, defaultCategoryId]);

	// Sync defaults when they load after dialog is already open
	useEffect(() => {
		if (!open) return;
		const patch: Partial<HabitEditorState> = {};
		if (!form.hoursSetId && defaultHoursSetId) patch.hoursSetId = defaultHoursSetId;
		const calendarExists = editableGoogleCalendars.some((c) => c.id === form.preferredCalendarId);
		if (!calendarExists && defaultCalendarId) patch.preferredCalendarId = defaultCalendarId;
		if (Object.keys(patch).length > 0) {
			setForm((current) => ({ ...current, ...patch }));
		}
	}, [
		form.hoursSetId,
		form.preferredCalendarId,
		defaultCalendarId,
		defaultHoursSetId,
		editableGoogleCalendars,
		open,
	]);

	const { execute: createHabit, isPending: isCreatingHabit } = useActionWithStatus(
		api.habits.actions.createHabit,
	);

	const onSubmit = async () => {
		const repeatsPerPeriod = Number.parseInt(form.repeatsPerPeriod, 10);
		const minDurationMinutesParsed = parseDurationToMinutes(form.minDurationMinutes);
		const maxDurationMinutesParsed = parseDurationToMinutes(form.maxDurationMinutes);
		const customReminderMinutes = Number.parseInt(form.customReminderMinutes, 10);

		if (!form.title.trim()) {
			setErrorMessage("Habit title is required.");
			return;
		}
		if (
			minDurationMinutesParsed === null ||
			maxDurationMinutesParsed === null ||
			minDurationMinutesParsed <= 0 ||
			maxDurationMinutesParsed <= 0 ||
			maxDurationMinutesParsed < minDurationMinutesParsed
		) {
			setErrorMessage("Duration settings are invalid.");
			return;
		}
		if (!Number.isFinite(repeatsPerPeriod) || repeatsPerPeriod <= 0) {
			setErrorMessage("Repeat value must be greater than 0.");
			return;
		}
		if (
			form.reminderMode === "custom" &&
			(!Number.isFinite(customReminderMinutes) || customReminderMinutes <= 0)
		) {
			setErrorMessage("Custom reminder minutes must be a positive number.");
			return;
		}

		const minDurationMinutes = minDurationMinutesParsed;
		const maxDurationMinutes = maxDurationMinutesParsed;
		const preferredWindowStart = form.idealTime || undefined;
		const preferredWindowEnd =
			form.idealTime && maxDurationMinutes
				? addMinutesToTime(form.idealTime, maxDurationMinutes)
				: undefined;
		const boundedEndDate =
			form.recurrenceState.endCondition === "on_date" ? toTimestamp(form.endDate) : undefined;

		const payload = {
			title: form.title.trim(),
			description: form.description.trim() || undefined,
			priority: form.priority,
			categoryId: form.categoryId as Id<"taskCategories">,
			recurrenceRule: recurrenceStateToRRule(form.recurrenceState),
			recoveryPolicy: form.recoveryPolicy,
			frequency: recurrenceStateToLegacyFrequency(form.recurrenceState),
			durationMinutes: maxDurationMinutes,
			minDurationMinutes,
			maxDurationMinutes,
			repeatsPerPeriod,
			idealTime: form.idealTime || undefined,
			preferredWindowStart,
			preferredWindowEnd,
			preferredDays: form.preferredDays.length > 0 ? form.preferredDays : undefined,
			hoursSetId: form.hoursSetId ? (form.hoursSetId as Id<"hoursSets">) : undefined,
			preferredCalendarId: form.preferredCalendarId || undefined,
			color: form.color,
			location: form.location.trim() || undefined,
			startDate: toTimestamp(form.startDate),
			endDate: boundedEndDate,
			visibilityPreference: form.visibilityPreference,
			timeDefenseMode: form.timeDefenseMode,
			reminderMode: form.reminderMode,
			customReminderMinutes: form.reminderMode === "custom" ? customReminderMinutes : undefined,
			unscheduledBehavior: form.unscheduledBehavior,
			autoDeclineInvites: form.autoDeclineInvites,
			ccEmails: parseCsv(form.ccEmails),
			duplicateAvoidKeywords: parseCsv(form.duplicateAvoidKeywords),
			dependencyNote: form.dependencyNote.trim() || undefined,
			publicDescription: form.publicDescription.trim() || undefined,
			isActive: form.isActive,
		};

		setErrorMessage(null);
		try {
			await createHabit({ requestId: createRequestId(), input: payload });
			onOpenChange(false);
		} catch (error) {
			const errorPayload = getConvexErrorPayload(error);
			if (errorPayload?.code === "FEATURE_LIMIT_REACHED" && errorPayload.featureId === "habits") {
				setPaywallOpen(true);
				setErrorMessage(errorPayload.message ?? "Habit limit reached.");
				return;
			}
			setErrorMessage(errorPayload?.message ?? "Could not create habit.");
		}
	};

	return (
		<>
			<HabitDialog
				open={open}
				onOpenChange={onOpenChange}
				title="New habit"
				compactCreate
				value={form}
				onChange={setForm}
				onSubmit={onSubmit}
				submitLabel={isCreatingHabit ? "Creating..." : "Create habit"}
				busy={isCreatingHabit}
				hoursSets={hoursSets}
				calendars={editableGoogleCalendars}
			/>
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="habits" />
		</>
	);
}
