"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { env } from "./env";

export const createAutumnCustomer = internalAction({
	args: {
		customerId: v.string(),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (_ctx, args) => {
		const body: Record<string, string> = {
			customer_id: args.customerId,
		};
		if (args.name) body.name = args.name;
		if (args.email) body.email = args.email;

		const autumnHeaders = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env().AUTUMN_SECRET_KEY}`,
		};

		const response = await fetch("https://api.useautumn.com/v1/customers", {
			method: "POST",
			headers: autumnHeaders,
			body: JSON.stringify(body),
		});

		const isNewCustomer = response.ok;

		if (!isNewCustomer && response.status !== 409) {
			const text = await response.text().catch(() => "");
			console.error(
				`Failed to create Autumn customer ${args.customerId}: ${response.status} ${text}`,
			);
			return null;
		}

		// Explicitly attach the free plan for newly created customers.
		// This ensures check()/track() work immediately, even if the
		// is_default auto-enable config hasn't synced to the Autumn dashboard.
		if (isNewCustomer) {
			const attachResponse = await fetch("https://api.useautumn.com/v1/attach", {
				method: "POST",
				headers: autumnHeaders,
				body: JSON.stringify({
					customer_id: args.customerId,
					product_id: "free",
				}),
			});

			if (!attachResponse.ok) {
				const text = await attachResponse.text().catch(() => "");
				console.error(
					`Failed to attach free plan for ${args.customerId}: ${attachResponse.status} ${text}`,
				);
			}
		}

		return null;
	},
});
