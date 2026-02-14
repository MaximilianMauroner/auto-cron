import { AuthKit } from "@convex-dev/workos-authkit";
import type { Auth } from "convex/server";
import { ConvexError } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { UnauthorizedError } from "./authTypes";

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit);
export type AuthenticatedContext<TContext> = TContext & { userId: string };

const unauthorizedError = () =>
	new ConvexError<UnauthorizedError>({
		code: "UNAUTHORIZED",
		message: "Authentication required.",
	});

/**
 * Validate JWT and return the userId (identity.subject).
 * Works in query, mutation, internalQuery, internalMutation, and action contexts.
 * Throws "Unauthorized" when no valid session exists.
 */
export async function requireAuth(ctx: { auth: Auth }): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw unauthorizedError();
	return identity.subject;
}

/**
 * Validate JWT + fetch the full WorkOS user record from the synced users table.
 * Requires a context with `runQuery` (query, mutation, or action — not httpAction).
 * Throws "Unauthorized" when no valid session exists.
 */
export async function requireAuthUser(ctx: Parameters<typeof authKit.getAuthUser>[0]) {
	const user = await authKit.getAuthUser(ctx);
	if (!user) throw unauthorizedError();
	return user;
}

const withAuthContext = async <TContext extends { auth: Auth }>(
	ctx: TContext,
): Promise<AuthenticatedContext<TContext>> => {
	const userId = await requireAuth(ctx);
	return { ...ctx, userId };
};

export const withQueryAuth = <TArgs, TResult>(
	handler: (ctx: AuthenticatedContext<QueryCtx>, args: TArgs) => Promise<TResult>,
) => {
	return async (ctx: QueryCtx, args: TArgs): Promise<TResult> => {
		const authenticatedCtx = await withAuthContext(ctx);
		return handler(authenticatedCtx, args);
	};
};

export const withMutationAuth = <TArgs, TResult>(
	handler: (ctx: AuthenticatedContext<MutationCtx>, args: TArgs) => Promise<TResult>,
) => {
	return async (ctx: MutationCtx, args: TArgs): Promise<TResult> => {
		const authenticatedCtx = await withAuthContext(ctx);
		return handler(authenticatedCtx, args);
	};
};

export const withActionAuth = <TArgs, TResult>(
	handler: (ctx: AuthenticatedContext<ActionCtx>, args: TArgs) => Promise<TResult>,
) => {
	return async (ctx: ActionCtx, args: TArgs): Promise<TResult> => {
		const authenticatedCtx = await withAuthContext(ctx);
		return handler(authenticatedCtx, args);
	};
};

export const { authKitEvent } = authKit.events({
	"user.created": async (ctx, event) => {
		await ctx.runMutation(internal.hours.mutations.internalBootstrapDefaultPlannerDataForUser, {
			userId: event.data.id,
		});

		const fullName = [event.data.firstName, event.data.lastName].filter(Boolean).join(" ");
		await ctx.scheduler.runAfter(0, internal.customers.createAutumnCustomer, {
			customerId: event.data.id,
			name: fullName || undefined,
			email: event.data.email ?? undefined,
		});
	},
	"user.deleted": async (ctx, event) => {
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", event.data.id))
			.unique();
		if (settings) {
			await ctx.db.delete(settings._id);
		}
	},
});
