import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

const GOOGLE_CALENDAR_COLORS = [
	"#f59e0b", // amber/gold - 1
	"#ef4444", // red - 2
	"#22c55e", // green - 3
	"#0ea5e9", // sky blue - 4
	"#6366f1", // indigo - 5
	"#a855f7", // purple - 6
	"#ec4899", // pink - 7
	"#14b8a6", // teal - 8
] as const;

type GoogleCalendarColor = (typeof GOOGLE_CALENDAR_COLORS)[number];

// Helper to ensure default categories exist
async function ensureDefaultCategories(
	ctx: MutationCtx,
	userId: string,
): Promise<{ personalId: string; travelId: string }> {
	const existing = await ctx.db
		.query("taskCategories")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	if (existing.length > 0) {
		const personal = existing.find((c) => c.name === "Personal");
		const travel = existing.find((c) => c.name === "Travel");
		if (personal && travel) {
			return { personalId: personal._id, travelId: travel._id };
		}
	}

	const now = Date.now();

	const personalId = await ctx.db.insert("taskCategories", {
		userId,
		name: "Personal",
		description: "Your personal tasks and habits",
		color: GOOGLE_CALENDAR_COLORS[0],
		isSystem: true,
		isDefault: true,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
	});

	const travelId = await ctx.db.insert("taskCategories", {
		userId,
		name: "Travel",
		description: "Flights, travel, and buffer time",
		color: GOOGLE_CALENDAR_COLORS[7],
		isSystem: true,
		isDefault: false,
		sortOrder: 1,
		createdAt: now,
		updatedAt: now,
	});

	return { personalId, travelId };
}

// Helper to find least used color
async function getLeastUsedColor(ctx: MutationCtx, userId: string): Promise<GoogleCalendarColor> {
	const categories = await ctx.db
		.query("taskCategories")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	const colorCounts = new Map<GoogleCalendarColor, number>();
	for (const color of GOOGLE_CALENDAR_COLORS) {
		colorCounts.set(color, 0);
	}

	for (const category of categories) {
		const color = category.color as GoogleCalendarColor;
		const count = colorCounts.get(color) ?? 0;
		colorCounts.set(color, count + 1);
	}

	let leastUsedColor: GoogleCalendarColor = GOOGLE_CALENDAR_COLORS[0];
	let minCount = Number.POSITIVE_INFINITY;

	for (const [color, count] of colorCounts) {
		if (count < minCount) {
			minCount = count;
			leastUsedColor = color;
		}
	}

	return leastUsedColor;
}

// Queries
export const getCategories = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("taskCategories"),
			userId: v.string(),
			name: v.string(),
			description: v.optional(v.string()),
			color: v.string(),
			isSystem: v.boolean(),
			isDefault: v.boolean(),
			sortOrder: v.number(),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, _args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError({
				code: "UNAUTHORIZED",
				message: "Not authenticated",
			});
		}
		const userId = identity.subject;

		return await ctx.db
			.query("taskCategories")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.order("asc")
			.collect();
	},
});

export const getDefaultCategory = query({
	args: {},
	returns: v.union(
		v.object({
			_id: v.id("taskCategories"),
			userId: v.string(),
			name: v.string(),
			description: v.optional(v.string()),
			color: v.string(),
			isSystem: v.boolean(),
			isDefault: v.boolean(),
			sortOrder: v.number(),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, _args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		return await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) => q.eq("userId", userId).eq("isDefault", true))
			.first();
	},
});

export const getCategoryById = query({
	args: { categoryId: v.id("taskCategories") },
	returns: v.union(
		v.object({
			_id: v.id("taskCategories"),
			userId: v.string(),
			name: v.string(),
			description: v.optional(v.string()),
			color: v.string(),
			isSystem: v.boolean(),
			isDefault: v.boolean(),
			sortOrder: v.number(),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== userId) return null;

		return category;
	},
});

// Mutations
export const createCategory = mutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	returns: v.id("taskCategories"),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError({
				code: "UNAUTHORIZED",
				message: "Not authenticated",
			});
		}
		const userId = identity.subject;

		// Check for duplicate name
		const existing = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_name", (q) => q.eq("userId", userId).eq("name", args.name))
			.first();

		if (existing) {
			throw new ConvexError({
				code: "DUPLICATE_NAME",
				message: "A category with this name already exists",
			});
		}

		// Auto-assign least used color
		const assignedColor: GoogleCalendarColor =
			(args.color as GoogleCalendarColor) || (await getLeastUsedColor(ctx, userId));

		const categories = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();

		const now = Date.now();
		const categoryId = await ctx.db.insert("taskCategories", {
			userId,
			name: args.name,
			description: args.description,
			color: assignedColor,
			isSystem: false,
			isDefault: false,
			sortOrder: categories.length,
			createdAt: now,
			updatedAt: now,
		});

		return categoryId;
	},
});

export const updateCategory = mutation({
	args: {
		categoryId: v.id("taskCategories"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError({
				code: "UNAUTHORIZED",
				message: "Not authenticated",
			});
		}
		const userId = identity.subject;

		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Category not found",
			});
		}

		// Don't allow name changes for system categories
		if (category.isSystem && args.name && args.name !== category.name) {
			throw new ConvexError({
				code: "SYSTEM_CATEGORY",
				message: "Cannot rename system categories",
			});
		}

		// Check for duplicate name if changing name
		const newName = args.name;
		if (newName && newName !== category.name) {
			const existing = await ctx.db
				.query("taskCategories")
				.withIndex("by_userId_name", (q) => q.eq("userId", userId).eq("name", newName))
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

		// If color changed, cascade to tasks that don't have manual override
		if (args.color && args.color !== category.color) {
			const tasks = await ctx.db
				.query("tasks")
				.withIndex("by_userId_categoryId", (q) =>
					q.eq("userId", userId).eq("categoryId", args.categoryId),
				)
				.collect();

			for (const task of tasks) {
				// Only update if no manual override (color matches old category color or is undefined)
				if (!task.color || task.color === category.color) {
					await ctx.db.patch(task._id, { color: args.color });
				}
			}

			// Also update habits
			const habits = await ctx.db
				.query("habits")
				.withIndex("by_userId_categoryId", (q) =>
					q.eq("userId", userId).eq("categoryId", args.categoryId),
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
});

export const deleteCategory = mutation({
	args: { categoryId: v.id("taskCategories") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError({
				code: "UNAUTHORIZED",
				message: "Not authenticated",
			});
		}
		const userId = identity.subject;

		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Category not found",
			});
		}

		// Prevent deleting system categories
		if (category.isSystem) {
			throw new ConvexError({
				code: "SYSTEM_CATEGORY",
				message: "Cannot delete system categories",
			});
		}

		// Get default category for reassignment
		const defaultCategory = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) => q.eq("userId", userId).eq("isDefault", true))
			.first();

		if (!defaultCategory) {
			throw new ConvexError({
				code: "NO_DEFAULT",
				message: "No default category found",
			});
		}

		// Reassign all tasks to default category
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_userId_categoryId", (q) =>
				q.eq("userId", userId).eq("categoryId", args.categoryId),
			)
			.collect();

		for (const task of tasks) {
			await ctx.db.patch(task._id, {
				categoryId: defaultCategory._id,
				color: defaultCategory.color,
			});
		}

		// Reassign all habits to default category
		const habits = await ctx.db
			.query("habits")
			.withIndex("by_userId_categoryId", (q) =>
				q.eq("userId", userId).eq("categoryId", args.categoryId),
			)
			.collect();

		for (const habit of habits) {
			await ctx.db.patch(habit._id, {
				categoryId: defaultCategory._id,
				color: defaultCategory.color,
			});
		}

		// Delete the category
		await ctx.db.delete(args.categoryId);

		return null;
	},
});

export const setDefaultCategory = mutation({
	args: { categoryId: v.id("taskCategories") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError({
				code: "UNAUTHORIZED",
				message: "Not authenticated",
			});
		}
		const userId = identity.subject;

		const category = await ctx.db.get(args.categoryId);
		if (!category || category.userId !== userId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Category not found",
			});
		}

		// Unset current default
		const currentDefault = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) => q.eq("userId", userId).eq("isDefault", true))
			.first();

		if (currentDefault) {
			await ctx.db.patch(currentDefault._id, {
				isDefault: false,
				updatedAt: Date.now(),
			});
		}

		// Set new default
		await ctx.db.patch(args.categoryId, {
			isDefault: true,
			updatedAt: Date.now(),
		});

		return null;
	},
});
