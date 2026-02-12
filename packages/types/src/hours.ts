export const hoursSetDays = [0, 1, 2, 3, 4, 5, 6] as const;
export type HoursSetDay = (typeof hoursSetDays)[number];

export type HoursWindow = {
	day: HoursSetDay;
	startMinute: number;
	endMinute: number;
};

export type HoursSetDTO = {
	_id: string;
	_creationTime: number;
	userId: string;
	name: string;
	isDefault: boolean;
	isSystem: boolean;
	windows: HoursWindow[];
	defaultCalendarId?: string;
	updatedAt: number;
};

export type HoursSetCreateInput = {
	name: string;
	windows: HoursWindow[];
	defaultCalendarId?: string;
};

export type HoursSetUpdateInput = {
	name?: string;
	windows?: HoursWindow[];
	defaultCalendarId?: string;
	isDefault?: boolean;
};
