import { autumnHandler } from "autumn-js/next";

const autumnSecretKey = process.env.AUTUMN_SECRET_KEY;
if (!autumnSecretKey) {
	throw new Error(
		"Missing AUTUMN_SECRET_KEY. Set it in apps/web/.env.local (or in the web runtime environment).",
	);
}

export const { GET, POST } = autumnHandler({
	secretKey: autumnSecretKey,
	suppressLogs: true,
	identify: async (_request) => {
		// TODO: Get user from WorkOS AuthKit session
		// const session = await getSession(request.headers);
		return {
			customerId: "anonymous",
			customerData: {
				name: "Anonymous User",
				email: "anonymous@local.dev",
			},
		};
	},
});
