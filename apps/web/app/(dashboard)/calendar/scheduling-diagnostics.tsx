"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionWithStatus, useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { AlertTriangle, PlayCircle } from "lucide-react";
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
	const { execute: runNow, isPending } = useActionWithStatus(api.scheduling.actions.runNow);

	const latestRun = latestRunQuery.data;
	const lateCount = latestRun?.lateTasks?.length ?? 0;
	const shortfallCount =
		latestRun?.habitShortfalls?.reduce(
			(sum: number, row: { shortfall: number }) => sum + row.shortfall,
			0,
		) ?? 0;

	return (
		<Card className="border-border/70 bg-card/70">
			<CardHeader className="pb-2">
				<CardDescription className="text-xs uppercase tracking-[0.14em]">
					Scheduling
				</CardDescription>
				<CardTitle className="flex items-center justify-between gap-2 text-lg">
					<span>Run Diagnostics</span>
					<Button
						type="button"
						size="sm"
						className="gap-1.5"
						onClick={() => void runNow({})}
						disabled={isPending}
					>
						<PlayCircle className="size-4" />
						{isPending ? "Running..." : "Run scheduler"}
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-4">
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground/80">Status</p>
					<p aria-live="polite" aria-atomic="true" className="font-medium text-foreground">
						{latestRun?.status ?? "idle"}
					</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground/80">Last Started</p>
					<p className="font-medium text-foreground">{formatDateTime(latestRun?.startedAt)}</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground/80">Late Tasks</p>
					<p className="font-medium text-foreground">{lateCount}</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground/80">
						Habit Shortfalls
					</p>
					<p className="font-medium text-foreground">{shortfallCount}</p>
				</div>
				{latestRun && latestRun.feasibleOnTime === false ? (
					<div className="md:col-span-4">
						<p className="flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
							<AlertTriangle className="size-4" />
							Not feasible to keep all tasks on-time under current hard constraints.
						</p>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
