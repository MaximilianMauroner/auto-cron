import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Clock3, CreditCard, SlidersHorizontal, UserCircle } from "lucide-react";
import Link from "next/link";

const settingsSections = [
	{
		title: "Working Hours",
		description: "Manage reusable hours sets for tasks and habits.",
		href: "/settings/hours",
		icon: Clock3,
	},
	{
		title: "Task Scheduling",
		description: "Set the default task scheduling mode.",
		href: "/settings/scheduling",
		icon: SlidersHorizontal,
	},
	{
		title: "Account",
		description: "Profile, identity, and account-level preferences.",
		href: "/settings/account",
		icon: UserCircle,
	},
	{
		title: "Notifications",
		description: "Configure reminder and notification behavior.",
		href: "/settings/notifications",
		icon: Bell,
	},
	{
		title: "Billing",
		description: "Manage your current plan and limits.",
		href: "/pricing",
		icon: CreditCard,
		externalSection: true,
	},
];

export default function SettingsOverviewPage() {
	return (
		<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{settingsSections.map((section) => (
				<Link key={section.title} href={section.href} className="group">
					<Card className="h-full border-border/70 bg-card/70 transition-colors group-hover:border-primary/40 group-hover:bg-primary/[0.04]">
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-lg">
								<section.icon className="size-4 text-primary" />
								{section.title}
								{section.externalSection ? (
									<Badge variant="outline" className="ml-auto text-[0.65rem]">
										Pricing
									</Badge>
								) : null}
							</CardTitle>
							<CardDescription>{section.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm font-medium text-primary">Open section</p>
						</CardContent>
					</Card>
				</Link>
			))}
		</div>
	);
}
