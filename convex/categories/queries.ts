import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
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
	handler: withQueryAuth(async (ctx, _args: Record<string, never>) => {
		return await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) => q.eq("userId", ctx.userId).eq("isDefault", true))
			.first();
	}),
});

export const getCategoryById = query({
	args: { categoryId: v.id("taskCategories") },
	returns: v.union(categoryDtoValidator, v.null()),
	handler: withQueryAuth(async (ctx, args: { categoryId: Id<"taskCategories"> }) => {
		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== ctx.userId) return null;

		return category;
	}),
});
