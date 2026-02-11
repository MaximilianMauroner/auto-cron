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
	returnPathname: "/calendar",
	onSuccess: async ({ accessToken, oauthTokens }) => {
		const cookieStore = await cookies();
		const isProd = process.env.NODE_ENV === "production";
		const existingRefreshToken = cookieStore.get("google_refresh_token")?.value;

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

		const refreshToken = oauthTokens.refreshToken ?? existingRefreshToken;
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

		const now = Math.floor(Date.now() / 1000);
		const accessMaxAge = Math.max(60, oauthTokens.expiresAt - now);
		cookieStore.set("google_oauth_status", "connected", {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		});

		cookieStore.set("google_access_token", oauthTokens.accessToken, {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: accessMaxAge,
		});
		cookieStore.set("google_refresh_token", refreshToken, {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		});
		cookieStore.set("google_token_expires_at", String(oauthTokens.expiresAt), {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		});
	},
});
