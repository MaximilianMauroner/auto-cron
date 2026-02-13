import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { DEBOUNCE_WINDOW_MS } from "./constants";
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

	// We only need to know if *any* pending run exists to avoid creating a duplicate.
	// The exact run returned doesn't matter — callers just get "already pending, reuse this ID".
	const latestPending = (
		await ctx.db
			.query("schedulingRuns")
			.withIndex("by_userId_status_startedAt", (q) =>
				q.eq("userId", userId).eq("status", "pending"),
			)
			.order("desc")
			.take(1)
	)[0];

	// Keep at most one pending run per user.
	// Additional debounce below rate-limits repeated enqueue triggers while a run is running.
	if (latestPending && !force) {
		return {
			enqueued: false,
			runId: latestPending._id,
		};
	}

	const runningWithinDebounce = await ctx.db
		.query("schedulingRuns")
		.withIndex("by_userId_status_startedAt", (q) =>
			q
				.eq("userId", userId)
				.eq("status", "running")
				.gte("startedAt", now - DEBOUNCE_WINDOW_MS),
		)
		.collect();
	const latestRunning = runningWithinDebounce.reduce<
		(typeof runningWithinDebounce)[number] | undefined
	>((latest, run) => {
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
