"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { withActionAuth } from "../auth";
import { env } from "../env";
import { VALID_PRODUCT_IDS, isValidProductId } from "../planLimits";

const CURRENTLY_ENTITLED_PRODUCT_STATUSES = [
	"active",
	"trialing",
	"past_due",
	"cancelling",
	"canceling",
] as const;

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
		const requestedProductId = isValidProductId(args.productId) ? args.productId : undefined;

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
		const entitledProducts = products.filter(
			(p): p is { id: string; status?: string; is_add_on?: boolean } =>
				Boolean(p.id) &&
				isValidProductId(p.id ?? "") &&
				!p.is_add_on &&
				CURRENTLY_ENTITLED_PRODUCT_STATUSES.includes(
					(p.status ?? "") as (typeof CURRENTLY_ENTITLED_PRODUCT_STATUSES)[number],
				),
		);
		const requestedEntitled =
			requestedProductId && entitledProducts.some((product) => product.id === requestedProductId)
				? requestedProductId
				: undefined;
		const primaryEntitled = entitledProducts[0]?.id;
		const resolvedProductId = requestedEntitled ?? primaryEntitled ?? "free";

		// Keep this filter for compatibility with any downstream assumptions.
		const activeProducts = products.filter((p) =>
			CURRENTLY_ENTITLED_PRODUCT_STATUSES.includes(
				(p.status ?? "") as (typeof CURRENTLY_ENTITLED_PRODUCT_STATUSES)[number],
			),
		);
		if (activeProducts.length === 0 && resolvedProductId !== "free") {
			throw new ConvexError({
				code: "SUBSCRIPTION_VERIFICATION_FAILED",
				message: "Could not resolve an entitled product.",
			});
		}

		return ctx.runMutation(internal.hours.mutations.internalUpdateActiveProduct, {
			userId: ctx.userId,
			productId: resolvedProductId,
		});
	}),
});
