import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { shouldDispatchBackgroundWork } from "../runtime";
import { DEBOUNCE_WINDOW_MS } from "./constants";
import { isRunNewer } from "./run_order";
import type { TriggeredBy } from "./types";

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
	// Additional debounce below rate-limits repeated enqueue triggers while a run is running.
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

	const running = await ctx.db
		.query("schedulingRuns")
		.withIndex("by_userId_status_startedAt", (q) => q.eq("userId", userId).eq("status", "running"))
		.collect();
	const latestRunning = running.reduce<(typeof running)[number] | undefined>((latest, run) => {
		if (!latest) return run;
		return isRunNewer(run, latest) ? run : latest;
	}, undefined);
	if (
		latestRunning &&
		latestRunning.triggeredBy === triggeredBy &&
		now - latestRunning.startedAt < DEBOUNCE_WINDOW_MS &&
		!force
	) {
		return {
			enqueued: false,
			runId: latestRunning._id,
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

	if (shouldDispatchBackgroundWork()) {
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
