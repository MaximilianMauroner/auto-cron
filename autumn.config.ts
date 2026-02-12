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

// --- Products ---

export const basic = product({
	id: "basic",
	name: "Basic",
	items: [
		priceItem({
			price: 5,
			interval: "month",
		}),
		featureItem({
			feature_id: tasks.id,
			included_usage: 50,
			interval: "month",
		}),
		featureItem({
			feature_id: habits.id,
			included_usage: 5,
			interval: "month",
		}),
	],
});

export const pro = product({
	id: "pro",
	name: "Pro",
	items: [
		priceItem({
			price: 7.99,
			interval: "month",
		}),
		featureItem({
			feature_id: tasks.id,
			included_usage: 200,
			interval: "month",
		}),
		featureItem({
			feature_id: habits.id,
			included_usage: 20,
			interval: "month",
		}),
	],
});

export const premium = product({
	id: "premium",
	name: "Premium",
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
			interval: "month",
		}),
		featureItem({
			feature_id: analytics.id,
		}),
	],
});
