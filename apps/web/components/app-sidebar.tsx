"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "@/components/ui/sidebar";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth, useQuery } from "convex/react";
import {
	Bell,
	Calendar,
	CheckSquare,
	ChevronsUpDown,
	CreditCard,
	LogOut,
	Moon,
	Plus,
	Repeat,
	Rss,
	Settings,
	Sun,
	UserCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

const navItems = [
	{ title: "Calendar", href: "/calendar", icon: Calendar },
	{ title: "Tasks", href: "/tasks", icon: CheckSquare },
	{ title: "Habits", href: "/habits", icon: Repeat },
];

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

export function AppSidebar() {
	const pathname = usePathname();
	const isCalendarRoute = pathname.startsWith("/calendar");
	const { user, signOut } = useAuth();
	const { isAuthenticated } = useConvexAuth();
	const [isSigningOut, setIsSigningOut] = useState(false);
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const googleCalendars = useQuery(
		api.calendar.queries.listGoogleCalendars,
		isCalendarRoute && isAuthenticated ? {} : "skip",
	);
	const calendarAccounts = useMemo(() => {
		return (googleCalendars ?? [])
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
	const localCalendars = useMemo(
		() => calendarAccounts.filter((calendar) => !calendar.isRemote),
		[calendarAccounts],
	);
	const remoteCalendars = useMemo(
		() => calendarAccounts.filter((calendar) => calendar.isRemote),
		[calendarAccounts],
	);

	const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
	const initials =
		[user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U";
	const email = user?.email ?? "";

	const handleSignOut = async () => {
		if (isSigningOut) return;
		setIsSigningOut(true);
		try {
			await signOut({ returnTo: "/sign-in" });
		} finally {
			setIsSigningOut(false);
		}
	};

	return (
		<Sidebar>
			<SidebarHeader className="px-4 py-4">
				<h2 className="text-[0.85rem] font-semibold tracking-tight">Auto Cron</h2>
			</SidebarHeader>
			<SidebarContent className="flex flex-col overflow-hidden">
				<SidebarGroup className="gap-0.5 p-1">
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton asChild isActive={pathname === item.href}>
										<Link href={item.href} className="relative flex w-full items-center gap-2.5">
											<item.icon className="size-3.5 shrink-0" />
											<span className="text-[0.76rem] font-medium">{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{isCalendarRoute ? (
					<SidebarGroup className="mt-auto gap-2 p-1">
						<SidebarGroupLabel>Scheduling</SidebarGroupLabel>
						<div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-2">
							<div className="px-1 pb-1 text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
								Google Calendars
							</div>
							<div className="grid gap-0.5">
								{localCalendars.map((calendar) => (
									<div
										key={calendar.id}
										title={calendar.name}
										className="flex min-w-0 items-center rounded-md px-1.5 py-1 text-[0.74rem] text-sidebar-foreground/80 hover:bg-sidebar-accent"
									>
										<div className="flex min-w-0 flex-1 items-center gap-2">
											<span
												className="size-2.5 rounded-[4px] shrink-0"
												style={{ backgroundColor: calendar.color }}
											/>
											<span className="truncate">{calendar.name}</span>
										</div>
										{calendar.isDefault ? (
											<span className="ml-2 shrink-0 text-[0.66rem] text-muted-foreground">
												Default
											</span>
										) : null}
									</div>
								))}
								{remoteCalendars.length ? (
									<div className="mt-1 border-t border-sidebar-border pt-1.5">
										<div className="px-1 pb-1 text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
											Subscribed
										</div>
										<div className="grid gap-0.5">
											{remoteCalendars.map((calendar) => (
												<div
													key={calendar.id}
													title={calendar.name}
													className="flex min-w-0 items-center rounded-md px-1.5 py-1 text-[0.72rem] text-sidebar-foreground/70 hover:bg-sidebar-accent"
												>
													<div className="flex min-w-0 flex-1 items-center gap-2">
														<Rss className="size-3.5 shrink-0" style={{ color: calendar.color }} />
														<span className="truncate">{calendar.name}</span>
													</div>
												</div>
											))}
										</div>
									</div>
								) : null}
								<button
									type="button"
									disabled
									aria-label="Add calendar account (coming soon)"
									title="Add calendar account (coming soon)"
									className="mt-1 inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[0.72rem] text-muted-foreground/70 disabled:cursor-not-allowed"
								>
									<Plus className="size-3.5" />
									Add calendar account
								</button>
							</div>
						</div>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="size-8 rounded-lg">
										<AvatarImage src={user?.profilePictureUrl ?? undefined} alt={displayName} />
										<AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{displayName}</span>
										<span className="truncate text-xs text-muted-foreground">{email}</span>
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
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="size-8 rounded-lg">
											<AvatarImage src={user?.profilePictureUrl ?? undefined} alt={displayName} />
											<AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-medium">{displayName}</span>
											<span className="truncate text-xs text-muted-foreground">{email}</span>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuItem asChild>
										<Link href="/settings">
											<UserCircle />
											Account
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link href="/pricing">
											<CreditCard />
											Billing
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link href="/settings">
											<Bell />
											Notifications
										</Link>
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								{mounted ? (
									<DropdownMenuItem
										onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
									>
										{resolvedTheme === "dark" ? <Sun /> : <Moon />}
										{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
									</DropdownMenuItem>
								) : null}
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
									<LogOut />
									{isSigningOut ? "Signing out..." : "Log out"}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
