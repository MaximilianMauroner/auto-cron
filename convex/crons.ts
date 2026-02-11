import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"calendar-sync-google",
	{ minutes: 15 },
	internal.calendar.actions.syncGoogleForAllUsers,
	{
		limit: 200,
	},
);

export default crons;
