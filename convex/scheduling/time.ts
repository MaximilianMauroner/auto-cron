import { HORIZON_WEEKS_DEFAULT, HORIZON_WEEKS_MAX, HORIZON_WEEKS_MIN, SLOT_MS } from "./constants";
import type { BusyInterval, HourWindow } from "./types";

const WEEKDAY_TO_INDEX: Record<string, HourWindow["day"]> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
};

const formatters = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timezone: string) => {
	const cached = formatters.get(timezone);
	if (cached) return cached;
	const created = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	formatters.set(timezone, created);
	return created;
};

export const clampHorizonWeeks = (weeks: number | undefined) => {
	if (!weeks || !Number.isFinite(weeks)) return HORIZON_WEEKS_DEFAULT;
	return Math.max(HORIZON_WEEKS_MIN, Math.min(HORIZON_WEEKS_MAX, Math.floor(weeks)));
};

export const floorToSlot = (timestamp: number) => Math.floor(timestamp / SLOT_MS) * SLOT_MS;

export const ceilToSlot = (timestamp: number) => Math.ceil(timestamp / SLOT_MS) * SLOT_MS;

export const slotCountBetween = (start: number, end: number) =>
	Math.max(0, Math.floor((end - start) / SLOT_MS));

export const timestampForSlot = (horizonStart: number, slot: number) =>
	horizonStart + slot * SLOT_MS;

export const slotForTimestamp = (horizonStart: number, timestamp: number) =>
	Math.floor((timestamp - horizonStart) / SLOT_MS);

export const slotRangeForInterval = (
	horizonStart: number,
	horizonEnd: number,
	intervalStart: number,
	intervalEnd: number,
) => {
	const start = Math.max(horizonStart, intervalStart);
	const end = Math.min(horizonEnd, intervalEnd);
	if (end <= start) return null;
	const startSlot = Math.max(0, slotForTimestamp(horizonStart, floorToSlot(start)));
	const endSlot = Math.max(startSlot, slotForTimestamp(horizonStart, ceilToSlot(end)));
	return { startSlot, endSlot };
};

export const zonedPartsForTimestamp = (timestamp: number, timezone: string) => {
	try {
		const parts = getFormatter(timezone).formatToParts(new Date(timestamp));
		const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
		const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
		const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
		return {
			day: WEEKDAY_TO_INDEX[weekday] ?? 1,
			minuteOfDay: Math.max(0, Math.min(1439, hour * 60 + minute)),
		};
	} catch {
		const date = new Date(timestamp);
		return {
			day: date.getUTCDay() as HourWindow["day"],
			minuteOfDay: date.getUTCHours() * 60 + date.getUTCMinutes(),
		};
	}
};

export const buildAllowedMask = (
	horizonStart: number,
	slotCount: number,
	timezone: string,
	windows: HourWindow[],
) => {
	const windowsByDay = new Map<HourWindow["day"], HourWindow[]>();
	for (const window of windows) {
		const dayWindows = windowsByDay.get(window.day) ?? [];
		dayWindows.push(window);
		windowsByDay.set(window.day, dayWindows);
	}

	const mask = new Array<boolean>(slotCount).fill(false);
	for (let slot = 0; slot < slotCount; slot += 1) {
		const ts = timestampForSlot(horizonStart, slot);
		const parts = zonedPartsForTimestamp(ts, timezone);
		const dayWindows = windowsByDay.get(parts.day) ?? [];
		mask[slot] = dayWindows.some(
			(window) => parts.minuteOfDay >= window.startMinute && parts.minuteOfDay < window.endMinute,
		);
	}
	return mask;
};

export const buildBusyMask = (
	horizonStart: number,
	horizonEnd: number,
	slotCount: number,
	busyIntervals: BusyInterval[],
) => {
	const mask = new Array<boolean>(slotCount).fill(false);
	for (const interval of busyIntervals) {
		const range = slotRangeForInterval(horizonStart, horizonEnd, interval.start, interval.end);
		if (!range) continue;
		for (let slot = range.startSlot; slot < range.endSlot; slot += 1) {
			if (slot >= 0 && slot < slotCount) mask[slot] = true;
		}
	}
	return mask;
};

export const mergeMasks = (left: boolean[], right: boolean[]) => {
	const size = Math.min(left.length, right.length);
	const merged = new Array<boolean>(size).fill(false);
	for (let i = 0; i < size; i += 1) {
		merged[i] = (left[i] ?? false) && !(right[i] ?? false);
	}
	return merged;
};

export const isRangeAvailable = (
	availabilityMask: boolean[],
	occupancyMask: boolean[],
	startSlot: number,
	durationSlots: number,
) => {
	if (durationSlots <= 0) return false;
	const endSlot = startSlot + durationSlots;
	if (startSlot < 0 || endSlot > availabilityMask.length) return false;
	for (let slot = startSlot; slot < endSlot; slot += 1) {
		if (!availabilityMask[slot] || occupancyMask[slot]) return false;
	}
	return true;
};

export const occupyRange = (occupancyMask: boolean[], startSlot: number, durationSlots: number) => {
	const endSlot = startSlot + durationSlots;
	for (let slot = startSlot; slot < endSlot; slot += 1) {
		occupancyMask[slot] = true;
	}
};
