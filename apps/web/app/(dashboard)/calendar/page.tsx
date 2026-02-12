import { createConvexHttpClient } from "@/lib/convex-http";
import { withAuth } from "@workos-inc/authkit-nextjs";
import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { api } from "../../../../../convex/_generated/api";
import { SchedulingDiagnostics } from "./scheduling-diagnostics";

const CalendarClient = dynamic(
	() => import("./calendar-client").then((module) => module.CalendarClient),
	{
		loading: () => (
			<div className="h-full min-h-0 rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
				Loading calendar...
			</div>
		),
	},
);

export default async function CalendarPage() {
	const { accessToken } = await withAuth();
	const cookieStore = await cookies();
	const refreshToken = cookieStore.get("google_refresh_token")?.value;

	if (accessToken && refreshToken) {
		try {
			const convex = createConvexHttpClient(accessToken);
			await convex.mutation(api.calendar.mutations.upsertGoogleTokens, {
				refreshToken,
			});
		} catch (error) {
			console.error("Failed to backfill Google refresh token:", error);
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-4">
			<SchedulingDiagnostics />
			<div className="min-h-0 flex-1">
				<CalendarClient />
			</div>
		</div>
	);
}
