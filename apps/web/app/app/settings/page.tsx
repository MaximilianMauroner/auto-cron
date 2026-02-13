"use client";

import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	detectLocalTimeFormatPreference,
	detectLocalTimeZone,
} from "@/components/user-preferences-context";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { cn } from "@/lib/utils";
import { Check, Globe, Hash, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";

type EditingRow = "timezone" | "horizon" | "weekStart" | "dateFormat" | "timeFormat" | null;

const weekDayLabels: Record<number, string> = {
	0: "Sunday",
	1: "Monday",
	2: "Tuesday",
	3: "Wednesday",
	4: "Thursday",
	5: "Friday",
	6: "Saturday",
};

const dateFormatExamples: Record<string, string> = {
	"MM/DD/YYYY": "12/31/2026",
	"DD/MM/YYYY": "31/12/2026",
	"YYYY-MM-DD": "2026-12-31",
};

const timeFormatExamples: Record<string, string> = {
	"12h": "1:00 PM",
	"24h": "13:00",
};

const horizonOptions = [
	{ days: 7, label: "1 week" },
	{ days: 14, label: "2 weeks" },
	{ days: 21, label: "3 weeks" },
	{ days: 28, label: "4 weeks" },
	{ days: 42, label: "6 weeks" },
	{ days: 56, label: "8 weeks" },
	{ days: 84, label: "12 weeks" },
];

const isValidTimeZone = (value: string) => {
	const normalized = value.trim();
	if (!normalized) return false;
	try {
		new Intl.DateTimeFormat(undefined, { timeZone: normalized }).format(0);
		return true;
	} catch {
		return false;
	}
};

const getSupportedTimeZones = (detectedTimeZone: string) => {
	const withSupportedValues = Intl as typeof Intl & {
		supportedValuesOf?: (key: string) => string[];
	};
	const supported = withSupportedValues.supportedValuesOf?.("timeZone");
	if (supported?.length) {
		if (supported.includes(detectedTimeZone)) return supported;
		return [detectedTimeZone, ...supported];
	}
	const fallback = [
		"UTC",
		"America/New_York",
		"America/Chicago",
		"America/Denver",
		"America/Los_Angeles",
		"Europe/London",
		"Europe/Berlin",
		"Asia/Tokyo",
		"Australia/Sydney",
	];
	if (fallback.includes(detectedTimeZone)) return fallback;
	return [detectedTimeZone, ...fallback];
};

function formatHorizon(days: number): string {
	const match = horizonOptions.find((opt) => opt.days === days);
	if (match) return match.label;
	const weeks = Math.round(days / 7);
	if (weeks > 0 && days % 7 === 0) return `${weeks} week${weeks > 1 ? "s" : ""}`;
	return `${days} days`;
}

export default function GeneralSettingsPage() {
	const [editing, setEditing] = useState<EditingRow>(null);
	const [savedRow, setSavedRow] = useState<EditingRow>(null);

	const detectedTimeZone = useMemo(() => detectLocalTimeZone(), []);
	const detectedTimeFormatPreference = useMemo(() => detectLocalTimeFormatPreference(), []);
	const timeZoneOptions = useMemo(
		() => getSupportedTimeZones(detectedTimeZone),
		[detectedTimeZone],
	);

	const preferencesQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getCalendarDisplayPreferences,
		{},
	);
	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);

	const timezone = preferencesQuery.data?.timezone ?? detectedTimeZone;
	const timeFormatPreference =
		preferencesQuery.data?.timeFormatPreference ?? detectedTimeFormatPreference;
	const schedulingHorizonDays = schedulingDefaultsQuery.data?.schedulingHorizonDays ?? 75;
	const weekStartsOn = schedulingDefaultsQuery.data?.weekStartsOn ?? 1;
	const dateFormat = schedulingDefaultsQuery.data?.dateFormat ?? "MM/DD/YYYY";

	const [timezoneDraft, setTimezoneDraft] = useState(timezone);

	useEffect(() => {
		if (preferencesQuery.data?.timezone) {
			setTimezoneDraft(preferencesQuery.data.timezone);
		}
	}, [preferencesQuery.data?.timezone]);

	const { mutate: setCalendarDisplayPreferences } = useMutationWithStatus(
		api.hours.mutations.setCalendarDisplayPreferences,
	);
	const { mutate: persistSchedulingHorizonDays } = useMutationWithStatus(
		api.hours.mutations.setSchedulingHorizonDays,
	);
	const { mutate: persistWeekStartsOn } = useMutationWithStatus(
		api.hours.mutations.setWeekStartsOn,
	);
	const { mutate: persistDateFormat } = useMutationWithStatus(api.hours.mutations.setDateFormat);
	const { mutate: persistTimeFormatPreference } = useMutationWithStatus(
		api.hours.mutations.setTimeFormatPreference,
	);

	const flashSaved = useCallback((row: EditingRow) => {
		setSavedRow(row);
		setTimeout(() => setSavedRow(null), 1200);
	}, []);

	const saveTimezone = useCallback(async () => {
		const normalized = timezoneDraft.trim();
		if (!isValidTimeZone(normalized)) return;
		try {
			await setCalendarDisplayPreferences({
				timezone: normalized,
				timeFormatPreference,
			});
			flashSaved("timezone");
		} catch {
			/* mutation error handled by convex */
		}
		setEditing(null);
	}, [timezoneDraft, timeFormatPreference, setCalendarDisplayPreferences, flashSaved]);

	const saveHorizon = useCallback(
		async (days: number) => {
			try {
				await persistSchedulingHorizonDays({ days });
				flashSaved("horizon");
			} catch {
				/* mutation error handled by convex */
			}
			setEditing(null);
		},
		[persistSchedulingHorizonDays, flashSaved],
	);

	const saveWeekStart = useCallback(
		async (day: 0 | 1 | 2 | 3 | 4 | 5 | 6) => {
			try {
				await persistWeekStartsOn({ day });
				flashSaved("weekStart");
			} catch {
				/* mutation error handled by convex */
			}
			setEditing(null);
		},
		[persistWeekStartsOn, flashSaved],
	);

	const saveDateFormat = useCallback(
		async (format: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD") => {
			try {
				await persistDateFormat({ format });
				flashSaved("dateFormat");
			} catch {
				/* mutation error handled by convex */
			}
			setEditing(null);
		},
		[persistDateFormat, flashSaved],
	);

	const saveTimeFormat = useCallback(
		async (pref: "12h" | "24h") => {
			try {
				await persistTimeFormatPreference({ timeFormatPreference: pref });
				flashSaved("timeFormat");
			} catch {
				/* mutation error handled by convex */
			}
			setEditing(null);
		},
		[persistTimeFormatPreference, flashSaved],
	);

	const rows: {
		key: EditingRow & string;
		label: string;
		icon: React.ReactNode;
		displayValue: string;
		editor: React.ReactNode;
	}[] = [
		{
			key: "timezone",
			label: "Timezone",
			icon: <Globe className="size-4 text-muted-foreground/60" />,
			displayValue: timezone,
			editor: (
				<div className="flex items-center gap-2">
					<Input
						list="tz-general-options"
						value={timezoneDraft}
						onChange={(e) => setTimezoneDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") void saveTimezone();
							if (e.key === "Escape") setEditing(null);
						}}
						placeholder="e.g. America/New_York"
						className="max-w-[260px]"
						autoFocus
					/>
					<datalist id="tz-general-options">
						{timeZoneOptions.map((zone) => (
							<option key={zone} value={zone} />
						))}
					</datalist>
				</div>
			),
		},
		{
			key: "horizon",
			label: "Scheduling window",
			icon: <Hash className="size-4 text-muted-foreground/60" />,
			displayValue: formatHorizon(schedulingHorizonDays),
			editor: (
				<Select
					value={String(schedulingHorizonDays)}
					onValueChange={(value) => void saveHorizon(Number(value))}
				>
					<SelectTrigger className="max-w-[180px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{horizonOptions.map((opt) => (
							<SelectItem key={opt.days} value={String(opt.days)}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			),
		},
		{
			key: "weekStart",
			label: "Start of week",
			icon: <Hash className="size-4 text-muted-foreground/60" />,
			displayValue: weekDayLabels[weekStartsOn] ?? "Monday",
			editor: (
				<Select
					value={String(weekStartsOn)}
					onValueChange={(value) => void saveWeekStart(Number(value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
				>
					<SelectTrigger className="max-w-[180px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{[0, 1, 2, 3, 4, 5, 6].map((day) => (
							<SelectItem key={day} value={String(day)}>
								{weekDayLabels[day]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			),
		},
		{
			key: "dateFormat",
			label: "Date format",
			icon: <Hash className="size-4 text-muted-foreground/60" />,
			displayValue: dateFormatExamples[dateFormat] ?? dateFormat,
			editor: (
				<Select
					value={dateFormat}
					onValueChange={(value) =>
						void saveDateFormat(value as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD")
					}
				>
					<SelectTrigger className="max-w-[180px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
						<SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
						<SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
					</SelectContent>
				</Select>
			),
		},
		{
			key: "timeFormat",
			label: "Time format",
			icon: <Hash className="size-4 text-muted-foreground/60" />,
			displayValue: timeFormatExamples[timeFormatPreference] ?? timeFormatPreference,
			editor: (
				<Select
					value={timeFormatPreference}
					onValueChange={(value) => void saveTimeFormat(value as "12h" | "24h")}
				>
					<SelectTrigger className="max-w-[180px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="12h">12-hour</SelectItem>
						<SelectItem value="24h">24-hour</SelectItem>
					</SelectContent>
				</Select>
			),
		},
	];

	return (
		<>
			<SettingsSectionHeader
				sectionNumber="01"
				sectionLabel="Display"
				title="Calendar & Display"
				description="Configure timezone, date formats, scheduling window, and display preferences."
			/>
			<div className="overflow-hidden rounded-xl border border-border/60">
				{rows.map((row, i) => {
					const isEditing = editing === row.key;
					const isSaved = savedRow === row.key;
					return (
						<div key={row.key}>
							{i > 0 && <div className="border-t border-border/40" />}
							<div
								className={cn(
									"group flex items-center gap-4 px-5 py-4 transition-colors duration-300",
									isSaved && "bg-accent/5",
								)}
							>
								{row.icon}
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-foreground">{row.label}</p>
									{isEditing ? (
										<div className="mt-2">{row.editor}</div>
									) : (
										<p
											className={cn(
												"mt-0.5 text-[13px] text-muted-foreground transition-colors duration-300",
												isSaved && "text-accent",
											)}
										>
											{row.displayValue}
										</p>
									)}
								</div>
								<button
									type="button"
									onClick={() => {
										if (isEditing) {
											if (row.key === "timezone") void saveTimezone();
											else setEditing(null);
										} else {
											if (row.key === "timezone") setTimezoneDraft(timezone);
											setEditing(row.key);
										}
									}}
									className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-muted/60 hover:text-foreground"
									aria-label={isEditing ? `Save ${row.label}` : `Edit ${row.label}`}
								>
									{isEditing ? <Check className="size-4" /> : <Pencil className="size-3.5" />}
								</button>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
