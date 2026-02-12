import { v } from "convex/values";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import { hoursSetValidator, taskSchedulingModeValidator } from "./shared";

const sanitizeTaskSchedulingMode = (
	mode: string | undefined,
): "fastest" | "balanced" | "packed" => {
	if (mode === "fastest" || mode === "balanced" || mode === "packed") return mode;
	if (mode === "backfacing") return "packed";
	if (mode === "parallel") return "balanced";
	return "fastest";
};

export const listHoursSets = query({
	args: {},
	returns: v.array(hoursSetValidator),
	handler: withQueryAuth(async (ctx) => {
		const hoursSets = await ctx.db
			.query("hoursSets")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.collect();

		return [...hoursSets].sort((a, b) => {
			if (a.isDefault && !b.isDefault) return -1;
			if (!a.isDefault && b.isDefault) return 1;
			return a.name.localeCompare(b.name);
		});
	}),
});

export const getTaskSchedulingDefaults = query({
	args: {},
	returns: v.object({
		defaultTaskSchedulingMode: taskSchedulingModeValidator,
	}),
	handler: withQueryAuth(async (ctx) => {
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.unique();
		return {
			defaultTaskSchedulingMode: sanitizeTaskSchedulingMode(settings?.defaultTaskSchedulingMode),
		};
	}),
});
