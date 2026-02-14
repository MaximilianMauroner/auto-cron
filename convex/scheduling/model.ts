import type { PlacementSearchArgs } from "../types/scheduling";
import type { SchedulingMode } from "./constants";
import { isRangeAvailable } from "./time";
export type { PlacementSearchArgs } from "../types/scheduling";

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
	downtimeSlots = 0,
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
		if (
			isRangeAvailable(availabilityMask, occupancyMask, startSlot, durationSlots) &&
			hasDowntimeClearance(occupancyMask, startSlot, durationSlots, downtimeSlots)
		) {
			return startSlot;
		}
	}
	return null;
};

const hasDowntimeClearance = (
	occupancyMask: boolean[],
	startSlot: number,
	durationSlots: number,
	downtimeSlots: number,
) => {
	if (downtimeSlots <= 0) return true;
	const endSlot = startSlot + durationSlots;
	const gapBeforeStart = Math.max(0, startSlot - downtimeSlots);
	for (let slot = gapBeforeStart; slot < startSlot; slot += 1) {
		if (occupancyMask[slot]) return false;
	}
	const gapAfterEnd = Math.min(occupancyMask.length, endSlot + downtimeSlots);
	for (let slot = endSlot; slot < gapAfterEnd; slot += 1) {
		if (occupancyMask[slot]) return false;
	}
	return true;
};
