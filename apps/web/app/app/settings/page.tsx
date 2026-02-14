"use client";

import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { useCustomer } from "autumn-js/react";
import { ArrowUpRight, Check, ChevronsUpDown, Globe, Hash, Pencil } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { getMaxHorizonWeeks, isValidProductId } from "../../../../../convex/planLimits";

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
	{ weeks: 1, label: "1 week" },
	{ weeks: 2, label: "2 weeks" },
	{ weeks: 3, label: "3 weeks" },
	{ weeks: 4, label: "4 weeks" },
	{ weeks: 6, label: "6 weeks" },
	{ weeks: 8, label: "8 weeks" },
	{ weeks: 12, label: "12 weeks" },
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

function formatHorizon(weeks: number): string {
	const match = horizonOptions.find((opt) => opt.weeks === weeks);
	if (match) return match.label;
	return `${weeks} week${weeks !== 1 ? "s" : ""}`;
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

	const { customer, attach } = useCustomer({ errorOnNotFound: false });
	const autumnProductId = useMemo(() => {
		const products = customer?.products ?? [];
		const active = products.filter((p) => ["active", "trialing", "past_due"].includes(p.status));
		const primary = active.find((p) => !p.is_add_on) ?? active[0];
		return primary?.id && isValidProductId(primary.id) ? primary.id : undefined;
	}, [customer?.products]);

	const timezone = preferencesQuery.data?.timezone ?? detectedTimeZone;
	const timeFormatPreference =
		preferencesQuery.data?.timeFormatPreference ?? detectedTimeFormatPreference;
	const dbActiveProductId = schedulingDefaultsQuery.data?.activeProductId;
	const effectiveProductId = autumnProductId ?? dbActiveProductId;
	const maxHorizonWeeks = useMemo(
		() => getMaxHorizonWeeks(effectiveProductId),
		[effectiveProductId],
	);
	const filteredHorizonOptions = useMemo(
		() => horizonOptions.filter((opt) => opt.weeks <= maxHorizonWeeks),
		[maxHorizonWeeks],
	);

	// Sync DB activeProductId with Autumn's actual subscription.
	// If the customer has no plan at all, auto-attach the free plan.
	const { mutate: syncActiveProduct } = useMutationWithStatus(
		api.hours.mutations.updateActiveProduct,
	);
	const hasSynced = useRef(false);
	useEffect(() => {
		if (hasSynced.current || !customer) return;

		if (!autumnProductId) {
			// Customer exists but has no active plan — attach free
			hasSynced.current = true;
			void (async () => {
				try {
					await attach({ productId: "free" });
				} catch {
					// Best-effort; the backend still enforces limits
				}
				void syncActiveProduct({ productId: "free" });
			})();
		} else if (dbActiveProductId && autumnProductId !== dbActiveProductId) {
			// Plan mismatch — sync DB to match Autumn
			hasSynced.current = true;
			void syncActiveProduct({ productId: autumnProductId });
		}
	}, [autumnProductId, dbActiveProductId, customer, attach, syncActiveProduct]);
	const schedulingHorizonWeeks = Math.min(
		schedulingDefaultsQuery.data?.schedulingHorizonWeeks ?? maxHorizonWeeks,
		maxHorizonWeeks,
	);
	const weekStartsOn = schedulingDefaultsQuery.data?.weekStartsOn ?? 1;
	const dateFormat = schedulingDefaultsQuery.data?.dateFormat ?? "MM/DD/YYYY";

	const { mutate: setCalendarDisplayPreferences } = useMutationWithStatus(
		api.hours.mutations.setCalendarDisplayPreferences,
	);
	const { mutate: persistSchedulingHorizonWeeks } = useMutationWithStatus(
		api.hours.mutations.setSchedulingHorizonWeeks,
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

	const saveTimezone = useCallback(
		async (tz: string) => {
			if (!isValidTimeZone(tz)) return;
			try {
				await setCalendarDisplayPreferences({
					timezone: tz,
					timeFormatPreference,
				});
				flashSaved("timezone");
			} catch {
				/* mutation error handled by convex */
			}
			setEditing(null);
		},
		[timeFormatPreference, setCalendarDisplayPreferences, flashSaved],
	);

	const saveHorizon = useCallback(
		async (weeks: number) => {
			try {
				await persistSchedulingHorizonWeeks({ weeks });
				flashSaved("horizon");
			} catch {
				/* mutation error handled by convex */
			}
			setEditing(null);
		},
		[persistSchedulingHorizonWeeks, flashSaved],
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
		hint?: React.ReactNode;
	}[] = [
		{
			key: "timezone",
			label: "Timezone",
			icon: <Globe className="size-4 text-muted-foreground/80" />,
			displayValue: timezone,
			editor: (
				<Popover
					open
					onOpenChange={(open) => {
						if (!open) setEditing(null);
					}}
				>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="inline-flex h-9 w-full max-w-[280px] cursor-pointer items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm"
						>
							{timezone}
							<ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-[280px] p-0" align="start">
						<Command>
							<CommandInput placeholder="Search timezones..." />
							<CommandList>
								<CommandEmpty>No timezone found.</CommandEmpty>
								<CommandGroup heading="Detected">
									<CommandItem
										value={`${detectedTimeZone} browser detected`}
										onSelect={() => void saveTimezone(detectedTimeZone)}
									>
										<Globe className="size-4 text-accent" />
										{detectedTimeZone}
										{timezone === detectedTimeZone && <Check className="ml-auto size-4" />}
									</CommandItem>
								</CommandGroup>
								<CommandSeparator />
								<CommandGroup heading="All timezones">
									{timeZoneOptions.map((zone) => (
										<CommandItem key={zone} value={zone} onSelect={() => void saveTimezone(zone)}>
											{zone}
											{timezone === zone && <Check className="ml-auto size-4" />}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			),
		},
		{
			key: "horizon",
			label: "Scheduling window",
			icon: <Hash className="size-4 text-muted-foreground/80" />,
			displayValue: formatHorizon(schedulingHorizonWeeks),
			editor:
				filteredHorizonOptions.length <= 1 ? (
					<p className="text-[13px] text-muted-foreground">
						{formatHorizon(schedulingHorizonWeeks)} (plan maximum)
					</p>
				) : (
					<Select
						defaultOpen
						value={String(schedulingHorizonWeeks)}
						onValueChange={(value) => void saveHorizon(Number(value))}
						onOpenChange={(open) => {
							if (!open) setEditing(null);
						}}
					>
						<SelectTrigger className="max-w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{filteredHorizonOptions.map((opt) => (
								<SelectItem key={opt.weeks} value={String(opt.weeks)}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				),
			hint:
				maxHorizonWeeks < 12 ? (
					<Link
						href="/app/pricing"
						className="group/cta mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-0.5 text-[11px] font-medium text-accent/80 transition-all hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
					>
						Upgrade for longer windows
						<ArrowUpRight className="size-3 transition-transform group-hover/cta:-translate-y-px group-hover/cta:translate-x-px" />
					</Link>
				) : null,
		},
		{
			key: "weekStart",
			label: "Start of week",
			icon: <Hash className="size-4 text-muted-foreground/80" />,
			displayValue: weekDayLabels[weekStartsOn] ?? "Monday",
			editor: (
				<Select
					defaultOpen
					value={String(weekStartsOn)}
					onValueChange={(value) => void saveWeekStart(Number(value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
					onOpenChange={(open) => {
						if (!open) setEditing(null);
					}}
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
			icon: <Hash className="size-4 text-muted-foreground/80" />,
			displayValue: dateFormatExamples[dateFormat] ?? dateFormat,
			editor: (
				<Select
					defaultOpen
					value={dateFormat}
					onValueChange={(value) =>
						void saveDateFormat(value as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD")
					}
					onOpenChange={(open) => {
						if (!open) setEditing(null);
					}}
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
			icon: <Hash className="size-4 text-muted-foreground/80" />,
			displayValue: timeFormatExamples[timeFormatPreference] ?? timeFormatPreference,
			editor: (
				<Select
					defaultOpen
					value={timeFormatPreference}
					onValueChange={(value) => void saveTimeFormat(value as "12h" | "24h")}
					onOpenChange={(open) => {
						if (!open) setEditing(null);
					}}
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
									{row.hint}
								</div>
								<button
									type="button"
									onClick={() => {
										if (isEditing) {
											setEditing(null);
										} else {
											setEditing(row.key);
										}
									}}
									className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-muted/60 hover:text-foreground"
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
