"use client";

import { useEventDetail } from "./event-detail-context";
import { EventDetailView } from "./event-detail-view";
import { TasksPrioritiesAside } from "./tasks-priorities-aside";

export function AsidePanelContent() {
	const { eventDetail } = useEventDetail();

	if (eventDetail) {
		return <EventDetailView />;
	}

	return <TasksPrioritiesAside />;
}
