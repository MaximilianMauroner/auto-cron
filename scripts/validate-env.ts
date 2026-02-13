import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const env = createEnv({
	server: {
		AUTUMN_SECRET_KEY: z.string().min(1),
		CONVEX_DEPLOY_KEY: z.string().min(1),
		CONVEX_URL: z.string().url().optional(),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		NEXT_PUBLIC_CONVEX_URL: z.string().url().optional(),
		NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().url(),
		WORKOS_API_KEY: z.string().min(1),
		WORKOS_CLIENT_ID: z.string().min(1),
		WORKOS_COOKIE_PASSWORD: z.string().min(32),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});

if (!env.NEXT_PUBLIC_CONVEX_URL && !env.CONVEX_URL) {
	throw new Error("Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL or CONVEX_URL.");
}

console.log("Environment validation passed.");
