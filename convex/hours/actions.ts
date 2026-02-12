"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { withActionAuth } from "../auth";

export const bootstrapHoursSetsForUser = action({
	args: {},
	returns: v.object({
		defaultHoursSetId: v.id("hoursSets"),
	}),
	handler: withActionAuth(async (ctx): Promise<{ defaultHoursSetId: Id<"hoursSets"> }> => {
		return ctx.runMutation(internal.hours.mutations.internalBootstrapHoursSetsForUser, {
			userId: ctx.userId,
		});
	}),
});

export const migrateSchedulingDataForCurrentUser = action({
	args: {},
	returns: v.object({
		updatedSettings: v.number(),
		updatedTasks: v.number(),
		updatedHabits: v.number(),
	}),
	handler: withActionAuth(
		async (
			ctx,
		): Promise<{ updatedSettings: number; updatedTasks: number; updatedHabits: number }> => {
			const result = await ctx.runMutation(
				internal.hours.mutations.internalMigrateSchedulingModelForUser,
				{
					userId: ctx.userId,
				},
			);
			return result as { updatedSettings: number; updatedTasks: number; updatedHabits: number };
		},
	),
});
