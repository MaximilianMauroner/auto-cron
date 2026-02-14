import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { env } from "./env";

export type BillableFeatureId = "tasks" | "habits";
export type BillableEntityType = "task" | "habit";
export type BillingReservationStatus = "reserved" | "committed" | "rolled_back" | "rollback_failed";

const BILLING_LOCK_TTL_MS = 15_000;

type FeatureLimitError = {
	code: "FEATURE_LIMIT_REACHED";
	message: string;
	featureId: BillableFeatureId;
	scenario?: string;
	preview?: string;
};

type BillingCheckFailedError = {
	code: "BILLING_CHECK_FAILED";
	message: string;
	featureId: BillableFeatureId;
	providerCode?: string;
};

type BillingLockError = {
	code: "BILLING_LOCKED";
	message: string;
	featureId: BillableFeatureId;
};

const getBillingMode = () => env().AUTUMN_BILLING_MODE?.trim().toLowerCase() ?? "live";

const featureLimitMessage = (featureId: BillableFeatureId) => {
	if (featureId === "habits") {
		return "Habits are available on the Basic plan and above. Upgrade to get started.";
	}
	return "You've reached your task limit for the current billing cycle. Upgrade for more.";
};

const normalizeOptionalString = (value: unknown): string | undefined => {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	if (!normalized || normalized === "undefined" || normalized === "null") return undefined;
	return normalized;
};

const featureLimitError = ({
	featureId,
	scenario,
	preview,
}: {
	featureId: BillableFeatureId;
	scenario?: string;
	preview?: string;
}) =>
	new ConvexError<FeatureLimitError>({
		code: "FEATURE_LIMIT_REACHED",
		message: featureLimitMessage(featureId),
		featureId,
		...(scenario ? { scenario } : {}),
		...(preview ? { preview } : {}),
	});

const billingCheckFailedError = ({
	featureId,
	providerCode,
}: {
	featureId: BillableFeatureId;
	providerCode?: string;
}) =>
	new ConvexError<BillingCheckFailedError>({
		code: "BILLING_CHECK_FAILED",
		message: "Billing provider check failed. Please retry.",
		featureId,
		...(providerCode ? { providerCode } : {}),
	});

const billingLockedError = (featureId: BillableFeatureId) =>
	new ConvexError<BillingLockError>({
		code: "BILLING_LOCKED",
		message: "Billing lock is currently held by another operation. Please retry.",
		featureId,
	});

const parseCheckOutcome = (checkResult: unknown) => {
	const topLevel =
		typeof checkResult === "object" && checkResult !== null
			? (checkResult as Record<string, unknown>)
			: undefined;
	const data =
		topLevel && typeof topLevel.data === "object" && topLevel.data !== null
			? (topLevel.data as Record<string, unknown>)
			: topLevel;
	const topLevelError =
		topLevel && typeof topLevel.error === "object" && topLevel.error !== null
			? (topLevel.error as Record<string, unknown>)
			: undefined;
	const dataError =
		data && typeof data.error === "object" && data.error !== null
			? (data.error as Record<string, unknown>)
			: undefined;
	const error = topLevelError ?? dataError;
	const allowedCandidates = [
		data?.allowed,
		data?.isAllowed,
		data?.is_allowed,
		topLevel?.allowed,
		topLevel?.isAllowed,
		topLevel?.is_allowed,
	];
	const allowed = allowedCandidates.find((value) => typeof value === "boolean");
	const scenario = normalizeOptionalString(data?.scenario);
	let preview: string | undefined;
	try {
		const rawPreview = data?.preview;
		if (typeof rawPreview === "string") {
			preview = normalizeOptionalString(rawPreview);
		} else if (rawPreview !== undefined) {
			preview = JSON.stringify(rawPreview);
		}
	} catch {
		preview = "unserializable_preview";
	}
	const providerCode = normalizeOptionalString(error?.code);
	const providerMessage = normalizeOptionalString(error?.message);

	return {
		allowed: allowed === true,
		scenario,
		preview,
		providerCode,
		providerMessage,
	};
};

const autumnCheckAction = makeFunctionReference<
	"action",
	{
		featureId: BillableFeatureId;
		sendEvent: boolean;
		withPreview: boolean;
	},
	unknown
>("autumn:check");

const autumnTrackAction = makeFunctionReference<
	"action",
	{
		featureId: BillableFeatureId;
		value: number;
		idempotencyKey: string;
	},
	unknown
>("autumn:track");

const isMockModeAllowAll = () => getBillingMode() === "allow_all";
const isMockModeTrackFail = () => getBillingMode() === "track_fail";
const isMockModeBypassCheck = () => isMockModeAllowAll() || isMockModeTrackFail();

const isMockModeDenied = (featureId: BillableFeatureId) => {
	const mode = getBillingMode();
	return mode === `deny_${featureId}`;
};

const nowMs = () => Date.now();

const reservationReturnValidator = v.object({
	id: v.id("billingReservations"),
	status: v.union(
		v.literal("reserved"),
		v.literal("committed"),
		v.literal("rolled_back"),
		v.literal("rollback_failed"),
	),
	entityId: v.optional(v.string()),
});

export async function assertFeatureAvailable(ctx: ActionCtx, featureId: BillableFeatureId) {
	if (isMockModeBypassCheck()) {
		return { allowed: true as const };
	}
	if (isMockModeDenied(featureId)) {
		throw featureLimitError({ featureId, scenario: "mock_deny" });
	}

	const checkResult = await ctx.runAction(autumnCheckAction, {
		featureId,
		sendEvent: false,
		withPreview: true,
	});
	const outcome = parseCheckOutcome(checkResult);
	if (outcome.providerCode || outcome.providerMessage) {
		throw billingCheckFailedError({
			featureId,
			providerCode: outcome.providerCode,
		});
	}
	if (!outcome.allowed) {
		throw featureLimitError({
			featureId,
			scenario: outcome.scenario,
			preview: outcome.preview,
		});
	}
	return outcome;
}

export async function trackFeatureUsage(
	ctx: ActionCtx,
	args: { featureId: BillableFeatureId; operationKey: string },
) {
	if (isMockModeAllowAll()) return;
	if (isMockModeTrackFail()) {
		throw new Error("Mock billing track failure");
	}
	if (isMockModeDenied(args.featureId)) {
		return;
	}

	await ctx.runAction(autumnTrackAction, {
		featureId: args.featureId,
		value: 1,
		idempotencyKey: args.operationKey,
	});
}

export async function startFeatureReservation(
	ctx: ActionCtx,
	args: {
		operationKey: string;
		userId: string;
		featureId: BillableFeatureId;
		entityType: BillableEntityType;
		entityId?: string;
	},
) {
	return ctx.runMutation(internal.billing.internalStartFeatureReservation, args);
}

export async function commitFeatureReservation(
	ctx: ActionCtx,
	args: { operationKey: string; entityId?: string },
) {
	return ctx.runMutation(internal.billing.internalCommitFeatureReservation, args);
}

export async function rollbackFeatureReservation(
	ctx: ActionCtx,
	args: {
		operationKey: string;
		error?: string;
		status?: "rolled_back" | "rollback_failed";
	},
) {
	return ctx.runMutation(internal.billing.internalRollbackFeatureReservation, args);
}

export async function acquireFeatureLock(
	ctx: ActionCtx,
	args: {
		userId: string;
		featureId: BillableFeatureId;
		lockToken: string;
		ttlMs?: number;
	},
) {
	return ctx.runMutation(internal.billing.internalAcquireFeatureLock, args);
}

export async function releaseFeatureLock(
	ctx: ActionCtx,
	args: { userId: string; featureId: BillableFeatureId; lockToken: string },
) {
	return ctx.runMutation(internal.billing.internalReleaseFeatureLock, args);
}

export const internalAcquireFeatureLock = internalMutation({
	args: {
		userId: v.string(),
		featureId: v.union(v.literal("tasks"), v.literal("habits")),
		lockToken: v.string(),
		ttlMs: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = nowMs();
		const ttlMs = Math.max(1_000, args.ttlMs ?? BILLING_LOCK_TTL_MS);
		const nextExpiresAt = now + ttlMs;
		const locks = await ctx.db
			.query("billingLocks")
			.withIndex("by_userId_featureId", (q) =>
				q.eq("userId", args.userId).eq("featureId", args.featureId),
			)
			.collect();
		const activeLock = locks.find((lock) => lock.expiresAt > now);
		if (activeLock && activeLock.lockToken !== args.lockToken) {
			throw billingLockedError(args.featureId);
		}

		const sortedLocks = [...locks].sort((a, b) => {
			if (a._creationTime !== b._creationTime) {
				return a._creationTime - b._creationTime;
			}
			return String(a._id).localeCompare(String(b._id));
		});
		const [primaryLock, ...duplicateLocks] = sortedLocks;
		if (primaryLock) {
			await ctx.db.patch(primaryLock._id, {
				lockToken: args.lockToken,
				expiresAt: nextExpiresAt,
				updatedAt: now,
			});
			for (const duplicateLock of duplicateLocks) {
				await ctx.db.delete(duplicateLock._id);
			}
			return null;
		}

		await ctx.db.insert("billingLocks", {
			userId: args.userId,
			featureId: args.featureId,
			lockToken: args.lockToken,
			expiresAt: nextExpiresAt,
			updatedAt: now,
		});
		return null;
	},
});

export const internalReleaseFeatureLock = internalMutation({
	args: {
		userId: v.string(),
		featureId: v.union(v.literal("tasks"), v.literal("habits")),
		lockToken: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const locks = await ctx.db
			.query("billingLocks")
			.withIndex("by_userId_featureId", (q) =>
				q.eq("userId", args.userId).eq("featureId", args.featureId),
			)
			.collect();
		for (const lock of locks) {
			if (lock.lockToken !== args.lockToken) continue;
			await ctx.db.delete(lock._id);
		}
		return null;
	},
});

export const internalStartFeatureReservation = internalMutation({
	args: {
		operationKey: v.string(),
		userId: v.string(),
		featureId: v.union(v.literal("tasks"), v.literal("habits")),
		entityType: v.union(v.literal("task"), v.literal("habit")),
		entityId: v.optional(v.string()),
	},
	returns: reservationReturnValidator,
	handler: async (ctx, args) => {
		const now = nowMs();
		const existing = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();

		if (existing) {
			if (args.entityId && existing.entityId !== args.entityId) {
				await ctx.db.patch(existing._id, {
					entityId: args.entityId,
					updatedAt: now,
				});
			}
			return {
				id: existing._id,
				status: existing.status,
				entityId: args.entityId ?? existing.entityId,
			};
		}

		const id = await ctx.db.insert("billingReservations", {
			operationKey: args.operationKey,
			userId: args.userId,
			featureId: args.featureId,
			entityType: args.entityType,
			entityId: args.entityId,
			status: "reserved",
			createdAt: now,
			updatedAt: now,
			error: undefined,
		});
		return {
			id,
			status: "reserved" as const,
			entityId: args.entityId,
		};
	},
});

export const internalCommitFeatureReservation = internalMutation({
	args: {
		operationKey: v.string(),
		entityId: v.optional(v.string()),
	},
	returns: reservationReturnValidator,
	handler: async (ctx, args) => {
		const now = nowMs();
		const existing = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (!existing) {
			throw new ConvexError({
				code: "RESERVATION_NOT_FOUND",
				message: "Billing reservation not found.",
			});
		}

		await ctx.db.patch(existing._id, {
			status: "committed",
			entityId: args.entityId ?? existing.entityId,
			updatedAt: now,
			error: undefined,
		});
		return {
			id: existing._id,
			status: "committed" as const,
			entityId: args.entityId ?? existing.entityId,
		};
	},
});

export const internalRollbackFeatureReservation = internalMutation({
	args: {
		operationKey: v.string(),
		error: v.optional(v.string()),
		status: v.optional(v.union(v.literal("rolled_back"), v.literal("rollback_failed"))),
	},
	returns: reservationReturnValidator,
	handler: async (ctx, args) => {
		const now = nowMs();
		const existing = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (!existing) {
			throw new ConvexError({
				code: "RESERVATION_NOT_FOUND",
				message: "Billing reservation not found.",
			});
		}

		const nextStatus = args.status ?? "rolled_back";
		await ctx.db.patch(existing._id, {
			status: nextStatus,
			error: args.error,
			updatedAt: now,
		});
		return {
			id: existing._id,
			status: nextStatus,
			entityId: existing.entityId,
		};
	},
});

export const internalGetReservationByOperationKey = internalQuery({
	args: {
		operationKey: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			id: v.id("billingReservations"),
			status: v.union(
				v.literal("reserved"),
				v.literal("committed"),
				v.literal("rolled_back"),
				v.literal("rollback_failed"),
			),
			entityId: v.optional(v.string()),
			entityType: v.union(v.literal("task"), v.literal("habit")),
			userId: v.string(),
			featureId: v.union(v.literal("tasks"), v.literal("habits")),
		}),
	),
	handler: async (ctx, args) => {
		const reservation = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (!reservation) return null;
		return {
			id: reservation._id,
			status: reservation.status,
			entityId: reservation.entityId,
			entityType: reservation.entityType,
			userId: reservation.userId,
			featureId: reservation.featureId,
		};
	},
});

export const internalSetReservationEntity = internalMutation({
	args: {
		operationKey: v.string(),
		entityId: v.string(),
	},
	returns: reservationReturnValidator,
	handler: async (ctx, args) => {
		const now = nowMs();
		const reservation = await ctx.db
			.query("billingReservations")
			.withIndex("by_operationKey", (q) => q.eq("operationKey", args.operationKey))
			.unique();
		if (!reservation) {
			throw new ConvexError({
				code: "RESERVATION_NOT_FOUND",
				message: "Billing reservation not found.",
			});
		}

		await ctx.db.patch(reservation._id, {
			entityId: args.entityId,
			updatedAt: now,
		});
		return {
			id: reservation._id,
			status: reservation.status,
			entityId: args.entityId,
		};
	},
});

export const buildOperationKey = ({
	userId,
	featureId,
	requestId,
}: {
	userId: string;
	featureId: BillableFeatureId;
	requestId: string;
}) => `${featureId}:${userId}:${requestId}`;

export const makeBillingLockToken = (operationKey: string) =>
	`${operationKey}:${Math.random().toString(36).slice(2, 10)}`;

export const isReservationTerminal = (reservation: Doc<"billingReservations">) =>
	reservation.status === "committed" ||
	reservation.status === "rolled_back" ||
	reservation.status === "rollback_failed";
