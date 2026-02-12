import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isRunNewer } from "./run_order";
import type { TriggeredBy } from "./types";

const isTestRuntime = () => process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const enqueueSchedulingRunFromMutation = async (
	ctx: MutationCtx,
	{
		userId,
		triggeredBy,
		force,
	}: {
		userId: string;
		triggeredBy: TriggeredBy;
		force?: boolean;
	},
): Promise<{ enqueued: boolean; runId: Id<"schedulingRuns"> }> => {
	const now = Date.now();

	const pending = await ctx.db
		.query("schedulingRuns")
		.withIndex("by_userId_status_startedAt", (q) => q.eq("userId", userId).eq("status", "pending"))
		.collect();

	// Keep at most one pending run per user.
	// Follow-up runs are still allowed while one run is "running", but pending fanout is avoided.
	const latestPending = pending.reduce<(typeof pending)[number] | undefined>((latest, run) => {
		if (!latest) return run;
		return isRunNewer(run, latest) ? run : latest;
	}, undefined);
	if (latestPending && !force) {
		return {
			enqueued: false,
			runId: latestPending._id,
		};
	}

	const runId = await ctx.db.insert("schedulingRuns", {
		userId,
		triggeredBy,
		status: "pending",
		startedAt: now,
		tasksScheduled: 0,
		habitsScheduled: 0,
	});

	if (!isTestRuntime()) {
		await ctx.scheduler.runAfter(0, internal.scheduling.actions.runForUser, {
			runId,
			userId,
			triggeredBy,
		});
	}

	return {
		enqueued: true,
		runId,
	};
};
