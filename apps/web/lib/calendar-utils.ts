export type EditorState = {
	mode: "create" | "edit";
	panelMode: "details" | "edit";
	eventId?: string;
	title: string;
	description: string;
	start: string;
	end: string;
	allDay: boolean;
	calendarId: string;
	busyStatus: "free" | "busy" | "tentative";
	visibility: "default" | "public" | "private" | "confidential";
	location: string;
	recurrenceRule: string;
	scope: "single" | "following" | "series";
};

export type RecurrenceFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type WeekdayToken = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type ParsedRecurrenceRule = {
	frequency: Exclude<RecurrenceFrequency, "NONE">;
	interval: number;
	byDay: WeekdayToken[];
	byMonthDay?: number;
	byMonth?: number;
	untilDate?: string;
	count?: number;
};

export const weekdayTokens: readonly WeekdayToken[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export const weekdayTokenToLabel: Record<WeekdayToken, string> = {
	MO: "Mon",
	TU: "Tue",
	WE: "Wed",
	TH: "Thu",
	FR: "Fri",
	SA: "Sat",
	SU: "Sun",
};

export const busyStatusOptions = [
	{ value: "busy", label: "Busy" },
	{ value: "free", label: "Free" },
	{ value: "tentative", label: "Tentative" },
] as const;

export const visibilityOptions = [
	{ value: "default", label: "Default visibility" },
	{ value: "public", label: "Public" },
	{ value: "private", label: "Private" },
	{ value: "confidential", label: "Confidential" },
] as const;

export const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});

// ── Color ──

export const googleColorPalette: Record<
	string,
	{ main: string; container: string; onContainer: string }
> = {
	"1": { main: "#7ba0e6", container: "#1c2840", onContainer: "#bdcfef" },
	"2": { main: "#5cc9a0", container: "#182e24", onContainer: "#a8e8cc" },
	"3": { main: "#b08ce6", container: "#231e3a", onContainer: "#d5c4f0" },
	"4": { main: "#d97b74", container: "#2c1f1f", onContainer: "#eab8b4" },
	"5": { main: "#d4b84e", container: "#282218", onContainer: "#ede0a8" },
	"6": { main: "#d9a066", container: "#28211a", onContainer: "#eecfaa" },
	"7": { main: "#4bb8bd", container: "#192b2e", onContainer: "#a0dfe2" },
	"8": { main: "#a0a4aa", container: "#1f2228", onContainer: "#d0d2d6" },
	"9": { main: "#5b82d4", container: "#1b2440", onContainer: "#afc2ea" },
	"10": { main: "#3aad72", container: "#182e22", onContainer: "#8fdfac" },
	"11": { main: "#c44a4e", container: "#2a1a1c", onContainer: "#e8a0a3" },
	"12": { main: "#d47e9a", container: "#281c24", onContainer: "#eab8ca" },
	"13": { main: "#909498", container: "#1e2124", onContainer: "#c8cacc" },
	"14": { main: "#4f7ed0", container: "#1b2440", onContainer: "#adc0e8" },
	"15": { main: "#7aaec6", container: "#1a252e", onContainer: "#b8d8ea" },
	"16": { main: "#4ca0d9", container: "#1a2838", onContainer: "#a0d0ee" },
	"17": { main: "#4da048", container: "#1a2c1a", onContainer: "#a0dea0" },
	"18": { main: "#d4b84e", container: "#282218", onContainer: "#ede0a8" },
	"19": { main: "#d9a066", container: "#28211a", onContainer: "#eecfaa" },
	"20": { main: "#d97b74", container: "#2c1f1f", onContainer: "#eab8b4" },
	"21": { main: "#c44a4e", container: "#2a1a1c", onContainer: "#e8a0a3" },
	"22": { main: "#b08ce6", container: "#231e3a", onContainer: "#d5c4f0" },
	"23": { main: "#909498", container: "#1e2124", onContainer: "#c8cacc" },
	"24": { main: "#7aaec6", container: "#1a252e", onContainer: "#b8d8ea" },
};

const isHexColor = (value: string) => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
	const raw = hex.replace("#", "");
	const normalized =
		raw.length === 3
			? raw
					.split("")
					.map((char) => `${char}${char}`)
					.join("")
			: raw;
	if (normalized.length !== 6) return null;
	const parsed = Number.parseInt(normalized, 16);
	if (Number.isNaN(parsed)) return null;
	return {
		r: (parsed >> 16) & 255,
		g: (parsed >> 8) & 255,
		b: parsed & 255,
	};
};

const mixToDarkContainer = (hex: string, alpha: number) => {
	const rgb = hexToRgb(hex);
	if (!rgb) return "#1b2640";
	const base = { r: 24, g: 28, b: 37 };
	const r = Math.round(base.r + (rgb.r - base.r) * alpha);
	const g = Math.round(base.g + (rgb.g - base.g) * alpha);
	const b = Math.round(base.b + (rgb.b - base.b) * alpha);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

const mixToLightContainer = (hex: string, alpha: number) => {
	const rgb = hexToRgb(hex);
	if (!rgb) return "#dce8fc";
	const base = { r: 247, g: 243, b: 237 };
	const r = Math.round(base.r + (rgb.r - base.r) * alpha);
	const g = Math.round(base.g + (rgb.g - base.g) * alpha);
	const b = Math.round(base.b + (rgb.b - base.b) * alpha);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export const resolveGoogleColor = (
	colorToken?: string,
): {
	token: string;
	main: string;
	container: string;
	onContainer: string;
	lightContainer: string;
	lightOnContainer: string;
} => {
	if (!colorToken) {
		return {
			token: "default",
			main: "#5b8def",
			container: "#1b2640",
			onContainer: "#b8d0ff",
			lightContainer: "#dce8fc",
			lightOnContainer: "#1a3a6e",
		};
	}
	const normalized = colorToken.trim().toLowerCase();
	const fromPalette = googleColorPalette[normalized];
	if (fromPalette) {
		return {
			token: normalized,
			...fromPalette,
			lightContainer: mixToLightContainer(fromPalette.main, 0.18),
			lightOnContainer: mixToDarkContainer(fromPalette.main, 0.55),
		};
	}
	if (isHexColor(normalized)) {
		return {
			token: normalized.replace("#", ""),
			main: normalized,
			container: mixToDarkContainer(normalized, 0.18),
			onContainer: "#dce4f0",
			lightContainer: mixToLightContainer(normalized, 0.18),
			lightOnContainer: "#2a3550",
		};
	}
	return {
		token: "default",
		main: "#5b8def",
		container: "#1b2640",
		onContainer: "#b8d0ff",
		lightContainer: "#dce8fc",
		lightOnContainer: "#1a3a6e",
	};
};

// ── Date/time ──

const toLocalParts = (timestamp: number) => {
	const date = new Date(timestamp);
	return {
		year: date.getFullYear(),
		month: String(date.getMonth() + 1).padStart(2, "0"),
		day: String(date.getDate()).padStart(2, "0"),
		hours: String(date.getHours()).padStart(2, "0"),
		minutes: String(date.getMinutes()).padStart(2, "0"),
	};
};

const LOCAL_DATE_TIME_REGEX =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.(\d{1,3}))?)?$/;
const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();
const getTimeZoneFormatter = (timeZone: string) => {
	const existing = timeZoneFormatterCache.get(timeZone);
	if (existing) return existing;
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	timeZoneFormatterCache.set(timeZone, formatter);
	return formatter;
};

const getTimeZoneParts = (timestamp: number, timeZone: string) => {
	try {
		const formatter = getTimeZoneFormatter(timeZone);
		const parts = formatter.formatToParts(new Date(timestamp));
		const byType = new Map(parts.map((part) => [part.type, part.value]));
		const year = Number.parseInt(byType.get("year") ?? "", 10);
		const month = Number.parseInt(byType.get("month") ?? "", 10);
		const day = Number.parseInt(byType.get("day") ?? "", 10);
		const hour = Number.parseInt(byType.get("hour") ?? "", 10);
		const minute = Number.parseInt(byType.get("minute") ?? "", 10);
		const second = Number.parseInt(byType.get("second") ?? "", 10);
		if (
			!Number.isFinite(year) ||
			!Number.isFinite(month) ||
			!Number.isFinite(day) ||
			!Number.isFinite(hour) ||
			!Number.isFinite(minute) ||
			!Number.isFinite(second)
		) {
			return null;
		}
		return { year, month, day, hour, minute, second };
	} catch {
		return null;
	}
};

export const parseLocalDateTimeInTimeZone = (raw: string, timeZone: string): number | undefined => {
	const match = raw.match(LOCAL_DATE_TIME_REGEX);
	if (!match) return undefined;

	const year = Number.parseInt(match[1] ?? "", 10);
	const month = Number.parseInt(match[2] ?? "", 10);
	const day = Number.parseInt(match[3] ?? "", 10);
	const hour = Number.parseInt(match[4] ?? "", 10);
	const minute = Number.parseInt(match[5] ?? "", 10);
	const second = Number.parseInt(match[6] ?? "0", 10);
	const millisecond = Number.parseInt((match[8] ?? "0").padEnd(3, "0"), 10);
	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day) ||
		!Number.isFinite(hour) ||
		!Number.isFinite(minute) ||
		!Number.isFinite(second) ||
		!Number.isFinite(millisecond)
	) {
		return undefined;
	}

	const targetUtcValue = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
	let candidate = targetUtcValue;
	for (let index = 0; index < 3; index += 1) {
		const resolved = getTimeZoneParts(candidate, timeZone);
		if (!resolved) return undefined;
		const observedUtcValue = Date.UTC(
			resolved.year,
			resolved.month - 1,
			resolved.day,
			resolved.hour,
			resolved.minute,
			resolved.second,
			millisecond,
		);
		const delta = targetUtcValue - observedUtcValue;
		candidate += delta;
		if (delta === 0) break;
	}
	return candidate;
};

export const toInputDateTime = (timestamp: number, timeZone?: string) => {
	const parts = timeZone ? getTimeZoneParts(timestamp, timeZone) : null;
	if (parts) {
		return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
	}
	const localParts = toLocalParts(timestamp);
	return `${localParts.year}-${localParts.month}-${localParts.day}T${localParts.hours}:${localParts.minutes}`;
};

export const parseDateTimeInput = (value: string, timeZone?: string) => {
	const valueWithSeconds = value.length === 16 ? `${value}:00` : value;
	if (timeZone) {
		const parsedInTimeZone = parseLocalDateTimeInTimeZone(valueWithSeconds, timeZone);
		if (parsedInTimeZone !== undefined) return parsedInTimeZone;
	}
	const [datePart, timePart] = value.split("T");
	if (!datePart || !timePart) return new Date(value).getTime();
	const [yearInput, monthInput, dayInput] = datePart.split("-").map(Number);
	const [hoursInput, minutesInput] = timePart.split(":").map(Number);
	const now = new Date();
	const year =
		typeof yearInput === "number" && Number.isFinite(yearInput) ? yearInput : now.getFullYear();
	const month =
		typeof monthInput === "number" && Number.isFinite(monthInput) ? monthInput : now.getMonth() + 1;
	const day = typeof dayInput === "number" && Number.isFinite(dayInput) ? dayInput : now.getDate();
	const hours = typeof hoursInput === "number" && Number.isFinite(hoursInput) ? hoursInput : 0;
	const minutes =
		typeof minutesInput === "number" && Number.isFinite(minutesInput) ? minutesInput : 0;
	return new Date(year, month - 1, day, hours, minutes).getTime();
};

// ── Duration ──

export const formatDuration = (start: number, end: number) => {
	const durationMs = Math.max(0, end - start);
	const minutes = Math.round(durationMs / (1000 * 60));
	const hoursPart = Math.floor(minutes / 60);
	const minutePart = minutes % 60;
	if (hoursPart > 0 && minutePart > 0) return `${hoursPart}h ${minutePart}min`;
	if (hoursPart > 0) return `${hoursPart}h`;
	return `${minutePart}min`;
};

// ── Calendar name ──

export const prettifyCalendarName = (id?: string) => {
	if (!id) return "Default";
	if (id === "primary") return "Default";
	const withoutDomain = id.split("@")[0] ?? id;
	const looksOpaqueId = /^[a-z0-9]{20,}$/i.test(withoutDomain);
	if (looksOpaqueId) return "Google Calendar";
	return withoutDomain
		.replace(/[._-]+/g, " ")
		.replace(/\b\w/g, (character) => character.toUpperCase())
		.trim();
};

// ── Labels ──

export const busyStatusLabel = (busyStatus: "free" | "busy" | "tentative") =>
	busyStatusOptions.find((option) => option.value === busyStatus)?.label ?? "Busy";

export const visibilityLabel = (
	visibility: "default" | "public" | "private" | "confidential" | undefined,
) => visibilityOptions.find((option) => option.value === visibility)?.label ?? "Default visibility";

// ── Description ──

export const normalizeDescription = (value?: string) => {
	if (!value) return "";
	return value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
};

// ── Recurrence ──

const toDateFromLocalDatePart = (datePart: string) => {
	const [year, month, day] = datePart.split("-").map(Number);
	if (!year || !month || !day) return new Date();
	return new Date(year, month - 1, day);
};

const toWeekdayToken = (timestamp: number): WeekdayToken => {
	const day = new Date(timestamp).getDay();
	const tokensByDateDay: WeekdayToken[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
	return tokensByDateDay[day] ?? "MO";
};

export const parseRRule = (rule?: string): ParsedRecurrenceRule | null => {
	if (!rule?.trim()) return null;
	const withoutPrefix = rule.trim().replace(/^RRULE:/i, "");
	const fields = withoutPrefix.split(";").reduce<Record<string, string>>((acc, part) => {
		const [key, value] = part.split("=");
		if (key && value) {
			acc[key.toUpperCase()] = value.toUpperCase();
		}
		return acc;
	}, {});

	const frequency = fields.FREQ as ParsedRecurrenceRule["frequency"] | undefined;
	if (!frequency || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(frequency)) {
		return null;
	}

	const interval = Math.max(1, Number.parseInt(fields.INTERVAL ?? "1", 10) || 1);
	const byDay = (fields.BYDAY ?? "")
		.split(",")
		.map((token) => token.trim())
		.filter((token): token is WeekdayToken =>
			Boolean(token && (weekdayTokens as readonly string[]).includes(token)),
		);
	const byMonthDay = fields.BYMONTHDAY ? Number.parseInt(fields.BYMONTHDAY, 10) : undefined;
	const byMonth = fields.BYMONTH ? Number.parseInt(fields.BYMONTH, 10) : undefined;
	const rawUntil = fields.UNTIL?.trim();
	const untilDate =
		rawUntil && rawUntil.length >= 8
			? `${rawUntil.slice(0, 4)}-${rawUntil.slice(4, 6)}-${rawUntil.slice(6, 8)}`
			: undefined;
	const count = fields.COUNT ? Number.parseInt(fields.COUNT, 10) : undefined;

	return {
		frequency,
		interval,
		byDay,
		byMonthDay: Number.isFinite(byMonthDay) ? byMonthDay : undefined,
		byMonth: Number.isFinite(byMonth) ? byMonth : undefined,
		untilDate,
		count: Number.isFinite(count) ? count : undefined,
	};
};

export const formatRecurrenceRule = (
	rule: string | undefined,
	startTimestamp: number,
	seriesFallback = false,
) => {
	const parsed = parseRRule(rule);
	if (!parsed) {
		return seriesFallback ? "Part of recurring series" : "Does not repeat";
	}

	let baseLabel = "Does not repeat";
	if (parsed.frequency === "DAILY") {
		baseLabel = parsed.interval === 1 ? "Every day" : `Every ${parsed.interval} days`;
	}

	if (parsed.frequency === "WEEKLY") {
		const byDay = parsed.byDay.length ? parsed.byDay : [toWeekdayToken(startTimestamp)];
		const dayLabel = byDay
			.map((token) => weekdayTokenToLabel[token as keyof typeof weekdayTokenToLabel] ?? token)
			.join(", ");
		baseLabel =
			parsed.interval === 1
				? `Every week on ${dayLabel}`
				: `Every ${parsed.interval} weeks on ${dayLabel}`;
	}

	if (parsed.frequency === "MONTHLY") {
		const monthDay = parsed.byMonthDay ?? new Date(startTimestamp).getDate();
		baseLabel =
			parsed.interval === 1
				? `Every month on day ${monthDay}`
				: `Every ${parsed.interval} months on day ${monthDay}`;
	}

	if (parsed.frequency === "YEARLY") {
		const monthDay = monthDayFormatter.format(new Date(startTimestamp));
		baseLabel =
			parsed.interval === 1
				? `Every year on ${monthDay}`
				: `Every ${parsed.interval} years on ${monthDay}`;
	}

	if (parsed.untilDate) {
		baseLabel += ` until ${monthDayFormatter.format(toDateFromLocalDatePart(parsed.untilDate))}`;
	} else if (parsed.count && parsed.count > 0) {
		baseLabel += ` (${parsed.count} times)`;
	}

	return baseLabel;
};
