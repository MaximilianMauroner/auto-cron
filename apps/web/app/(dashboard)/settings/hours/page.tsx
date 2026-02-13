"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	useActionWithStatus,
	useAuthenticatedQueryWithStatus,
	useMutationWithStatus,
} from "@/hooks/use-convex-status";
import type { HoursSetDTO } from "@auto-cron/types";
import { Clock3, Copy, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

type HoursWindow = {
	day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	startMinute: number;
	endMinute: number;
};

type HoursSetDraft = {
	id: string;
	name: string;
	isDefault: boolean;
	isSystem: boolean;
	defaultCalendarId?: string;
	windows: HoursWindow[];
};
type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

const dayDefinitions = [
	{ day: 1, short: "Mo", label: "Monday" },
	{ day: 2, short: "Tu", label: "Tuesday" },
	{ day: 3, short: "We", label: "Wednesday" },
	{ day: 4, short: "Th", label: "Thursday" },
	{ day: 5, short: "Fr", label: "Friday" },
	{ day: 6, short: "Sa", label: "Saturday" },
	{ day: 0, short: "Su", label: "Sunday" },
] as const;

const defaultWorkWindows: HoursWindow[] = [1, 2, 3, 4, 5].map((day) => ({
	day: day as HoursWindow["day"],
	startMinute: 9 * 60,
	endMinute: 17 * 60,
}));

const minuteToTime = (minute: number) => {
	const clampedMinute = Math.max(0, Math.min(minute, 24 * 60));
	// Native time inputs cannot represent 24:00, so keep end-of-day values in range.
	const safe = clampedMinute === 24 * 60 ? 23 * 60 + 45 : clampedMinute;
	const hours = Math.floor(safe / 60);
	const minutes = safe % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const timeToMinute = (value: string, fallback: number) => {
	const match = value.match(/^(\d{2}):(\d{2})$/);
	if (!match) return fallback;
	const [_, rawHours = "0", rawMinutes = "0"] = match;
	const hours = Number.parseInt(rawHours, 10);
	const minutes = Number.parseInt(rawMinutes, 10);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
	return Math.max(0, Math.min(hours * 60 + minutes, 1440));
};

const compareWindows = (a: HoursWindow, b: HoursWindow) => {
	if (a.day !== b.day) return a.day - b.day;
	if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
	return a.endMinute - b.endMinute;
};

const normalizeWindows = (windows: HoursWindow[]) => [...windows].sort(compareWindows);

const dedupeWindows = (windows: HoursWindow[]) => {
	const byKey = new Map<string, HoursWindow>();
	for (const window of windows) {
		byKey.set(`${window.day}:${window.startMinute}:${window.endMinute}`, window);
	}
	return normalizeWindows(Array.from(byKey.values()));
};

const defaultWindowForDay = (day: HoursWindow["day"]): HoursWindow => ({
	day,
	startMinute: 9 * 60,
	endMinute: 17 * 60,
});

const toHoursSetId = (value: string) => value as Id<"hoursSets">;

export default function SettingsHoursPage() {
	const [selectedSetId, setSelectedSetId] = useState<string>("");
	const [draft, setDraft] = useState<HoursSetDraft | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newSetName, setNewSetName] = useState("");
	const hasBootstrappedRef = useRef(false);

	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);
	const schedulingStepMinutes = schedulingDefaultsQuery.data?.schedulingStepMinutes ?? 15;
	const schedulingStepSeconds = schedulingStepMinutes * 60;
	const hoursSets = (hoursSetsQuery.data ?? []) as HoursSetDTO[];
	const googleCalendars = (googleCalendarsQuery.data ?? []) as GoogleCalendarListItem[];

	const { execute: bootstrapHoursSets, isPending: isBootstrapping } = useActionWithStatus(
		api.hours.actions.bootstrapHoursSetsForUser,
	);
	const { execute: bootstrapDefaultPlannerData, isPending: isBootstrappingDefaults } =
		useActionWithStatus(api.hours.actions.bootstrapDefaultPlannerDataForUser);
	const { mutate: createHoursSet, isPending: isCreatingSet } = useMutationWithStatus(
		api.hours.mutations.createHoursSet,
	);
	const { mutate: updateHoursSet, isPending: isUpdatingSet } = useMutationWithStatus(
		api.hours.mutations.updateHoursSet,
	);
	const { mutate: deleteHoursSet, isPending: isDeletingSet } = useMutationWithStatus(
		api.hours.mutations.deleteHoursSet,
	);
	const { mutate: setDefaultHoursSet, isPending: isSettingDefault } = useMutationWithStatus(
		api.hours.mutations.setDefaultHoursSet,
	);

	const isBusy =
		isBootstrapping ||
		isBootstrappingDefaults ||
		isCreatingSet ||
		isUpdatingSet ||
		isDeletingSet ||
		isSettingDefault;

	const hoursSetsById = useMemo(() => {
		return new Map(hoursSets.map((hoursSet) => [hoursSet._id, hoursSet] as const));
	}, [hoursSets]);

	const orderedHoursSets = useMemo(() => {
		return [...hoursSets].sort((a, b) => {
			if (a.isDefault && !b.isDefault) return -1;
			if (!a.isDefault && b.isDefault) return 1;
			return a.name.localeCompare(b.name);
		});
	}, [hoursSets]);

	const selectedSet = selectedSetId ? hoursSetsById.get(selectedSetId) : orderedHoursSets[0];
	const calendarOptions = useMemo(() => {
		const deduped = new Map<string, GoogleCalendarListItem>();
		for (const calendar of googleCalendars) {
			deduped.set(calendar.id, calendar);
		}
		if (!deduped.has("primary")) {
			deduped.set("primary", {
				id: "primary",
				name: "Default",
				primary: true,
				color: undefined,
				accessRole: "owner",
				isExternal: false,
			});
		}
		return Array.from(deduped.values()).sort((a, b) => {
			if (a.primary && !b.primary) return -1;
			if (!a.primary && b.primary) return 1;
			return a.name.localeCompare(b.name);
		});
	}, [googleCalendars]);

	useEffect(() => {
		if (hasBootstrappedRef.current) return;
		if (hoursSetsQuery.isPending) return;
		if (hoursSets.length > 0) return;
		hasBootstrappedRef.current = true;
		void bootstrapHoursSets({}).catch((error) => {
			console.error("bootstrapHoursSetsForUser failed", error);
		});
	}, [bootstrapHoursSets, hoursSets.length, hoursSetsQuery.isPending]);

	useEffect(() => {
		if (selectedSetId && hoursSetsById.has(selectedSetId)) return;
		setSelectedSetId(orderedHoursSets[0]?._id ?? "");
	}, [hoursSetsById, orderedHoursSets, selectedSetId]);

	useEffect(() => {
		if (!selectedSet) {
			setDraft(null);
			return;
		}
		setDraft({
			id: selectedSet._id,
			name: selectedSet.name,
			isDefault: selectedSet.isDefault,
			isSystem: selectedSet.isSystem,
			defaultCalendarId: selectedSet.defaultCalendarId,
			windows: normalizeWindows(
				selectedSet.windows.map((window) => ({
					day: window.day,
					startMinute: window.startMinute,
					endMinute: window.endMinute,
				})),
			),
		});
	}, [selectedSet]);

	const hasDraftChanges = useMemo(() => {
		if (!draft || !selectedSet) return false;
		if (draft.name.trim() !== selectedSet.name) return true;
		if ((draft.defaultCalendarId ?? "") !== (selectedSet.defaultCalendarId ?? "")) return true;
		const left = dedupeWindows(draft.windows);
		const right = dedupeWindows(
			selectedSet.windows.map((window) => ({
				day: window.day,
				startMinute: window.startMinute,
				endMinute: window.endMinute,
			})),
		);
		if (left.length !== right.length) return true;
		return left.some((window, index) => {
			const other = right[index];
			if (!other) return true;
			return (
				window.day !== other.day ||
				window.startMinute !== other.startMinute ||
				window.endMinute !== other.endMinute
			);
		});
	}, [draft, selectedSet]);

	const windowsByDay = useMemo(() => {
		const grouped = new Map<number, HoursWindow[]>();
		for (const { day } of dayDefinitions) grouped.set(day, []);
		if (!draft) return grouped;
		for (const window of normalizeWindows(draft.windows)) {
			const windows = grouped.get(window.day) ?? [];
			windows.push(window);
			grouped.set(window.day, windows);
		}
		return grouped;
	}, [draft]);

	const updateWindow = (
		day: HoursWindow["day"],
		index: number,
		field: "startMinute" | "endMinute",
		value: string,
	) => {
		if (!draft) return;
		const windows = windowsByDay.get(day) ?? [];
		const target = windows[index];
		if (!target) return;
		const nextMinute = timeToMinute(value, target[field]);
		const nextWindows = draft.windows.map((window) => {
			if (
				window.day === target.day &&
				window.startMinute === target.startMinute &&
				window.endMinute === target.endMinute
			) {
				return {
					...window,
					[field]: nextMinute,
				};
			}
			return window;
		});
		setDraft({ ...draft, windows: normalizeWindows(nextWindows) });
	};

	const addWindow = (day: HoursWindow["day"]) => {
		if (!draft) return;
		const dayWindows = windowsByDay.get(day) ?? [];
		const last = dayWindows[dayWindows.length - 1];
		const fallbackStart = last ? Math.min(last.endMinute, 23 * 60 + 45) : 9 * 60;
		const window: HoursWindow = {
			day,
			startMinute: fallbackStart,
			endMinute: Math.min(fallbackStart + 60, 24 * 60),
		};
		setDraft({ ...draft, windows: normalizeWindows([...draft.windows, window]) });
	};

	const removeWindow = (day: HoursWindow["day"], index: number) => {
		if (!draft) return;
		const dayWindows = windowsByDay.get(day) ?? [];
		const target = dayWindows[index];
		if (!target) return;
		const next = draft.windows.filter(
			(window) =>
				!(
					window.day === target.day &&
					window.startMinute === target.startMinute &&
					window.endMinute === target.endMinute
				),
		);
		setDraft({ ...draft, windows: normalizeWindows(next) });
	};

	const toggleDay = (day: HoursWindow["day"]) => {
		if (!draft) return;
		const hasDayWindows = (windowsByDay.get(day) ?? []).length > 0;
		if (hasDayWindows) {
			setDraft({
				...draft,
				windows: draft.windows.filter((window) => window.day !== day),
			});
			return;
		}
		setDraft({
			...draft,
			windows: normalizeWindows([...draft.windows, defaultWindowForDay(day)]),
		});
	};

	const copyDayToAll = (day: HoursWindow["day"]) => {
		if (!draft) return;
		const source = (windowsByDay.get(day) ?? []).map((window) => ({
			...window,
			startMinute: Math.floor(window.startMinute / schedulingStepMinutes) * schedulingStepMinutes,
			endMinute: Math.ceil(window.endMinute / schedulingStepMinutes) * schedulingStepMinutes,
		}));
		if (source.length === 0) return;

		// Copy only to currently enabled days so disabled days remain untouched.
		const enabledDays = new Set(
			dayDefinitions
				.filter(({ day: targetDay }) => (windowsByDay.get(targetDay) ?? []).length > 0)
				.map(({ day: targetDay }) => targetDay as HoursWindow["day"]),
		);
		if (enabledDays.size === 0) return;

		const copied = Array.from(enabledDays).flatMap((targetDay) =>
			source.map((window) => ({ ...window, day: targetDay as HoursWindow["day"] })),
		);
		const preservedDisabledDays = draft.windows.filter((window) => !enabledDays.has(window.day));
		setDraft({ ...draft, windows: normalizeWindows([...preservedDisabledDays, ...copied]) });
	};

	const onSaveHoursSet = async () => {
		if (!draft) return;
		if (!draft.name.trim()) {
			setErrorMessage("Hours set name is required.");
			return;
		}
		if (draft.windows.length === 0) {
			setErrorMessage("Configure at least one active day/window.");
			return;
		}
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			await updateHoursSet({
				id: toHoursSetId(draft.id),
				input: {
					name: draft.name.trim(),
					windows: normalizeWindows(draft.windows),
					defaultCalendarId: draft.defaultCalendarId || undefined,
				},
			});
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update hours set.");
		}
	};

	const onCreateHoursSet = async () => {
		const name = newSetName.trim();
		if (!name) {
			setErrorMessage("Hours set name is required.");
			return;
		}
		const sourceWindows =
			draft?.windows.length && draft.id
				? draft.windows
				: (orderedHoursSets.find((hoursSet) => hoursSet.isDefault)?.windows ?? defaultWorkWindows);

		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			const createdId = await createHoursSet({
				input: {
					name,
					windows: normalizeWindows(
						sourceWindows.map((window) => ({
							day: window.day,
							startMinute: window.startMinute,
							endMinute: window.endMinute,
						})),
					),
				},
			});
			setSelectedSetId(createdId);
			setNewSetName("");
			setIsCreateOpen(false);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not create hours set.");
		}
	};

	const onDeleteHoursSet = async () => {
		if (!draft) return;
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			await deleteHoursSet({ id: toHoursSetId(draft.id) });
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not delete hours set.");
		}
	};

	const onSetDefault = async () => {
		if (!draft) return;
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			await setDefaultHoursSet({ id: toHoursSetId(draft.id) });
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not set default hours set.");
		}
	};

	const onSeedDefaultPlannerData = async () => {
		setErrorMessage(null);
		try {
			const result = await bootstrapDefaultPlannerData({});
			const summary =
				result.createdTasks === 0 && result.createdHabits === 0
					? "Starter defaults already existed."
					: `Starter defaults created: ${result.createdTasks} tasks and ${result.createdHabits} habits.`;
			setSuccessMessage(summary);
		} catch (error) {
			setSuccessMessage(null);
			setErrorMessage(
				error instanceof Error ? error.message : "Could not generate starter planner data.",
			);
		}
	};

	return (
		<div className="flex flex-col gap-5">
			<div className="grid scroll-mt-24 gap-4 md:grid-cols-[1.3fr_1fr]" id="hours-settings">
				<Card className="border-border/70 bg-card/70">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs uppercase tracking-[0.14em]">
							Scheduling
						</CardDescription>
						<CardTitle className="text-2xl">Working Hours Sets</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="max-w-2xl text-sm text-muted-foreground">
							Create reusable hours sets and assign them per task or habit. System sets are editable
							but locked from deletion.
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<Button onClick={() => setIsCreateOpen(true)} disabled={isBusy} className="gap-1.5">
								<Plus className="size-4" />
								New hours set
							</Button>
							<Button
								variant="outline"
								onClick={() => void onSeedDefaultPlannerData()}
								disabled={isBusy}
								className="border-border/70 bg-background/60 text-foreground hover:bg-muted/60 hover:text-foreground"
							>
								Generate starter data
							</Button>
							<Button
								variant="outline"
								onClick={() => void bootstrapHoursSets({})}
								disabled={isBusy}
								className="border-border/70 bg-background/60 text-foreground hover:bg-muted/60 hover:text-foreground"
							>
								Re-run bootstrap
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			{errorMessage ? (
				<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
					{errorMessage}
				</div>
			) : null}
			{successMessage ? (
				<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
					{successMessage}
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-[320px_1fr]">
				<Card className="border-border/70 bg-card/70">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Hours Sets</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{hoursSetsQuery.isPending ? (
							<p className="text-sm text-muted-foreground">Loading sets...</p>
						) : orderedHoursSets.length === 0 ? (
							<p className="text-sm text-muted-foreground">No sets found yet.</p>
						) : (
							orderedHoursSets.map((hoursSet) => (
								<button
									key={hoursSet._id}
									type="button"
									className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
										selectedSetId === hoursSet._id
											? "border-primary/40 bg-primary/5"
											: "border-border hover:bg-muted/40"
									}`}
									onClick={() => setSelectedSetId(hoursSet._id)}
								>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{hoursSet.name}</p>
										<div className="mt-1 flex flex-wrap gap-1">
											{hoursSet.isDefault ? <Badge variant="secondary">Default</Badge> : null}
											{hoursSet.isSystem ? <Badge variant="outline">System</Badge> : null}
										</div>
									</div>
									<Clock3 className="size-4 text-muted-foreground" />
								</button>
							))
						)}
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-card/70">
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center justify-between gap-3 text-base">
							<span>{draft?.name ?? "Hours set"}</span>
							<div className="flex items-center gap-2">
								{draft?.isDefault ? <Badge variant="secondary">Default</Badge> : null}
								{draft?.isSystem ? <Badge variant="outline">System</Badge> : null}
							</div>
						</CardTitle>
						<CardDescription>
							Per-day windows use {schedulingStepMinutes}-minute steps. Multiple windows per day are
							supported.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{!draft ? (
							<p className="text-sm text-muted-foreground">Select a set to configure windows.</p>
						) : (
							<>
								<div className="grid gap-3 md:grid-cols-2">
									<div className="space-y-2">
										<Label>Name</Label>
										<Input
											value={draft.name}
											onChange={(event) => setDraft({ ...draft, name: event.target.value })}
										/>
									</div>
									<div className="space-y-2">
										<Label>Default calendar id (optional)</Label>
										<Select
											value={draft.defaultCalendarId ?? "__none__"}
											onValueChange={(value) =>
												setDraft({
													...draft,
													defaultCalendarId: value === "__none__" ? undefined : value,
												})
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select calendar" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="__none__">No default calendar</SelectItem>
												{calendarOptions.map((calendar) => (
													<SelectItem key={calendar.id} value={calendar.id}>
														{calendar.primary ? `${calendar.name} (primary)` : calendar.name}
													</SelectItem>
												))}
												{draft.defaultCalendarId &&
												!calendarOptions.some(
													(calendar) => calendar.id === draft.defaultCalendarId,
												) ? (
													<SelectItem value={draft.defaultCalendarId}>
														{draft.defaultCalendarId} (unavailable)
													</SelectItem>
												) : null}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="flex flex-wrap gap-1.5">
									{dayDefinitions.map(({ day, short }) => {
										const enabled = (windowsByDay.get(day) ?? []).length > 0;
										return (
											<button
												key={day}
												type="button"
												onClick={() => toggleDay(day)}
												className={`h-10 min-w-10 rounded-full border px-3 text-sm font-medium transition-colors ${
													enabled
														? "border-primary/40 bg-primary/10 text-primary"
														: "border-border bg-background text-muted-foreground"
												}`}
											>
												{short}
											</button>
										);
									})}
								</div>

								<Separator />

								<div className="space-y-4">
									{dayDefinitions.map(({ day, label }) => {
										const dayWindows = windowsByDay.get(day) ?? [];
										return (
											<div key={day} className="space-y-2">
												<div className="flex items-center justify-between gap-2">
													<p className="w-32 text-sm font-medium">{label}</p>
													<div className="flex items-center gap-1">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 gap-1 text-xs"
															disabled={dayWindows.length === 0}
															onClick={() => copyDayToAll(day)}
														>
															<Copy className="size-3.5" />
															Copy to all
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="size-8"
															onClick={() => addWindow(day)}
														>
															<Plus className="size-3.5" />
														</Button>
													</div>
												</div>
												{dayWindows.length === 0 ? (
													<p className="text-xs text-muted-foreground">No windows configured.</p>
												) : (
													<div className="space-y-2">
														{dayWindows.map((window, index) => (
															<div
																key={`${window.day}-${window.startMinute}-${window.endMinute}-${index}`}
																className="flex items-center gap-2"
															>
																<Input
																	type="time"
																	step={schedulingStepSeconds}
																	value={minuteToTime(window.startMinute)}
																	onChange={(event) =>
																		updateWindow(day, index, "startMinute", event.target.value)
																	}
																	className="w-44"
																/>
																<span className="text-sm text-muted-foreground">to</span>
																<Input
																	type="time"
																	step={schedulingStepSeconds}
																	value={minuteToTime(window.endMinute)}
																	onChange={(event) =>
																		updateWindow(day, index, "endMinute", event.target.value)
																	}
																	className="w-44"
																/>
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	className="size-8 text-rose-600"
																	onClick={() => removeWindow(day, index)}
																>
																	<Trash2 className="size-3.5" />
																</Button>
															</div>
														))}
													</div>
												)}
											</div>
										);
									})}
								</div>

								<Separator />

								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex flex-wrap items-center gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={onSetDefault}
											disabled={isBusy || draft.isDefault}
										>
											Set as default
										</Button>
										<Button
											type="button"
											variant="outline"
											onClick={onDeleteHoursSet}
											disabled={isBusy || draft.isDefault || draft.isSystem}
										>
											Delete set
										</Button>
									</div>
									<Button
										type="button"
										onClick={onSaveHoursSet}
										disabled={isBusy || !hasDraftChanges}
										className="gap-1.5"
									>
										<Save className="size-4" />
										Save changes
									</Button>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			</div>

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Create hours set</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label>Name</Label>
						<Input
							placeholder="e.g. Weekend deep work"
							value={newSetName}
							onChange={(event) => setNewSetName(event.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsCreateOpen(false)}>
							Cancel
						</Button>
						<Button onClick={onCreateHoursSet} disabled={isBusy}>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
