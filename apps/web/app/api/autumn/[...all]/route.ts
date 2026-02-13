import { serverEnv } from "@/env/server";
import { authkit } from "@workos-inc/authkit-nextjs";
import { autumnHandler } from "autumn-js/next";
import type { NextRequest } from "next/server";

const normalizeOptionalString = (value: string | null | undefined) => {
	if (!value) return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
};

const handlers = autumnHandler({
	secretKey: serverEnv.AUTUMN_SECRET_KEY,
	suppressLogs: true,
	identify: async (request) => {
		const { session } = await authkit(request as NextRequest);
		const user = session.user;
		if (!user?.id) return null;

		const email = normalizeOptionalString(user.email);
		const name =
			normalizeOptionalString([user.firstName, user.lastName].filter(Boolean).join(" ")) ?? email;
		const customerData =
			name || email
				? {
						...(name ? { name } : {}),
						...(email ? { email } : {}),
					}
				: undefined;

		return {
			customerId: user.id,
			...(customerData ? { customerData } : {}),
		};
	},
});

export const { GET, POST } = handlers;
