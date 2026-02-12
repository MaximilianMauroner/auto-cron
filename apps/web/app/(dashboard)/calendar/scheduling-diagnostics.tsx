"use client";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useActionWithStatus, useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { AlertTriangle, Gauge, PlayCircle } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";

const formatDateTime = (value: number | undefined) => {
	if (!value) return "-";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
};

export function SchedulingDiagnostics() {
	const latestRunQuery = useAuthenticatedQueryWithStatus(api.scheduling.queries.getLatestRun, {});
	const googleSyncHealthQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.getGoogleSyncHealth,
		{},
	);
	const { execute: runNow, isPending } = useActionWithStatus(api.scheduling.actions.runNow);

	const latestRun = latestRunQuery.data;
	const googleSyncHealth = googleSyncHealthQuery.data;
	const lateCount = latestRun?.lateTasks?.length ?? 0;
	const shortfallCount =
		latestRun?.habitShortfalls?.reduce(
			(sum: number, row: { shortfall: number }) => sum + row.shortfall,
			0,
		) ?? 0;
	const issueCount = lateCount + shortfallCount;
	const issueLabel = issueCount > 9 ? "9+" : String(issueCount);

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button
					type="button"
					size="icon"
					variant="outline"
					aria-label="Open scheduling diagnostics"
					title="Scheduling diagnostics"
					className="relative size-10 rounded-full border-border/70 bg-background/85 shadow-sm backdrop-blur transition hover:bg-background"
				>
					<Gauge className="size-4" />
					{issueCount > 0 ? (
						<span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full border border-background bg-amber-500 px-1 text-[10px] font-bold text-black">
							{issueLabel}
						</span>
					) : null}
				</Button>
			</SheetTrigger>
			<SheetContent side="right" className="w-full border-border/80 bg-card/95 p-0 sm:max-w-sm">
				<SheetHeader className="gap-3 border-b border-border/70 p-5 pr-12">
					<div className="space-y-1">
						<SheetDescription className="text-xs uppercase tracking-[0.14em]">
							Scheduling
						</SheetDescription>
						<SheetTitle className="text-xl">Run Diagnostics</SheetTitle>
					</div>
					<Button
						type="button"
						size="sm"
						className="gap-1.5 self-start"
						onClick={() => void runNow({})}
						disabled={isPending}
					>
						<PlayCircle className="size-4" />
						{isPending ? "Running..." : "Run scheduler"}
					</Button>
				</SheetHeader>
				<div className="grid gap-4 p-5 text-sm text-muted-foreground">
					<p aria-live="polite" aria-atomic="true" className="sr-only">
						Scheduler status: {latestRun?.status ?? "idle"}
					</p>
					<div className="space-y-3">
						<div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2">
							<span className="text-xs uppercase tracking-wide text-muted-foreground/80">
								Status
							</span>
							<span className="font-semibold text-foreground">{latestRun?.status ?? "idle"}</span>
						</div>
						<div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2">
							<span className="text-xs uppercase tracking-wide text-muted-foreground/80">
								Last Started
							</span>
							<span className="font-semibold text-foreground">
								{formatDateTime(latestRun?.startedAt)}
							</span>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
								<p className="text-xs uppercase tracking-wide text-muted-foreground/80">
									Late Tasks
								</p>
								<p className="font-semibold text-foreground">{lateCount}</p>
							</div>
							<div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
								<p className="text-xs uppercase tracking-wide text-muted-foreground/80">
									Habit Shortfalls
								</p>
								<p className="font-semibold text-foreground">{shortfallCount}</p>
							</div>
						</div>
						<div className="space-y-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
							<p className="text-xs uppercase tracking-wide text-muted-foreground/80">
								Google Push Sync
							</p>
							<p className="font-semibold text-foreground">
								{googleSyncHealth?.googleConnected
									? googleSyncHealth.activeChannels > 0
										? `Active (${googleSyncHealth.activeChannels} channels)`
										: "Connected (no active channels)"
									: "Not connected"}
							</p>
							<p className="text-xs text-muted-foreground">
								Last webhook: {formatDateTime(googleSyncHealth?.lastWebhookAt)}
							</p>
							<p className="text-xs text-muted-foreground">
								Last sync: {googleSyncHealth?.latestRunStatus ?? "-"}
							</p>
						</div>
					</div>
					{latestRun && latestRun.feasibleOnTime === false ? (
						<p className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
							<AlertTriangle className="size-4" />
							Not feasible to keep all tasks on-time under current hard constraints.
						</p>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}
