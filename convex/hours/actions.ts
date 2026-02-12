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
