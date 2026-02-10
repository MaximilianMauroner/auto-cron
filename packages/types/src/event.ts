export const eventSources = ["manual", "google", "task", "habit"] as const;
export type EventSource = (typeof eventSources)[number];

export const busyStatuses = ["free", "busy", "tentative"] as const;
export type BusyStatus = (typeof busyStatuses)[number];
