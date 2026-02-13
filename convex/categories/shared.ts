import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const GOOGLE_CALENDAR_COLORS = [
	"#f59e0b", // amber/gold - 1
	"#ef4444", // red - 2
	"#22c55e", // green - 3
	"#0ea5e9", // sky blue - 4
	"#6366f1", // indigo - 5
	"#a855f7", // purple - 6
	"#ec4899", // pink - 7
	"#14b8a6", // teal - 8
] as const;

export type GoogleCalendarColor = (typeof GOOGLE_CALENDAR_COLORS)[number];

export const categoryDtoValidator = v.object({
	_id: v.id("taskCategories"),
	_creationTime: v.number(),
	userId: v.string(),
	name: v.string(),
	description: v.optional(v.string()),
	color: v.string(),
	isSystem: v.boolean(),
	isDefault: v.boolean(),
	sortOrder: v.number(),
	createdAt: v.number(),
	updatedAt: v.number(),
});

type DbCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

export async function ensureDefaultCategories(
	ctx: Pick<MutationCtx, "db">,
	userId: string,
): Promise<{ personalId: Id<"taskCategories">; travelId: Id<"taskCategories"> }> {
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

export async function getLeastUsedColor(
	ctx: Pick<MutationCtx, "db">,
	userId: string,
): Promise<GoogleCalendarColor> {
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

export async function ensureCategoryOwnership(
	ctx: DbCtx,
	categoryId: Id<"taskCategories"> | undefined,
	userId: string,
) {
	if (!categoryId) return null;
	const category = await ctx.db.get(categoryId);
	if (!category || category.userId !== userId) {
		throw new ConvexError({
			code: "INVALID_CATEGORY",
			message: "The selected category does not exist.",
		});
	}
	return category;
}
