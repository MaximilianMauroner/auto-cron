"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	detectLocalTimeFormatPreference,
	detectLocalTimeZone,
} from "@/components/user-preferences-context";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { cn } from "@/lib/utils";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useCustomer } from "autumn-js/react";
import {
	CalendarSync,
	Clock3,
	CreditCard,
	ExternalLink,
	Globe2,
	Link2,
	Save,
	Settings2,
	Sparkles,
	UserCircle2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";

type TimeFormatPreference = "12h" | "24h";
type SchedulingStepMinutes = 15 | 30 | 60;

type UsageItem = {
	id: string;
	name: string;
	usage: number;
	limit: number | null;
	percent: number;
	remaining: number | null;
};

type CustomerProductStatus = "active" | "trialing" | "past_due" | "scheduled" | "expired";

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

const fallbackTimeZones = [
	"UTC",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"Europe/London",
	"Europe/Berlin",
	"Asia/Tokyo",
	"Australia/Sydney",
] as const;

const getSupportedTimeZones = (detectedTimeZone: string) => {
	const withSupportedValues = Intl as typeof Intl & {
		supportedValuesOf?: (key: string) => string[];
	};
	const supported = withSupportedValues.supportedValuesOf?.("timeZone");
	if (supported?.length) {
		if (supported.includes(detectedTimeZone)) return supported;
		return [detectedTimeZone, ...supported];
	}
	if (fallbackTimeZones.includes(detectedTimeZone as (typeof fallbackTimeZones)[number])) {
		return [...fallbackTimeZones];
	}
	return [detectedTimeZone, ...fallbackTimeZones];
};

const prettifyKey = (value: string) =>
	value
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (timestamp?: number | null) => {
	if (!timestamp) return "-";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(timestamp));
};

const formatStatusLabel = (status: CustomerProductStatus) => {
	if (status === "trialing") return "Trial";
	if (status === "past_due") return "Past due";
	if (status === "scheduled") return "Scheduled";
	if (status === "expired") return "Expired";
	return "Active";
};

const statusBadgeClass: Record<CustomerProductStatus, string> = {
	active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
	trialing: "bg-sky-500/15 text-sky-700 border-sky-500/25",
	past_due: "bg-amber-500/15 text-amber-700 border-amber-500/25",
	scheduled: "bg-violet-500/15 text-violet-700 border-violet-500/25",
	expired: "bg-zinc-500/15 text-zinc-700 border-zinc-500/25",
};

const featurePriority = (id: string) => {
	if (id === "tasks") return 0;
	if (id === "habits") return 1;
	return 2;
};

export default function AccountSettingsPage() {
	const { user } = useAuth();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [schedulingSaved, setSchedulingSaved] = useState(false);
	const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);

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
	const googleSyncHealthQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.getGoogleSyncHealth,
		{},
	);
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);

	const { mutate: setCalendarDisplayPreferences, isPending: isSavingAccountSettings } =
		useMutationWithStatus(api.hours.mutations.setCalendarDisplayPreferences);
	const { mutate: setSchedulingDowntimeMinutes, isPending: isSavingDowntime } =
		useMutationWithStatus(api.hours.mutations.setSchedulingDowntimeMinutes);
	const { mutate: setSchedulingStepMinutes, isPending: isSavingStep } = useMutationWithStatus(
		api.hours.mutations.setSchedulingStepMinutes,
	);

	const {
		customer,
		isLoading: isCustomerLoading,
		openBillingPortal,
	} = useCustomer({
		errorOnNotFound: false,
	});

	const [timeZoneDraft, setTimeZoneDraft] = useState(detectedTimeZone);
	const [timeFormatDraft, setTimeFormatDraft] = useState<TimeFormatPreference>(
		detectedTimeFormatPreference,
	);
	const [downtimeDraft, setDowntimeDraft] = useState("0");
	const [schedulingStepDraft, setSchedulingStepDraft] = useState<SchedulingStepMinutes>(15);

	const normalizedTimeZoneDraft = timeZoneDraft.trim();
	const isTimeZoneDraftValid = isValidTimeZone(normalizedTimeZoneDraft);

	const allProducts = customer?.products ?? [];
	const activeProducts = useMemo(
		() =>
			allProducts.filter((product) =>
				["active", "trialing", "past_due", "scheduled"].includes(product.status),
			),
		[allProducts],
	);
	const primaryProduct = useMemo(
		() => activeProducts.find((product) => !product.is_add_on) ?? activeProducts[0] ?? null,
		[activeProducts],
	);
	const addOnProducts = useMemo(
		() => activeProducts.filter((product) => product.is_add_on),
		[activeProducts],
	);
	const usageItems = useMemo((): UsageItem[] => {
		if (!customer?.features) return [];
		return Object.entries(customer.features)
			.map(([id, feature]) => {
				const limitCandidate = feature.usage_limit ?? feature.included_usage ?? null;
				const hasFiniteLimit = Number.isFinite(limitCandidate);
				const limit = hasFiniteLimit ? Math.max(0, Number(limitCandidate)) : null;
				const usage = Math.max(0, feature.usage ?? 0);
				if (limit === null && usage === 0) return null;
				const percent = limit ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
				const remaining = limit ? Math.max(0, limit - usage) : null;
				return {
					id,
					name: feature.name || prettifyKey(id),
					usage,
					limit,
					percent,
					remaining,
				};
			})
			.filter((item): item is UsageItem => Boolean(item))
			.sort((left, right) => {
				const leftPriority = featurePriority(left.id);
				const rightPriority = featurePriority(right.id);
				if (leftPriority !== rightPriority) return leftPriority - rightPriority;
				if (left.percent !== right.percent) return right.percent - left.percent;
				return left.name.localeCompare(right.name);
			});
	}, [customer?.features]);

	const connectedCalendarsCount = (googleCalendarsQuery.data ?? []).length;
	const googleSyncHealth = googleSyncHealthQuery.data;

	useEffect(() => {
		if (!preferencesQuery.data) return;
		setTimeZoneDraft(preferencesQuery.data.timezone ?? detectedTimeZone);
		setTimeFormatDraft(preferencesQuery.data.timeFormatPreference ?? detectedTimeFormatPreference);
	}, [detectedTimeFormatPreference, detectedTimeZone, preferencesQuery.data]);

	useEffect(() => {
		if (!schedulingDefaultsQuery.data) return;
		setDowntimeDraft(String(schedulingDefaultsQuery.data.schedulingDowntimeMinutes));
		setSchedulingStepDraft(schedulingDefaultsQuery.data.schedulingStepMinutes);
	}, [schedulingDefaultsQuery.data]);

	const onSaveLocale = async () => {
		setErrorMessage(null);
		setSaved(false);
		if (!isTimeZoneDraftValid) {
			setErrorMessage("Timezone must be a valid IANA timezone identifier.");
			return;
		}
		try {
			const next = await setCalendarDisplayPreferences({
				timezone: normalizedTimeZoneDraft,
				timeFormatPreference: timeFormatDraft,
			});
			setTimeZoneDraft(next.timezone);
			setTimeFormatDraft(next.timeFormatPreference);
			setSaved(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not update preferences.");
		}
	};

	const onSaveScheduling = async () => {
		setErrorMessage(null);
		setSchedulingSaved(false);
		const downtimeMinutes = Number.parseInt(downtimeDraft.trim(), 10);
		if (!Number.isFinite(downtimeMinutes) || downtimeMinutes < 0) {
			setErrorMessage("Downtime must be a whole number of minutes (0 or greater).");
			return;
		}
		try {
			const [savedDowntime, savedStep] = await Promise.all([
				setSchedulingDowntimeMinutes({ minutes: downtimeMinutes }),
				setSchedulingStepMinutes({ minutes: schedulingStepDraft }),
			]);
			setDowntimeDraft(String(savedDowntime));
			setSchedulingStepDraft(savedStep);
			setSchedulingSaved(true);
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Could not update scheduling preferences.",
			);
		}
	};

	const onOpenBillingPortal = async () => {
		setErrorMessage(null);
		setIsOpeningBillingPortal(true);
		try {
			const result = await openBillingPortal({
				returnUrl: typeof window !== "undefined" ? window.location.href : undefined,
			});
			if (result.error) {
				throw new Error(result.error.message);
			}
			if (result.data?.url && typeof window !== "undefined") {
				window.location.assign(result.data.url);
			}
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Could not open billing portal.");
		} finally {
			setIsOpeningBillingPortal(false);
		}
	};

	const profileName =
		[user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "Unknown";
	const profileEmail = user?.email || customer?.email || "No email";

	return (
		<div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
			<Card className="relative overflow-hidden border-border/70 bg-card/70">
				<div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary/12 via-sky-500/8 to-emerald-500/10" />
				<CardHeader className="relative">
					<CardDescription className="text-xs uppercase tracking-[0.14em]">
						Account overview
					</CardDescription>
					<CardTitle className="flex items-center gap-2 text-xl">
						<UserCircle2 className="size-4 text-primary" />
						Subscription & Usage
					</CardTitle>
				</CardHeader>
				<CardContent className="relative space-y-5">
					<div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
						<div className="rounded-xl border border-border/70 bg-background/70 p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
										Current plan
									</p>
									<p className="mt-1 text-xl font-semibold text-foreground">
										{primaryProduct?.name || prettifyKey(primaryProduct?.id ?? "free")}
									</p>
								</div>
								{primaryProduct ? (
									<Badge
										variant="outline"
										className={cn(
											"text-[0.72rem] capitalize",
											statusBadgeClass[primaryProduct.status as CustomerProductStatus],
										)}
									>
										{formatStatusLabel(primaryProduct.status as CustomerProductStatus)}
									</Badge>
								) : (
									<Badge variant="outline" className="text-[0.72rem]">
										Not subscribed
									</Badge>
								)}
							</div>
							<div className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
								<p>Started: {formatDateTime(primaryProduct?.started_at)}</p>
								<p>Renews: {formatDateTime(primaryProduct?.current_period_end)}</p>
								<p>Trial ends: {formatDateTime(primaryProduct?.trial_ends_at)}</p>
							</div>
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<Button
									onClick={() => void onOpenBillingPortal()}
									disabled={isOpeningBillingPortal || isCustomerLoading}
									className="gap-1.5"
								>
									<CreditCard className="size-3.5" />
									{isOpeningBillingPortal ? "Opening..." : "Manage billing"}
								</Button>
								<Button asChild variant="outline" className="gap-1.5">
									<Link href="/app/pricing">
										<ExternalLink className="size-3.5" />
										View plans
									</Link>
								</Button>
							</div>
						</div>
						<div className="rounded-xl border border-border/70 bg-background/70 p-4">
							<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Profile</p>
							<p className="mt-1 text-base font-semibold text-foreground">{profileName}</p>
							<p className="text-sm text-muted-foreground">{profileEmail}</p>
							<Separator className="my-3" />
							<div className="space-y-2 text-xs text-muted-foreground">
								<div className="flex items-center justify-between gap-3">
									<span>Connected calendars</span>
									<span className="font-medium text-foreground">{connectedCalendarsCount}</span>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span>Google sync</span>
									<Badge variant="outline" className="text-[0.68rem]">
										{googleSyncHealth?.googleConnected ? "Connected" : "Not connected"}
									</Badge>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span>Sync channels</span>
									<span className="font-medium text-foreground">
										{googleSyncHealth?.activeChannels ?? 0}
									</span>
								</div>
							</div>
						</div>
					</div>

					<div className="rounded-xl border border-border/70 bg-background/70 p-4">
						<div className="mb-3 flex items-center justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
									Usage this cycle
								</p>
								<p className="text-sm text-muted-foreground">
									Tracked feature limits and remaining capacity.
								</p>
							</div>
							{addOnProducts.length > 0 ? (
								<Badge variant="outline" className="text-[0.68rem]">
									{addOnProducts.length} add-on{addOnProducts.length > 1 ? "s" : ""}
								</Badge>
							) : null}
						</div>
						{isCustomerLoading ? (
							<p className="text-sm text-muted-foreground">Loading subscription data...</p>
						) : usageItems.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No metered usage data available for the current plan.
							</p>
						) : (
							<div className="grid gap-3 md:grid-cols-2">
								{usageItems.map((item) => (
									<div key={item.id} className="rounded-lg border border-border/70 bg-card/60 p-3">
										<div className="mb-2 flex items-center justify-between gap-3">
											<p className="text-sm font-medium text-foreground">{item.name}</p>
											<p className="text-xs text-muted-foreground">
												{item.limit === null
													? `${item.usage} used`
													: `${item.usage} / ${item.limit}`}
											</p>
										</div>
										<Progress value={item.limit ? item.percent : 0} className="h-2" />
										<p className="mt-2 text-xs text-muted-foreground">
											{item.limit === null
												? "No hard limit"
												: `${item.remaining ?? 0} remaining (${item.percent}% used)`}
										</p>
									</div>
								))}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<div className="space-y-4">
				<Card className="border-border/70 bg-card/70">
					<CardHeader>
						<CardDescription className="text-xs uppercase tracking-[0.14em]">
							Calendar locale
						</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl">
							<Globe2 className="size-4 text-primary" />
							Timezone & Format
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="account-timezone" className="text-sm">
								Timezone
							</Label>
							<div className="flex flex-col gap-2 sm:flex-row">
								<div className="flex-1">
									<Input
										id="account-timezone"
										list="timezone-options"
										value={timeZoneDraft}
										onChange={(event) => {
											setTimeZoneDraft(event.target.value);
											if (saved) setSaved(false);
										}}
										placeholder="e.g. America/New_York"
										aria-invalid={!isTimeZoneDraftValid}
									/>
									<datalist id="timezone-options">
										{timeZoneOptions.map((zone) => (
											<option key={zone} value={zone} />
										))}
									</datalist>
								</div>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setTimeZoneDraft(detectedTimeZone);
										if (saved) setSaved(false);
									}}
								>
									Use browser
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="account-time-format" className="text-sm">
								Time format
							</Label>
							<Select
								value={timeFormatDraft}
								onValueChange={(value) => {
									setTimeFormatDraft(value as TimeFormatPreference);
									if (saved) setSaved(false);
								}}
							>
								<SelectTrigger id="account-time-format" className="max-w-[220px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="12h">
										<div className="flex items-center gap-2">
											<Clock3 className="size-3.5" />
											12-hour (1:30 PM)
										</div>
									</SelectItem>
									<SelectItem value="24h">
										<div className="flex items-center gap-2">
											<Clock3 className="size-3.5" />
											24-hour (13:30)
										</div>
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center gap-3">
							<Button
								onClick={() => void onSaveLocale()}
								disabled={isSavingAccountSettings || !isTimeZoneDraftValid}
							>
								<Save className="size-4" />
								Save locale
							</Button>
							{saved ? (
								<span className="text-sm text-emerald-600">Saved.</span>
							) : (
								<span className="text-xs text-muted-foreground">
									Detected: {detectedTimeZone} / {detectedTimeFormatPreference}
								</span>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-card/70">
					<CardHeader>
						<CardDescription className="text-xs uppercase tracking-[0.14em]">
							Scheduling defaults
						</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl">
							<Settings2 className="size-4 text-primary" />
							Downtime & Step
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="account-downtime">Downtime between scheduled blocks</Label>
							<div className="flex items-center gap-2">
								<Input
									id="account-downtime"
									type="number"
									min={0}
									step={1}
									value={downtimeDraft}
									onChange={(event) => {
										setDowntimeDraft(event.target.value);
										setSchedulingSaved(false);
									}}
									className="max-w-[140px]"
								/>
								<span className="text-xs text-muted-foreground">minutes</span>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="account-step-size">Global calendar time step</Label>
							<Select
								value={String(schedulingStepDraft)}
								onValueChange={(value) => {
									setSchedulingStepDraft(Number.parseInt(value, 10) as SchedulingStepMinutes);
									setSchedulingSaved(false);
								}}
							>
								<SelectTrigger id="account-step-size" className="max-w-[180px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="15">15 minutes</SelectItem>
									<SelectItem value="30">30 minutes</SelectItem>
									<SelectItem value="60">60 minutes</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center gap-3">
							<Button
								onClick={() => void onSaveScheduling()}
								disabled={isSavingDowntime || isSavingStep}
							>
								<Save className="size-4" />
								Save scheduling
							</Button>
							{schedulingSaved ? <span className="text-sm text-emerald-600">Saved.</span> : null}
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-card/70">
					<CardHeader>
						<CardDescription className="text-xs uppercase tracking-[0.14em]">
							Connected services
						</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl">
							<CalendarSync className="size-4 text-primary" />
							Sync & Shortcuts
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="grid gap-2 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Google account</span>
								<Badge variant="outline">
									{googleSyncHealth?.googleConnected ? "Connected" : "Not connected"}
								</Badge>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Watch channels</span>
								<span className="font-medium">{googleSyncHealth?.activeChannels ?? 0}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Last sync run</span>
								<span className="font-medium">
									{formatDateTime(googleSyncHealth?.latestRunCompletedAt)}
								</span>
							</div>
						</div>
						<Separator />
						<div className="grid gap-2">
							<Button asChild variant="outline" className="justify-between">
								<Link href="/app/settings/hours">
									<span className="inline-flex items-center gap-1.5">
										<Link2 className="size-3.5" />
										Working hours
									</span>
									<ExternalLink className="size-3.5" />
								</Link>
							</Button>
							<Button asChild variant="outline" className="justify-between">
								<Link href="/app/settings/scheduling">
									<span className="inline-flex items-center gap-1.5">
										<Sparkles className="size-3.5" />
										Advanced scheduling
									</span>
									<ExternalLink className="size-3.5" />
								</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			{errorMessage ? (
				<div className="xl:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}
		</div>
	);
}
