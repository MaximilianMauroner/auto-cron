import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type RecurrencePatternInput = {
	recurrenceRule: string;
	recoveryPolicy?: "skip" | "recover";
	frequency?: "daily" | "weekly" | "biweekly" | "monthly";
	repeatsPerPeriod?: number;
	startDate?: number;
	endDate?: number;
	preferredWindowStart?: string;
	preferredWindowEnd?: string;
	preferredDays?: number[];
	timezone?: string;
};

const normalizePreferredDays = (preferredDays: number[] | undefined) =>
	preferredDays
		? ([...preferredDays].sort((a, b) => a - b) as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>)
		: undefined;

export const recurrenceFingerprintForInput = (input: RecurrencePatternInput) => {
	return JSON.stringify({
		recurrenceRule: input.recurrenceRule,
		recoveryPolicy: input.recoveryPolicy ?? "skip",
		frequency: input.frequency,
		repeatsPerPeriod: input.repeatsPerPeriod,
		startDate: input.startDate,
		endDate: input.endDate,
		preferredWindowStart: input.preferredWindowStart,
		preferredWindowEnd: input.preferredWindowEnd,
		preferredDays: normalizePreferredDays(input.preferredDays),
		timezone: input.timezone,
	});
};

export const upsertRecurrencePattern = async (
	ctx: MutationCtx,
	args: {
		userId: string;
		pattern: RecurrencePatternInput;
	},
) => {
	const fingerprint = recurrenceFingerprintForInput(args.pattern);
	const existing = await ctx.db
		.query("recurrencePatterns")
		.withIndex("by_userId_fingerprint", (q) =>
			q.eq("userId", args.userId).eq("fingerprint", fingerprint),
		)
		.unique();

	const now = Date.now();
	if (existing) {
		if (existing.updatedAt !== now) {
			await ctx.db.patch(existing._id, { updatedAt: now });
		}
		return existing._id;
	}

	return await ctx.db.insert("recurrencePatterns", {
		userId: args.userId,
		fingerprint,
		recurrenceRule: args.pattern.recurrenceRule,
		frequency: args.pattern.frequency,
		interval: undefined,
		repeatsPerPeriod: args.pattern.repeatsPerPeriod,
		recoveryPolicy: args.pattern.recoveryPolicy ?? "skip",
		startDate: args.pattern.startDate,
		endDate: args.pattern.endDate,
		preferredWindowStart: args.pattern.preferredWindowStart,
		preferredWindowEnd: args.pattern.preferredWindowEnd,
		preferredDays: normalizePreferredDays(args.pattern.preferredDays),
		timezone: args.pattern.timezone,
		createdAt: now,
		updatedAt: now,
	});
};

export const ensureHabitSeries = async (
	ctx: MutationCtx,
	args: {
		userId: string;
		habitId: Id<"habits">;
		recurrencePatternId: Id<"recurrencePatterns">;
		isActive: boolean;
	},
) => {
	const existing = await ctx.db
		.query("workItemSeries")
		.withIndex("by_userId_sourceHabitId", (q) =>
			q.eq("userId", args.userId).eq("sourceHabitId", args.habitId),
		)
		.unique();
	const now = Date.now();
	if (existing) {
		if (
			existing.recurrencePatternId !== args.recurrencePatternId ||
			existing.isActive !== args.isActive
		) {
			await ctx.db.patch(existing._id, {
				recurrencePatternId: args.recurrencePatternId,
				isActive: args.isActive,
				updatedAt: now,
			});
		}
		return existing._id;
	}

	return await ctx.db.insert("workItemSeries", {
		userId: args.userId,
		sourceType: "habit",
		sourceTaskId: undefined,
		sourceHabitId: args.habitId,
		recurrencePatternId: args.recurrencePatternId,
		isActive: args.isActive,
		anchorStart: undefined,
		horizonCursor: undefined,
		lastOccurrenceAt: undefined,
		createdAt: now,
		updatedAt: now,
	});
};

export const loadRecurrencePatternForHabit = async (
	ctx: QueryCtx,
	habit: {
		recurrencePatternId: Id<"recurrencePatterns">;
	},
) => {
	return await ctx.db.get(habit.recurrencePatternId);
};
