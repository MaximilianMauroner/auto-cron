"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import type { TaskSchedulingMode } from "@auto-cron/types";
import { Save, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../../../convex/_generated/api";

const schedulingModeLabels: Record<TaskSchedulingMode, string> = {
	fastest: "Fastest",
	backfacing: "Backfacing",
	parallel: "Parallel",
};

const schedulingModeDescriptions: Record<TaskSchedulingMode, string> = {
	fastest: "Schedules tasks as early as possible to finish soonest before due time.",
	backfacing: "Schedules tasks as late as possible while still finishing by the due time.",
	parallel: "Distributes tasks with similar due dates in parallel across available windows.",
};

export default function SchedulingSettingsPage() {
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);
	const defaultTaskSchedulingMode =
		schedulingDefaultsQuery.data?.defaultTaskSchedulingMode ?? "fastest";
	const { mutate: setDefaultTaskSchedulingMode, isPending } = useMutationWithStatus(
		api.hours.mutations.setDefaultTaskSchedulingMode,
	);

	const onChangeTaskSchedulingMode = async (mode: TaskSchedulingMode) => {
		setErrorMessage(null);
		try {
			await setDefaultTaskSchedulingMode({ mode });
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update task mode.");
		}
	};

	return (
		<div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
			<Card className="border-border/70 bg-card/70">
				<CardHeader>
					<CardDescription className="text-xs uppercase tracking-[0.14em]">Tasks</CardDescription>
					<CardTitle className="flex items-center gap-2 text-xl">
						<SlidersHorizontal className="size-4 text-primary" />
						Default Scheduling Mode
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Select
						value={defaultTaskSchedulingMode}
						onValueChange={(value) => void onChangeTaskSchedulingMode(value as TaskSchedulingMode)}
						disabled={isPending}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(schedulingModeLabels).map(([mode, label]) => (
								<SelectItem key={mode} value={mode}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-sm text-muted-foreground">
						{defaultTaskSchedulingMode
							? schedulingModeDescriptions[defaultTaskSchedulingMode]
							: "Choose how tasks should be placed by default."}
					</p>
					{errorMessage ? (
						<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
							{errorMessage}
						</div>
					) : null}
				</CardContent>
			</Card>

			<Card className="border-border/70 bg-card/70">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">How it works</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>This mode is the global default for all tasks.</p>
					<p>Each individual task can still override this value from its editor.</p>
					<Button variant="outline" size="sm" className="gap-1.5" disabled>
						<Save className="size-3.5" />
						Auto-saved on change
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
