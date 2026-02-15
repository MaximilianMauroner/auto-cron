"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useUserPreferences } from "@/components/user-preferences-context";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useCustomer } from "autumn-js/react";
import { useConvexAuth } from "convex/react";
import {
	Bell,
	Calendar,
	CheckSquare,
	ChevronRight,
	ChevronsUpDown,
	CreditCard,
	Layers,
	LogOut,
	MessageSquare,
	Moon,
	Plus,
	Repeat,
	Rss,
	Settings,
	Sun,
	UserCircle,
	Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

const navItems = [
	{ title: "Calendar", href: "/app/calendar", icon: Calendar },
	{ title: "Tasks", href: "/app/tasks", icon: CheckSquare },
	{ title: "Habits", href: "/app/habits", icon: Repeat },
	{ title: "Priorities", href: "/app/priorities", icon: Layers },
	{ title: "Settings", href: "/app/settings", icon: Settings },
];

type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

const prettifyCalendarName = (id: string) => {
	if (id === "primary") return "Default";
	const withoutDomain = id.split("@")[0] ?? id;
	const looksOpaqueId = /^[a-z0-9]{20,}$/i.test(withoutDomain);
	if (looksOpaqueId) return "Google Calendar";
	return withoutDomain
		.replace(/[._-]+/g, " ")
		.replace(/\b\w/g, (character) => character.toUpperCase())
		.trim();
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

const formatDateForEvent = (date: Date): string => {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
};

export function AppSidebar() {
	const pathname = usePathname();
	const isCalendarRoute = pathname.startsWith("/app/calendar");
	const { user, signOut } = useAuth();
	const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
	const [isSigningOut, setIsSigningOut] = useState(false);
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const { weekStartsOn } = useUserPreferences();

	useEffect(() => {
		setMounted(true);
	}, []);

	// Autumn billing data
	const { customer } = useCustomer({ errorOnNotFound: false });
	const primaryProduct = useMemo(() => {
		const products = customer?.products ?? [];
		return products
			.filter((p: { status: string }) => ["active", "trialing", "past_due"].includes(p.status))
			.find((p: { is_add_on: boolean }) => !p.is_add_on);
	}, [customer]);
	const planName = (primaryProduct as { name?: string } | undefined)?.name ?? "Free";
	const isFreePlan =
		!primaryProduct || (primaryProduct as { id?: string } | undefined)?.id === "free";

	// Google calendars (calendar route only)
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		isCalendarRoute ? {} : "skip",
	);
	const googleCalendars = (googleCalendarsQuery.data ?? []) as GoogleCalendarListItem[];
	const isGoogleCalendarsLoading =
		isCalendarRoute && isAuthenticated && (isConvexAuthLoading || googleCalendarsQuery.isPending);
	const calendarAccounts = useMemo(() => {
		return googleCalendars
			.map((calendar) => ({
				id: calendar.id,
				name: calendar.name?.trim() ? calendar.name : prettifyCalendarName(calendar.id),
				color: resolveCalendarColor(calendar.color),
				isDefault: calendar.primary,
				isRemote: calendar.isExternal,
			}))
			.sort((a, b) => {
				if (a.isDefault && !b.isDefault) return -1;
				if (!a.isDefault && b.isDefault) return 1;
				return a.name.localeCompare(b.name);
			});
	}, [googleCalendars]);
	const orderedCalendars = useMemo(() => {
		return [...calendarAccounts].sort((a, b) => {
			if (a.isDefault && !b.isDefault) return -1;
			if (!a.isDefault && b.isDefault) return 1;
			if (!a.isRemote && b.isRemote) return -1;
			if (a.isRemote && !b.isRemote) return 1;
			return a.name.localeCompare(b.name);
		});
	}, [calendarAccounts]);

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

	// Mini date picker state (synced with calendar page via custom events)
	const [sidebarSelectedDate, setSidebarSelectedDate] = useState<Date>(new Date());

	useEffect(() => {
		const onDateChanged = (rawEvent: Event) => {
			const { date } = (rawEvent as CustomEvent<{ date?: string }>).detail ?? {};
			if (date) {
				const parsed = new Date(`${date}T12:00:00`);
				if (!Number.isNaN(parsed.getTime())) {
					setSidebarSelectedDate(parsed);
				}
			}
		};
		window.addEventListener("calendar:date-changed", onDateChanged);
		return () => window.removeEventListener("calendar:date-changed", onDateChanged);
	}, []);

	const handleDateSelect = useCallback((date: Date | undefined) => {
		if (!date) return;
		setSidebarSelectedDate(date);
		window.dispatchEvent(
			new CustomEvent("calendar:navigate-to-date", {
				detail: { date: formatDateForEvent(date) },
			}),
		);
	}, []);

	// User info
	const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
	const initials =
		[user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U";
	const email = user?.email ?? "";

	const handleSignOut = async () => {
		if (isSigningOut) return;
		setIsSigningOut(true);
		try {
			await signOut({ returnTo: "/" });
		} finally {
			setIsSigningOut(false);
		}
	};

	const openFeedbackDialog = useCallback(() => {
		window.dispatchEvent(new CustomEvent("open-feedback-dialog"));
	}, []);

	// Platform detection for keyboard shortcut display
	const isMac =
		mounted && typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

	return (
		<Sidebar collapsible="icon">
			{/* Header with branding */}
			<SidebarHeader className="border-b border-sidebar-border/40">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild tooltip="Auto Cron">
							<Link href="/app/calendar" className="flex items-center gap-2.5">
								<Image
									src="/logo.png"
									alt="Auto Cron"
									width={24}
									height={24}
									className="size-6 shrink-0 rounded-sm"
								/>
								<div className="flex flex-1 items-center justify-between">
									<span className="font-[family-name:var(--font-outfit)] text-sm font-semibold tracking-tight">
										Auto Cron
									</span>
									<kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-sidebar-border/60 bg-sidebar-accent/50 px-1.5 py-0.5 font-[family-name:var(--font-cutive)] text-[9px] text-muted-foreground">
										{isMac ? "\u2318" : "Ctrl+"}B
									</kbd>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent className="flex flex-col overflow-hidden">
				{/* Navigation */}
				<SidebarGroup className="gap-0.5 p-1">
					<SidebarGroupLabel className="font-[family-name:var(--font-cutive)]">
						Navigation
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										asChild
										isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
										tooltip={item.title}
									>
										<Link href={item.href} className="relative flex w-full items-center gap-2.5">
											<item.icon className="size-3.5 shrink-0" />
											<span className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium">
												{item.title}
											</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Mini date picker (calendar route only) */}
				{isCalendarRoute ? (
					<SidebarGroup className="gap-0.5 px-1 pt-0 pb-1 group-data-[collapsible=icon]:hidden">
						<SidebarGroupContent>
							<DatePickerCalendar
								mode="single"
								selected={sidebarSelectedDate}
								onSelect={handleDateSelect}
								weekStartsOn={weekStartsOn}
								className="w-full rounded-md border border-sidebar-border/60 bg-sidebar-accent/30 p-1.5 [--cell-size:--spacing(5)]"
							/>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}

				{/* Google Calendars (calendar route only) */}
				{isCalendarRoute ? (
					<SidebarGroup className="mt-auto gap-0.5 p-1 group-data-[collapsible=icon]:hidden">
						<Collapsible defaultOpen className="group/calendars">
							<SidebarGroupLabel asChild className="font-[family-name:var(--font-cutive)]">
								<CollapsibleTrigger className="flex w-full items-center">
									Google Calendars
									<ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-[state=open]/calendars:rotate-90" />
								</CollapsibleTrigger>
							</SidebarGroupLabel>
							<CollapsibleContent>
								<div className="mt-1 rounded-lg border border-sidebar-border/60 bg-sidebar-accent p-2">
									{email ? (
										<div className="font-[family-name:var(--font-outfit)] px-1 pb-1 text-[0.72rem] text-muted-foreground/85">
											{email}
										</div>
									) : null}
									<div className="grid gap-0.5">
										{isGoogleCalendarsLoading ? (
											<div className="rounded-md px-1.5 py-1 text-[0.74rem] text-muted-foreground/80">
												Loading calendars…
											</div>
										) : (
											orderedCalendars.map((calendar) => {
												const isHidden = hiddenCalendarIds.has(calendar.id);
												return (
													<div
														key={calendar.id}
														title={calendar.name}
														className={`flex min-w-0 items-center rounded-md px-1.5 py-1 text-[0.74rem] text-sidebar-foreground/80 hover:bg-sidebar-accent ${isHidden ? "opacity-40" : ""}`}
													>
														<button
															type="button"
															onClick={() => toggleCalendar(calendar.id)}
															className="shrink-0 cursor-pointer rounded p-0.5 transition-opacity hover:bg-sidebar-border/50"
															title={isHidden ? `Show ${calendar.name}` : `Hide ${calendar.name}`}
														>
															{calendar.isRemote ? (
																<Rss
																	className="size-3.5"
																	style={{
																		color: isHidden ? undefined : calendar.color,
																	}}
																/>
															) : (
																<span
																	className="block size-2.5 rounded-[4px]"
																	style={{
																		backgroundColor: isHidden ? "transparent" : calendar.color,
																		border: isHidden ? `1.5px solid ${calendar.color}` : undefined,
																	}}
																/>
															)}
														</button>
														<div className="ml-1.5 flex min-w-0 flex-1 items-center gap-2">
															<span className="font-[family-name:var(--font-outfit)] truncate">
																{calendar.name}
															</span>
														</div>
														{calendar.isDefault ? (
															<span className="font-[family-name:var(--font-cutive)] ml-2 shrink-0 text-[0.66rem] text-muted-foreground">
																Default
															</span>
														) : null}
													</div>
												);
											})
										)}
										<button
											type="button"
											disabled
											aria-label="Add calendar account (coming soon)"
											title="Add calendar account (coming soon)"
											className="mt-1 inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-left font-[family-name:var(--font-outfit)] text-[0.72rem] text-muted-foreground/70 disabled:cursor-not-allowed"
										>
											<Plus className="size-3.5" />
											Add calendar account
										</button>
									</div>
								</div>
							</CollapsibleContent>
						</Collapsible>
					</SidebarGroup>
				) : null}
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					{/* Theme toggle */}
					{mounted ? (
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
								onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
							>
								{resolvedTheme === "dark" ? (
									<Sun className="size-3.5" />
								) : (
									<Moon className="size-3.5" />
								)}
								<span className="font-[family-name:var(--font-outfit)] text-[0.76rem] font-medium">
									{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					) : null}

					{/* User menu */}
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									tooltip={displayName}
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="size-8 rounded-lg">
										<AvatarImage src={user?.profilePictureUrl ?? undefined} alt={displayName} />
										<AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="font-[family-name:var(--font-outfit)] truncate font-medium">
											{displayName}
										</span>
										<span className="font-[family-name:var(--font-cutive)] truncate text-[0.66rem] tracking-[0.02em] text-muted-foreground">
											{planName} plan
										</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
								side="bottom"
								align="end"
								sideOffset={4}
							>
								{/* Header */}
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="size-8 rounded-lg">
											<AvatarImage src={user?.profilePictureUrl ?? undefined} alt={displayName} />
											<AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="font-[family-name:var(--font-outfit)] truncate font-medium">
												{displayName}
											</span>
											<span className="font-[family-name:var(--font-cutive)] truncate text-[0.66rem] tracking-[0.02em] text-muted-foreground">
												{email}
											</span>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />

								{/* Upgrade CTA for free users */}
								{isFreePlan ? (
									<>
										<DropdownMenuItem asChild>
											<Link
												href="/app/pricing"
												className="font-[family-name:var(--font-outfit)] font-medium text-amber-600 dark:text-amber-400"
											>
												<Zap className="text-amber-500" />
												Upgrade to Plus
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
									</>
								) : null}

								{/* Account */}
								<DropdownMenuGroup>
									<DropdownMenuItem asChild>
										<Link href="/app/settings/account">
											<UserCircle />
											Account
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link href="/app/pricing">
											<CreditCard />
											Billing
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link href="/app/settings/notifications">
											<Bell />
											Notifications
										</Link>
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />

								{/* Support */}
								<DropdownMenuGroup>
									<DropdownMenuItem onClick={openFeedbackDialog}>
										<MessageSquare />
										Feedback
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />

								{/* Sign out */}
								<DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
									<LogOut />
									{isSigningOut ? "Signing out..." : "Log out"}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
