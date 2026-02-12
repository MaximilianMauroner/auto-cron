import { SLOT_MS } from "./constants";

export const estimateCapacitySlots = (
	availabilityMask: boolean[],
	occupancyMask: boolean[],
	startSlot: number,
	endSlot: number,
) => {
	let count = 0;
	for (
		let slot = Math.max(0, startSlot);
		slot < Math.min(availabilityMask.length, endSlot);
		slot += 1
	) {
		if (availabilityMask[slot] && !occupancyMask[slot]) count += 1;
	}
	return count;
};

export const lateReasonFromCapacity = (requiredSlots: number, availableSlotsBeforeDue: number) => {
	if (availableSlotsBeforeDue < requiredSlots) {
		const missing = requiredSlots - availableSlotsBeforeDue;
		return `insufficient_capacity_missing_${missing}_slots`;
	}
	return "placement_conflicts_or_chunk_constraints";
};

export const slotsToMinutes = (slots: number) => Math.max(0, slots) * (SLOT_MS / (60 * 1000));
