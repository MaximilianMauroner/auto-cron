import {
	buildHabitOccurrenceCandidates,
	buildTaskChunkPlan,
	splitTaskIntoChunkSizes,
} from "./candidates";
import { DAY_SLOTS, HORIZON_WEEKS_DEFAULT, SLOT_MS, priorityWeight } from "./constants";
import { estimateCapacitySlots, lateReasonFromCapacity } from "./explain";
import { findPlacementSlot } from "./model";
import {
	blockerStartPenalty,
	habitKeepReward,
	habitShortfallPenalty,
	idealTimePenalty,
	modePlacementPenalty,
	movePenalty,
	preferredDayPenalty,
	taskLatenessPenalty,
} from "./objective";
import { type ParsedRRule, parseSupportedRRule, recurrenceFromLegacyFrequency } from "./rrule";
import {
	buildAllowedMask,
	buildBusyMask,
	ceilToSlot,
	clampHorizonWeeks,
	occupyRange,
	slotCountBetween,
	slotForTimestamp,
	timestampForSlot,
	zonedPartsForTimestamp,
} from "./time";
import type {
	HabitDropDiagnostic,
	HabitShortfallDiagnostic,
	LateTaskDiagnostic,
	ScheduledBlock,
	SchedulingHabitInput,
	SchedulingInput,
	SchedulingTaskInput,
	SolverResult,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const anytimeWindows = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
	day: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
	startMinute: 0,
	endMinute: 24 * 60,
}));

const parseIdealMinute = (idealTime: string | undefined) => {
	if (!idealTime) return 9 * 60;
	const match = idealTime.match(/^(\d{2}):(\d{2})$/);
	if (!match) return 9 * 60;
	const hours = Number.parseInt(match[1] ?? "0", 10);
	const minutes = Number.parseInt(match[2] ?? "0", 10);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 9 * 60;
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 9 * 60;
	return hours * 60 + minutes;
};

const toDowntimeSlots = (downtimeMinutes: number | undefined) => {
	if (!Number.isFinite(downtimeMinutes)) return 0;
	const safeMinutes = Math.max(0, Math.round(downtimeMinutes ?? 0));
	if (safeMinutes === 0) return 0;
	return Math.ceil(safeMinutes / (SLOT_MS / 60000));
};

const buildTravelSourceId = (
	taskId: string,
	placementStart: number,
	placementEnd: number,
	segment: "before" | "after",
) => `task:${taskId}:travel:${segment}:${placementStart}:${placementEnd}`;

type TaskScheduleResult = {
	success: boolean;
	reasonCode?: string;
	blocks: ScheduledBlock[];
	occupancyMask: boolean[];
	completionByTaskId: Map<string, number>;
	requiredSlotsByTaskId: Map<string, number>;
	availabilityByTaskId: Map<string, boolean[]>;
};

const sortTasksForScheduling = (tasks: SchedulingTaskInput[]) => {
	return [...tasks].sort((left, right) => {
		if (left.blocker !== right.blocker) return left.blocker ? -1 : 1;
		const dueLeft = left.deadline ?? Number.POSITIVE_INFINITY;
		const dueRight = right.deadline ?? Number.POSITIVE_INFINITY;
		if (dueLeft !== dueRight) return dueLeft - dueRight;
		const pLeft = priorityWeight(left.priority);
		const pRight = priorityWeight(right.priority);
		if (pLeft !== pRight) return pRight - pLeft;
		return left.creationTime - right.creationTime;
	});
};

const taskAvailabilityMask = (
	input: SchedulingInput,
	task: SchedulingTaskInput,
	horizonStart: number,
	slotCount: number,
	busyMask: boolean[],
) => {
	const windows =
		(task.hoursSetId ? input.hoursBySetId[String(task.hoursSetId)] : undefined) ??
		(input.defaultHoursSetId ? input.hoursBySetId[String(input.defaultHoursSetId)] : undefined) ??
		anytimeWindows;
	const allowed = buildAllowedMask(horizonStart, slotCount, input.timezone, windows);
	const availability = new Array<boolean>(slotCount).fill(false);
	for (let slot = 0; slot < slotCount; slot += 1) {
		availability[slot] = (allowed[slot] ?? false) && !(busyMask[slot] ?? false);
	}
	return availability;
};

const scheduleTasks = (
	input: SchedulingInput,
	horizonStart: number,
	horizonEnd: number,
	slotCount: number,
	busyMask: boolean[],
	downtimeSlots: number,
	enforceDue: boolean,
) => {
	const tasks = sortTasksForScheduling(input.tasks);
	const occupancyMask = [...busyMask];
	const blocks: ScheduledBlock[] = [];
	const completionByTaskId = new Map<string, number>();
	const requiredSlotsByTaskId = new Map<string, number>();
	const availabilityByTaskId = new Map<string, boolean[]>();

	for (const task of tasks) {
		const plan = buildTaskChunkPlan(task);
		requiredSlotsByTaskId.set(String(task.id), plan.requiredSlots);
		const chunks = splitTaskIntoChunkSizes(
			plan.requiredSlots,
			plan.minChunkSlots,
			plan.maxChunkSlots,
		);
		if (!chunks) {
			return {
				success: false,
				reasonCode: "INFEASIBLE_HARD",
				blocks,
				occupancyMask,
				completionByTaskId,
				requiredSlotsByTaskId,
				availabilityByTaskId,
			} as TaskScheduleResult;
		}
		const availability = taskAvailabilityMask(input, task, horizonStart, slotCount, busyMask);
		availabilityByTaskId.set(String(task.id), availability);
		const hasLocation = Boolean(task.location?.trim());
		const restSlots = toDowntimeSlots(task.restMinutes);
		const travelSlots = hasLocation ? toDowntimeSlots(task.travelMinutes) : 0;
		const taskDowntimeSlots = Math.max(downtimeSlots, restSlots + travelSlots);

		const earliestStartSlot = Math.max(
			0,
			slotForTimestamp(horizonStart, Math.max(horizonStart, task.scheduleAfter ?? horizonStart)),
		);
		const dueEndSlot =
			task.deadline !== undefined
				? Math.max(0, slotForTimestamp(horizonStart, Math.min(task.deadline, horizonEnd)))
				: undefined;

		const chunkPlacements: Array<{ startSlot: number; durationSlots: number }> = [];
		for (const durationSlots of chunks) {
			const startSlot = findPlacementSlot({
				availabilityMask: availability,
				occupancyMask,
				durationSlots,
				earliestStartSlot,
				latestEndSlot: enforceDue ? dueEndSlot : undefined,
				downtimeSlots: taskDowntimeSlots,
				mode: task.blocker ? "fastest" : task.effectiveSchedulingMode,
				slotScore: (slot) => {
					if (task.effectiveSchedulingMode !== "balanced") return slot;
					if (dueEndSlot === undefined) return slot;
					const target = Math.max(earliestStartSlot, dueEndSlot - durationSlots);
					return Math.abs(slot - target);
				},
			});
			if (startSlot === null) {
				return {
					success: false,
					reasonCode: "INFEASIBLE_HARD",
					blocks,
					occupancyMask,
					completionByTaskId,
					requiredSlotsByTaskId,
					availabilityByTaskId,
				} as TaskScheduleResult;
			}
			occupyRange(occupancyMask, startSlot, durationSlots);
			chunkPlacements.push({ startSlot, durationSlots });
		}

		for (const placement of chunkPlacements) {
			const start = timestampForSlot(horizonStart, placement.startSlot);
			const end = timestampForSlot(horizonStart, placement.startSlot + placement.durationSlots);
			blocks.push({
				source: "task",
				sourceId: String(task.id),
				title: task.title,
				start,
				end,
				priority: task.priority,
				calendarId: task.preferredCalendarId,
				color: task.color,
				location: task.location,
			});
			if (hasLocation && travelSlots > 0) {
				const travelDurationMs = travelSlots * SLOT_MS;
				blocks.push({
					source: "task",
					sourceId: buildTravelSourceId(String(task.id), start, end, "before"),
					title: `Travel: ${task.title}`,
					start: start - travelDurationMs,
					end: start,
					priority: task.priority,
					calendarId: task.preferredCalendarId,
					color: task.color,
					location: task.location,
				});
				blocks.push({
					source: "task",
					sourceId: buildTravelSourceId(String(task.id), start, end, "after"),
					title: `Travel: ${task.title}`,
					start: end,
					end: end + travelDurationMs,
					priority: task.priority,
					calendarId: task.preferredCalendarId,
					color: task.color,
					location: task.location,
				});
			}
		}

		const completion = Math.max(
			...chunkPlacements.map((placement) => placement.startSlot + placement.durationSlots),
		);
		completionByTaskId.set(String(task.id), completion);
	}

	return {
		success: true,
		blocks,
		occupancyMask,
		completionByTaskId,
		requiredSlotsByTaskId,
		availabilityByTaskId,
	} as TaskScheduleResult;
};

const buildExistingStartSlotMap = (input: SchedulingInput, horizonStart: number) => {
	const map = new Map<string, number>();
	for (const placement of input.existingPlacements) {
		const key = `${placement.source}:${placement.sourceId}`;
		const existing = map.get(key);
		const slot = Math.max(0, slotForTimestamp(horizonStart, placement.start));
		if (existing === undefined || slot < existing) {
			map.set(key, slot);
		}
	}
	return map;
};

const scheduleHabits = (
	input: SchedulingInput,
	horizonStart: number,
	horizonEnd: number,
	slotCount: number,
	busyMask: boolean[],
	taskOccupancyMask: boolean[],
	downtimeSlots: number,
) => {
	const blocks: ScheduledBlock[] = [];
	const shortfalls: HabitShortfallDiagnostic[] = [];
	const dropped: HabitDropDiagnostic[] = [];
	let objectiveScore = 0;

	const occupancyMask = [...taskOccupancyMask];
	const habits = [...input.habits]
		.filter((habit) => habit.isActive)
		.sort((left, right) => {
			if (left.recoveryPolicy !== right.recoveryPolicy) {
				return left.recoveryPolicy === "recover" ? -1 : 1;
			}
			return priorityWeight(right.priority) - priorityWeight(left.priority);
		});

	const existingStartBySource = buildExistingStartSlotMap(input, horizonStart);

	for (const habit of habits) {
		const windows =
			(habit.hoursSetId ? input.hoursBySetId[String(habit.hoursSetId)] : undefined) ??
			(input.defaultHoursSetId ? input.hoursBySetId[String(input.defaultHoursSetId)] : undefined) ??
			anytimeWindows;
		const allowed = buildAllowedMask(horizonStart, slotCount, input.timezone, windows);
		const availability = new Array<boolean>(slotCount).fill(false);
		for (let slot = 0; slot < slotCount; slot += 1) {
			availability[slot] = (allowed[slot] ?? false) && !(busyMask[slot] ?? false);
		}

		const recurrenceRule = habit.recurrenceRule || recurrenceFromLegacyFrequency(undefined);
		let parsedRule: ParsedRRule;
		try {
			parsedRule = parseSupportedRRule(recurrenceRule);
		} catch {
			dropped.push({
				habitId: habit.id,
				recoveryPolicy: habit.recoveryPolicy,
				priority: habit.priority,
				reason: "unsupported_rrule",
			});
			continue;
		}

		const durationSlots = Math.max(
			1,
			Math.ceil((habit.maxDurationMinutes ?? habit.durationMinutes) / (SLOT_MS / 60000)),
		);
		const minDurationSlots = Math.max(
			1,
			Math.ceil((habit.minDurationMinutes ?? habit.durationMinutes) / (SLOT_MS / 60000)),
		);
		const { periods, occurrenceCandidatesByPeriod } = buildHabitOccurrenceCandidates(
			habit,
			parsedRule,
			horizonStart,
			horizonEnd,
			input.timezone,
			slotCount,
		);

		for (let periodIndex = 0; periodIndex < periods.length; periodIndex += 1) {
			const period = periods[periodIndex];
			if (!period) continue;
			const candidates = occurrenceCandidatesByPeriod[periodIndex] ?? [];
			const usedStarts = new Set<number>();
			let scheduledCount = 0;

			for (let occurrence = 0; occurrence < period.targetCount; occurrence += 1) {
				let placed = false;
				for (const candidate of candidates) {
					if (usedStarts.has(candidate.startSlot)) continue;
					if (candidate.startSlot < 0 || candidate.startSlot >= slotCount) continue;
					let finalDuration = durationSlots;
					if (
						!isRangeSchedulable(
							availability,
							occupancyMask,
							candidate.startSlot,
							finalDuration,
							downtimeSlots,
						)
					) {
						if (minDurationSlots === finalDuration) continue;
						finalDuration = minDurationSlots;
						if (
							!isRangeSchedulable(
								availability,
								occupancyMask,
								candidate.startSlot,
								finalDuration,
								downtimeSlots,
							)
						) {
							continue;
						}
					}
					usedStarts.add(candidate.startSlot);
					occupyRange(occupancyMask, candidate.startSlot, finalDuration);
					scheduledCount += 1;
					placed = true;
					const start = timestampForSlot(horizonStart, candidate.startSlot);
					const end = timestampForSlot(horizonStart, candidate.startSlot + finalDuration);
					blocks.push({
						source: "habit",
						sourceId: String(habit.id),
						title: habit.title,
						start,
						end,
						priority: habit.priority,
						calendarId: habit.preferredCalendarId,
						color: habit.color,
					});
					const zoned = zonedPartsForTimestamp(start, input.timezone);
					const idealMinute = parseIdealMinute(habit.idealTime);
					const idealDistanceSlots = Math.floor(Math.abs(zoned.minuteOfDay - idealMinute) / 15);
					objectiveScore += idealTimePenalty(idealDistanceSlots, habit.priority);
					if (habit.preferredDays?.length) {
						objectiveScore += preferredDayPenalty(
							!habit.preferredDays.includes(zoned.day),
							habit.priority,
						);
					}
					const oldStart = existingStartBySource.get(`habit:${String(habit.id)}`);
					objectiveScore += movePenalty(oldStart, candidate.startSlot, habit.priority, "balanced");
					objectiveScore -= habitKeepReward(finalDuration, habit.priority, habit.recoveryPolicy);
					break;
				}
				if (!placed) {
					if (habit.recoveryPolicy === "skip") {
						dropped.push({
							habitId: habit.id,
							recoveryPolicy: habit.recoveryPolicy,
							priority: habit.priority,
							reason: "skip_dropped_due_to_conflict",
						});
					}
				}
			}

			const shortfall = Math.max(0, period.targetCount - scheduledCount);
			if (shortfall > 0 && habit.recoveryPolicy === "recover") {
				shortfalls.push({
					habitId: habit.id,
					periodStart: period.periodStart,
					periodEnd: period.periodEnd,
					targetCount: period.targetCount,
					scheduledCount,
					shortfall,
					recoveryPolicy: habit.recoveryPolicy,
				});
				objectiveScore += habitShortfallPenalty(shortfall, habit.priority);
			}
		}
	}

	return {
		blocks,
		shortfalls,
		dropped,
		objectiveScore,
	};
};

const isRangeSchedulable = (
	availabilityMask: boolean[],
	occupancyMask: boolean[],
	startSlot: number,
	durationSlots: number,
	downtimeSlots: number,
) => {
	const endSlot = startSlot + durationSlots;
	if (startSlot < 0 || endSlot > availabilityMask.length) return false;
	for (let slot = startSlot; slot < endSlot; slot += 1) {
		if (!availabilityMask[slot] || occupancyMask[slot]) return false;
	}
	if (downtimeSlots > 0) {
		const gapBeforeStart = Math.max(0, startSlot - downtimeSlots);
		for (let slot = gapBeforeStart; slot < startSlot; slot += 1) {
			if (occupancyMask[slot]) return false;
		}
		const gapAfterEnd = Math.min(occupancyMask.length, endSlot + downtimeSlots);
		for (let slot = endSlot; slot < gapAfterEnd; slot += 1) {
			if (occupancyMask[slot]) return false;
		}
	}
	return true;
};

const lateTaskDiagnostics = (
	input: SchedulingInput,
	horizonStart: number,
	horizonEnd: number,
	busyMask: boolean[],
	taskResult: TaskScheduleResult,
) => {
	const diagnostics: LateTaskDiagnostic[] = [];
	for (const task of input.tasks) {
		const completionEndSlot = taskResult.completionByTaskId.get(String(task.id));
		if (completionEndSlot === undefined) continue;
		if (!task.deadline) continue;
		const dueSlot = slotForTimestamp(horizonStart, task.deadline);
		const tardinessSlots = Math.max(0, completionEndSlot - dueSlot);
		if (tardinessSlots <= 0) continue;
		const availability = taskResult.availabilityByTaskId.get(String(task.id));
		const requiredSlots = taskResult.requiredSlotsByTaskId.get(String(task.id)) ?? 0;
		const earliestSlot = Math.max(
			0,
			slotForTimestamp(horizonStart, task.scheduleAfter ?? horizonStart),
		);
		const capacityBeforeDue = availability
			? estimateCapacitySlots(availability, busyMask, earliestSlot, Math.max(earliestSlot, dueSlot))
			: 0;
		diagnostics.push({
			taskId: task.id,
			dueDate: task.deadline,
			completionEnd: timestampForSlot(horizonStart, completionEndSlot),
			tardinessSlots,
			priority: task.priority,
			blocker: task.blocker,
			reason: lateReasonFromCapacity(requiredSlots, capacityBeforeDue),
		});
	}
	return diagnostics;
};

const computeTaskObjective = (
	input: SchedulingInput,
	horizonStart: number,
	taskResult: TaskScheduleResult,
	existingStartBySource: Map<string, number>,
) => {
	let total = 0;
	for (const task of input.tasks) {
		const completionEndSlot = taskResult.completionByTaskId.get(String(task.id));
		if (completionEndSlot === undefined) continue;
		const dueSlot = task.deadline
			? Math.max(0, slotForTimestamp(horizonStart, task.deadline))
			: Math.max(0, completionEndSlot);
		const tardinessSlots = Math.max(0, completionEndSlot - dueSlot);
		total += taskLatenessPenalty(tardinessSlots, task.priority, task.blocker);
		const startSlot = taskResult.blocks
			.filter((block) => block.source === "task" && block.sourceId === String(task.id))
			.map((block) => slotForTimestamp(horizonStart, block.start))
			.sort((a, b) => a - b)[0];
		if (startSlot !== undefined) {
			total += blockerStartPenalty(startSlot, task.priority, task.blocker);
			total += modePlacementPenalty(startSlot, task.effectiveSchedulingMode);
			total += movePenalty(
				existingStartBySource.get(`task:${String(task.id)}`),
				startSlot,
				task.priority,
				task.effectiveSchedulingMode,
			);
		}
	}
	return total;
};

export const solveSchedule = (input: SchedulingInput): SolverResult => {
	const horizonStart = ceilToSlot(input.now);
	const horizonWeeks = clampHorizonWeeks(
		Number.isFinite(input.horizonWeeks) ? input.horizonWeeks : HORIZON_WEEKS_DEFAULT,
	);
	const horizonEnd = horizonStart + horizonWeeks * 7 * DAY_MS;
	const slotCount = slotCountBetween(horizonStart, horizonEnd);
	const busyMask = buildBusyMask(horizonStart, horizonEnd, slotCount, input.busy);
	const downtimeSlots = toDowntimeSlots(input.downtimeMinutes);

	const onTimeCheck = scheduleTasks(
		input,
		horizonStart,
		horizonEnd,
		slotCount,
		busyMask,
		downtimeSlots,
		true,
	);
	const feasibleOnTime = onTimeCheck.success;

	const taskPass = scheduleTasks(
		input,
		horizonStart,
		horizonEnd,
		slotCount,
		busyMask,
		downtimeSlots,
		false,
	);
	if (!taskPass.success) {
		return {
			horizonStart,
			horizonEnd,
			feasibleOnTime,
			feasibleHard: false,
			objectiveScore: Number.POSITIVE_INFINITY,
			blocks: [],
			lateTasks: [],
			habitShortfalls: [],
			droppedHabits: [],
			reasonCode: taskPass.reasonCode ?? "INFEASIBLE_HARD",
		};
	}

	const habits = scheduleHabits(
		input,
		horizonStart,
		horizonEnd,
		slotCount,
		busyMask,
		taskPass.occupancyMask,
		downtimeSlots,
	);

	const existingStartBySource = buildExistingStartSlotMap(input, horizonStart);
	const lateTasks = lateTaskDiagnostics(input, horizonStart, horizonEnd, busyMask, taskPass);
	let objectiveScore = computeTaskObjective(input, horizonStart, taskPass, existingStartBySource);
	objectiveScore += habits.objectiveScore;

	return {
		horizonStart,
		horizonEnd,
		feasibleOnTime,
		feasibleHard: true,
		objectiveScore,
		blocks: [...taskPass.blocks, ...habits.blocks].sort((a, b) => a.start - b.start),
		lateTasks,
		habitShortfalls: habits.shortfalls,
		droppedHabits: habits.dropped,
		reasonCode: lateTasks.length > 0 ? "TASKS_LATE" : undefined,
	};
};
