"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useActionWithStatus, useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { parseDurationToMinutes } from "@/lib/duration";
import {
	createRequestId,
	createTaskEditorState,
	fallbackTaskQuickCreateDefaults,
	getEditableCalendars,
	toTimestamp,
} from "@/lib/task-editor";
import type { GoogleCalendarListItem, TaskEditorState } from "@/lib/task-editor";
import type { HoursSetDTO } from "@auto-cron/types";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type CreateTaskDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
	const [form, setForm] = useState<TaskEditorState>(() =>
		createTaskEditorState({
			defaults: fallbackTaskQuickCreateDefaults,
			defaultHoursSetId: "",
			defaultCalendarId: "primary",
			defaultCategoryId: "",
		}),
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [paywallOpen, setPaywallOpen] = useState(false);

	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);
	const defaultTaskSchedulingMode =
		schedulingDefaultsQuery.data?.defaultTaskSchedulingMode ?? "fastest";
	const taskQuickCreateDefaults = useMemo(
		() => schedulingDefaultsQuery.data?.taskQuickCreateDefaults ?? fallbackTaskQuickCreateDefaults,
		[schedulingDefaultsQuery.data?.taskQuickCreateDefaults],
	);

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
		setForm(
			createTaskEditorState({
				defaults: taskQuickCreateDefaults,
				defaultHoursSetId,
				defaultCalendarId,
				defaultCategoryId,
			}),
		);
		setErrorMessage(null);
	}, [open, taskQuickCreateDefaults, defaultHoursSetId, defaultCalendarId, defaultCategoryId]);

	// Sync calendar selection if it becomes invalid
	useEffect(() => {
		if (!open) return;
		if (editableGoogleCalendars.some((c) => c.id === form.preferredCalendarId)) return;
		setForm((current) => ({ ...current, preferredCalendarId: defaultCalendarId }));
	}, [form.preferredCalendarId, defaultCalendarId, editableGoogleCalendars, open]);

	// Sync hours set if missing
	useEffect(() => {
		if (!open || !defaultHoursSetId) return;
		if (form.hoursSetId) return;
		setForm((current) => ({ ...current, hoursSetId: defaultHoursSetId }));
	}, [form.hoursSetId, defaultHoursSetId, open]);

	const { execute: createTask, isPending: isCreatingTask } = useActionWithStatus(
		api.tasks.actions.createTask,
	);

	const onSubmit = async () => {
		const estimatedMinutesParsed = parseDurationToMinutes(form.estimatedMinutes);
		const minChunkMinutesParsed = parseDurationToMinutes(form.minChunkMinutes);
		const maxChunkMinutesParsed = parseDurationToMinutes(form.maxChunkMinutes);
		const restMinutesParsed = parseDurationToMinutes(form.restMinutes);
		const travelMinutesParsed = parseDurationToMinutes(form.travelMinutes);

		if (!form.title.trim() || estimatedMinutesParsed === null || estimatedMinutesParsed <= 0) {
			setErrorMessage("Please provide a title and valid estimated duration.");
			return;
		}
		if (
			form.splitAllowed &&
			(minChunkMinutesParsed === null ||
				maxChunkMinutesParsed === null ||
				minChunkMinutesParsed <= 0 ||
				maxChunkMinutesParsed < minChunkMinutesParsed)
		) {
			setErrorMessage("Split duration range is invalid.");
			return;
		}
		if (
			restMinutesParsed === null ||
			travelMinutesParsed === null ||
			restMinutesParsed < 0 ||
			travelMinutesParsed < 0
		) {
			setErrorMessage("Rest and travel durations must be 0 or greater.");
			return;
		}

		const payload = {
			title: form.title.trim(),
			description: form.description.trim() || undefined,
			location: form.location.trim() || undefined,
			priority: form.priority,
			status: (form.sendToUpNext || form.status === "queued" ? "queued" : "backlog") as
				| "backlog"
				| "queued",
			estimatedMinutes: estimatedMinutesParsed,
			deadline: toTimestamp(form.deadline),
			scheduleAfter: toTimestamp(form.scheduleAfter),
			splitAllowed: form.splitAllowed,
			minChunkMinutes: form.splitAllowed ? (minChunkMinutesParsed ?? undefined) : undefined,
			maxChunkMinutes: form.splitAllowed ? (maxChunkMinutesParsed ?? undefined) : undefined,
			restMinutes: restMinutesParsed,
			travelMinutes: travelMinutesParsed,
			sendToUpNext: form.sendToUpNext,
			hoursSetId: form.hoursSetId ? (form.hoursSetId as Id<"hoursSets">) : undefined,
			schedulingMode: form.schedulingMode === "default" ? undefined : form.schedulingMode,
			visibilityPreference: form.visibilityPreference,
			preferredCalendarId: form.preferredCalendarId || undefined,
			color: form.color,
			categoryId: form.categoryId ? (form.categoryId as Id<"taskCategories">) : undefined,
		};

		setErrorMessage(null);
		try {
			await createTask({ requestId: createRequestId(), input: payload });
			onOpenChange(false);
		} catch (error) {
			const errorPayload = getConvexErrorPayload(error);
			if (errorPayload?.code === "FEATURE_LIMIT_REACHED" && errorPayload.featureId === "tasks") {
				setPaywallOpen(true);
				setErrorMessage(errorPayload.message ?? "Task limit reached.");
				return;
			}
			setErrorMessage(errorPayload?.message ?? "Could not save task.");
		}
	};

	return (
		<>
			<TaskDialog
				open={open}
				onOpenChange={onOpenChange}
				title="New task"
				compactCreate
				value={form}
				onChange={setForm}
				onSubmit={onSubmit}
				submitLabel={isCreatingTask ? "Creating..." : "Create task"}
				busy={isCreatingTask}
				calendars={editableGoogleCalendars}
				hoursSets={hoursSets}
				defaultTaskSchedulingMode={defaultTaskSchedulingMode}
				errorMessage={errorMessage}
			/>
			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="tasks" />
		</>
	);
}
