import { v } from "convex/values";
import { query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import { categoryDtoValidator } from "./shared";

export const getCategories = query({
	args: {},
	returns: v.array(categoryDtoValidator),
	handler: withQueryAuth(async (ctx) => {
		return await ctx.db
			.query("taskCategories")
			.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
			.order("asc")
			.collect();
	}),
});

export const getDefaultCategory = query({
	args: {},
	returns: v.union(categoryDtoValidator, v.null()),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;

		return await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) =>
				q.eq("userId", identity.subject).eq("isDefault", true),
			)
			.first();
	},
});

export const getCategoryById = query({
	args: { categoryId: v.id("taskCategories") },
	returns: v.union(categoryDtoValidator, v.null()),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;

		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== identity.subject) return null;

		return category;
	},
});
