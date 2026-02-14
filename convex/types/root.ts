export type UnauthorizedError = {
	code: "UNAUTHORIZED";
	message: string;
};

export type AutumnIdentifyContext = {
	auth: {
		getUserIdentity: () => Promise<{
			subject: string;
			name?: string | null;
			email?: string | null;
		} | null>;
	};
	runQuery?: unknown;
};

export type BillableFeatureId = "tasks" | "habits";

export type BillableEntityType = "task" | "habit";

export type BillingReservationStatus = "reserved" | "committed" | "rolled_back" | "rollback_failed";

export type FeatureLimitError = {
	code: "FEATURE_LIMIT_REACHED";
	message: string;
	featureId: BillableFeatureId;
	scenario?: string;
	preview?: string;
};

export type BillingCheckFailedError = {
	code: "BILLING_CHECK_FAILED";
	message: string;
	featureId: BillableFeatureId;
	providerCode?: string;
};

export type BillingLockError = {
	code: "BILLING_LOCKED";
	message: string;
	featureId: BillableFeatureId;
};

export type BillingMode = "live" | "allow_all" | "deny_tasks" | "deny_habits" | "track_fail";

export type ConvexEnv = {
	AUTUMN_BILLING_MODE?: BillingMode;
	AUTUMN_SECRET_KEY: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	GOOGLE_CALENDAR_WEBHOOK_URL?: string;
	GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET?: string;
};

export type ProductId = "free" | "basic" | "plus" | "pro";
