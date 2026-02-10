export const habitFrequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
export type HabitFrequency = (typeof habitFrequencies)[number];

export const habitCategories = [
	"health",
	"fitness",
	"learning",
	"mindfulness",
	"productivity",
	"social",
	"other",
] as const;
export type HabitCategory = (typeof habitCategories)[number];
