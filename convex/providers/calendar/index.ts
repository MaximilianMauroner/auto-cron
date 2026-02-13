import { googleCalendarProvider } from "./google";
import type { CalendarProvider } from "./types";

export const getCalendarProvider = (): CalendarProvider => {
	return googleCalendarProvider;
};
