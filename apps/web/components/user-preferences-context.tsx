"use client";

import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { type ReactNode, createContext, useContext, useMemo } from "react";
import { api } from "../../../convex/_generated/api";

type TimeFormatPreference = "12h" | "24h";

type UserPreferencesValue = {
	timezone: string;
	hour12: boolean;
	timeFormatPreference: TimeFormatPreference;
	isLoading: boolean;
};

export const detectLocalTimeZone = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
};

export const detectLocalTimeFormatPreference = (): TimeFormatPreference => {
	try {
		return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ===
			false
			? "24h"
			: "12h";
	} catch {
		return "24h";
	}
};

const fallback: UserPreferencesValue = {
	timezone: typeof window !== "undefined" ? detectLocalTimeZone() : "UTC",
	hour12: typeof window !== "undefined" ? detectLocalTimeFormatPreference() === "12h" : false,
	timeFormatPreference: typeof window !== "undefined" ? detectLocalTimeFormatPreference() : "24h",
	isLoading: true,
};

const UserPreferencesContext = createContext<UserPreferencesValue>(fallback);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
	const preferencesQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getCalendarDisplayPreferences,
		{},
	);

	const localTimeZone = useMemo(() => detectLocalTimeZone(), []);
	const localTimeFormatPreference = useMemo(() => detectLocalTimeFormatPreference(), []);

	const value = useMemo<UserPreferencesValue>(() => {
		const timeFormatPreference =
			preferencesQuery.data?.timeFormatPreference ?? localTimeFormatPreference;
		const timezone = preferencesQuery.data?.timezone ?? localTimeZone;
		return {
			timezone,
			hour12: timeFormatPreference === "12h",
			timeFormatPreference,
			isLoading: preferencesQuery.isPending,
		};
	}, [
		localTimeFormatPreference,
		localTimeZone,
		preferencesQuery.data?.timeFormatPreference,
		preferencesQuery.data?.timezone,
		preferencesQuery.isPending,
	]);

	return (
		<UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
	);
}

export const useUserPreferences = () => useContext(UserPreferencesContext);
