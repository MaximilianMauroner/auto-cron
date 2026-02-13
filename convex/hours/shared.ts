import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const taskSchedulingModeValidator = v.union(
	v.literal("fastest"),
	v.literal("backfacing"),
	v.literal("parallel"),
);

export const hourWindowDayValidator = v.union(
	v.literal(0),
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4),
	v.literal(5),
	v.literal(6),
);

export const hourWindowValidator = v.object({
	day: hourWindowDayValidator,
	startMinute: v.number(),
	endMinute: v.number(),
});

export const hoursSetValidator = v.object({
	_id: v.id("hoursSets"),
	_creationTime: v.number(),
	userId: v.string(),
	name: v.string(),
	isDefault: v.boolean(),
	isSystem: v.boolean(),
	windows: v.array(hourWindowValidator),
	defaultCalendarId: v.optional(v.string()),
	updatedAt: v.number(),
});

export type HourWindow = {
	day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	startMinute: number;
	endMinute: number;
};

type HourWindowValidationErrorCode =
	| "INVALID_HOURS_WINDOW_RANGE"
	| "INVALID_HOURS_WINDOW_GRANULARITY"
	| "OVERLAPPING_HOURS_WINDOWS";

const hoursValidationError = (code: HourWindowValidationErrorCode, message: string) => {
	throw new ConvexError({
		code,
		message,
	});
};

export const anytimeWindows: HourWindow[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
	day: day as HourWindow["day"],
	startMinute: 0,
	endMinute: 1440,
}));

export const normalizeWindows = (windows: HourWindow[]) => {
	return [...windows].sort((a, b) => {
		if (a.day !== b.day) return a.day - b.day;
		if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
		return a.endMinute - b.endMinute;
	});
};

export const assertValidWindows = (windows: HourWindow[]) => {
	for (const window of windows) {
		if (
			window.startMinute < 0 ||
			window.endMinute > 1440 ||
			window.startMinute >= window.endMinute
		) {
			hoursValidationError(
				"INVALID_HOURS_WINDOW_RANGE",
				"Hours windows must satisfy 0 <= start < end <= 1440.",
			);
		}
		if (window.startMinute % 15 !== 0 || window.endMinute % 15 !== 0) {
			hoursValidationError(
				"INVALID_HOURS_WINDOW_GRANULARITY",
				"Hours windows must use 15-minute granularity.",
			);
		}
	}

	const windowsByDay = new Map<HourWindow["day"], HourWindow[]>();
	for (const window of normalizeWindows(windows)) {
		const dayWindows = windowsByDay.get(window.day) ?? [];
		if (dayWindows.some((existing) => window.startMinute < existing.endMinute)) {
			hoursValidationError(
				"OVERLAPPING_HOURS_WINDOWS",
				"Hours windows cannot overlap on the same day.",
			);
		}
		dayWindows.push(window);
		windowsByDay.set(window.day, dayWindows);
	}
};

type DbCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

export const getDefaultHoursSet = async (
	ctx: DbCtx,
	userId: string,
): Promise<Doc<"hoursSets"> | null> => {
	return ctx.db
		.query("hoursSets")
		.withIndex("by_userId_isDefault", (q) => q.eq("userId", userId).eq("isDefault", true))
		.unique();
};

export const ensureHoursSetOwnership = async (
	ctx: DbCtx,
	hoursSetId: Id<"hoursSets"> | undefined,
	userId: string,
) => {
	if (!hoursSetId) return null;
	const hoursSet = await ctx.db.get(hoursSetId);
	if (!hoursSet || hoursSet.userId !== userId) {
		throw new ConvexError({
			code: "INVALID_HOURS_SET",
			message: "The selected hours set does not exist.",
		});
	}
	return hoursSet;
};
