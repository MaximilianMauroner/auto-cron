import type { HabitFrequency } from "@auto-cron/types";

// ── Types ──

export type RecurrencePreset =
	| "daily"
	| "weekly_on_day"
	| "every_weekday"
	| "biweekly"
	| "monthly"
	| "custom";

export type RecurrenceUnit = "day" | "week" | "month";

export type EndCondition = "never" | "on_date" | "after_count";

export type RecurrenceState = {
	preset: RecurrencePreset;
	interval: number;
	unit: RecurrenceUnit;
	byDay: number[]; // 0=Sun, 1=Mon ... 6=Sat
	endCondition: EndCondition;
	endDate?: string; // ISO date string (YYYY-MM-DD)
	endCount?: number;
};

// ── Constants ──

const WEEKDAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const WEEKDAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** RFC 5545 BYDAY tokens — must match convex/scheduling/rrule.ts weekdayMap */
const BYDAY_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export const DAY_OPTIONS = [
	{ value: 1, short: "Mo", label: "Monday" },
	{ value: 2, short: "Tu", label: "Tuesday" },
	{ value: 3, short: "We", label: "Wednesday" },
	{ value: 4, short: "Th", label: "Thursday" },
	{ value: 5, short: "Fr", label: "Friday" },
	{ value: 6, short: "Sa", label: "Saturday" },
	{ value: 0, short: "Su", label: "Sunday" },
] as const;

const WEEKDAY_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

// ── Default state ──

export const defaultRecurrenceState = (referenceDate?: Date): RecurrenceState => {
	const day = (referenceDate ?? new Date()).getDay(); // 0=Sun
	return {
		preset: "weekly_on_day",
		interval: 1,
		unit: "week",
		byDay: [day],
		endCondition: "never",
	};
};

// ── Contextual presets ──

export type PresetOption = {
	value: RecurrencePreset;
	label: string;
	state: RecurrenceState;
};

export const buildContextualPresets = (referenceDate?: Date): PresetOption[] => {
	const ref = referenceDate ?? new Date();
	const dayOfWeek = ref.getDay(); // 0=Sun
	const dayName = WEEKDAY_NAMES[dayOfWeek] ?? "Monday";

	return [
		{
			value: "daily",
			label: "Daily",
			state: { preset: "daily", interval: 1, unit: "day", byDay: [], endCondition: "never" },
		},
		{
			value: "weekly_on_day",
			label: `Weekly on ${dayName}`,
			state: {
				preset: "weekly_on_day",
				interval: 1,
				unit: "week",
				byDay: [dayOfWeek],
				endCondition: "never",
			},
		},
		{
			value: "every_weekday",
			label: "Every weekday (Mon\u2013Fri)",
			state: {
				preset: "every_weekday",
				interval: 1,
				unit: "week",
				byDay: [...WEEKDAY_DAYS],
				endCondition: "never",
			},
		},
		{
			value: "biweekly",
			label: "Biweekly",
			state: {
				preset: "biweekly",
				interval: 2,
				unit: "week",
				byDay: [dayOfWeek],
				endCondition: "never",
			},
		},
		{
			value: "monthly",
			label: "Monthly",
			state: {
				preset: "monthly",
				interval: 1,
				unit: "month",
				byDay: [],
				endCondition: "never",
			},
		},
	];
};

// ── RRULE generation ──

export const recurrenceStateToRRule = (state: RecurrenceState): string => {
	const freq = unitToFreq(state.unit);
	const parts = [`RRULE:FREQ=${freq}`, `INTERVAL=${state.interval}`];

	if (state.unit === "week" && state.byDay.length > 0) {
		const tokens = sortedByDay(state.byDay).map((d) => BYDAY_TOKENS[d] ?? "MO");
		parts.push(`BYDAY=${tokens.join(",")}`);
	}

	if (state.endCondition === "after_count" && state.endCount && state.endCount > 0) {
		parts.push(`COUNT=${state.endCount}`);
	}

	return parts.join(";");
};

// ── RRULE parsing ──

export const rruleToRecurrenceState = (
	rule: string | undefined,
	legacyFrequency?: HabitFrequency,
): RecurrenceState => {
	if (!rule && !legacyFrequency) return defaultRecurrenceState();

	if (!rule && legacyFrequency) {
		return legacyFrequencyToRecurrenceState(legacyFrequency);
	}

	const withoutPrefix = (rule ?? "").trim().replace(/^RRULE:/i, "");
	const fields = new Map<string, string>();
	for (const chunk of withoutPrefix.split(";")) {
		const [rawKey, rawValue] = chunk.split("=", 2);
		if (!rawKey || !rawValue) continue;
		fields.set(rawKey.toUpperCase(), rawValue.toUpperCase());
	}

	const freq = fields.get("FREQ") ?? "WEEKLY";
	const interval = safeParseInt(fields.get("INTERVAL"), 1);
	const unit = freqToUnit(freq);

	const byDayRaw = fields.get("BYDAY");
	const byDay = byDayRaw ? parseByDay(byDayRaw) : [];

	const count = safeParseInt(fields.get("COUNT"), 0);
	const endCondition: EndCondition = count > 0 ? "after_count" : "never";

	const preset = detectPreset(unit, interval, byDay);

	return {
		preset,
		interval,
		unit,
		byDay,
		endCondition,
		endCount: count > 0 ? count : undefined,
	};
};

// ── Legacy frequency mapping ──

export const recurrenceStateToLegacyFrequency = (state: RecurrenceState): HabitFrequency => {
	if (state.unit === "day") return "daily";
	if (state.unit === "month") return "monthly";
	if (state.unit === "week" && state.interval >= 2) return "biweekly";
	return "weekly";
};

const legacyFrequencyToRecurrenceState = (frequency: HabitFrequency): RecurrenceState => {
	switch (frequency) {
		case "daily":
			return { preset: "daily", interval: 1, unit: "day", byDay: [], endCondition: "never" };
		case "weekly":
			return defaultRecurrenceState();
		case "biweekly":
			return {
				preset: "biweekly",
				interval: 2,
				unit: "week",
				byDay: [new Date().getDay()],
				endCondition: "never",
			};
		case "monthly":
			return {
				preset: "monthly",
				interval: 1,
				unit: "month",
				byDay: [],
				endCondition: "never",
			};
		default:
			return defaultRecurrenceState();
	}
};

// ── Human-readable description ──

export const describeRecurrence = (state: RecurrenceState): string => {
	if (state.unit === "day" && state.interval === 1) return "Daily";
	if (state.unit === "month" && state.interval === 1) return "Monthly";

	if (state.unit === "week") {
		const sorted = sortedByDay(state.byDay);

		// Every weekday shorthand
		if (state.interval === 1 && arraysEqual(sorted, WEEKDAY_DAYS)) {
			return "Every weekday";
		}

		const prefix =
			state.interval === 1
				? "Weekly"
				: state.interval === 2
					? "Biweekly"
					: `Every ${state.interval} weeks`;

		if (sorted.length === 1) {
			return `${prefix} on ${WEEKDAY_NAMES[sorted[0] ?? 0]}`;
		}
		if (sorted.length > 1) {
			const dayNames = sorted.map((d) => WEEKDAY_SHORT[d] ?? "?");
			return `${prefix} on ${dayNames.join(", ")}`;
		}
		return prefix;
	}

	const unitLabel =
		state.interval === 1
			? state.unit
			: `${state.interval} ${state.unit}${state.interval > 1 ? "s" : ""}`;

	let description = `Every ${unitLabel}`;

	if (state.endCondition === "after_count" && state.endCount) {
		description += ` \u00d7${state.endCount}`;
	} else if (state.endCondition === "on_date" && state.endDate) {
		description += ` until ${state.endDate}`;
	}

	return description;
};

// ── Internal helpers ──

const unitToFreq = (unit: RecurrenceUnit): string => {
	if (unit === "day") return "DAILY";
	if (unit === "week") return "WEEKLY";
	return "MONTHLY";
};

const freqToUnit = (freq: string): RecurrenceUnit => {
	if (freq === "DAILY") return "day";
	if (freq === "MONTHLY") return "month";
	return "week";
};

const parseByDay = (raw: string): number[] => {
	const tokenMap: Record<string, number> = {
		SU: 0,
		MO: 1,
		TU: 2,
		WE: 3,
		TH: 4,
		FR: 5,
		SA: 6,
	};
	return raw
		.split(",")
		.map((t) => t.trim())
		.map((t) => tokenMap[t])
		.filter((v): v is number => Number.isInteger(v));
};

const sortedByDay = (days: number[]): number[] => {
	return [...days].sort((a, b) => {
		const left = a === 0 ? 7 : a;
		const right = b === 0 ? 7 : b;
		return left - right;
	});
};

const safeParseInt = (value: string | undefined, fallback: number): number => {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const arraysEqual = (a: number[], b: number[]): boolean => {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((v, i) => v === sortedB[i]);
};

const detectPreset = (
	unit: RecurrenceUnit,
	interval: number,
	byDay: number[],
): RecurrencePreset => {
	if (unit === "day" && interval === 1) return "daily";
	if (unit === "month" && interval === 1) return "monthly";

	if (unit === "week") {
		if (arraysEqual(byDay, WEEKDAY_DAYS) && interval === 1) return "every_weekday";
		if (interval === 2) return "biweekly";
		if (interval === 1 && byDay.length <= 1) return "weekly_on_day";
	}

	return "custom";
};
