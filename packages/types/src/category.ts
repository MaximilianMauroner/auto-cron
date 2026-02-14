export const GOOGLE_CALENDAR_COLORS = [
	"#f59e0b", // amber/gold - 1
	"#ef4444", // red - 2
	"#22c55e", // green - 3
	"#0ea5e9", // sky blue - 4
	"#6366f1", // indigo - 5
	"#a855f7", // purple - 6
	"#ec4899", // pink - 7
	"#14b8a6", // teal - 8
] as const;

export type GoogleCalendarColor = (typeof GOOGLE_CALENDAR_COLORS)[number];

export type CategoryId = string;

export interface CategoryDTO {
	_id: CategoryId;
	userId: string;
	name: string;
	description?: string;
	color: GoogleCalendarColor;
	isSystem: boolean;
	isDefault: boolean;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
}

export interface CategoryCreateInput {
	name: string;
	description?: string;
	color?: GoogleCalendarColor;
}

export interface CategoryUpdateInput {
	name?: string;
	description?: string;
	color?: GoogleCalendarColor;
}

export const SYSTEM_CATEGORY_NAMES = {
	TRAVEL: "Travel",
	PERSONAL: "Personal",
} as const;

export type SystemCategoryName = (typeof SYSTEM_CATEGORY_NAMES)[keyof typeof SYSTEM_CATEGORY_NAMES];
