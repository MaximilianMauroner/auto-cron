"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
	{ href: "/app/settings", label: "Display", number: "01" },
	{ href: "/app/settings/scheduling", label: "Scheduling", number: "02" },
	{ href: "/app/settings/hours", label: "Hours", number: "03" },
	{ href: "/app/settings/categories", label: "Categories", number: "04" },
	{ href: "/app/settings/account", label: "Account", number: "05" },
	{ href: "/app/settings/notifications", label: "Alerts", number: "06" },
] as const;

export function SettingsNav() {
	const pathname = usePathname();

	return (
		<nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
			{navItems.map((item) => {
				const isActive =
					pathname === item.href ||
					(item.href !== "/app/settings" && pathname.startsWith(`${item.href}/`));

				return (
					<Link
						key={item.href}
						href={item.href}
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"group relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors",
							isActive
								? "text-foreground"
								: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
						)}
					>
						<span
							className={cn(
								"font-[family-name:var(--font-cutive)] text-[9px] tracking-[0.15em]",
								isActive ? "text-accent" : "text-muted-foreground/50",
							)}
						>
							{item.number}
						</span>
						<span className="font-[family-name:var(--font-outfit)] text-[13px] font-medium">
							{item.label}
						</span>

						{/* Active indicator line */}
						<span
							className={cn(
								"absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent transition-transform duration-200 origin-center",
								isActive ? "scale-x-100" : "scale-x-0",
							)}
						/>
					</Link>
				);
			})}
		</nav>
	);
}
