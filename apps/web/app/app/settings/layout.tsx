"use client";

import { cn } from "@/lib/utils";
import { Bell, Clock3, Settings2, SlidersHorizontal, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsNavItems = [
	{ href: "/app/settings", label: "General", icon: Settings2 },
	{ href: "/app/settings/hours", label: "Hours", icon: Clock3 },
	{ href: "/app/settings/scheduling", label: "Scheduling", icon: SlidersHorizontal },
	{ href: "/app/settings/account", label: "Account", icon: UserCircle },
	{ href: "/app/settings/notifications", label: "Notifications", icon: Bell },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	return (
		<div className="h-full min-h-0 overflow-auto p-4 md:p-6 lg:p-8">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
				<header className="rounded-xl border border-border/70 bg-card/70 p-4 md:p-5">
					<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Settings</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight">Workspace Configuration</h1>
					<p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
						Display preferences, scheduling behavior, working hours, and account management.
					</p>
					<nav className="mt-4 flex flex-wrap gap-2">
						{settingsNavItems.map((item) => {
							const isActive =
								pathname === item.href ||
								(item.href !== "/app/settings" && pathname.startsWith(`${item.href}/`));
							return (
								<Link
									key={item.href}
									href={item.href}
									className={cn(
										"inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
										isActive
											? "border-primary/50 bg-primary/10 text-primary"
											: "border-border bg-background/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
									)}
								>
									<item.icon className="size-3.5" />
									{item.label}
								</Link>
							);
						})}
					</nav>
				</header>
				{children}
			</div>
		</div>
	);
}
