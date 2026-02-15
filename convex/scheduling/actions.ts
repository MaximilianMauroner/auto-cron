"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import { withActionAuth } from "../auth";
import { solveSchedule } from "./solver";

const triggerValidator = v.union(
	v.literal("manual"),
	v.literal("task_change"),
	v.literal("habit_change"),
	v.literal("hours_change"),
	v.literal("calendar_change"),
	v.literal("cron"),
);

const getErrorCode = (error: unknown): string | undefined => {
	if (!error || typeof error !== "object") return undefined;
	const maybeData = (error as { data?: unknown }).data;
	if (maybeData && typeof maybeData === "object") {
		const code = (maybeData as { code?: unknown }).code;
		if (typeof code === "string") return code;
	}
	const message = (error as { message?: unknown }).message;
	if (typeof message === "string") {
		try {
			const parsed = JSON.parse(message) as { code?: unknown };
			return typeof parsed.code === "string" ? parsed.code : undefined;
		} catch {
			return undefined;
		}
	}
	return undefined;
};

export const runForUser: ReturnType<typeof internalAction> = internalAction({
	args: {
		runId: v.id("schedulingRuns"),
		userId: v.string(),
		triggeredBy: triggerValidator,
	},
	returns: v.object({
		runId: v.id("schedulingRuns"),
		status: v.union(v.literal("completed"), v.literal("failed")),
		reasonCode: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.scheduling.mutations.markRunRunning, {
			runId: args.runId,
		});
		const isSupersededAtStart = await ctx.runQuery(internal.scheduling.queries.isRunSuperseded, {
			runId: args.runId,
			userId: args.userId,
		});
		if (isSupersededAtStart) {
			await ctx.runMutation(internal.scheduling.mutations.failRun, {
				runId: args.runId,
				error: "Run superseded by a newer queued run.",
				reasonCode: "SUPERSEDED_BY_NEWER_RUN",
			});
			return {
				runId: args.runId,
				status: "failed" as const,
				reasonCode: "SUPERSEDED_BY_NEWER_RUN",
			};
		}

		try {
			await ctx.runMutation(internal.hours.mutations.internalBootstrapHoursSetsForUser, {
				userId: args.userId,
			});
			await ctx.runMutation(internal.hours.mutations.internalMigrateSchedulingModelForUser, {
				userId: args.userId,
			});
			const input = await ctx.runQuery(internal.scheduling.queries.getSchedulingInputForUser, {
				userId: args.userId,
				now: Date.now(),
			});
			const solved = solveSchedule(input);

			if (!solved.feasibleHard) {
				await ctx.runMutation(internal.scheduling.mutations.failRun, {
					runId: args.runId,
					error: "Scheduling infeasible under hard constraints.",
					reasonCode: solved.reasonCode,
					feasibleOnTime: solved.feasibleOnTime,
					horizonStart: solved.horizonStart,
					horizonEnd: solved.horizonEnd,
				});
				return {
					runId: args.runId,
					status: "failed" as const,
					reasonCode: solved.reasonCode,
				};
			}

			const applied = await ctx.runMutation(internal.scheduling.mutations.applySchedulingBlocks, {
				runId: args.runId,
				userId: args.userId,
				horizonStart: solved.horizonStart,
				horizonEnd: solved.horizonEnd,
				blocks: solved.blocks,
			});

			await ctx.runMutation(internal.scheduling.mutations.completeRun, {
				runId: args.runId,
				tasksScheduled: applied.tasksScheduled,
				habitsScheduled: applied.habitsScheduled,
				feasibleOnTime: solved.feasibleOnTime,
				horizonStart: solved.horizonStart,
				horizonEnd: solved.horizonEnd,
				objectiveScore: solved.objectiveScore,
				lateTasks: solved.lateTasks,
				habitShortfalls: solved.habitShortfalls,
				dropSummary: solved.droppedHabits,
				reasonCode: solved.reasonCode,
			});

			if (applied.scheduledEventsChanged || applied.removedGoogleEvents.length > 0) {
				try {
					await ctx.runAction(internal.calendar.actions.syncScheduledBlocksToGoogle, {
						userId: args.userId,
						horizonStart: solved.horizonStart,
						horizonEnd: solved.horizonEnd,
						removedGoogleEvents: applied.removedGoogleEvents,
					});
				} catch (syncError) {
					console.error("[scheduling] post-run Google sync failed", {
						userId: args.userId,
						runId: args.runId,
						error: syncError instanceof Error ? syncError.message : syncError,
					});
				}
			}

			return {
				runId: args.runId,
				status: "completed" as const,
				reasonCode: solved.reasonCode,
			};
		} catch (error) {
			const errorCode = getErrorCode(error);
			const message = error instanceof Error ? error.message : "Scheduler run failed.";
			await ctx.runMutation(internal.scheduling.mutations.failRun, {
				runId: args.runId,
				error: message,
				reasonCode: errorCode === "SUPERSEDED_BY_NEWER_RUN" ? errorCode : undefined,
			});
			return {
				runId: args.runId,
				status: "failed" as const,
				reasonCode: errorCode === "SUPERSEDED_BY_NEWER_RUN" ? errorCode : "RUN_ERROR",
			};
		}
	},
});

export const runNow: ReturnType<typeof action> = action({
	args: {},
	returns: v.object({
		runId: v.id("schedulingRuns"),
		enqueued: v.boolean(),
	}),
	handler: withActionAuth(
		async (ctx): Promise<{ runId: Id<"schedulingRuns">; enqueued: boolean }> => {
			const queued = await ctx.runMutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId: ctx.userId,
				triggeredBy: "manual",
			});
			return {
				runId: queued.runId,
				enqueued: queued.enqueued,
			};
		},
	),
});
