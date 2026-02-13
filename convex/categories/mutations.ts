import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { withMutationAuth } from "../auth";
import type { GoogleCalendarColor } from "./shared";
import { getLeastUsedColor } from "./shared";

export const createCategory = mutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	returns: v.id("taskCategories"),
	handler: withMutationAuth(
		async (ctx, args: { name: string; description?: string; color?: string }) => {
			const existing = await ctx.db
				.query("taskCategories")
				.withIndex("by_userId_name", (q) => q.eq("userId", ctx.userId).eq("name", args.name))
				.first();

			if (existing) {
				throw new ConvexError({
					code: "DUPLICATE_NAME",
					message: "A category with this name already exists",
				});
			}

			const assignedColor: GoogleCalendarColor =
				(args.color as GoogleCalendarColor) || (await getLeastUsedColor(ctx, ctx.userId));

			const categories = await ctx.db
				.query("taskCategories")
				.withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
				.collect();

			const now = Date.now();
			return await ctx.db.insert("taskCategories", {
				userId: ctx.userId,
				name: args.name,
				description: args.description,
				color: assignedColor,
				isSystem: false,
				isDefault: false,
				sortOrder: categories.length,
				createdAt: now,
				updatedAt: now,
			});
		},
	),
});

export const updateCategory = mutation({
	args: {
		categoryId: v.id("taskCategories"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	returns: v.null(),
	handler: withMutationAuth(
		async (
			ctx,
			args: {
				categoryId: Id<"taskCategories">;
				name?: string;
				description?: string;
				color?: string;
			},
		) => {
			const category = await ctx.db.get(args.categoryId);
			if (!category || category.userId !== ctx.userId) {
				throw new ConvexError({ code: "NOT_FOUND", message: "Category not found" });
			}

			if (category.isSystem && args.name && args.name !== category.name) {
				throw new ConvexError({
					code: "SYSTEM_CATEGORY",
					message: "Cannot rename system categories",
				});
			}

			const newName = args.name;
			if (newName && newName !== category.name) {
				const existing = await ctx.db
					.query("taskCategories")
					.withIndex("by_userId_name", (q) => q.eq("userId", ctx.userId).eq("name", newName))
					.first();

				if (existing) {
					throw new ConvexError({
						code: "DUPLICATE_NAME",
						message: "A category with this name already exists",
					});
				}
			}

			const updates: {
				updatedAt: number;
				name?: string;
				description?: string;
				color?: string;
			} = { updatedAt: Date.now() };
			if (args.name !== undefined) updates.name = args.name;
			if (args.description !== undefined) updates.description = args.description;
			if (args.color !== undefined) updates.color = args.color;

			await ctx.db.patch(args.categoryId, updates);

			if (args.color && args.color !== category.color) {
				const tasks = await ctx.db
					.query("tasks")
					.withIndex("by_userId_categoryId", (q) =>
						q.eq("userId", ctx.userId).eq("categoryId", args.categoryId),
					)
					.collect();

				for (const task of tasks) {
					if (!task.color || task.color === category.color) {
						await ctx.db.patch(task._id, { color: args.color });
					}
				}

				const habits = await ctx.db
					.query("habits")
					.withIndex("by_userId_categoryId", (q) =>
						q.eq("userId", ctx.userId).eq("categoryId", args.categoryId),
					)
					.collect();

				for (const habit of habits) {
					if (!habit.color || habit.color === category.color) {
						await ctx.db.patch(habit._id, { color: args.color });
					}
				}
			}

			return null;
		},
	),
});

export const deleteCategory = mutation({
	args: { categoryId: v.id("taskCategories") },
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: { categoryId: Id<"taskCategories"> }) => {
		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== ctx.userId) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Category not found" });
		}

		if (category.isSystem) {
			throw new ConvexError({
				code: "SYSTEM_CATEGORY",
				message: "Cannot delete system categories",
			});
		}

		const defaultCategory = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) => q.eq("userId", ctx.userId).eq("isDefault", true))
			.first();

		if (!defaultCategory) {
			throw new ConvexError({ code: "NO_DEFAULT", message: "No default category found" });
		}

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId_categoryId", (q) =>
				q.eq("userId", ctx.userId).eq("categoryId", args.categoryId),
			)
			.collect();

		for (const task of tasks) {
			await ctx.db.patch(task._id, {
				categoryId: defaultCategory._id,
				color: defaultCategory.color,
			});
		}

		const habits = await ctx.db
			.query("habits")
			.withIndex("by_userId_categoryId", (q) =>
				q.eq("userId", ctx.userId).eq("categoryId", args.categoryId),
			)
			.collect();

		for (const habit of habits) {
			await ctx.db.patch(habit._id, {
				categoryId: defaultCategory._id,
				color: defaultCategory.color,
			});
		}

		await ctx.db.delete(args.categoryId);
		return null;
	}),
});

export const setDefaultCategory = mutation({
	args: { categoryId: v.id("taskCategories") },
	returns: v.null(),
	handler: withMutationAuth(async (ctx, args: { categoryId: Id<"taskCategories"> }) => {
		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== ctx.userId) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Category not found" });
		}

		const currentDefault = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) => q.eq("userId", ctx.userId).eq("isDefault", true))
			.first();

		if (currentDefault) {
			await ctx.db.patch(currentDefault._id, {
				isDefault: false,
				updatedAt: Date.now(),
			});
		}

		await ctx.db.patch(args.categoryId, {
			isDefault: true,
			updatedAt: Date.now(),
		});

		return null;
	}),
});
