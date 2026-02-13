"use client";

import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { cn } from "@/lib/utils";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useCustomer } from "autumn-js/react";
import { CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";

type UsageItem = {
	id: string;
	name: string;
	usage: number;
	limit: number | null;
	percent: number;
	remaining: number | null;
};

type CustomerProductStatus = "active" | "trialing" | "past_due" | "scheduled" | "expired";

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
	const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);

	const googleSyncHealthQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.getGoogleSyncHealth,
		{},
	);
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);

	const {
		customer,
		isLoading: isCustomerLoading,
		openBillingPortal,
	} = useCustomer({
		errorOnNotFound: false,
	});

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
		<>
			<SettingsSectionHeader
				sectionNumber="04"
				sectionLabel="Account"
				title="Account & Sync"
				description="Manage your subscription, usage limits, connected services, and billing."
			/>

			<div className="space-y-4">
				{/* Plan + Profile row */}
				<div className="grid gap-4 md:grid-cols-2">
					{/* Current plan */}
					<div className="rounded-xl border border-border/60 p-5">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
									Current plan
								</p>
								<p className="mt-1 text-lg font-semibold text-foreground">
									{primaryProduct?.name || prettifyKey(primaryProduct?.id ?? "free")}
								</p>
							</div>
							{primaryProduct ? (
								<Badge
									variant="outline"
									className={cn(
										"text-[0.68rem] capitalize",
										statusBadgeClass[primaryProduct.status as CustomerProductStatus],
									)}
								>
									{formatStatusLabel(primaryProduct.status as CustomerProductStatus)}
								</Badge>
							) : (
								<Badge variant="outline" className="text-[0.68rem]">
									Not subscribed
								</Badge>
							)}
						</div>
						<div className="mt-3 grid gap-1 text-xs text-muted-foreground">
							<p>Started: {formatDateTime(primaryProduct?.started_at)}</p>
							<p>Renews: {formatDateTime(primaryProduct?.current_period_end)}</p>
							<p>Trial ends: {formatDateTime(primaryProduct?.trial_ends_at)}</p>
						</div>
						<div className="mt-4 flex flex-wrap items-center gap-2">
							<Button
								size="sm"
								onClick={() => void onOpenBillingPortal()}
								disabled={isOpeningBillingPortal || isCustomerLoading}
								className="gap-1.5"
							>
								<CreditCard className="size-3.5" />
								{isOpeningBillingPortal ? "Opening..." : "Manage billing"}
							</Button>
							<Button asChild variant="outline" size="sm" className="gap-1.5">
								<Link href="/app/pricing">
									<ExternalLink className="size-3" />
									Plans
								</Link>
							</Button>
						</div>
					</div>

					{/* Profile + Sync */}
					<div className="rounded-xl border border-border/60 p-5">
						<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							Profile
						</p>
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
							<div className="flex items-center justify-between gap-3">
								<span>Last sync</span>
								<span className="font-medium text-foreground">
									{formatDateTime(googleSyncHealth?.latestRunCompletedAt)}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Usage */}
				<div className="rounded-xl border border-border/60 p-5">
					<div className="mb-3 flex items-center justify-between gap-3">
						<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							Usage this cycle
						</p>
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
						<div className="grid gap-3 sm:grid-cols-2">
							{usageItems.map((item) => (
								<div key={item.id} className="rounded-lg border border-border/50 p-3">
									<div className="mb-2 flex items-center justify-between gap-3">
										<p className="text-sm font-medium text-foreground">{item.name}</p>
										<p className="text-xs text-muted-foreground">
											{item.limit === null ? `${item.usage} used` : `${item.usage} / ${item.limit}`}
										</p>
									</div>
									<Progress value={item.limit ? item.percent : 0} className="h-1.5" />
									<p className="mt-1.5 text-[11px] text-muted-foreground">
										{item.limit === null
											? "No hard limit"
											: `${item.remaining ?? 0} remaining (${item.percent}%)`}
									</p>
								</div>
							))}
						</div>
					)}
				</div>

				{errorMessage ? (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{errorMessage}
					</div>
				) : null}
			</div>
		</>
	);
}
