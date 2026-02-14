import { describe, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { parseSupportedRRule } from "../../../convex/scheduling/rrule";
import { solveSchedule } from "../../../convex/scheduling/solver";
import { buildAllowedMask, zonedPartsForTimestamp } from "../../../convex/scheduling/time";
import type { SchedulingInput } from "../../../convex/scheduling/types";

const anytimeWindows = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
	day: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
	startMinute: 0,
	endMinute: 24 * 60,
}));

const asTaskId = (value: string) => value as Id<"tasks">;
const asHabitId = (value: string) => value as Id<"habits">;
const asHoursSetId = (value: string) => value as Id<"hoursSets">;
const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const taskDefaults = (input: SchedulingInput) => ({
	creationTime: input.now,
	title: "Task",
	priority: "medium" as const,
	blocker: false,
	status: "queued" as const,
	estimatedMinutes: 60,
	hoursSetId: asHoursSetId("default"),
	effectiveSchedulingMode: "fastest" as const,
});

const habitDefaults = (input: SchedulingInput) => ({
	creationTime: input.now,
	title: "Habit",
	priority: "medium" as const,
	recoveryPolicy: "skip" as const,
	recurrenceRule: "RRULE:FREQ=DAILY;INTERVAL=1",
	durationMinutes: 30,
	repeatsPerPeriod: 1,
	hoursSetId: asHoursSetId("default"),
	isActive: true,
});

const firstStartForTask = (
	solved: ReturnType<typeof solveSchedule>,
	taskId: string,
): number | undefined => {
	const blocks = solved.blocks
		.filter((block) => block.source === "task" && block.sourceId === taskId)
		.sort((a, b) => a.start - b.start);
	return blocks[0]?.start;
};

const firstStartForHabit = (
	solved: ReturnType<typeof solveSchedule>,
	habitId: string,
): number | undefined => {
	const blocks = solved.blocks
		.filter((block) => block.source === "habit" && block.sourceId === habitId)
		.sort((a, b) => a.start - b.start);
	return blocks[0]?.start;
};

const minutesFromBlock = (start: number, end: number) => (end - start) / (60 * 1000);
const ensureDefined = <T>(value: T | undefined, label: string): T => {
	if (value === undefined) {
		throw new Error(`Expected ${label} to be defined`);
	}
	return value;
};

const baseInput = (): SchedulingInput => {
	const now = Date.UTC(2026, 0, 1, 8, 0, 0, 0);
	return {
		userId: "test-user",
		timezone: "UTC",
		horizonWeeks: 4,
		downtimeMinutes: 0,
		defaultTaskMode: "fastest" as const,
		tasks: [],
		habits: [],
		busy: [],
		hoursBySetId: {
			default: anytimeWindows,
		},
		defaultHoursSetId: asHoursSetId("default"),
		existingPlacements: [],
		now,
	};
};

describe("scheduling solver", () => {
	test("covers full task duration when feasible", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-1"),
			splitAllowed: false,
		});

		const solved = solveSchedule(input);
		expect(solved.feasibleHard).toBe(true);
		const taskBlocks = solved.blocks.filter((block) => block.source === "task");
		expect(taskBlocks).toHaveLength(1);
		expect(taskBlocks[0]?.end - taskBlocks[0]?.start).toBe(60 * 60 * 1000);
	});

	test("does not schedule blocks before current timestamp when now is mid-slot", () => {
		const input = baseInput();
		input.now = Date.UTC(2026, 0, 1, 8, 7, 0, 0);
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-no-past"),
			estimatedMinutes: 15,
			splitAllowed: false,
		});

		const solved = solveSchedule(input);
		const block = solved.blocks.find(
			(candidate) => candidate.source === "task" && candidate.sourceId === "task-no-past",
		);
		expect(block).toBeDefined();
		expect(ensureDefined(block, "taskNoPastBlock").start).toBeGreaterThanOrEqual(input.now);
	});

	test("reports on-time infeasibility but still produces late schedule", () => {
		const input = baseInput();
		input.busy.push({
			start: input.now,
			end: input.now + 8 * 60 * 60 * 1000,
		});
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-2"),
			title: "Urgent",
			priority: "high",
			deadline: input.now + 60 * 60 * 1000,
		});

		const solved = solveSchedule(input);
		expect(solved.feasibleOnTime).toBe(false);
		expect(solved.feasibleHard).toBe(true);
		expect(solved.lateTasks.length).toBeGreaterThan(0);
	});

	test("returns hard infeasible without partial blocks", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 15 }];
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-3"),
			title: "Too large",
			priority: "critical",
			estimatedMinutes: 180,
		});

		const solved = solveSchedule(input);
		expect(solved.feasibleHard).toBe(false);
		expect(solved.blocks).toHaveLength(0);
	});

	test("schedules recover habits before skip habits under contention", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 4, startMinute: 8 * 60, endMinute: 8 * 60 + 30 }];
		input.habits.push(
			{
				...habitDefaults(input),
				id: asHabitId("habit-recover"),
				title: "Recover",
				recoveryPolicy: "recover",
			},
			{
				...habitDefaults(input),
				id: asHabitId("habit-skip"),
				title: "Skip",
				priority: "critical",
			},
		);
		const solved = solveSchedule(input);
		const habitBlocks = solved.blocks.filter((block) => block.source === "habit");
		expect(habitBlocks.some((block) => block.sourceId === "habit-recover")).toBe(true);
		expect(solved.droppedHabits.some((drop) => String(drop.habitId) === "habit-skip")).toBe(true);
	});

	test("orders task placement by blocker then priority under equal due dates", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 4, startMinute: 8 * 60, endMinute: 13 * 60 }];
		const due = input.now + 10 * HOUR_MS;

		const priorities = [
			{ id: "task-low", priority: "low" as const, blocker: false },
			{ id: "task-medium", priority: "medium" as const, blocker: false },
			{ id: "task-high", priority: "high" as const, blocker: false },
			{ id: "task-critical", priority: "critical" as const, blocker: false },
			{ id: "task-blocker", priority: "blocker" as const, blocker: true },
		];

		for (const [index, task] of priorities.entries()) {
			input.tasks.push({
				...taskDefaults(input),
				id: asTaskId(task.id),
				title: task.id,
				priority: task.priority,
				blocker: task.blocker,
				deadline: due,
				creationTime: input.now + index,
			});
		}

		const solved = solveSchedule(input);
		const blocker = firstStartForTask(solved, "task-blocker");
		const critical = firstStartForTask(solved, "task-critical");
		const high = firstStartForTask(solved, "task-high");
		const medium = firstStartForTask(solved, "task-medium");
		const low = firstStartForTask(solved, "task-low");

		expect(blocker).toBeDefined();
		expect(critical).toBeDefined();
		expect(high).toBeDefined();
		expect(medium).toBeDefined();
		expect(low).toBeDefined();
		const blockerStart = ensureDefined(blocker, "blockerStart");
		const criticalStart = ensureDefined(critical, "criticalStart");
		const highStart = ensureDefined(high, "highStart");
		const mediumStart = ensureDefined(medium, "mediumStart");
		const lowStart = ensureDefined(low, "lowStart");
		expect(blockerStart).toBeLessThanOrEqual(criticalStart);
		expect(criticalStart).toBeLessThanOrEqual(highStart);
		expect(highStart).toBeLessThanOrEqual(mediumStart);
		expect(mediumStart).toBeLessThanOrEqual(lowStart);
	});

	test("blocker task can start before higher-priority non-blocker", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 4, startMinute: 8 * 60, endMinute: 10 * 60 }];
		input.tasks.push(
			{
				...taskDefaults(input),
				id: asTaskId("non-blocker-critical"),
				priority: "critical",
				blocker: false,
				deadline: input.now + 3 * HOUR_MS,
			},
			{
				...taskDefaults(input),
				id: asTaskId("blocker-low"),
				priority: "low",
				blocker: true,
				deadline: input.now + 3 * HOUR_MS,
			},
		);

		const solved = solveSchedule(input);
		const blockerStart = firstStartForTask(solved, "blocker-low");
		const nonBlockerStart = firstStartForTask(solved, "non-blocker-critical");
		expect(blockerStart).toBeDefined();
		expect(nonBlockerStart).toBeDefined();
		expect(ensureDefined(blockerStart, "blockerStart")).toBeLessThanOrEqual(
			ensureDefined(nonBlockerStart, "nonBlockerStart"),
		);
	});

	test("split tasks honor chunk bounds and exact total coverage", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-split"),
			estimatedMinutes: 150,
			splitAllowed: true,
			minChunkMinutes: 30,
			maxChunkMinutes: 60,
		});

		const solved = solveSchedule(input);
		const chunks = solved.blocks.filter(
			(block) => block.source === "task" && block.sourceId === "task-split",
		);
		const total = chunks.reduce((sum, chunk) => sum + minutesFromBlock(chunk.start, chunk.end), 0);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			const duration = minutesFromBlock(chunk.start, chunk.end);
			expect(duration).toBeGreaterThanOrEqual(30);
			expect(duration).toBeLessThanOrEqual(60);
		}
		expect(total).toBe(150);
	});

	test("split tasks respect min chunk bounds on awkward remainders", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-split-awkward"),
			estimatedMinutes: 195,
			splitAllowed: true,
			minChunkMinutes: 60,
			maxChunkMinutes: 90,
		});

		const solved = solveSchedule(input);
		const chunks = solved.blocks.filter(
			(block) => block.source === "task" && block.sourceId === "task-split-awkward",
		);
		const total = chunks.reduce((sum, chunk) => sum + minutesFromBlock(chunk.start, chunk.end), 0);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			const duration = minutesFromBlock(chunk.start, chunk.end);
			expect(duration).toBeGreaterThanOrEqual(60);
			expect(duration).toBeLessThanOrEqual(90);
		}
		expect(total).toBe(195);
	});

	test("returns hard infeasible when chunk constraints are unsatisfiable", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-unsat-split"),
			estimatedMinutes: 195,
			splitAllowed: true,
			minChunkMinutes: 75,
			maxChunkMinutes: 90,
		});

		const solved = solveSchedule(input);
		expect(solved.feasibleHard).toBe(false);
		expect(solved.blocks).toHaveLength(0);
	});

	test("respects task scheduleAfter boundary", () => {
		const input = baseInput();
		const scheduleAfter = input.now + 2 * HOUR_MS;
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-after"),
			scheduleAfter,
		});

		const solved = solveSchedule(input);
		const start = firstStartForTask(solved, "task-after");
		expect(start).toBeDefined();
		expect(ensureDefined(start, "taskAfterStart")).toBeGreaterThanOrEqual(scheduleAfter);
	});

	test("avoids busy intervals when placing tasks", () => {
		const input = baseInput();
		input.busy.push({
			start: input.now,
			end: input.now + HOUR_MS,
		});
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-busy-avoid"),
		});

		const solved = solveSchedule(input);
		const start = firstStartForTask(solved, "task-busy-avoid");
		expect(start).toBeDefined();
		expect(ensureDefined(start, "taskBusyAvoidStart")).toBeGreaterThanOrEqual(input.now + HOUR_MS);
	});

	test("enforces configured downtime between scheduled tasks", () => {
		const input = baseInput();
		input.downtimeMinutes = 30;
		input.tasks.push(
			{
				...taskDefaults(input),
				id: asTaskId("task-gap-a"),
				estimatedMinutes: 60,
			},
			{
				...taskDefaults(input),
				id: asTaskId("task-gap-b"),
				estimatedMinutes: 60,
			},
		);

		const solved = solveSchedule(input);
		const blocks = solved.blocks
			.filter(
				(block) =>
					block.source === "task" &&
					(block.sourceId === "task-gap-a" || block.sourceId === "task-gap-b"),
			)
			.sort((a, b) => a.start - b.start);
		expect(blocks).toHaveLength(2);
		const firstBlock = ensureDefined(blocks[0], "firstDowntimeTaskBlock");
		const secondBlock = ensureDefined(blocks[1], "secondDowntimeTaskBlock");
		expect(secondBlock.start - firstBlock.end).toBeGreaterThanOrEqual(30 * 60 * 1000);
	});

	test("tasks without due dates are never reported as late", () => {
		const input = baseInput();
		input.busy.push({
			start: input.now,
			end: input.now + 2 * HOUR_MS,
		});
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-no-due"),
			deadline: undefined,
		});

		const solved = solveSchedule(input);
		expect(solved.feasibleHard).toBe(true);
		expect(solved.lateTasks).toHaveLength(0);
	});

	test("late reason reports insufficient capacity when due window is too small", () => {
		const input = baseInput();
		input.busy.push({
			start: input.now,
			end: input.now + 8 * HOUR_MS,
		});
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-insufficient-capacity"),
			deadline: input.now + HOUR_MS,
		});

		const solved = solveSchedule(input);
		expect(solved.lateTasks.length).toBeGreaterThan(0);
		expect(solved.lateTasks[0]?.reason?.startsWith("insufficient_capacity_missing_")).toBe(true);
	});

	test("late reason reports chunk/placement conflict when free slots are fragmented", () => {
		const input = baseInput();
		input.busy.push(
			{ start: input.now, end: input.now + 15 * 60 * 1000 },
			{ start: input.now + 30 * 60 * 1000, end: input.now + 45 * 60 * 1000 },
			{ start: input.now + 60 * 60 * 1000, end: input.now + 75 * 60 * 1000 },
			{ start: input.now + 90 * 60 * 1000, end: input.now + 105 * 60 * 1000 },
		);
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-fragmented-before-due"),
			estimatedMinutes: 45,
			splitAllowed: false,
			deadline: input.now + 2 * HOUR_MS,
		});

		const solved = solveSchedule(input);
		expect(solved.lateTasks.length).toBeGreaterThan(0);
		expect(solved.lateTasks[0]?.reason).toBe("placement_conflicts_or_chunk_constraints");
	});

	test("drops unsupported RRULE habits with explicit reason", () => {
		const input = baseInput();
		input.habits.push({
			...habitDefaults(input),
			id: asHabitId("habit-unsupported"),
			recurrenceRule: "RRULE:FREQ=YEARLY;INTERVAL=1",
		});

		const solved = solveSchedule(input);
		expect(solved.blocks.filter((block) => block.source === "habit")).toHaveLength(0);
		expect(
			solved.droppedHabits.some(
				(drop) =>
					String(drop.habitId) === "habit-unsupported" && drop.reason === "unsupported_rrule",
			),
		).toBe(true);
	});

	test("ignores inactive habits", () => {
		const input = baseInput();
		input.habits.push({
			...habitDefaults(input),
			id: asHabitId("habit-inactive"),
			isActive: false,
		});

		const solved = solveSchedule(input);
		expect(solved.blocks.filter((block) => block.source === "habit")).toHaveLength(0);
		expect(solved.droppedHabits).toHaveLength(0);
		expect(solved.habitShortfalls).toHaveLength(0);
	});

	test("records shortfalls for recover habits when target count cannot be met", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 4, startMinute: 8 * 60, endMinute: 8 * 60 + 30 }];
		input.habits.push({
			...habitDefaults(input),
			id: asHabitId("habit-recover-shortfall"),
			recoveryPolicy: "recover",
			repeatsPerPeriod: 2,
		});

		const solved = solveSchedule(input);
		expect(solved.habitShortfalls.length).toBeGreaterThan(0);
		expect(solved.habitShortfalls.every((row) => row.shortfall > 0)).toBe(true);
		expect(solved.habitShortfalls.every((row) => row.recoveryPolicy === "recover")).toBe(true);
	});

	test("higher-priority skip habit wins contention over lower-priority skip habit", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 4, startMinute: 8 * 60, endMinute: 8 * 60 + 30 }];
		input.habits.push(
			{
				...habitDefaults(input),
				id: asHabitId("habit-critical-skip"),
				priority: "critical",
			},
			{
				...habitDefaults(input),
				id: asHabitId("habit-low-skip"),
				priority: "low",
			},
		);

		const solved = solveSchedule(input);
		expect(firstStartForHabit(solved, "habit-critical-skip")).toBeDefined();
		expect(firstStartForHabit(solved, "habit-low-skip")).toBeUndefined();
		expect(solved.droppedHabits.some((drop) => String(drop.habitId) === "habit-low-skip")).toBe(
			true,
		);
	});

	test("habit placement falls back from max duration to min duration when needed", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 4, startMinute: 8 * 60, endMinute: 8 * 60 + 30 }];
		input.habits.push({
			...habitDefaults(input),
			id: asHabitId("habit-min-fallback"),
			durationMinutes: 30,
			minDurationMinutes: 30,
			maxDurationMinutes: 60,
			repeatsPerPeriod: 1,
		});

		const solved = solveSchedule(input);
		const blocks = solved.blocks.filter(
			(block) => block.source === "habit" && block.sourceId === "habit-min-fallback",
		);
		expect(blocks.length).toBeGreaterThan(0);
		expect(blocks.every((block) => minutesFromBlock(block.start, block.end) === 30)).toBe(true);
	});

	test("invalid habit idealTime does not corrupt objective score", () => {
		const input = baseInput();
		input.habits.push({
			...habitDefaults(input),
			id: asHabitId("habit-invalid-ideal"),
			idealTime: "not-a-time",
		});

		const solved = solveSchedule(input);
		expect(Number.isFinite(solved.objectiveScore)).toBe(true);
		expect(firstStartForHabit(solved, "habit-invalid-ideal")).toBeDefined();
	});

	test("task-specific hours set overrides default hours window", () => {
		const input = baseInput();
		input.hoursBySetId.default = [{ day: 4, startMinute: 8 * 60, endMinute: 9 * 60 }];
		input.hoursBySetId.custom = [{ day: 4, startMinute: 14 * 60, endMinute: 15 * 60 }];
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-custom-hours"),
			hoursSetId: asHoursSetId("custom"),
		});

		const solved = solveSchedule(input);
		const start = ensureDefined(firstStartForTask(solved, "task-custom-hours"), "customHoursStart");
		const zoned = zonedPartsForTimestamp(start, "UTC");
		expect(zoned.day).toBe(4);
		expect(zoned.minuteOfDay).toBeGreaterThanOrEqual(14 * 60);
		expect(zoned.minuteOfDay).toBeLessThan(15 * 60);
	});

	test("cross-midnight task can be scheduled across split windows", () => {
		const input = baseInput();
		input.hoursBySetId.default = [
			{ day: 4, startMinute: 23 * 60, endMinute: 24 * 60 },
			{ day: 5, startMinute: 0, endMinute: 60 },
		];
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-cross-midnight"),
			estimatedMinutes: 90,
			splitAllowed: false,
		});

		const solved = solveSchedule(input);
		const block = solved.blocks.find(
			(candidate) => candidate.source === "task" && candidate.sourceId === "task-cross-midnight",
		);
		expect(block).toBeDefined();
		const placement = ensureDefined(block, "crossMidnightBlock");
		expect(minutesFromBlock(placement.start, placement.end)).toBe(90);
		const start = zonedPartsForTimestamp(placement.start, "UTC");
		const end = zonedPartsForTimestamp(placement.end, "UTC");
		expect(start.day).toBe(4);
		expect(start.minuteOfDay).toBeGreaterThanOrEqual(23 * 60);
		expect(end.day).toBe(5);
		expect(end.minuteOfDay).toBeLessThanOrEqual(60);
	});

	test("existing placements influence objective through move penalty", () => {
		const stableInput = baseInput();
		stableInput.tasks.push({
			...taskDefaults(stableInput),
			id: asTaskId("task-stability"),
		});
		stableInput.existingPlacements.push({
			source: "task",
			sourceId: "task-stability",
			start: stableInput.now,
			end: stableInput.now + HOUR_MS,
		});

		const movedInput = baseInput();
		movedInput.tasks.push({
			...taskDefaults(movedInput),
			id: asTaskId("task-stability"),
		});
		movedInput.existingPlacements.push({
			source: "task",
			sourceId: "task-stability",
			start: movedInput.now + 4 * HOUR_MS,
			end: movedInput.now + 5 * HOUR_MS,
		});

		const stable = solveSchedule(stableInput);
		const moved = solveSchedule(movedInput);
		expect(moved.objectiveScore).toBeGreaterThan(stable.objectiveScore);
	});

	test("fastest mode places earlier than packed mode for identical tasks", () => {
		const fastestInput = baseInput();
		fastestInput.tasks.push({
			...taskDefaults(fastestInput),
			id: asTaskId("task-mode"),
			effectiveSchedulingMode: "fastest",
		});
		const packedInput = baseInput();
		packedInput.tasks.push({
			...taskDefaults(packedInput),
			id: asTaskId("task-mode"),
			effectiveSchedulingMode: "packed",
		});

		const fastest = solveSchedule(fastestInput);
		const packed = solveSchedule(packedInput);
		const fastestStart = firstStartForTask(fastest, "task-mode");
		const packedStart = firstStartForTask(packed, "task-mode");
		expect(fastestStart).toBeDefined();
		expect(packedStart).toBeDefined();
		expect(ensureDefined(packedStart, "packedStart")).toBeGreaterThan(
			ensureDefined(fastestStart, "fastestStart"),
		);
	});

	test("balanced mode prefers placement closer to due boundary than fastest", () => {
		const fastestInput = baseInput();
		fastestInput.tasks.push({
			...taskDefaults(fastestInput),
			id: asTaskId("task-balanced-compare"),
			deadline: fastestInput.now + 6 * HOUR_MS,
			effectiveSchedulingMode: "fastest",
		});
		const balancedInput = baseInput();
		balancedInput.tasks.push({
			...taskDefaults(balancedInput),
			id: asTaskId("task-balanced-compare"),
			deadline: balancedInput.now + 6 * HOUR_MS,
			effectiveSchedulingMode: "balanced",
		});

		const fastest = solveSchedule(fastestInput);
		const balanced = solveSchedule(balancedInput);
		const fastestStart = ensureDefined(
			firstStartForTask(fastest, "task-balanced-compare"),
			"fastestBalancedCompareStart",
		);
		const balancedStart = ensureDefined(
			firstStartForTask(balanced, "task-balanced-compare"),
			"balancedStart",
		);

		expect(balancedStart).toBeGreaterThanOrEqual(fastestStart);
	});

	test("handles DST spring-forward window in America/New_York", () => {
		const input = baseInput();
		input.timezone = "America/New_York";
		input.now = Date.UTC(2026, 2, 8, 5, 0, 0, 0); // 2026-03-08 00:00 local
		input.horizonWeeks = 4;
		input.hoursBySetId.default = [{ day: 0, startMinute: 60, endMinute: 240 }]; // Sun 01:00-04:00
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-dst-spring"),
			estimatedMinutes: 60,
		});

		const solved = solveSchedule(input);
		expect(solved.feasibleHard).toBe(true);
		const start = ensureDefined(firstStartForTask(solved, "task-dst-spring"), "dstSpringStart");
		const zoned = zonedPartsForTimestamp(start, "America/New_York");
		expect(zoned.day).toBe(0);
		expect(zoned.minuteOfDay).toBeGreaterThanOrEqual(60);
		expect(zoned.minuteOfDay).toBeLessThan(240);
	});

	test("handles DST fall-back repeated-hour window in America/New_York", () => {
		const input = baseInput();
		input.timezone = "America/New_York";
		input.now = Date.UTC(2026, 10, 1, 4, 0, 0, 0); // 2026-11-01 00:00 local
		input.horizonWeeks = 4;
		input.hoursBySetId.default = [{ day: 0, startMinute: 60, endMinute: 120 }]; // Sun 01:00-02:00
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-dst-fall"),
			estimatedMinutes: 90,
		});

		const solved = solveSchedule(input);
		expect(solved.feasibleHard).toBe(true);
		const blocks = solved.blocks.filter(
			(block) => block.source === "task" && block.sourceId === "task-dst-fall",
		);
		expect(blocks).toHaveLength(1);
		const firstBlock = ensureDefined(blocks[0], "dstFallFirstBlock");
		expect(minutesFromBlock(firstBlock.start, firstBlock.end)).toBe(90);
		const zoned = zonedPartsForTimestamp(firstBlock.start, "America/New_York");
		expect(zoned.day).toBe(0);
		expect(zoned.minuteOfDay).toBeGreaterThanOrEqual(60);
		expect(zoned.minuteOfDay).toBeLessThan(120);
	});

	test("clamps horizon to min and max bounds", () => {
		const short = baseInput();
		short.horizonWeeks = 1;
		const long = baseInput();
		long.horizonWeeks = 20;

		const solvedShort = solveSchedule(short);
		const solvedLong = solveSchedule(long);
		expect(solvedShort.horizonEnd - solvedShort.horizonStart).toBe(4 * WEEK_MS);
		expect(solvedLong.horizonEnd - solvedLong.horizonStart).toBe(12 * WEEK_MS);
	});

	test("never overlaps scheduled task/habit blocks", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-no-overlap"),
			estimatedMinutes: 90,
			splitAllowed: true,
			minChunkMinutes: 30,
			maxChunkMinutes: 60,
		});
		input.habits.push({
			...habitDefaults(input),
			id: asHabitId("habit-no-overlap"),
			durationMinutes: 30,
			repeatsPerPeriod: 1,
		});
		input.busy.push({
			start: input.now + 2 * HOUR_MS,
			end: input.now + 3 * HOUR_MS,
		});

		const solved = solveSchedule(input);
		for (let left = 0; left < solved.blocks.length; left += 1) {
			for (let right = left + 1; right < solved.blocks.length; right += 1) {
				const a = solved.blocks[left];
				const b = solved.blocks[right];
				const overlaps = a.start < b.end && b.start < a.end;
				expect(overlaps).toBe(false);
			}
		}
	});

	test("asymmetric downtime: task with large buffer protects against task with zero buffer", () => {
		const input = baseInput();
		input.tasks.push(
			{
				...taskDefaults(input),
				id: asTaskId("task-buffer-a"),
				estimatedMinutes: 60,
				restMinutes: 30,
			},
			{
				...taskDefaults(input),
				id: asTaskId("task-buffer-b"),
				estimatedMinutes: 60,
				restMinutes: 0,
			},
		);

		const solved = solveSchedule(input);
		const blocks = solved.blocks
			.filter(
				(block) =>
					block.source === "task" &&
					(block.sourceId === "task-buffer-a" || block.sourceId === "task-buffer-b"),
			)
			.sort((a, b) => a.start - b.start);
		expect(blocks).toHaveLength(2);
		const first = ensureDefined(blocks[0], "firstBufferTaskBlock");
		const second = ensureDefined(blocks[1], "secondBufferTaskBlock");
		expect(second.start - first.end).toBeGreaterThanOrEqual(30 * 60 * 1000);
	});

	test("travel blocks are clamped to solver horizon", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-travel"),
			estimatedMinutes: 60,
			travelMinutes: 30,
			location: "Office",
		});

		const solved = solveSchedule(input);
		const travelBlocks = solved.blocks.filter(
			(block) => block.source === "task" && block.sourceId.includes(":travel:"),
		);
		for (const block of travelBlocks) {
			expect(block.start).toBeGreaterThanOrEqual(solved.horizonStart);
			expect(block.end).toBeLessThanOrEqual(solved.horizonEnd);
			expect(block.start).toBeLessThan(block.end);
		}
	});

	test("travel blocks use travel color instead of task color", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-travel-color"),
			estimatedMinutes: 60,
			travelMinutes: 15,
			color: "#f59e0b",
			travelColor: "#14b8a6",
			location: "Office",
		});

		const solved = solveSchedule(input);
		const travelBlocks = solved.blocks.filter(
			(block) =>
				block.source === "task" && block.sourceId.startsWith("task:task-travel-color:travel:"),
		);
		expect(travelBlocks.length).toBeGreaterThan(0);
		expect(travelBlocks.every((block) => block.color === "#14b8a6")).toBe(true);
	});

	test("travel blocks are not created when travelMinutes is set without location", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-travel-no-location"),
			estimatedMinutes: 60,
			travelMinutes: 15,
			location: undefined,
		});

		const solved = solveSchedule(input);
		const taskBlock = solved.blocks.find(
			(block) => block.source === "task" && block.sourceId === "task-travel-no-location",
		);
		const travelBlocks = solved.blocks
			.filter(
				(block) =>
					block.source === "task" &&
					block.sourceId.startsWith("task:task-travel-no-location:travel:"),
			)
			.sort((a, b) => a.start - b.start);

		expect(taskBlock).toBeDefined();
		expect(travelBlocks).toHaveLength(0);
		const core = ensureDefined(taskBlock, "travelNoLocationCoreTask");
		expect(core.location).toBeUndefined();
	});

	test("travel buffer does not stack with rest when deriving downtime", () => {
		const input = baseInput();
		input.downtimeMinutes = 15;
		input.tasks.push(
			{
				...taskDefaults(input),
				id: asTaskId("task-travel-buffered"),
				estimatedMinutes: 60,
				restMinutes: 20,
				travelMinutes: 30,
				location: "Office",
			},
			{
				...taskDefaults(input),
				id: asTaskId("task-no-travel"),
				estimatedMinutes: 60,
			},
		);

		const solved = solveSchedule(input);
		const travelTaskBlock = solved.blocks.find(
			(block) => block.source === "task" && block.sourceId === "task-travel-buffered",
		);
		const noTravelTaskBlock = solved.blocks.find(
			(block) => block.source === "task" && block.sourceId === "task-no-travel",
		);

		expect(travelTaskBlock).toBeDefined();
		expect(noTravelTaskBlock).toBeDefined();

		const travelEnd = ensureDefined(travelTaskBlock, "travelBufferedTask").end;
		const noTravelStart = ensureDefined(noTravelTaskBlock, "noTravelTask").start;
		expect(noTravelStart - travelEnd).toBe(45 * 60 * 1000);
	});

	test("does not emit duplicate travel blocks with the same sourceId", () => {
		const input = baseInput();
		input.tasks.push({
			...taskDefaults(input),
			id: asTaskId("task-duplicate-travel-window"),
			estimatedMinutes: 120,
			splitAllowed: true,
			minChunkMinutes: 60,
			maxChunkMinutes: 60,
			travelMinutes: 30,
			location: "Office",
		});

		const solved = solveSchedule(input);
		const travelBlocks = solved.blocks.filter(
			(block) =>
				block.source === "task" &&
				block.sourceId.startsWith("task:task-duplicate-travel-window:travel:"),
		);

		const seenSourceIds = new Set<string>();
		for (const block of travelBlocks) {
			expect(seenSourceIds.has(block.sourceId)).toBe(false);
			seenSourceIds.add(block.sourceId);
		}
	});
});

describe("rrule and slot utilities", () => {
	test("parses supported rrules", () => {
		const parsed = parseSupportedRRule("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE");
		expect(parsed.frequency).toBe("WEEKLY");
		expect(parsed.interval).toBe(2);
		expect(parsed.byDay).toEqual([1, 3]);
	});

	test("allowed mask supports split windows for cross-midnight ranges", () => {
		const horizonStart = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
		const slotCount = 96;
		const mask = buildAllowedMask(horizonStart, slotCount, "UTC", [
			{ day: 4, startMinute: 20 * 60, endMinute: 24 * 60 },
			{ day: 5, startMinute: 0, endMinute: 3 * 60 },
		]);
		expect(mask.some(Boolean)).toBe(true);
	});
});
