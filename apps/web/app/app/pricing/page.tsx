"use client";

import PricingTable from "@/components/autumn/pricing-table";

const productDetails = [
	{
		id: "free",
		description: "Get started with smart scheduling, no card required",
		price: {
			primaryText: "Free",
			secondaryText: "forever",
		},
		items: [
			{ featureId: "tasks", primaryText: "28 tasks", secondaryText: "per month" },
			{ primaryText: "1-week scheduling horizon" },
			{ primaryText: "Google Calendar Sync" },
		],
	},
	{
		id: "basic",
		description: "For individuals building consistent routines",
		price: {
			primaryText: "€4.99/month",
			secondaryText: "billed monthly",
		},
		items: [
			{ featureId: "tasks", primaryText: "100 tasks", secondaryText: "per month" },
			{ featureId: "habits", primaryText: "10 habits", secondaryText: "total" },
			{ primaryText: "4-week scheduling horizon" },
			{ primaryText: "Google Calendar Sync" },
		],
	},
	{
		id: "plus",
		description: "For power users who need full control",
		recommendText: "Most Popular",
		price: {
			primaryText: "€7.99/month",
			secondaryText: "billed monthly",
		},
		items: [
			{ primaryText: "Unlimited tasks" },
			{ primaryText: "Unlimited habits" },
			{ primaryText: "8-week scheduling horizon" },
			{ primaryText: "Google Calendar Sync" },
			{
				featureId: "analytics",
				primaryText: "Analytics Dashboard",
				secondaryText: "productivity insights",
			},
		],
	},
	{
		id: "pro",
		description: "Everything in Plus, with extended planning",
		price: {
			primaryText: "€15.99/month",
			secondaryText: "billed monthly",
		},
		items: [
			{ primaryText: "Everything in Plus" },
			{ primaryText: "12-week scheduling horizon" },
			{
				featureId: "priority_support",
				primaryText: "Priority Support",
			},
		],
	},
];

export default function PricingPage() {
	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto max-w-5xl px-6 py-12 md:px-8">
				<div className="mb-10 text-center">
					<h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
					<p className="mt-2 text-muted-foreground">
						Choose the plan that fits your scheduling needs.
					</p>
				</div>
				<PricingTable productDetails={productDetails} />
			</div>
		</div>
	);
}
