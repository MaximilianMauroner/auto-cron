import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const convexUrlSchema = z.string().url().optional();

export const env = createEnv({
	server: {
		AUTUMN_SECRET_KEY: z.string().min(1),
		CONVEX_URL: convexUrlSchema,
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
		WORKOS_API_KEY: z.string().min(1),
		WORKOS_CLIENT_ID: z.string().min(1),
		WORKOS_COOKIE_PASSWORD: z.string().min(32),
	},
	client: {
		NEXT_PUBLIC_AUTUMN_BACKEND_URL: z.string().url().optional(),
		NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().url(),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_AUTUMN_BACKEND_URL: process.env.NEXT_PUBLIC_AUTUMN_BACKEND_URL,
		NEXT_PUBLIC_WORKOS_REDIRECT_URI: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
	},
	emptyStringAsUndefined: true,
});
