import { Autumn } from "@useautumn/convex";
import { components } from "./_generated/api";
import { authKit } from "./auth";
import type { AutumnIdentifyContext } from "./autumnTypes";
import { env } from "./env";

const normalizeOptionalString = (value: string | null | undefined) => {
	if (!value) return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
};

// NOTE: `identify` uses manual getUserIdentity() instead of requireAuth() because:
// 1. It must return null (not throw) when unauthenticated
// 2. Its AutumnIdentifyContext type lacks `runQuery`, so requireAuthUser() won't work
export const autumn = new Autumn(components.autumn, {
	secretKey: env().AUTUMN_SECRET_KEY,
	identify: async (ctx: AutumnIdentifyContext) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;

		let customerId = normalizeOptionalString(identity.subject);
		let customerName = normalizeOptionalString(identity.name);
		let customerEmail = normalizeOptionalString(identity.email);

		if ("runQuery" in ctx && typeof ctx.runQuery === "function") {
			const authUser = await authKit.getAuthUser(ctx as Parameters<typeof authKit.getAuthUser>[0]);
			if (authUser) {
				customerId = normalizeOptionalString(authUser.id) ?? customerId;
				customerEmail = normalizeOptionalString(authUser.email) ?? customerEmail;
				const fullName = normalizeOptionalString(
					[authUser.firstName, authUser.lastName].filter(Boolean).join(" "),
				);
				customerName = fullName ?? customerName;
			}
		}

		if (!customerId) return null;

		const customerData =
			customerName || customerEmail
				? {
						...(customerName ? { name: customerName } : {}),
						...(customerEmail ? { email: customerEmail } : {}),
					}
				: undefined;

		return {
			customerId,
			...(customerData ? { customerData } : {}),
		};
	},
});

const autumnApi = autumn.api() as {
	track: unknown;
	cancel: unknown;
	query: unknown;
	attach: unknown;
	check: unknown;
	checkout: unknown;
	usage: unknown;
	setupPayment: unknown;
	createCustomer: unknown;
	listProducts: unknown;
	billingPortal: unknown;
	createEntity: unknown;
	getEntity: unknown;
};

export const track = autumnApi.track;
export const cancel = autumnApi.cancel;
export const query = autumnApi.query;
export const attach = autumnApi.attach;
export const check = autumnApi.check;
export const checkout = autumnApi.checkout;
export const usage = autumnApi.usage;
export const setupPayment = autumnApi.setupPayment;
export const createCustomer = autumnApi.createCustomer;
export const listProducts = autumnApi.listProducts;
export const billingPortal = autumnApi.billingPortal;
export const createEntity = autumnApi.createEntity;
export const getEntity = autumnApi.getEntity;
