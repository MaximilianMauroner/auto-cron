"use client";

import { useAsideContent } from "./aside-content-context";
import { EventRouteView } from "./event-route-view";
import { HabitDetailView } from "./habit-detail-view";
import { HabitEditView } from "./habit-edit-view";
import { TaskDetailView } from "./task-detail-view";
import { TaskEditView } from "./task-edit-view";
import { TasksPrioritiesAside } from "./tasks-priorities-aside";

export function AsidePanelContent() {
	const { route } = useAsideContent();

	if (route.kind === "taskDetails") {
		return <TaskDetailView taskId={route.taskId} />;
	}

	if (route.kind === "taskEdit") {
		return <TaskEditView taskId={route.taskId} />;
	}

	if (route.kind === "habitDetails") {
		return <HabitDetailView habitId={route.habitId} />;
	}

	if (route.kind === "habitEdit") {
		return <HabitEditView habitId={route.habitId} />;
	}

	if (route.kind === "eventDetails" || route.kind === "eventEdit") {
		return (
			<EventRouteView
				eventId={route.eventId}
				mode={route.kind === "eventEdit" ? "edit" : "details"}
			/>
		);
	}

	return <TasksPrioritiesAside />;
}
