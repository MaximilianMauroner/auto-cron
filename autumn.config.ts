import { feature, featureItem, priceItem, product } from "atmn";

// --- Features ---

export const tasks = feature({
	id: "tasks",
	name: "Tasks",
	type: "single_use",
});

export const habits = feature({
	id: "habits",
	name: "Habits",
	type: "single_use",
});

export const analytics = feature({
	id: "analytics",
	name: "Analytics Dashboard",
	type: "boolean",
});
export const priority_support = feature({
	id: "priority_support",
	name: "Priority Support",
	type: "boolean",
});

// --- Products ---

export const free = product({
	id: "free",
	name: "Free",
	is_default: true,
	items: [
		featureItem({
			feature_id: tasks.id,
			included_usage: 28,
			interval: "month",
		}),
		featureItem({
			feature_id: habits.id,
			included_usage: 0,
		}),
	],
});

export const basic = product({
	id: "basic",
	name: "Basic",
	items: [
		priceItem({
			price: 4.99,
			interval: "month",
		}),
		featureItem({
			feature_id: tasks.id,
			included_usage: 100,
			interval: "month",
		}),
		featureItem({
			feature_id: habits.id,
			included_usage: 10,
		}),
	],
});

export const plus = product({
	id: "plus",
	name: "Plus",
	items: [
		priceItem({
			price: 7.99,
			interval: "month",
		}),
		featureItem({
			feature_id: tasks.id,
			included_usage: "inf",
			interval: "month",
		}),
		featureItem({
			feature_id: habits.id,
			included_usage: "inf",
		}),
		featureItem({
			feature_id: analytics.id,
		}),
	],
});

export const pro = product({
	id: "pro",
	name: "Pro",
	items: [
		priceItem({
			price: 15.99,
			interval: "month",
		}),
		featureItem({
			feature_id: tasks.id,
			included_usage: "inf",
			interval: "month",
		}),
		featureItem({
			feature_id: habits.id,
			included_usage: "inf",
		}),
		featureItem({
			feature_id: analytics.id,
		}),
		featureItem({
			feature_id: priority_support.id,
		}),
	],
});
