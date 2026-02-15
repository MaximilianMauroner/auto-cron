import { serverEnv } from "@/env/server";
import { createConvexHttpClient } from "@/lib/convex-http";
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { makeFunctionReference } from "convex/server";
import { cookies } from "next/headers";

const upsertGoogleTokensRef = makeFunctionReference<
	"mutation",
	{ refreshToken: string; syncToken?: string },
	string
>("calendar/mutations:upsertGoogleTokens");

export const GET = handleAuth({
	returnPathname: "/app/calendar",
	onSuccess: async ({ accessToken, oauthTokens }) => {
		const cookieStore = await cookies();
		const isProd = serverEnv.NODE_ENV === "production";

		if (!oauthTokens) {
			cookieStore.set("google_oauth_status", "missing_tokens", {
				httpOnly: true,
				secure: isProd,
				sameSite: "lax",
				path: "/",
				maxAge: 60 * 60,
			});
			return;
		}

		const refreshToken = oauthTokens.refreshToken;
		if (!refreshToken) {
			cookieStore.set("google_oauth_status", "missing_refresh_token", {
				httpOnly: true,
				secure: isProd,
				sameSite: "lax",
				path: "/",
				maxAge: 60 * 60,
			});
			return;
		}

		const convex = createConvexHttpClient(accessToken);
		await convex.mutation(upsertGoogleTokensRef, {
			refreshToken,
		});

		cookieStore.set("google_oauth_status", "connected", {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		});
	},
});
