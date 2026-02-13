import {
	DAY_SLOTS,
	type HabitPriorityLevel,
	MODE_MOVE_WEIGHT,
	type PriorityLevel,
	type SchedulingMode,
	WEIGHTS,
	priorityWeight,
} from "./constants";
import type { RecoveryPolicy } from "./types";

export const taskLatenessPenalty = (
	tardinessSlots: number,
	priority: PriorityLevel,
	blocker: boolean,
) => {
	if (tardinessSlots <= 0) return 0;
	const p = priorityWeight(priority);
	const dailyLate = Math.floor(tardinessSlots / DAY_SLOTS);
	let convex = 0;
	for (let day = 1; day <= dailyLate; day += 1) {
		convex += WEIGHTS.latePerDayBase * day;
	}
	const base = WEIGHTS.latePerSlot * tardinessSlots + convex;
	return base * p * (blocker ? WEIGHTS.blockerMultiplier : 1);
};

export const blockerStartPenalty = (
	startSlot: number,
	priority: PriorityLevel,
	blocker: boolean,
) => {
	if (!blocker) return 0;
	return priorityWeight(priority) * WEIGHTS.startAsap * startSlot;
};

export const habitKeepReward = (
	durationSlots: number,
	priority: HabitPriorityLevel,
	recovery: RecoveryPolicy,
) => {
	const base = recovery === "recover" ? WEIGHTS.baseRecover : WEIGHTS.baseSkip;
	return base * priorityWeight(priority) * durationSlots;
};

export const habitShortfallPenalty = (shortfall: number, priority: HabitPriorityLevel) => {
	if (shortfall <= 0) return 0;
	return WEIGHTS.shortfall * priorityWeight(priority) * shortfall;
};

export const idealTimePenalty = (distanceSlots: number, priority: HabitPriorityLevel) => {
	return WEIGHTS.ideal * priorityWeight(priority) * distanceSlots;
};

export const preferredDayPenalty = (notPreferred: boolean, priority: HabitPriorityLevel) => {
	if (!notPreferred) return 0;
	return WEIGHTS.preferredDay * priorityWeight(priority);
};

export const movePenalty = (
	oldStartSlot: number | undefined,
	newStartSlot: number,
	priority: PriorityLevel,
	mode: SchedulingMode,
) => {
	if (oldStartSlot === undefined) return 0;
	const distance = Math.abs(newStartSlot - oldStartSlot);
	return MODE_MOVE_WEIGHT[mode] * priorityWeight(priority) * distance;
};

export const modePlacementPenalty = (slot: number, mode: SchedulingMode) => {
	if (mode === "fastest") return WEIGHTS.modeFastestEarly * slot;
	if (mode === "packed") return -WEIGHTS.modePackedLateReward * slot;
	return 0;
};
