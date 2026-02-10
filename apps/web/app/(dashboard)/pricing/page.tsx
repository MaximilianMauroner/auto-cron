"use client";

import PricingTable from "@/components/autumn/pricing-table";

const productDetails = [
	{
		id: "basic",
		description: "For individuals getting started with auto-scheduling",
		price: {
			primaryText: "€5/month",
			secondaryText: "billed monthly",
		},
		items: [
			{ featureId: "tasks", primaryText: "50 tasks", secondaryText: "per month" },
			{ featureId: "habits", primaryText: "5 habits", secondaryText: "per month" },
			{
				featureId: "scheduling_runs",
				primaryText: "100 scheduling runs",
				secondaryText: "per month",
			},
			{ primaryText: "Google Calendar Sync" },
		],
	},
	{
		id: "pro",
		description: "For power users who need more capacity",
		recommendText: "Most Popular",
		price: {
			primaryText: "€8/month",
			secondaryText: "billed monthly",
		},
		items: [
			{ featureId: "tasks", primaryText: "200 tasks", secondaryText: "per month" },
			{ featureId: "habits", primaryText: "20 habits", secondaryText: "per month" },
			{
				featureId: "scheduling_runs",
				primaryText: "500 scheduling runs",
				secondaryText: "per month",
			},
			{ primaryText: "Google Calendar Sync" },
		],
	},
	{
		id: "premium",
		description: "Unlimited everything with analytics",
		price: {
			primaryText: "€16/month",
			secondaryText: "billed monthly",
		},
		items: [
			{ primaryText: "Unlimited tasks" },
			{ primaryText: "Unlimited habits" },
			{ primaryText: "Unlimited scheduling runs" },
			{ primaryText: "Google Calendar Sync" },
			{
				featureId: "analytics",
				primaryText: "Analytics Dashboard",
				secondaryText: "productivity insights",
			},
		],
	},
];

export default function PricingPage() {
	return (
		<div className="mx-auto max-w-5xl space-y-8">
			<div className="text-center">
				<h1 className="text-3xl font-bold">Pricing</h1>
				<p className="mt-2 text-muted-foreground">
					Choose the plan that fits your scheduling needs.
				</p>
			</div>
			<PricingTable productDetails={productDetails} />
		</div>
	);
}
