import type { BillingMode, ConvexEnv } from "./types/root";

export type { BillingMode, ConvexEnv } from "./types/root";

const BILLING_MODES = new Set(["live", "allow_all", "deny_tasks", "deny_habits", "track_fail"]);

const runtimeEnv =
	typeof process !== "undefined" && process.env
		? (process.env as Record<string, string | undefined>)
		: {};

const readRequired = (name: "AUTUMN_SECRET_KEY" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET") => {
	const value = runtimeEnv[name]?.trim();
	if (!value) {
		throw new Error(`Missing required Convex env var: ${name}`);
	}
	return value;
};

const readBillingMode = (): BillingMode | undefined => {
	const value = runtimeEnv.AUTUMN_BILLING_MODE?.trim().toLowerCase();
	if (!value) return undefined;
	return BILLING_MODES.has(value) ? (value as BillingMode) : undefined;
};

const readOptional = (name: string): string | undefined => {
	const value = runtimeEnv[name]?.trim();
	if (!value) return undefined;
	return value;
};

const readOptionalCsv = (name: string): string[] | undefined => {
	const value = runtimeEnv[name]?.trim();
	if (!value) return undefined;
	const parsed = value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return parsed.length > 0 ? parsed : undefined;
};

export const env = (): ConvexEnv => ({
	AUTUMN_BILLING_MODE: readBillingMode(),
	AUTUMN_SECRET_KEY: readRequired("AUTUMN_SECRET_KEY"),
	INTERNAL_ADMIN_USER_IDS: readOptionalCsv("INTERNAL_ADMIN_USER_IDS"),
	GOOGLE_CLIENT_ID: readRequired("GOOGLE_CLIENT_ID"),
	GOOGLE_CLIENT_SECRET: readRequired("GOOGLE_CLIENT_SECRET"),
	GOOGLE_CALENDAR_WEBHOOK_URL: readOptional("GOOGLE_CALENDAR_WEBHOOK_URL"),
	GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET: readOptional("GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET"),
});
