export const SLOT_MINUTES = 15;
export const SLOT_MS = SLOT_MINUTES * 60 * 1000;

export const HORIZON_WEEKS_MIN = 4;
export const HORIZON_WEEKS_DEFAULT = 8;
export const HORIZON_WEEKS_MAX = 12;

export const DEBOUNCE_WINDOW_MS = 30 * 1000;

export const MAX_HABIT_DRIFT_DAYS = 30;

export const PRIORITY_LEVELS = ["low", "medium", "high", "critical", "blocker"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];
export type HabitPriorityLevel = Exclude<PriorityLevel, "blocker">;

export const PRIORITY_VALUE: Record<PriorityLevel, number> = {
	low: 0,
	medium: 1,
	high: 2,
	critical: 3,
	blocker: 4,
};

export const priorityWeight = (priority: PriorityLevel) => 2 ** PRIORITY_VALUE[priority];

export const WEIGHTS = {
	latePerSlot: 1_000_000,
	latePerDayBase: 10_000_000,
	blockerMultiplier: 8,
	startAsap: 50_000,
	baseSkip: 1,
	baseRecover: 32,
	shortfall: 5_000_000,
	ideal: 2_000,
	preferredDay: 50_000,
	moveFastest: 1_000,
	moveBalanced: 5_000,
	movePacked: 8_000,
	modeFastestEarly: 400,
	modeBalancedFragment: 2_500,
	modePackedLateReward: 300,
} as const;

export const DAY_SLOTS = Math.floor((24 * 60) / SLOT_MINUTES);

export type SchedulingMode = "fastest" | "balanced" | "packed";

export const MODE_MOVE_WEIGHT: Record<SchedulingMode, number> = {
	fastest: WEIGHTS.moveFastest,
	balanced: WEIGHTS.moveBalanced,
	packed: WEIGHTS.movePacked,
};
