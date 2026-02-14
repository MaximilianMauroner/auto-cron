"use client";

import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { cn } from "@/lib/utils";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Calendar, CheckCircle2, Clock, RefreshCw, Rss, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";

type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

const resolveCalendarColor = (value?: string) => {
	if (!value) return "#5b8def";
	if (value.startsWith("#")) return value;
	const palette: Record<string, string> = {
		"1": "#7ba0e6",
		"2": "#5cc9a0",
		"3": "#b08ce6",
		"4": "#d97b74",
		"5": "#d4b84e",
		"6": "#f29468",
		"7": "#58c4dd",
		"8": "#4fc3a1",
		"9": "#6579cb",
		"10": "#b39ddb",
		"11": "#f4a5c1",
	};
	return palette[value] ?? "#5b8def";
};

const prettifyCalendarName = (id: string) => {
	if (id === "primary") return "Default";
	const withoutDomain = id.split("@")[0] ?? id;
	const looksOpaqueId = /^[a-z0-9]{20,}$/i.test(withoutDomain);
	if (looksOpaqueId) return "Google Calendar";
	return withoutDomain
		.replace(/[._-]+/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
};

const accessRoleLabel: Record<string, string> = {
	owner: "Owner",
	writer: "Read & Write",
	reader: "Read-only",
	freeBusyReader: "Free/Busy",
};

const formatRelativeTime = (timestamp?: number | null) => {
	if (!timestamp) return "Never";
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

export default function CalendarsSettingsPage() {
	const { user } = useAuth();

	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const googleSyncHealthQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.getGoogleSyncHealth,
		{},
	);

	const googleCalendars = (googleCalendarsQuery.data ?? []) as GoogleCalendarListItem[];
	const googleSyncHealth = googleSyncHealthQuery.data;
	const isLoading = googleCalendarsQuery.isPending;

	const [hiddenCalendarIds, setHiddenCalendarIds] = useState<Set<string>>(new Set());

	useEffect(() => {
		const onHiddenChanged = (rawEvent: Event) => {
			const { hiddenCalendarIds: ids } =
				(rawEvent as CustomEvent<{ hiddenCalendarIds?: string[] }>).detail ?? {};
			if (ids) setHiddenCalendarIds(new Set(ids));
		};
		window.addEventListener("calendar:hidden-calendars-changed", onHiddenChanged);
		return () => {
			window.removeEventListener("calendar:hidden-calendars-changed", onHiddenChanged);
		};
	}, []);

	const toggleCalendar = useCallback((calendarId: string) => {
		window.dispatchEvent(
			new CustomEvent("calendar:toggle-calendar", {
				detail: { calendarId },
			}),
		);
	}, []);

	const ownedCalendars = googleCalendars.filter((c) => !c.isExternal);
	const externalCalendars = googleCalendars.filter((c) => c.isExternal);
	const email = user?.email ?? "";

	return (
		<>
			<SettingsSectionHeader
				sectionNumber="05"
				sectionLabel="Calendars"
				title="Calendar Connections"
				description="Manage which Google calendars are visible on your schedule."
			/>

			<div className="space-y-5">
				{/* Google Account + Sync status */}
				<div className="grid gap-4 md:grid-cols-2">
					{/* Connected account */}
					<div className="rounded-xl border border-border/60 p-5">
						<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							Google Account
						</p>
						<div className="mt-3 flex items-center gap-3">
							<div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
								<Calendar className="size-4 text-primary" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-[family-name:var(--font-outfit)] text-sm font-medium text-foreground truncate">
									{email || "No account connected"}
								</p>
								<p className="text-xs text-muted-foreground">
									{googleCalendars.length} calendar{googleCalendars.length !== 1 ? "s" : ""} found
								</p>
							</div>
							{googleSyncHealth?.googleConnected ? (
								<Badge
									variant="outline"
									className="shrink-0 text-[0.68rem] bg-emerald-500/15 text-emerald-700 border-emerald-500/25"
								>
									Connected
								</Badge>
							) : (
								<Badge
									variant="outline"
									className="shrink-0 text-[0.68rem] bg-zinc-500/15 text-zinc-700 border-zinc-500/25"
								>
									Not connected
								</Badge>
							)}
						</div>
					</div>

					{/* Sync health */}
					<div className="rounded-xl border border-border/60 p-5">
						<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							Sync Status
						</p>
						<div className="mt-3 space-y-2.5">
							<div className="flex items-center justify-between gap-3 text-xs">
								<span className="flex items-center gap-1.5 text-muted-foreground">
									{googleSyncHealth?.latestRunStatus === "completed" ? (
										<CheckCircle2 className="size-3 text-emerald-500" />
									) : googleSyncHealth?.latestRunStatus === "failed" ? (
										<XCircle className="size-3 text-destructive" />
									) : (
										<RefreshCw className="size-3 text-muted-foreground/60" />
									)}
									Last sync
								</span>
								<span className="font-medium text-foreground">
									{formatRelativeTime(googleSyncHealth?.latestRunCompletedAt)}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3 text-xs">
								<span className="flex items-center gap-1.5 text-muted-foreground">
									<RefreshCw className="size-3 text-muted-foreground/60" />
									Active channels
								</span>
								<span className="font-medium text-foreground">
									{googleSyncHealth?.activeChannels ?? 0}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3 text-xs">
								<span className="flex items-center gap-1.5 text-muted-foreground">
									<Clock className="size-3 text-muted-foreground/60" />
									Last webhook
								</span>
								<span className="font-medium text-foreground">
									{formatRelativeTime(googleSyncHealth?.lastWebhookAt)}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Calendars list */}
				<div className="rounded-xl border border-border/60">
					{/* Your calendars */}
					<div className="p-5 pb-0">
						<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							Your Calendars
						</p>
						<p className="mt-0.5 text-xs text-muted-foreground/80">
							Calendars you own or can edit. Toggle visibility on your schedule.
						</p>
					</div>

					{isLoading ? (
						<div className="p-5 text-sm text-muted-foreground">Loading calendars…</div>
					) : (
						<div className="px-2 py-3">
							{ownedCalendars.length === 0 ? (
								<div className="px-3 py-4 text-center text-sm text-muted-foreground/70">
									No calendars found
								</div>
							) : (
								ownedCalendars.map((calendar) => {
									const isHidden = hiddenCalendarIds.has(calendar.id);
									const color = resolveCalendarColor(calendar.color);
									const name = calendar.name?.trim()
										? calendar.name
										: prettifyCalendarName(calendar.id);
									return (
										// biome-ignore lint/a11y/noLabelWithoutControl: Radix Checkbox renders an internal button that acts as the control
										<label
											key={calendar.id}
											className={cn(
												"flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
												isHidden && "opacity-50",
											)}
										>
											<Checkbox
												checked={!isHidden}
												onCheckedChange={() => toggleCalendar(calendar.id)}
												style={
													!isHidden
														? ({
																"--color-primary": color,
																borderColor: color,
															} as React.CSSProperties)
														: undefined
												}
											/>
											<span
												className="size-2.5 shrink-0 rounded-[4px]"
												style={{ backgroundColor: color }}
											/>
											<span className="flex-1 truncate font-[family-name:var(--font-outfit)] text-sm text-foreground">
												{name}
											</span>
											{calendar.primary ? (
												<Badge variant="outline" className="text-[0.62rem] text-muted-foreground">
													Primary
												</Badge>
											) : null}
											<span className="shrink-0 font-[family-name:var(--font-cutive)] text-[0.62rem] text-muted-foreground/70">
												{accessRoleLabel[calendar.accessRole ?? "owner"] ?? "Owner"}
											</span>
										</label>
									);
								})
							)}
						</div>
					)}

					{externalCalendars.length > 0 ? (
						<>
							<Separator />
							<div className="p-5 pb-0">
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
									Subscribed Calendars
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground/80">
									Read-only calendars shared with you or subscribed via URL.
								</p>
							</div>
							<div className="px-2 py-3">
								{externalCalendars.map((calendar) => {
									const isHidden = hiddenCalendarIds.has(calendar.id);
									const color = resolveCalendarColor(calendar.color);
									const name = calendar.name?.trim()
										? calendar.name
										: prettifyCalendarName(calendar.id);
									return (
										// biome-ignore lint/a11y/noLabelWithoutControl: Radix Checkbox renders an internal button that acts as the control
										<label
											key={calendar.id}
											className={cn(
												"flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
												isHidden && "opacity-50",
											)}
										>
											<Checkbox
												checked={!isHidden}
												onCheckedChange={() => toggleCalendar(calendar.id)}
												style={
													!isHidden
														? ({
																"--color-primary": color,
																borderColor: color,
															} as React.CSSProperties)
														: undefined
												}
											/>
											<Rss className="size-3.5 shrink-0" style={{ color }} />
											<span className="flex-1 truncate font-[family-name:var(--font-outfit)] text-sm text-foreground">
												{name}
											</span>
											<span className="shrink-0 font-[family-name:var(--font-cutive)] text-[0.62rem] text-muted-foreground/70">
												{accessRoleLabel[calendar.accessRole ?? "reader"] ?? "Read-only"}
											</span>
										</label>
									);
								})}
							</div>
						</>
					) : null}
				</div>
			</div>
		</>
	);
}
