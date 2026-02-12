import { MAX_HABIT_DRIFT_DAYS } from "./constants";

type SupportedFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

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

const weekdayMap: Record<string, number> = {
	SU: 0,
	MO: 1,
	TU: 2,
	WE: 3,
	TH: 4,
	FR: 5,
	SA: 6,
};

const dayMs = 24 * 60 * 60 * 1000;

export const recurrenceFromLegacyFrequency = (frequency: string | undefined) => {
	if (frequency === "daily") return "RRULE:FREQ=DAILY;INTERVAL=1";
	if (frequency === "weekly") return "RRULE:FREQ=WEEKLY;INTERVAL=1";
	if (frequency === "biweekly") return "RRULE:FREQ=WEEKLY;INTERVAL=2";
	if (frequency === "monthly") return "RRULE:FREQ=MONTHLY;INTERVAL=1";
	return "RRULE:FREQ=WEEKLY;INTERVAL=1";
};

export const parseSupportedRRule = (rule: string): ParsedRRule => {
	const withoutPrefix = rule.trim().replace(/^RRULE:/i, "");
	const fields = new Map<string, string>();
	for (const chunk of withoutPrefix.split(";")) {
		const [rawKey, rawValue] = chunk.split("=", 2);
		if (!rawKey || !rawValue) continue;
		fields.set(rawKey.toUpperCase(), rawValue.toUpperCase());
	}
	const frequency = fields.get("FREQ");
	if (frequency !== "DAILY" && frequency !== "WEEKLY" && frequency !== "MONTHLY") {
		throw new Error("Unsupported recurrence rule frequency. Use DAILY, WEEKLY, or MONTHLY.");
	}
	const interval = Number.parseInt(fields.get("INTERVAL") ?? "1", 10);
	const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : 1;
	const byDayRaw = fields.get("BYDAY");
	const byDay = byDayRaw
		? byDayRaw
				.split(",")
				.map((token) => token.trim())
				.map((token) => weekdayMap[token])
				.filter((value): value is number => Number.isInteger(value))
		: [];
	return {
		frequency,
		interval: safeInterval,
		byDay,
	};
};

const periodLengthDays = (rule: ParsedRRule) => {
	if (rule.frequency === "DAILY") return 1 * rule.interval;
	if (rule.frequency === "WEEKLY") return 7 * rule.interval;
	return 30 * rule.interval;
};

export const buildHabitPeriods = (
	horizonStart: number,
	horizonEnd: number,
	habitStart: number | undefined,
	habitEnd: number | undefined,
	rule: ParsedRRule,
	targetCount: number,
) => {
	const effectiveStart = Math.max(horizonStart, habitStart ?? horizonStart);
	const effectiveEnd = Math.min(horizonEnd, habitEnd ?? horizonEnd);
	if (effectiveEnd <= effectiveStart) return [] as HabitPeriod[];
	const lengthDays = periodLengthDays(rule);
	const lengthMs = Math.max(dayMs, lengthDays * dayMs);
	const safeTargetCount = Math.max(1, targetCount);
	const expectedSpacingDays = lengthDays / safeTargetCount;
	const driftDays = Math.max(
		0,
		Math.min(MAX_HABIT_DRIFT_DAYS, Math.round(expectedSpacingDays - 1)),
	);
	const periods: HabitPeriod[] = [];
	for (let periodStart = effectiveStart; periodStart < effectiveEnd; periodStart += lengthMs) {
		periods.push({
			periodStart,
			periodEnd: Math.min(periodStart + lengthMs, effectiveEnd),
			targetCount: safeTargetCount,
			expectedSpacingDays,
			driftDays,
		});
	}
	return periods;
};
