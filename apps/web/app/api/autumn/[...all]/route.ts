import { serverEnv } from "@/env/server";
import { autumnHandler } from "autumn-js/next";

const handlers = autumnHandler({
	secretKey: serverEnv.AUTUMN_SECRET_KEY,
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

export const { GET, POST } = handlers;
