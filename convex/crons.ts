import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const builtinCrons = cronJobs();
builtinCrons.interval(
	"calendar-sync-google-fallback",
	{ hours: 6 },
	internal.calendar.actions.enqueueGoogleSyncRunsForAllUsers,
	{
		limit: 200,
		triggeredBy: "cron",
	},
);
builtinCrons.interval(
	"calendar-watch-renewal",
	{ hours: 6 },
	internal.calendar.actions.renewExpiringWatchChannels,
	{
		limit: 1000,
	},
);
export default builtinCrons;
