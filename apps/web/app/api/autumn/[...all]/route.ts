import { serverEnv } from "@/env/server";
import { authkit } from "@workos-inc/authkit-nextjs";
import { autumnHandler } from "autumn-js/next";
import type { NextRequest } from "next/server";

const handlers = autumnHandler({
	secretKey: serverEnv.AUTUMN_SECRET_KEY,
	suppressLogs: true,
	identify: async (request) => {
		const { session } = await authkit(request as NextRequest);
		const user = session.user;
		if (!user) return null;

		const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
		return {
			customerId: user.id,
			customerData: {
				name: fullName || user.email,
				email: user.email,
			},
		};
	},
});

export const { GET, POST } = handlers;
