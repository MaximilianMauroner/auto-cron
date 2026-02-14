import type { MutationCtx, QueryCtx } from "../_generated/server";

export type DbCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

export type GoogleCalendarColor =
	| "#f59e0b"
	| "#ef4444"
	| "#22c55e"
	| "#0ea5e9"
	| "#6366f1"
	| "#a855f7"
	| "#ec4899"
	| "#14b8a6";
