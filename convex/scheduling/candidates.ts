import type { HabitOccurrenceCandidate, TaskChunkPlan } from "../types/scheduling";
import { SLOT_MINUTES, SLOT_MS } from "./constants";
import { type ParsedRRule, buildHabitPeriods } from "./rrule";
import { slotForTimestamp, timestampForSlot, zonedPartsForTimestamp } from "./time";
import type { SchedulingHabitInput, SchedulingTaskInput } from "./types";
export type { HabitOccurrenceCandidate, TaskChunkPlan } from "../types/scheduling";

export const toSlots = (minutes: number) => Math.max(1, Math.ceil(minutes / SLOT_MINUTES));

export const buildTaskChunkPlan = (task: SchedulingTaskInput): TaskChunkPlan => {
	const requiredSlots = toSlots(task.estimatedMinutes);
	if (!task.splitAllowed) {
		return {
			requiredSlots,
			minChunkSlots: requiredSlots,
			maxChunkSlots: requiredSlots,
		};
	}
	const minChunkSlots = toSlots(task.minChunkMinutes ?? SLOT_MINUTES);
	const maxChunkSlots = Math.max(
		minChunkSlots,
		toSlots(task.maxChunkMinutes ?? task.estimatedMinutes),
	);
	return {
		requiredSlots,
		minChunkSlots,
		maxChunkSlots,
	};
};

export const splitTaskIntoChunkSizes = (
	requiredSlots: number,
	minChunk: number,
	maxChunk: number,
) => {
	const clampedMin = Math.max(1, Math.min(requiredSlots, minChunk));
	const clampedMax = Math.max(clampedMin, Math.min(requiredSlots, maxChunk));
	if (requiredSlots <= clampedMax) return [requiredSlots];

	const isRepresentable = (remaining: number) => {
		if (remaining === 0) return true;
		const minParts = Math.ceil(remaining / clampedMax);
		const maxParts = Math.floor(remaining / clampedMin);
		return minParts <= maxParts;
	};

	const sizes: number[] = [];
	let remaining = requiredSlots;
	while (remaining > 0) {
		let selected: number | null = null;
		for (let chunk = Math.min(clampedMax, remaining); chunk >= clampedMin; chunk -= 1) {
			if (isRepresentable(remaining - chunk)) {
				selected = chunk;
				break;
			}
		}
		if (selected === null) {
			return null;
		}
		sizes.push(selected);
		remaining -= selected;
	}
	return sizes;
};

const parseIdealMinute = (idealTime: string | undefined) => {
	if (!idealTime) return 9 * 60;
	const match = idealTime.match(/^(\d{2}):(\d{2})$/);
	if (!match) return 9 * 60;
	const hours = Number.parseInt(match[1] ?? "0", 10);
	const minutes = Number.parseInt(match[2] ?? "0", 10);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 9 * 60;
	return Math.max(0, Math.min(1439, hours * 60 + minutes));
};

export const buildHabitOccurrenceCandidates = (
	habit: SchedulingHabitInput,
	rule: ParsedRRule,
	horizonStart: number,
	horizonEnd: number,
	timezone: string,
	slotCount: number,
) => {
	const periods = buildHabitPeriods(
		horizonStart,
		horizonEnd,
		habit.startDate,
		habit.endDate,
		rule,
		habit.repeatsPerPeriod ?? 1,
	);
	const idealMinute = parseIdealMinute(habit.idealTime);
	const preferredDays = new Set(habit.preferredDays ?? []);
	const occurrenceCandidatesByPeriod: HabitOccurrenceCandidate[][] = [];

	for (const period of periods) {
		const candidatesForPeriod: HabitOccurrenceCandidate[] = [];
		for (let index = 0; index < period.targetCount; index += 1) {
			const expectedTs =
				period.periodStart + Math.floor(index * period.expectedSpacingDays * 24 * 60 * 60 * 1000);
			const driftMs = period.driftDays * 24 * 60 * 60 * 1000;
			const searchStart = Math.max(period.periodStart, expectedTs - driftMs);
			const searchEnd = Math.min(period.periodEnd, expectedTs + driftMs + 24 * 60 * 60 * 1000);
			const startSlot = Math.max(0, slotForTimestamp(horizonStart, searchStart));
			const endSlot = Math.min(slotCount, slotForTimestamp(horizonStart, searchEnd));
			for (let slot = startSlot; slot < endSlot; slot += 1) {
				const ts = timestampForSlot(horizonStart, slot);
				if (ts < period.periodStart || ts >= period.periodEnd) continue;
				const zoned = zonedPartsForTimestamp(ts, timezone);
				const idealDistance = Math.abs(zoned.minuteOfDay - idealMinute);
				const preferredPenalty = preferredDays.size > 0 && !preferredDays.has(zoned.day) ? 1 : 0;
				const timingDistance = Math.abs(ts - expectedTs) / SLOT_MS;
				const score = idealDistance + preferredPenalty * 1_000 + timingDistance;
				candidatesForPeriod.push({
					startSlot: slot,
					score,
					periodStart: period.periodStart,
					periodEnd: period.periodEnd,
				});
			}
		}
		occurrenceCandidatesByPeriod.push(candidatesForPeriod.sort((a, b) => a.score - b.score));
	}

	return {
		periods,
		occurrenceCandidatesByPeriod,
	};
};
