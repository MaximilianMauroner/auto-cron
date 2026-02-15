"use client";

import { CategoryPicker } from "@/components/category-picker";
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
import { priorityLabels } from "@/lib/scheduling-constants";
import { getEditableCalendars } from "@/lib/task-editor";
import type { Priority } from "@auto-cron/types";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsideContent } from "./aside-content-context";

type TaskDraft = {
	title: string;
	description: string;
	estimatedMinutes: string;
	deadline: string;
	scheduleAfter: string;
	hoursSetId: string;
	preferredCalendarId: string;
	visibilityPreference: "default" | "private";
	location: string;
	color: string;
	categoryId: string;
};

const toDateTimeLocal = (timestamp?: number) => {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toTimestamp = (value: string) => {
	if (!value) return null;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : null;
};

export function TaskEditView({ taskId }: { taskId: string }) {
	const { goBack, openTask } = useAsideContent();
	const taskQuery = useAuthenticatedQueryWithStatus(api.tasks.queries.getTask, {
		id: taskId as Id<"tasks">,
	});
	const task = taskQuery.data;
	const [draft, setDraft] = useState<TaskDraft | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const editableCalendars = useMemo(
		() => getEditableCalendars(googleCalendarsQuery.data ?? []),
		[googleCalendarsQuery.data],
	);
	const { mutate: updateTask, isPending } = useMutationWithStatus(api.tasks.mutations.updateTask);

	useEffect(() => {
		if (!task) return;
		setDraft({
			title: task.title,
			description: task.description ?? "",
			estimatedMinutes: formatDurationFromMinutes(task.estimatedMinutes),
			deadline: toDateTimeLocal(task.deadline),
			scheduleAfter: toDateTimeLocal(task.scheduleAfter),
			hoursSetId: task.hoursSetId ?? "",
			preferredCalendarId: task.preferredCalendarId ?? "primary",
			visibilityPreference: task.visibilityPreference ?? "default",
			location: task.location ?? "",
			color: task.color ?? task.effectiveColor ?? "#f59e0b",
			categoryId: task.categoryId ?? "",
		});
		setErrorMessage(null);
	}, [task]);

	const dirty = useMemo(() => {
		if (!task || !draft) return false;
		return (
			draft.title !== task.title ||
			draft.description !== (task.description ?? "") ||
			draft.estimatedMinutes !== formatDurationFromMinutes(task.estimatedMinutes) ||
			draft.deadline !== toDateTimeLocal(task.deadline) ||
			draft.scheduleAfter !== toDateTimeLocal(task.scheduleAfter) ||
			draft.hoursSetId !== (task.hoursSetId ?? "") ||
			draft.preferredCalendarId !== (task.preferredCalendarId ?? "primary") ||
			draft.visibilityPreference !== (task.visibilityPreference ?? "default") ||
			draft.location !== (task.location ?? "") ||
			draft.color !== (task.color ?? task.effectiveColor ?? "#f59e0b") ||
			draft.categoryId !== (task.categoryId ?? "")
		);
	}, [draft, task]);

	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!dirty) return;
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [dirty]);

	if (taskQuery.isPending || !task || !draft) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Loading task editor...
			</div>
		);
	}

	const updateQuickPriority = (priority: Priority) => {
		void updateTask({ id: task._id, patch: { priority } });
	};

	const onSave = async () => {
		const estimatedMinutes = parseDurationToMinutes(draft.estimatedMinutes);
		if (!draft.title.trim() || estimatedMinutes === null || estimatedMinutes <= 0) {
			setErrorMessage("Please provide a title and valid duration.");
			return;
		}
		setErrorMessage(null);
		await updateTask({
			id: task._id,
			patch: {
				title: draft.title.trim(),
				description: draft.description.trim() || null,
				estimatedMinutes,
				deadline: toTimestamp(draft.deadline),
				scheduleAfter: toTimestamp(draft.scheduleAfter),
				hoursSetId: draft.hoursSetId ? (draft.hoursSetId as Id<"hoursSets">) : null,
				preferredCalendarId: draft.preferredCalendarId || null,
				visibilityPreference: draft.visibilityPreference,
				location: draft.location.trim() || null,
				color: draft.color || null,
				...(draft.categoryId ? { categoryId: draft.categoryId as Id<"taskCategories"> } : {}),
			},
		});
		openTask(task._id, "details", { replace: true });
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
						Edit task
					</p>
				</div>
				<div className="mt-2">
					<Select
						value={task.priority}
						onValueChange={(value) => updateQuickPriority(value as Priority)}
					>
						<SelectTrigger className="h-10 w-full">
							<SelectValue placeholder="Priority" />
						</SelectTrigger>
						<SelectContent>
							{(Object.keys(priorityLabels) as Priority[]).map((priority) => (
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
						<Label>Title</Label>
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
							<Label>Duration</Label>
							<DurationInput
								value={draft.estimatedMinutes}
								onChange={(estimatedMinutes) => setDraft({ ...draft, estimatedMinutes })}
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
							<Label>Due date</Label>
							<DateTimePicker
								value={draft.deadline}
								onChange={(deadline) => setDraft({ ...draft, deadline })}
								placeholder="Anytime"
								minuteStep={15}
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Schedule after</Label>
							<DateTimePicker
								value={draft.scheduleAfter}
								onChange={(scheduleAfter) => setDraft({ ...draft, scheduleAfter })}
								placeholder="Anytime"
								minuteStep={15}
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
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Visibility</Label>
							<Select
								value={draft.visibilityPreference}
								onValueChange={(visibilityPreference) =>
									setDraft({
										...draft,
										visibilityPreference: visibilityPreference as "default" | "private",
									})
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="default">Default</SelectItem>
									<SelectItem value="private">Private</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>Color</Label>
							<ColorPaletteDropdown
								value={draft.color}
								onChange={(color) => setDraft({ ...draft, color })}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label>Category</Label>
						<CategoryPicker
							value={draft.categoryId}
							onValueChange={(categoryId) => setDraft({ ...draft, categoryId })}
						/>
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
							openTask(task._id, "details", { replace: true });
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
