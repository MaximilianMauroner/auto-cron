"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { withActionAuth } from "../auth";
import { env } from "../env";
import { VALID_PRODUCT_IDS, isValidProductId } from "../planLimits";

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

export const bootstrapDefaultPlannerDataForUser = action({
	args: {},
	returns: v.object({
		defaultHoursSetId: v.id("hoursSets"),
		createdTasks: v.number(),
		createdHabits: v.number(),
	}),
	handler: withActionAuth(
		async (
			ctx,
		): Promise<{
			defaultHoursSetId: Id<"hoursSets">;
			createdTasks: number;
			createdHabits: number;
		}> => {
			return ctx.runMutation(internal.hours.mutations.internalBootstrapDefaultPlannerDataForUser, {
				userId: ctx.userId,
			});
		},
	),
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

export const syncActiveProduct = action({
	args: {
		productId: v.string(),
	},
	returns: v.string(),
	handler: withActionAuth(async (ctx, args: { productId: string }): Promise<string> => {
		if (!isValidProductId(args.productId)) {
			throw new ConvexError({
				code: "INVALID_PRODUCT",
				message: "Unknown product ID.",
			});
		}

		// Verify the product against Autumn's actual subscription data
		const response = await fetch(
			`https://api.useautumn.com/v1/customers/${encodeURIComponent(ctx.userId)}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${env().AUTUMN_SECRET_KEY}`,
				},
			},
		);

		if (!response.ok) {
			throw new ConvexError({
				code: "SUBSCRIPTION_VERIFICATION_FAILED",
				message: "Could not verify subscription status.",
			});
		}

		const customer = (await response.json()) as {
			products?: Array<{ id?: string; status?: string; is_add_on?: boolean }>;
		};
		const products = customer.products ?? [];
		const activeProducts = products.filter((p) =>
			["active", "trialing", "past_due"].includes(p.status ?? ""),
		);
		const primaryProduct = activeProducts.find((p) => !p.is_add_on) ?? activeProducts[0];
		const verifiedProductId = primaryProduct?.id;

		// Only allow setting a product that matches the verified subscription,
		// or fallback to "free" if no active subscription
		const resolvedProductId =
			verifiedProductId && isValidProductId(verifiedProductId) ? verifiedProductId : "free";

		if (args.productId !== resolvedProductId) {
			throw new ConvexError({
				code: "PRODUCT_MISMATCH",
				message: "Requested product does not match your active subscription.",
			});
		}

		return ctx.runMutation(internal.hours.mutations.internalUpdateActiveProduct, {
			userId: ctx.userId,
			productId: resolvedProductId,
		});
	}),
});
