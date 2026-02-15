"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToastContext } from "@/components/ui/toast-context";
import { useMutationWithStatus } from "@/hooks/use-convex-status";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import {
	CirclePlay,
	History,
	Lock,
	LockOpen,
	MoreVertical,
	Pencil,
	Play,
	SkipForward,
	Square,
	Trash2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export type AsideOccurrenceItem = {
	id: string;
	title: string;
	start: number;
	end: number;
	pinned?: boolean;
	seriesId?: string;
};

const formatDate = (timestamp: number) =>
	new Intl.DateTimeFormat(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	}).format(new Date(timestamp));

const formatTime = (timestamp: number, hour12: boolean) =>
	new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
		hour12,
	}).format(new Date(timestamp));

const openInCalendar = ({
	pathname,
	eventId,
	start,
	openDetails,
}: {
	pathname: string;
	eventId: string;
	start: number;
	openDetails: boolean;
}) => {
	if (typeof window === "undefined") return;
	if (pathname.startsWith("/app/calendar")) {
		window.dispatchEvent(
			new CustomEvent("calendar:navigate-to-event", {
				detail: { eventId, start },
			}),
		);
		if (openDetails) {
			window.dispatchEvent(
				new CustomEvent("calendar:event-preview", {
					detail: { eventId },
				}),
			);
		}
		return;
	}
	const hash = new URLSearchParams({
		focusEventId: eventId,
		focusStart: String(start),
		focusMode: openDetails ? "details" : "navigate",
	}).toString();
	window.location.assign(`/app/calendar#${hash}`);
};

export function AsideOccurrenceList({
	title,
	items,
	hour12,
	isLoading,
	hasMore,
	onLoadMore,
	onOpenOccurrenceDetails,
	onEditFollowing,
	onViewChangeLog,
	allowFollowingEdit = false,
	showLockActions = true,
}: {
	title: string;
	items: AsideOccurrenceItem[];
	hour12: boolean;
	isLoading: boolean;
	hasMore: boolean;
	onLoadMore: () => void;
	onOpenOccurrenceDetails?: (eventId: string) => void;
	onEditFollowing?: (eventId: string) => void;
	onViewChangeLog?: (eventId: string) => void;
	allowFollowingEdit?: boolean;
	showLockActions?: boolean;
}) {
	const pathname = usePathname();
	const toast = useToastContext();
	const { mutate: lockOccurrence } = useMutationWithStatus(api.calendar.mutations.lockOccurrence);
	const { mutate: skipOccurrence } = useMutationWithStatus(api.calendar.mutations.skipOccurrence);
	const { mutate: deleteEvent } = useMutationWithStatus(api.calendar.mutations.deleteEvent);
	const { mutate: moveResizeEvent } = useMutationWithStatus(api.calendar.mutations.moveResizeEvent);
	const pushEventToGoogle = useAction(api.calendar.actions.pushEventToGoogle);
	const activeOccurrenceId =
		items.find((occurrence) => occurrence.start <= Date.now() && occurrence.end >= Date.now())
			?.id ?? null;

	const confirmDestructive = (message: string) => {
		if (typeof window === "undefined") return false;
		return window.confirm(message);
	};

	const handleDelete = async (occurrence: AsideOccurrenceItem, scope: "single" | "following") => {
		if (
			!confirmDestructive(
				scope === "following"
					? "Delete this and all following occurrences?"
					: "Delete this occurrence?",
			)
		) {
			return;
		}
		const eventId = occurrence.id as Id<"calendarEvents">;
		await pushEventToGoogle({
			eventId,
			operation: "delete",
			scope,
		}).catch(() => {});
		await deleteEvent({
			id: eventId,
			scope,
		});
		toast.success(scope === "following" ? "Following occurrences deleted." : "Occurrence deleted.");
	};

	const handleSkip = async (occurrence: AsideOccurrenceItem) => {
		if (!confirmDestructive("Skip this occurrence?")) return;
		await skipOccurrence({
			id: occurrence.id as Id<"calendarEvents">,
			scope: "single",
		});
		toast.success("Occurrence skipped.");
	};

	const handleRestart = async (occurrence: AsideOccurrenceItem) => {
		const now = Date.now();
		const durationMs = Math.max(15 * 60 * 1000, occurrence.end - occurrence.start);
		await moveResizeEvent({
			id: occurrence.id as Id<"calendarEvents">,
			start: now,
			end: now + durationMs,
			scope: "single",
		});
		toast.success("Occurrence restarted from now.");
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
					{title}
				</p>
				<span className="text-[0.68rem] text-muted-foreground">{items.length}</span>
			</div>
			{isLoading && items.length === 0 ? (
				<div className="space-y-2">
					{["occ-skeleton-1", "occ-skeleton-2"].map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-2xl border border-border/60 bg-card/50"
						/>
					))}
				</div>
			) : items.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-3.5 text-[0.74rem] text-muted-foreground">
					No events.
				</div>
			) : (
				<div className="space-y-2">
					{items.map((occurrence) => {
						const isActive = occurrence.id === activeOccurrenceId;
						return (
							<div
								key={occurrence.id}
								className={cn(
									"rounded-2xl border border-border/60 bg-card/75 px-3.5 py-3",
									isActive && "border-blue-500 ring-1 ring-blue-500/35",
								)}
							>
								<div className="flex items-center gap-2">
									<button
										type="button"
										className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
										onClick={() => {
											onOpenOccurrenceDetails?.(occurrence.id);
											openInCalendar({
												pathname,
												eventId: occurrence.id,
												start: occurrence.start,
												openDetails: false,
											});
										}}
									>
										{isActive ? (
											<CirclePlay className="mt-0.5 size-4 shrink-0 text-blue-600" />
										) : null}
										<div className="min-w-0 pt-0.5">
											<p className="truncate font-[family-name:var(--font-outfit)] text-[0.9rem] font-semibold">
												{formatDate(occurrence.start)}
												{isActive ? (
													<span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[0.58rem] font-medium text-blue-700">
														Now
													</span>
												) : null}
											</p>
											<p className="mt-0.5 text-[0.76rem] text-muted-foreground">
												{formatTime(occurrence.start, hour12)} -{" "}
												{formatTime(occurrence.end, hour12)}
											</p>
										</div>
									</button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button type="button" variant="ghost" size="icon" className="size-8">
												<MoreVertical className="size-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-44">
											<DropdownMenuItem
												onClick={() =>
													openInCalendar({
														pathname,
														eventId: occurrence.id,
														start: occurrence.start,
														openDetails: true,
													})
												}
											>
												Open in calendar
											</DropdownMenuItem>
											{showLockActions ? (
												<DropdownMenuItem
													onClick={() =>
														lockOccurrence({
															id: occurrence.id as Id<"calendarEvents">,
															locked: !occurrence.pinned,
														})
													}
												>
													{occurrence.pinned ? (
														<>
															<LockOpen className="mr-2 size-3.5" />
															Unlock
														</>
													) : (
														<>
															<Lock className="mr-2 size-3.5" />
															Lock
														</>
													)}
												</DropdownMenuItem>
											) : null}
											<DropdownMenuItem onClick={() => void handleSkip(occurrence)}>
												<SkipForward className="mr-2 size-3.5" />
												Skip
											</DropdownMenuItem>
											{allowFollowingEdit && occurrence.seriesId ? (
												<DropdownMenuItem onClick={() => onEditFollowing?.(occurrence.id)}>
													<Pencil className="mr-2 size-3.5" />
													Edit this & following
												</DropdownMenuItem>
											) : null}
											{isActive ? (
												<DropdownMenuSub>
													<DropdownMenuSubTrigger>
														<Play className="mr-2 size-3.5" />
														Live controls
													</DropdownMenuSubTrigger>
													<DropdownMenuSubContent className="w-44">
														<DropdownMenuItem
															onClick={() => {
																onOpenOccurrenceDetails?.(occurrence.id);
																openInCalendar({
																	pathname,
																	eventId: occurrence.id,
																	start: occurrence.start,
																	openDetails: true,
																});
															}}
														>
															Start
														</DropdownMenuItem>
														<DropdownMenuItem onClick={() => void handleSkip(occurrence)}>
															<Square className="mr-2 size-3.5" />
															Stop
														</DropdownMenuItem>
														<DropdownMenuItem onClick={() => void handleRestart(occurrence)}>
															Restart
														</DropdownMenuItem>
													</DropdownMenuSubContent>
												</DropdownMenuSub>
											) : null}
											<DropdownMenuSeparator />
											{occurrence.seriesId ? (
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => void handleDelete(occurrence, "following")}
												>
													<Trash2 className="mr-2 size-3.5" />
													Delete this & following
												</DropdownMenuItem>
											) : null}
											<DropdownMenuItem
												className="text-destructive focus:text-destructive"
												onClick={() => void handleDelete(occurrence, "single")}
											>
												<Trash2 className="mr-2 size-3.5" />
												Delete event
											</DropdownMenuItem>
											{onViewChangeLog ? (
												<>
													<DropdownMenuSeparator />
													<DropdownMenuItem onClick={() => onViewChangeLog(occurrence.id)}>
														<History className="mr-2 size-3.5" />
														View change log
													</DropdownMenuItem>
												</>
											) : null}
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>
						);
					})}
					{hasMore ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onLoadMore}
							className="h-8 w-full rounded-xl text-[0.74rem]"
						>
							Load more
						</Button>
					) : null}
				</div>
			)}
		</div>
	);
}
