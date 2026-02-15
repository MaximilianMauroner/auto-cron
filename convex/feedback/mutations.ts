import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";

const feedbackCategoryValidator = v.union(
	v.literal("bug"),
	v.literal("idea"),
	v.literal("general"),
);

const FEEDBACK_RATE_WINDOW_MS = 60 * 1000;
const FEEDBACK_RATE_LIMIT_PER_WINDOW = 3;
const FEEDBACK_MAX_SUBJECT_LENGTH = 120;
const FEEDBACK_MAX_MESSAGE_LENGTH = 2000;

export const createFeedback = mutation({
	args: {
		category: feedbackCategoryValidator,
		subject: v.optional(v.string()),
		message: v.string(),
		fingerprint: v.optional(v.string()),
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
		if (message.length > FEEDBACK_MAX_MESSAGE_LENGTH) {
			throw new ConvexError({
				code: "INVALID_FEEDBACK",
				message: `Feedback message cannot exceed ${FEEDBACK_MAX_MESSAGE_LENGTH} characters.`,
			});
		}
		const subject = args.subject?.trim();
		if (subject && subject.length > FEEDBACK_MAX_SUBJECT_LENGTH) {
			throw new ConvexError({
				code: "INVALID_FEEDBACK",
				message: `Feedback subject cannot exceed ${FEEDBACK_MAX_SUBJECT_LENGTH} characters.`,
			});
		}

		const fingerprint = args.fingerprint?.trim();
		if (!identity?.subject && (!fingerprint || fingerprint.length < 8)) {
			throw new ConvexError({
				code: "INVALID_FEEDBACK",
				message: "Anonymous feedback requires a valid client fingerprint.",
			});
		}

		const windowStart = now - FEEDBACK_RATE_WINDOW_MS;
		if (identity?.subject) {
			const recentByUser = await ctx.db
				.query("feedback")
				.withIndex("by_userId_createdAt", (q) =>
					q.eq("userId", identity.subject).gte("createdAt", windowStart),
				)
				.collect();
			if (recentByUser.length >= FEEDBACK_RATE_LIMIT_PER_WINDOW) {
				throw new ConvexError({
					code: "RATE_LIMITED",
					message: "Too many feedback submissions. Please wait one minute.",
				});
			}
		} else if (fingerprint) {
			const recentByFingerprint = await ctx.db
				.query("feedback")
				.withIndex("by_fingerprint_createdAt", (q) =>
					q.eq("fingerprint", fingerprint).gte("createdAt", windowStart),
				)
				.collect();
			if (recentByFingerprint.length >= FEEDBACK_RATE_LIMIT_PER_WINDOW) {
				throw new ConvexError({
					code: "RATE_LIMITED",
					message: "Too many feedback submissions. Please wait one minute.",
				});
			}
		}

		return ctx.db.insert("feedback", {
			userId: identity?.subject,
			fingerprint: identity?.subject ? undefined : fingerprint,
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
