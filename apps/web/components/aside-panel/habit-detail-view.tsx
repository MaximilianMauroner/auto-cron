"use client";

import {
	type AsideOccurrenceItem,
	AsideOccurrenceList,
	ChangeLogDialog,
	useOccurrencePagination,
} from "@/components/aside-panel/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useUserPreferences } from "@/components/user-preferences-context";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { formatRecurrenceRule } from "@/lib/calendar-utils";
import { formatDurationCompact } from "@/lib/duration";
import { priorityClass, priorityLabels } from "@/lib/scheduling-constants";
import { History, Pencil, Repeat2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsideContent } from "./aside-content-context";

const formatDate = (timestamp?: number) =>
	timestamp
		? new Intl.DateTimeFormat(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "numeric",
				minute: "2-digit",
			}).format(new Date(timestamp))
		: "Anytime";

export function HabitDetailView({ habitId }: { habitId: string }) {
	const { hour12 } = useUserPreferences();
	const { goBack, openHabit, openEvent } = useAsideContent();
	const [changeLogTarget, setChangeLogTarget] = useState<{
		entityType: "task" | "habit" | "event" | "occurrence";
		entityId: string;
		title?: string;
	} | null>(null);
	const habitQuery = useAuthenticatedQueryWithStatus(api.habits.queries.getHabit, {
		id: habitId as Id<"habits">,
	});
	const habit = habitQuery.data;
	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const { mutate: updateHabit } = useMutationWithStatus(api.habits.mutations.updateHabit);
	const { mutate: toggleHabitActive } = useMutationWithStatus(
		api.habits.mutations.toggleHabitActive,
	);

	const upcoming = useOccurrencePagination<AsideOccurrenceItem>({
		queryRef: api.calendar.queries.listHabitOccurrencesPage,
		args: { habitId: habitId as Id<"habits"> },
		bucket: "upcoming",
		enabled: Boolean(habit),
	});
	const past = useOccurrencePagination<AsideOccurrenceItem>({
		queryRef: api.calendar.queries.listHabitOccurrencesPage,
		args: { habitId: habitId as Id<"habits"> },
		bucket: "past",
		enabled: Boolean(habit),
	});

	if (habitQuery.isPending) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Loading habit...
			</div>
		);
	}

	if (!habit) {
		return (
			<div className="p-3 text-[0.78rem] text-muted-foreground font-[family-name:var(--font-outfit)]">
				Habit not found.
			</div>
		);
	}

	const hoursSetName = hoursSetsQuery.data?.find((entry) => entry._id === habit.hoursSetId)?.name;
	const recurrence = formatRecurrenceRule(
		habit.recurrenceRule,
		habit.startDate ?? Date.now(),
		false,
	);
	const nextBlock = upcoming.items[0];

	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 border-b border-border/60 px-4 py-3">
				<div className="flex items-center justify-between gap-2">
					<Button variant="ghost" size="sm" className="h-8 text-[0.74rem]" onClick={goBack}>
						Back
					</Button>
					<div className="flex items-center gap-1.5">
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1 text-[0.74rem]"
							onClick={() =>
								setChangeLogTarget({
									entityType: "habit",
									entityId: habit._id,
									title: habit.title,
								})
							}
						>
							<History className="size-3.5" />
							Log
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1 text-[0.74rem]"
							onClick={() => openHabit(habit._id, "edit", { replace: true })}
						>
							<Pencil className="size-3.5" />
							Edit
						</Button>
					</div>
				</div>
				<div className="mt-3 flex items-start gap-2.5">
					<span
						className="mt-1.5 size-2 shrink-0 rounded-full"
						style={{ backgroundColor: habit.effectiveColor ?? habit.color ?? "#f59e0b" }}
					/>
					<div className="min-w-0">
						<p className="truncate font-[family-name:var(--font-outfit)] text-[1.05rem] font-semibold leading-tight">
							{habit.title}
						</p>
						<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
							<Badge
								className={`${priorityClass[habit.priority ?? "medium"]} px-1.5 py-0 text-[0.6rem] font-[family-name:var(--font-cutive)]`}
							>
								{priorityLabels[habit.priority ?? "medium"]}
							</Badge>
							<Badge variant="outline" className="text-[0.6rem]">
								{habit.isActive ? "Active" : "Paused"}
							</Badge>
						</div>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
				<div className="space-y-4">
					<div className="rounded-2xl border border-border/60 bg-card/65 p-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Duration
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">
									{formatDurationCompact(habit.minDurationMinutes ?? habit.durationMinutes)} -{" "}
									{formatDurationCompact(habit.maxDurationMinutes ?? habit.durationMinutes)}
								</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Hours
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">{hoursSetName ?? "Default"}</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Next block
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">{formatDate(nextBlock?.start)}</p>
							</div>
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Visibility
								</p>
								<p className="mt-1 text-[0.86rem] font-medium">
									{habit.visibilityPreference ?? "default"}
								</p>
							</div>
						</div>
						<div className="mt-3 border-t border-border/40 pt-3 text-[0.74rem] text-muted-foreground">
							<div className="flex items-center gap-1.5">
								<Repeat2 className="size-3.5" />
								{recurrence}
							</div>
						</div>
						<div className="mt-4 border-t border-border/50 pt-3.5">
							<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
								Quick controls
							</p>
							<div className="mt-2.5 grid grid-cols-2 gap-2">
								<Button
									type="button"
									variant={habit.isActive ? "outline" : "default"}
									size="sm"
									onClick={() => toggleHabitActive({ id: habit._id, isActive: !habit.isActive })}
								>
									{habit.isActive ? "Pause" : "Resume"}
								</Button>
								<Select
									value={habit.priority ?? "medium"}
									onValueChange={(priority) =>
										updateHabit({
											id: habit._id,
											patch: {
												priority: priority as "low" | "medium" | "high" | "critical",
											},
										})
									}
								>
									<SelectTrigger className="h-8">
										<SelectValue placeholder="Priority" />
									</SelectTrigger>
									<SelectContent>
										{(["low", "medium", "high", "critical"] as const).map((priority) => (
											<SelectItem key={priority} value={priority}>
												{priorityLabels[priority]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="mt-4 border-t border-border/50 pt-3.5">
							<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
								Notes
							</p>
							<p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-foreground">
								{habit.description || "No notes"}
							</p>
						</div>
					</div>

					<AsideOccurrenceList
						title="Upcoming"
						items={upcoming.items}
						hour12={hour12}
						isLoading={upcoming.isPending}
						hasMore={upcoming.hasMore}
						onLoadMore={upcoming.loadMore}
						onOpenOccurrenceDetails={(eventId) => openEvent(eventId, "details")}
						allowFollowingEdit
						onEditFollowing={(eventId) => openEvent(eventId, "edit")}
						onViewChangeLog={(eventId) =>
							setChangeLogTarget({
								entityType: "event",
								entityId: eventId,
								title: "Occurrence event",
							})
						}
					/>
					<AsideOccurrenceList
						title="Past"
						items={past.items}
						hour12={hour12}
						isLoading={past.isPending}
						hasMore={past.hasMore}
						onLoadMore={past.loadMore}
						onOpenOccurrenceDetails={(eventId) => openEvent(eventId, "details")}
						allowFollowingEdit
						onEditFollowing={(eventId) => openEvent(eventId, "edit")}
						onViewChangeLog={(eventId) =>
							setChangeLogTarget({
								entityType: "event",
								entityId: eventId,
								title: "Occurrence event",
							})
						}
					/>
				</div>
			</div>
			<ChangeLogDialog
				open={Boolean(changeLogTarget)}
				onOpenChange={(open) => {
					if (!open) setChangeLogTarget(null);
				}}
				target={changeLogTarget}
			/>
		</div>
	);
}
