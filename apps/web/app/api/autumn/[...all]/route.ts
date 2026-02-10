import { autumnHandler } from "autumn-js/next";

// TODO: Replace with actual auth once WorkOS is configured
export const { GET, POST } = autumnHandler({
	suppressLogs: true,
	identify: async (_request) => {
		// TODO: Get user from WorkOS AuthKit session
		// const session = await getSession(request.headers);
		return {
			customerId: "anonymous",
			customerData: {
				name: "Anonymous User",
				email: "",
			},
		};
	},
});
