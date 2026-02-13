import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";

const feedbackCategoryValidator = v.union(
	v.literal("bug"),
	v.literal("idea"),
	v.literal("general"),
);

export const createFeedback = mutation({
	args: {
		category: feedbackCategoryValidator,
		subject: v.optional(v.string()),
		message: v.string(),
		page: v.optional(v.string()),
		timezone: v.optional(v.string()),
		userAgent: v.optional(v.string()),
	},
	returns: v.id("feedback"),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		const now = Date.now();
		const message = args.message.trim();
		if (!message) {
			throw new ConvexError({
				code: "INVALID_FEEDBACK",
				message: "Feedback message cannot be empty.",
			});
		}
		const subject = args.subject?.trim();

		return ctx.db.insert("feedback", {
			userId: identity?.subject,
			category: args.category,
			subject: subject && subject.length > 0 ? subject : undefined,
			message,
			page: args.page?.trim() || undefined,
			timezone: args.timezone?.trim() || undefined,
			userAgent: args.userAgent?.trim() || undefined,
			status: "new",
			createdAt: now,
			updatedAt: now,
		});
	},
});
