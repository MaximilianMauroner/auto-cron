import { Crons } from "@convex-dev/crons";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const runtimeCrons = new Crons(components.crons);
const CALENDAR_SYNC_CRON_NAME = "calendar-sync-google";
const CALENDAR_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const CALENDAR_SYNC_ARGS = { limit: 200 } as const;

const hasExpectedSchedule = (
	schedule: { kind: "interval"; ms: number } | { kind: "cron"; cronspec: string; tz?: string },
) => schedule.kind === "interval" && schedule.ms === CALENDAR_SYNC_INTERVAL_MS;

const hasExpectedArgs = (args: Record<string, unknown>) =>
	Object.keys(args).length === 1 && args.limit === CALENDAR_SYNC_ARGS.limit;

export const ensureCalendarSyncGoogleCron = internalMutation({
	args: {},
	returns: v.object({
		status: v.union(v.literal("created"), v.literal("updated"), v.literal("already_configured")),
	}),
	handler: async (ctx) => {
		const existing = await runtimeCrons.get(ctx, { name: CALENDAR_SYNC_CRON_NAME });
		if (existing && hasExpectedSchedule(existing.schedule) && hasExpectedArgs(existing.args)) {
			return { status: "already_configured" as const };
		}

		if (existing) {
			await runtimeCrons.delete(ctx, { id: existing.id });
		}

		await runtimeCrons.register(
			ctx,
			{ kind: "interval", ms: CALENDAR_SYNC_INTERVAL_MS },
			internal.calendar.actions.syncGoogleForAllUsers,
			CALENDAR_SYNC_ARGS,
			CALENDAR_SYNC_CRON_NAME,
		);

		return { status: existing ? ("updated" as const) : ("created" as const) };
	},
});
