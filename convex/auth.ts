import { AuthKit } from "@convex-dev/workos-authkit";
import type { Auth } from "convex/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit);

/**
 * Validate JWT and return the userId (identity.subject).
 * Works in query, mutation, internalQuery, internalMutation, and action contexts.
 * Throws "Unauthorized" when no valid session exists.
 */
export async function requireAuth(ctx: { auth: Auth }): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthorized");
	return identity.subject;
}

/**
 * Validate JWT + fetch the full WorkOS user record from the synced users table.
 * Requires a context with `runQuery` (query, mutation, or action — not httpAction).
 * Throws "Unauthorized" when no valid session exists.
 */
export async function requireAuthUser(ctx: Parameters<typeof authKit.getAuthUser>[0]) {
	const user = await authKit.getAuthUser(ctx);
	if (!user) throw new Error("Unauthorized");
	return user;
}

export const { authKitEvent } = authKit.events({
	"user.created": async (ctx, event) => {
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", event.data.id))
			.unique();
		if (existing) return;

		await ctx.db.insert("userSettings", {
			userId: event.data.id,
			timezone: "UTC",
			workingHoursStart: "09:00",
			workingHoursEnd: "17:00",
			workingDays: [1, 2, 3, 4, 5],
			schedulingHorizonDays: 7,
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
