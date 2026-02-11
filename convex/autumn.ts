import { Autumn } from "@useautumn/convex";
import { components } from "./_generated/api";
import { env } from "./env";

type AutumnIdentifyContext = {
	auth: {
		getUserIdentity: () => Promise<{
			subject: string;
			name?: string | null;
			email?: string | null;
		} | null>;
	};
};

// NOTE: `identify` uses manual getUserIdentity() instead of requireAuth() because:
// 1. It must return null (not throw) when unauthenticated
// 2. Its AutumnIdentifyContext type lacks `runQuery`, so requireAuthUser() won't work
export const autumn = new Autumn(components.autumn, {
	secretKey: env().AUTUMN_SECRET_KEY ?? "",
	identify: async (ctx: AutumnIdentifyContext) => {
		const user = await ctx.auth.getUserIdentity();
		if (!user) return null;

		return {
			customerId: user.subject,
			customerData: {
				name: user.name ?? "",
				email: user.email ?? "",
			},
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
