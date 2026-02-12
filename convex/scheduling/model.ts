import type { SchedulingMode } from "./constants";
import { isRangeAvailable } from "./time";

export type PlacementSearchArgs = {
	availabilityMask: boolean[];
	occupancyMask: boolean[];
	durationSlots: number;
	earliestStartSlot: number;
	latestEndSlot?: number;
	mode: SchedulingMode;
	slotScore?: (slot: number) => number;
};

const range = (start: number, end: number) => {
	const values: number[] = [];
	for (let value = start; value < end; value += 1) values.push(value);
	return values;
};

export const findPlacementSlot = ({
	availabilityMask,
	occupancyMask,
	durationSlots,
	earliestStartSlot,
	latestEndSlot,
	mode,
	slotScore,
}: PlacementSearchArgs) => {
	const absoluteLatestStart = availabilityMask.length - durationSlots;
	const dueLimitedLatestStart =
		typeof latestEndSlot === "number"
			? Math.min(absoluteLatestStart, latestEndSlot - durationSlots)
			: absoluteLatestStart;
	if (dueLimitedLatestStart < earliestStartSlot) return null;

	let candidateSlots = range(earliestStartSlot, dueLimitedLatestStart + 1);
	if (mode === "packed") {
		candidateSlots = candidateSlots.reverse();
	}
	if (mode === "balanced" && slotScore) {
		candidateSlots = candidateSlots.sort((a, b) => slotScore(a) - slotScore(b));
	}

	for (const startSlot of candidateSlots) {
		if (isRangeAvailable(availabilityMask, occupancyMask, startSlot, durationSlots)) {
			return startSlot;
		}
	}
	return null;
};
