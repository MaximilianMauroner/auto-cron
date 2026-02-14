import type { Id } from "../_generated/dataModel";

export type PriorityLevel = "low" | "medium" | "high" | "critical" | "blocker";
export type HabitPriorityLevel = Exclude<PriorityLevel, "blocker">;
export type SchedulingMode = "fastest" | "balanced" | "packed";

export type RecoveryPolicy = "skip" | "recover";

export type TriggeredBy =
	| "manual"
	| "task_change"
	| "habit_change"
	| "hours_change"
	| "calendar_change"
	| "cron";

export type HourWindow = {
	day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	startMinute: number;
	endMinute: number;
};

export type SchedulingTaskInput = {
	id: Id<"tasks">;
	creationTime: number;
	title: string;
	priority: PriorityLevel;
	blocker: boolean;
	status: "queued" | "scheduled";
	estimatedMinutes: number;
	deadline?: number;
	scheduleAfter?: number;
	splitAllowed?: boolean;
	minChunkMinutes?: number;
	maxChunkMinutes?: number;
	restMinutes?: number;
	travelMinutes?: number;
	location?: string;
	hoursSetId?: Id<"hoursSets">;
	schedulingMode?: SchedulingMode;
	effectiveSchedulingMode: SchedulingMode;
	preferredCalendarId?: string;
	color?: string;
	travelColor?: string;
	pinnedEventMinutes?: number;
};

export type SchedulingHabitInput = {
	id: Id<"habits">;
	creationTime: number;
	title: string;
	priority: HabitPriorityLevel;
	recoveryPolicy: RecoveryPolicy;
	recurrenceRule: string;
	startDate?: number;
	endDate?: number;
	durationMinutes: number;
	minDurationMinutes?: number;
	maxDurationMinutes?: number;
	repeatsPerPeriod?: number;
	idealTime?: string;
	preferredDays?: number[];
	hoursSetId?: Id<"hoursSets">;
	preferredCalendarId?: string;
	color?: string;
	isActive: boolean;
};

export type BusyInterval = {
	start: number;
	end: number;
};

export type ExistingPlacement = {
	source: "task" | "habit";
	sourceId: string;
	start: number;
	end: number;
};

export type SchedulingInput = {
	userId: string;
	timezone: string;
	horizonWeeks: number;
	downtimeMinutes: number;
	defaultTaskMode: SchedulingMode;
	tasks: SchedulingTaskInput[];
	habits: SchedulingHabitInput[];
	busy: BusyInterval[];
	hoursBySetId: Record<string, HourWindow[]>;
	defaultHoursSetId?: Id<"hoursSets">;
	existingPlacements: ExistingPlacement[];
	now: number;
};

export type ScheduledBlock = {
	source: "task" | "habit";
	sourceId: string;
	title: string;
	start: number;
	end: number;
	priority: PriorityLevel;
	calendarId?: string;
	color?: string;
	location?: string;
};

export type LateTaskDiagnostic = {
	taskId: Id<"tasks">;
	dueDate?: number;
	completionEnd: number;
	tardinessSlots: number;
	priority: PriorityLevel;
	blocker: boolean;
	reason?: string;
};

export type HabitShortfallDiagnostic = {
	habitId: Id<"habits">;
	periodStart: number;
	periodEnd: number;
	targetCount: number;
	scheduledCount: number;
	shortfall: number;
	recoveryPolicy: RecoveryPolicy;
};

export type HabitDropDiagnostic = {
	habitId: Id<"habits">;
	recoveryPolicy: RecoveryPolicy;
	priority: HabitPriorityLevel;
	reason: string;
};

export type SolverResult = {
	horizonStart: number;
	horizonEnd: number;
	feasibleOnTime: boolean;
	feasibleHard: boolean;
	objectiveScore: number;
	blocks: ScheduledBlock[];
	lateTasks: LateTaskDiagnostic[];
	habitShortfalls: HabitShortfallDiagnostic[];
	droppedHabits: HabitDropDiagnostic[];
	reasonCode?: string;
	error?: string;
};

export type SupportedFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type ParsedRRule = {
	frequency: SupportedFrequency;
	interval: number;
	byDay: number[];
};

export type HabitPeriod = {
	periodStart: number;
	periodEnd: number;
	targetCount: number;
	expectedSpacingDays: number;
	driftDays: number;
};

export type PlacementSearchArgs = {
	availabilityMask: boolean[];
	occupancyMask: boolean[];
	beforeDowntimeMask?: boolean[];
	durationSlots: number;
	earliestStartSlot: number;
	latestEndSlot?: number;
	downtimeSlots?: number;
	mode: SchedulingMode;
	slotScore?: (slot: number) => number;
};

export type TaskChunkPlan = {
	requiredSlots: number;
	minChunkSlots: number;
	maxChunkSlots: number;
};

export type HabitOccurrenceCandidate = {
	startSlot: number;
	score: number;
	periodStart: number;
	periodEnd: number;
};

export type RunOrderComparable = {
	_id: Id<"schedulingRuns">;
	startedAt: number;
	_creationTime?: number;
};

export type SchedulingBlock = {
	source: "task" | "habit";
	sourceId: string;
	title: string;
	start: number;
	end: number;
	priority: PriorityLevel;
	calendarId?: string;
	color?: string;
	location?: string;
};

export type SchedulableTaskStatus = "queued" | "scheduled";

export type TaskScheduleResult = {
	success: boolean;
	reasonCode?: string;
	blocks: ScheduledBlock[];
	occupancyMask: boolean[];
	completionByTaskId: Map<string, number>;
	requiredSlotsByTaskId: Map<string, number>;
	availabilityByTaskId: Map<string, boolean[]>;
};

export type AvailabilityMaskCache = Map<string, boolean[]>;
