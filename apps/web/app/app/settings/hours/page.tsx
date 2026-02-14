"use client";

import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useUserPreferences } from "@/components/user-preferences-context";
import {
	useActionWithStatus,
	useAuthenticatedQueryWithStatus,
	useMutationWithStatus,
} from "@/hooks/use-convex-status";
import { cn } from "@/lib/utils";
import type { HoursSetDTO } from "@auto-cron/types";
import { Clock3, Copy, Minus, Plus, Save, Star, Trash2 } from "lucide-react";
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

const minuteToTime24 = (minute: number) => {
	const safe = Math.max(0, Math.min(minute, 23 * 60 + 45));
	const hours = Math.floor(safe / 60);
	const minutes = safe % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const minuteToTime12 = (minute: number) => {
	const safe = Math.max(0, Math.min(minute, 23 * 60 + 45));
	const hours = Math.floor(safe / 60);
	const minutes = safe % 60;
	const period = hours >= 12 ? "PM" : "AM";
	const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
	return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

const formatMinuteAsTime = (minute: number, hour12: boolean) =>
	hour12 ? minuteToTime12(minute) : minuteToTime24(minute);

const parseTimeToMinute = (value: string, fallback: number) => {
	const trimmed = value.trim();
	const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
	if (match24) {
		const hours = Number.parseInt(match24[1] ?? "0", 10);
		const minutes = Number.parseInt(match24[2] ?? "0", 10);
		if (
			Number.isFinite(hours) &&
			Number.isFinite(minutes) &&
			hours >= 0 &&
			hours <= 23 &&
			minutes >= 0 &&
			minutes <= 59
		) {
			return hours * 60 + minutes;
		}
	}
	const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
	if (match12) {
		let hours = Number.parseInt(match12[1] ?? "0", 10);
		const minutes = Number.parseInt(match12[2] ?? "0", 10);
		const period = (match12[3] ?? "AM").toUpperCase();
		if (
			Number.isFinite(hours) &&
			Number.isFinite(minutes) &&
			hours >= 1 &&
			hours <= 12 &&
			minutes >= 0 &&
			minutes <= 59
		) {
			if (period === "AM" && hours === 12) hours = 0;
			if (period === "PM" && hours !== 12) hours += 12;
			return hours * 60 + minutes;
		}
	}
	return fallback;
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
	const { hour12 } = useUserPreferences();
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
		const nextMinute = parseTimeToMinute(value, target[field]);
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

	const activeDayCount = dayDefinitions.filter(
		({ day }) => (windowsByDay.get(day) ?? []).length > 0,
	).length;

	return (
		<>
			<div className="flex items-start justify-between gap-4">
				<SettingsSectionHeader
					sectionNumber="03"
					sectionLabel="Hours"
					title="Working Hours"
					description="Create reusable hours sets and assign them per task or habit."
				/>
				<Button
					size="sm"
					className="mt-6 shrink-0 gap-1.5"
					onClick={() => setIsCreateOpen(true)}
					disabled={isBusy}
				>
					<Plus className="size-3.5" />
					New set
				</Button>
			</div>

			{errorMessage ? (
				<div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
					{errorMessage}
				</div>
			) : null}
			{successMessage ? (
				<div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
					{successMessage}
				</div>
			) : null}

			<div className="space-y-4">
				{/* Set selector — list style like categories */}
				{hoursSetsQuery.isPending ? (
					<p className="text-sm text-muted-foreground">Loading hours sets...</p>
				) : orderedHoursSets.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16">
						<div className="mb-4 rounded-full bg-muted/40 p-4">
							<Clock3 className="size-8 text-muted-foreground/40" />
						</div>
						<p className="text-sm font-medium text-muted-foreground">No hours sets</p>
						<p className="mt-1 text-xs text-muted-foreground/80">
							Create one to define your working schedule
						</p>
						<Button
							size="sm"
							variant="outline"
							className="mt-4 gap-1.5"
							onClick={() => setIsCreateOpen(true)}
						>
							<Plus className="size-3.5" />
							Create set
						</Button>
					</div>
				) : (
					<div className="space-y-1.5">
						{orderedHoursSets.map((hoursSet) => {
							const isSelected = selectedSetId === hoursSet._id;
							const windowCount = hoursSet.windows.length;
							const dayCount = new Set(hoursSet.windows.map((w) => w.day)).size;
							return (
								<button
									key={hoursSet._id}
									type="button"
									onClick={() => setSelectedSetId(hoursSet._id)}
									className={cn(
										"group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
										isSelected
											? "border-primary/40 bg-primary/5"
											: "border-border/50 hover:border-border/80 hover:bg-muted/20",
									)}
								>
									<Clock3 className="size-3.5 shrink-0 text-muted-foreground/80" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="truncate text-sm font-medium">{hoursSet.name}</p>
											{hoursSet.isDefault ? (
												<Badge
													variant="secondary"
													className="shrink-0 gap-1 px-1.5 py-0 text-[10px]"
												>
													<Star className="size-2.5" />
													Default
												</Badge>
											) : null}
											{hoursSet.isSystem ? (
												<Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
													System
												</Badge>
											) : null}
										</div>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{dayCount} day{dayCount !== 1 ? "s" : ""} &middot; {windowCount} window
											{windowCount !== 1 ? "s" : ""}
										</p>
									</div>
								</button>
							);
						})}
					</div>
				)}

				{/* Editor */}
				{draft ? (
					<div className="rounded-xl border border-border/60 p-5">
						<p className="mb-4 font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							Configure &mdash; {draft.name}
						</p>

						{/* Name + Calendar */}
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-xs">Name</Label>
								<Input
									value={draft.name}
									onChange={(event) => setDraft({ ...draft, name: event.target.value })}
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Default calendar</Label>
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
										!calendarOptions.some((calendar) => calendar.id === draft.defaultCalendarId) ? (
											<SelectItem value={draft.defaultCalendarId}>
												{draft.defaultCalendarId} (unavailable)
											</SelectItem>
										) : null}
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Day toggles */}
						<div className="mt-5 border-t border-border/40 pt-4">
							<div className="mb-3 flex items-center justify-between gap-2">
								<p className="text-xs font-medium text-muted-foreground">
									Active days
									<span className="ml-1.5 text-foreground/60">{activeDayCount}/7</span>
								</p>
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">
									{schedulingStepMinutes}m steps
								</p>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{dayDefinitions.map(({ day, short }) => {
									const enabled = (windowsByDay.get(day) ?? []).length > 0;
									return (
										<button
											key={day}
											type="button"
											onClick={() => toggleDay(day)}
											className={cn(
												"h-8 min-w-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
												enabled
													? "border-primary/40 bg-primary/10 text-primary"
													: "border-border/60 bg-background text-muted-foreground/50 hover:border-border hover:text-muted-foreground",
											)}
										>
											{short}
										</button>
									);
								})}
							</div>
						</div>

						{/* Day windows */}
						<div className="mt-4 space-y-px">
							{dayDefinitions.map(({ day, short, label }) => {
								const dayWindows = windowsByDay.get(day) ?? [];
								if (dayWindows.length === 0) return null;
								return (
									<div
										key={day}
										className="group/day rounded-md border border-transparent px-3 py-2.5 transition-colors hover:border-border/40 hover:bg-muted/10"
									>
										<div className="flex items-start gap-3">
											{/* Day label */}
											<div className="w-8 shrink-0 pt-1.5">
												<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
													{short}
												</p>
											</div>

											{/* Windows */}
											<div className="flex-1 space-y-1.5">
												{dayWindows.map((window, index) => (
													<div
														key={`${window.day}-${window.startMinute}-${window.endMinute}-${index}`}
														className="flex items-center gap-2"
													>
														<Input
															type="text"
															inputMode="text"
															value={formatMinuteAsTime(window.startMinute, hour12)}
															onBlur={(event) =>
																updateWindow(day, index, "startMinute", event.target.value)
															}
															onChange={(event) =>
																updateWindow(day, index, "startMinute", event.target.value)
															}
															className="h-8 w-28 text-xs"
														/>
														<span className="text-[10px] text-muted-foreground/50">&ndash;</span>
														<Input
															type="text"
															inputMode="text"
															value={formatMinuteAsTime(window.endMinute, hour12)}
															onBlur={(event) =>
																updateWindow(day, index, "endMinute", event.target.value)
															}
															onChange={(event) =>
																updateWindow(day, index, "endMinute", event.target.value)
															}
															className="h-8 w-28 text-xs"
														/>
														<button
															type="button"
															onClick={() => removeWindow(day, index)}
															className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
														>
															<Minus className="size-3" />
														</button>
													</div>
												))}
											</div>

											{/* Day actions */}
											<div className="flex shrink-0 items-center gap-0.5 pt-1 opacity-0 transition-opacity group-hover/day:opacity-100">
												<button
													type="button"
													onClick={() => addWindow(day)}
													title={`Add window to ${label}`}
													className="rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-muted/60 hover:text-foreground"
												>
													<Plus className="size-3" />
												</button>
												<button
													type="button"
													onClick={() => copyDayToAll(day)}
													title={`Copy ${label} to all active days`}
													className="rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-muted/60 hover:text-foreground"
												>
													<Copy className="size-3" />
												</button>
											</div>
										</div>
									</div>
								);
							})}
						</div>

						{/* Actions */}
						<div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
							<div className="flex items-center gap-2">
								{!draft.isDefault ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-8 gap-1.5 px-2.5 text-xs"
										onClick={() => void onSetDefault()}
										disabled={isBusy}
									>
										<Star className="size-3" />
										Set default
									</Button>
								) : null}
								{!draft.isDefault && !draft.isSystem ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-8 gap-1.5 px-2.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
										onClick={() => void onDeleteHoursSet()}
										disabled={isBusy}
									>
										<Trash2 className="size-3" />
										Delete
									</Button>
								) : null}
							</div>
							<Button
								type="button"
								size="sm"
								className="h-8 gap-1.5 px-3 text-xs"
								onClick={() => void onSaveHoursSet()}
								disabled={isBusy || !hasDraftChanges}
							>
								<Save className="size-3" />
								{isUpdatingSet ? "Saving..." : "Save changes"}
							</Button>
						</div>
					</div>
				) : null}

				{/* Utility */}
				<div className="flex flex-wrap items-center gap-2 pt-2">
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs"
						onClick={() => void onSeedDefaultPlannerData()}
						disabled={isBusy}
					>
						Generate starter data
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs"
						onClick={() => void bootstrapHoursSets({})}
						disabled={isBusy}
					>
						Re-run bootstrap
					</Button>
				</div>
			</div>

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Create hours set</DialogTitle>
					</DialogHeader>
					<div className="space-y-1.5">
						<Label className="text-xs uppercase tracking-[0.1em]">Name</Label>
						<Input
							placeholder="e.g. Weekend deep work"
							value={newSetName}
							onChange={(event) => setNewSetName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") void onCreateHoursSet();
							}}
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsCreateOpen(false)}>
							Cancel
						</Button>
						<Button onClick={() => void onCreateHoursSet()} disabled={isBusy}>
							{isCreatingSet ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
