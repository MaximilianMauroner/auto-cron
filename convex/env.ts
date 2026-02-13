const BILLING_MODES = new Set(["live", "allow_all", "deny_tasks", "deny_habits", "track_fail"]);

export type BillingMode = "live" | "allow_all" | "deny_tasks" | "deny_habits" | "track_fail";

export type ConvexEnv = {
	AUTUMN_BILLING_MODE?: BillingMode;
	AUTUMN_SECRET_KEY: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	GOOGLE_CALENDAR_WEBHOOK_URL?: string;
	GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET?: string;
};

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

export const env = (): ConvexEnv => ({
	AUTUMN_BILLING_MODE: readBillingMode(),
	AUTUMN_SECRET_KEY: readRequired("AUTUMN_SECRET_KEY"),
	GOOGLE_CLIENT_ID: readRequired("GOOGLE_CLIENT_ID"),
	GOOGLE_CLIENT_SECRET: readRequired("GOOGLE_CLIENT_SECRET"),
	GOOGLE_CALENDAR_WEBHOOK_URL: readOptional("GOOGLE_CALENDAR_WEBHOOK_URL"),
	GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET: readOptional("GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET"),
});
