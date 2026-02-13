"use client";

import { DateGridEvent } from "@/components/calendar/date-grid-event";
import { TimeGridEvent } from "@/components/calendar/time-grid-event";
import { QuickCreateHabitDialog } from "@/components/quick-create/quick-create-habit-dialog";
import { QuickCreateTaskDialog } from "@/components/quick-create/quick-create-task-dialog";
import { Button } from "@/components/ui/button";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUserPreferences } from "@/components/user-preferences-context";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import type {
	CalendarEventCreateInput,
	CalendarEventDTO,
	CalendarEventUpdateInput,
	CalendarSource,
	RecurrenceEditScope,
} from "@auto-cron/types";
import {
	type CalendarEventExternal,
	type CalendarType,
	createCalendar,
	createViewDay,
	createViewMonthGrid,
	createViewWeek,
} from "@schedule-x/calendar";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import { createCurrentTimePlugin } from "@schedule-x/current-time";
import { createDragAndDropPlugin } from "@schedule-x/drag-and-drop";
import { ScheduleXCalendar } from "@schedule-x/react";
import { createScrollControllerPlugin } from "@schedule-x/scroll-controller";
import { useAction, useConvexAuth } from "convex/react";
import {
	ArrowRight,
	Bell,
	CalendarDays,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock3,
	FileText,
	Globe2,
	MapPin,
	MoreHorizontal,
	RefreshCw,
	Repeat2,
	Rocket,
	Route,
	Sparkles,
	User,
	Video,
} from "lucide-react";
import { useTheme } from "next-themes";
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { SchedulingDiagnostics } from "./scheduling-diagnostics";

type EditorState = {
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
	scope: RecurrenceEditScope;
};

type ScheduleXEventVM = {
	dedupeKey: string;
	calendarKey: string;
	event: CalendarEventDTO;
};

type DragCreateState = {
	active: boolean;
	start: number;
	current: number;
	day: string;
	pointerDownX: number;
	pointerDownY: number;
	hasMoved: boolean;
	pointerId: number | null;
};
type DragSelectionPreview = {
	start: number;
	end: number;
	day: string;
};
type ResizeSelectionPreview = {
	eventId: string;
	start: number;
	end: number;
	day: string;
};
type OptimisticEventUpdate = {
	eventId: string;
	start: number;
	end: number;
};
type ResizeEventState = {
	active: boolean;
	eventId: string;
	start: number;
	originalEnd: number;
	currentEnd: number;
	startPointerY: number;
	day: string;
	pointerId: number | null;
};
type PendingMoveUpdate = {
	eventId: CalendarEventId;
	start: number;
	end: number;
	title: string;
};
type SyncRange = {
	start: number;
	end: number;
};
type TimeFormatPreference = "12h" | "24h";

type RecurrenceFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type WeekdayToken = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
type ParsedRecurrenceRule = {
	frequency: Exclude<RecurrenceFrequency, "NONE">;
	interval: number;
	byDay: WeekdayToken[];
	byMonthDay?: number;
	byMonth?: number;
	untilDate?: string;
	count?: number;
};
type RecurrenceEndsMode = "never" | "on" | "after";
type CustomRecurrenceDraft = {
	interval: number;
	frequency: Exclude<RecurrenceFrequency, "NONE">;
	byDay: WeekdayToken[];
	endsMode: RecurrenceEndsMode;
	untilDate: string;
	count: number;
};
type RecurrencePresetId =
	| "NONE"
	| "DAILY"
	| "WEEKDAYS"
	| "WEEKLY"
	| "BIWEEKLY"
	| "MONTHLY"
	| "YEARLY";

type CalendarEventId = string & { __tableName: "calendarEvents" };
type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

const monthYearFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});
const weekdayTokens: readonly WeekdayToken[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const weekdayTokenToLabel: Record<WeekdayToken, string> = {
	MO: "Mon",
	TU: "Tue",
	WE: "Wed",
	TH: "Thu",
	FR: "Fri",
	SA: "Sat",
	SU: "Sun",
};
const busyStatusOptions = [
	{ value: "busy", label: "Busy" },
	{ value: "free", label: "Free" },
	{ value: "tentative", label: "Tentative" },
] as const;
const visibilityOptions = [
	{ value: "default", label: "Default visibility" },
	{ value: "public", label: "Public" },
	{ value: "private", label: "Private" },
	{ value: "confidential", label: "Confidential" },
] as const;
const durationPresetMultipliers = [1, 2, 3, 4, 6, 8] as const;

const defaultSourceCalendars: Record<string, CalendarType> = {
	"google-default": {
		colorName: "google-default",
		label: "Google",
		lightColors: { main: "#3b6fd4", container: "#dce8fc", onContainer: "#1a3a6e" },
		darkColors: { main: "#5b8def", container: "#1b2640", onContainer: "#b8d0ff" },
	},
	task: {
		colorName: "task",
		label: "Task",
		lightColors: { main: "#7c5ac9", container: "#ece4fe", onContainer: "#2e1a5e" },
		darkColors: { main: "#9b7af7", container: "#221c3e", onContainer: "#d0c1fe" },
	},
	habit: {
		colorName: "habit",
		label: "Habit",
		lightColors: { main: "#2e9e62", container: "#d4f5e4", onContainer: "#0e3d22" },
		darkColors: { main: "#4cd68f", container: "#182e24", onContainer: "#a8f0c8" },
	},
	manual: {
		colorName: "manual",
		label: "Manual",
		lightColors: { main: "#c68a2e", container: "#fdf0d4", onContainer: "#3d2a0e" },
		darkColors: { main: "#e8a74e", container: "#2a2219", onContainer: "#fde4a8" },
	},
};

const googleColorPalette: Record<string, { main: string; container: string; onContainer: string }> =
	{
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

const resolveGoogleColor = (
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

const recencyScore = (event: CalendarEventDTO) =>
	Math.max(event.lastSyncedAt ?? 0, event.updatedAt ?? 0);

const MINUTE_MS = 60 * 1000;
const normalizeToMinute = (timestamp: number) => Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;

const buildDedupeKey = (event: CalendarEventDTO) => {
	if (event.googleEventId) {
		const occurrenceTs = normalizeToMinute(event.originalStartTime ?? event.start);
		return `google:${event.calendarId ?? "primary"}:${event.googleEventId}:${occurrenceTs}`;
	}
	return `fallback:${event.source}:${event.sourceId ?? "none"}:${event.start}:${event.end}:${event.title}`;
};

const getCalendarKey = (event: CalendarEventDTO) => {
	if (event.source === "google") {
		return `google-${resolveGoogleColor(event.color).token}`;
	}
	if (
		(event.source === "task" || event.source === "habit" || event.source === "manual") &&
		event.color?.trim()
	) {
		return `${event.source}-${resolveGoogleColor(event.color).token}`;
	}
	return event.source;
};

const sourceCalendarLabel: Record<CalendarSource, string> = {
	google: "Google",
	task: "Task",
	habit: "Habit",
	manual: "Manual",
};

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

const parseLocalDateTimeInTimeZone = (raw: string, timeZone: string): number | undefined => {
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

const toInputDateTime = (timestamp: number, timeZone?: string) => {
	const parts = timeZone ? getTimeZoneParts(timestamp, timeZone) : null;
	if (parts) {
		return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
	}
	const localParts = toLocalParts(timestamp);
	return `${localParts.year}-${localParts.month}-${localParts.day}T${localParts.hours}:${localParts.minutes}`;
};

const parseDateTimeInput = (value: string, timeZone?: string) => {
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

const splitDateTimeLocal = (value: string) => {
	const [datePart, timePart] = value.split("T");
	return {
		datePart,
		timePart: timePart?.slice(0, 5) ?? "00:00",
	};
};

const toDateFromLocalDatePart = (datePart: string) => {
	const [year, month, day] = datePart.split("-").map(Number);
	if (!year || !month || !day) return new Date();
	return new Date(year, month - 1, day);
};

const toWeekdayToken = (timestamp: number): (typeof weekdayTokens)[number] => {
	const day = new Date(timestamp).getDay();
	const tokensByDateDay: (typeof weekdayTokens)[number][] = [
		"SU",
		"MO",
		"TU",
		"WE",
		"TH",
		"FR",
		"SA",
	];
	return tokensByDateDay[day] ?? "MO";
};

const parseRRule = (rule?: string): ParsedRecurrenceRule | null => {
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

const serializeRRule = (parsed: ParsedRecurrenceRule | null) => {
	if (!parsed) return "";
	const parts: string[] = [`FREQ=${parsed.frequency}`];
	if (parsed.interval > 1) {
		parts.push(`INTERVAL=${parsed.interval}`);
	}
	if (parsed.frequency === "WEEKLY" && parsed.byDay.length) {
		parts.push(`BYDAY=${parsed.byDay.join(",")}`);
	}
	if (parsed.frequency === "MONTHLY" && parsed.byMonthDay) {
		parts.push(`BYMONTHDAY=${parsed.byMonthDay}`);
	}
	if (parsed.frequency === "YEARLY") {
		if (parsed.byMonth) parts.push(`BYMONTH=${parsed.byMonth}`);
		if (parsed.byMonthDay) parts.push(`BYMONTHDAY=${parsed.byMonthDay}`);
	}
	if (parsed.untilDate) {
		parts.push(`UNTIL=${parsed.untilDate.replaceAll("-", "")}T235959Z`);
	}
	if (parsed.count && parsed.count > 0) {
		parts.push(`COUNT=${parsed.count}`);
	}
	return `RRULE:${parts.join(";")}`;
};

const inferRecurrenceRule = (event: CalendarEventDTO, events: CalendarEventDTO[]) => {
	if (!event.recurringEventId) return undefined;
	const series = events
		.filter((candidate) => candidate.recurringEventId === event.recurringEventId)
		.sort((a, b) => a.start - b.start);
	if (series.length < 2) return undefined;

	const dayDiffs: number[] = [];
	for (let index = 1; index < series.length; index++) {
		const current = series[index];
		const previous = series[index - 1];
		if (!current || !previous) continue;
		const diff = current.start - previous.start;
		dayDiffs.push(Math.round(diff / (1000 * 60 * 60 * 24)));
	}

	const counts = new Map<number, number>();
	for (const diff of dayDiffs) {
		counts.set(diff, (counts.get(diff) ?? 0) + 1);
	}
	const primaryDiff = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
	if (!primaryDiff) return undefined;

	if (primaryDiff === 1) {
		return "RRULE:FREQ=DAILY";
	}
	if (primaryDiff >= 6 && primaryDiff <= 8) {
		const byDay = [...new Set(series.map((item) => toWeekdayToken(item.start)))].sort(
			(a, b) => weekdayTokens.indexOf(a) - weekdayTokens.indexOf(b),
		);
		return serializeRRule({
			frequency: "WEEKLY",
			interval: 1,
			byDay,
		});
	}
	if (primaryDiff >= 27 && primaryDiff <= 31) {
		const dayOfMonth = new Date(event.start).getDate();
		return serializeRRule({
			frequency: "MONTHLY",
			interval: 1,
			byDay: [],
			byMonthDay: dayOfMonth,
		});
	}
	return undefined;
};

const formatRecurrenceRule = (
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

const formatOrdinal = (value: number) => {
	const absValue = Math.abs(value);
	const mod100 = absValue % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
	switch (absValue % 10) {
		case 1:
			return `${value}st`;
		case 2:
			return `${value}nd`;
		case 3:
			return `${value}rd`;
		default:
			return `${value}th`;
	}
};

const getDefaultUntilDate = (startTimestamp: number) => {
	const date = new Date(startTimestamp);
	date.setMonth(date.getMonth() + 3);
	return formatDateInput(date);
};

const sortWeekdayTokens = (tokens: WeekdayToken[]) =>
	[...tokens].sort((a, b) => weekdayTokens.indexOf(a) - weekdayTokens.indexOf(b));

const toRecurrencePresetLabel = (
	preset: RecurrencePresetId,
	startTimestamp: number,
	weekdayToken: WeekdayToken,
) => {
	const weekdayLabel = weekdayTokenToLabel[weekdayToken];
	const monthDay = new Date(startTimestamp).getDate();
	const monthDayLabel = monthDayFormatter.format(new Date(startTimestamp));
	switch (preset) {
		case "NONE":
			return "Does not repeat";
		case "DAILY":
			return "Every day";
		case "WEEKDAYS":
			return "Every weekday Mon-Fri";
		case "WEEKLY":
			return `Every week on ${weekdayLabel}`;
		case "BIWEEKLY":
			return `Every 2 weeks on ${weekdayLabel}`;
		case "MONTHLY":
			return `Every month on the ${formatOrdinal(monthDay)}`;
		case "YEARLY":
			return `Every year on ${monthDayLabel}`;
		default:
			return "Custom";
	}
};

const applyRecurrencePreset = (
	preset: RecurrencePresetId,
	startTimestamp: number,
): ParsedRecurrenceRule | null => {
	const weekday = toWeekdayToken(startTimestamp);
	const dayOfMonth = new Date(startTimestamp).getDate();
	const month = new Date(startTimestamp).getMonth() + 1;
	switch (preset) {
		case "NONE":
			return null;
		case "DAILY":
			return { frequency: "DAILY", interval: 1, byDay: [] };
		case "WEEKDAYS":
			return { frequency: "WEEKLY", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"] };
		case "WEEKLY":
			return { frequency: "WEEKLY", interval: 1, byDay: [weekday] };
		case "BIWEEKLY":
			return { frequency: "WEEKLY", interval: 2, byDay: [weekday] };
		case "MONTHLY":
			return { frequency: "MONTHLY", interval: 1, byDay: [], byMonthDay: dayOfMonth };
		case "YEARLY":
			return {
				frequency: "YEARLY",
				interval: 1,
				byDay: [],
				byMonth: month,
				byMonthDay: dayOfMonth,
			};
		default:
			return null;
	}
};

const toCustomRecurrenceDraft = (
	parsed: ParsedRecurrenceRule | null,
	startTimestamp: number,
): CustomRecurrenceDraft => {
	const fallbackWeekday = toWeekdayToken(startTimestamp);
	const frequency = parsed?.frequency ?? "WEEKLY";
	return {
		interval: parsed?.interval ?? 1,
		frequency,
		byDay:
			frequency === "WEEKLY"
				? parsed?.byDay.length
					? parsed.byDay
					: [fallbackWeekday]
				: [fallbackWeekday],
		endsMode: parsed?.count ? "after" : parsed?.untilDate ? "on" : "never",
		untilDate: parsed?.untilDate ?? getDefaultUntilDate(startTimestamp),
		count: parsed?.count ?? 10,
	};
};

const mergeDateAndTime = (datePart: string, timePart: string) => `${datePart}T${timePart}`;

const setLocalDatePart = (value: string, date: Date) =>
	mergeDateAndTime(formatDateInput(date), splitDateTimeLocal(value).timePart);

const setLocalTimePart = (value: string, timePart: string) =>
	mergeDateAndTime(splitDateTimeLocal(value).datePart || formatDateInput(new Date()), timePart);

const toScheduleXEvent = (vm: ScheduleXEventVM, timeZone: string): CalendarEventExternal | null => {
	const start = toScheduleXZonedDateTime(vm.event.start, timeZone);
	const end = toScheduleXZonedDateTime(vm.event.end, timeZone);
	if (!start || !end) return null;
	return {
		id: vm.event._id,
		title: vm.event.title,
		start: start as never,
		end: end as never,
		description: vm.event.description,
		calendarId: vm.calendarKey,
		source: vm.event.source,
		sourceId: vm.event.sourceId,
		googleEventId: vm.event.googleEventId,
		colorId: vm.event.color,
		isRecurring: !!(vm.event.recurrenceRule || vm.event.recurringEventId),
		busyStatus: vm.event.busyStatus,
	};
};

const fromScheduleDateTime = (value?: unknown) => {
	if (!value) return Date.now();
	if (typeof value === "string") {
		const normalized = value.replace(" ", "T").replace(/\[[^\]]+\]$/, "");
		const parsed = Date.parse(normalized);
		return Number.isFinite(parsed) ? parsed : Date.now();
	}
	if (typeof value === "object") {
		const maybeTemporal = value as {
			epochMilliseconds?: unknown;
			toInstant?: () => { epochMilliseconds?: unknown };
			toString?: () => string;
		};
		if (
			typeof maybeTemporal.epochMilliseconds === "number" &&
			Number.isFinite(maybeTemporal.epochMilliseconds)
		) {
			return maybeTemporal.epochMilliseconds;
		}
		if (typeof maybeTemporal.toInstant === "function") {
			const instant = maybeTemporal.toInstant();
			if (
				instant &&
				typeof instant.epochMilliseconds === "number" &&
				Number.isFinite(instant.epochMilliseconds)
			) {
				return instant.epochMilliseconds;
			}
		}
		if (typeof maybeTemporal.toString === "function") {
			const asString = maybeTemporal.toString();
			if (typeof asString === "string") {
				const normalized = asString.replace(/\[[^\]]+\]$/, "");
				const parsed = Date.parse(normalized);
				if (Number.isFinite(parsed)) return parsed;
			}
		}
	}
	return Date.now();
};

const getScheduleDatePart = (value: unknown) => {
	if (value && typeof value === "object") {
		const maybeDate = value as { year?: unknown; month?: unknown; day?: unknown };
		if (
			typeof maybeDate.year === "number" &&
			typeof maybeDate.month === "number" &&
			typeof maybeDate.day === "number"
		) {
			const year = String(maybeDate.year).padStart(4, "0");
			const month = String(maybeDate.month).padStart(2, "0");
			const day = String(maybeDate.day).padStart(2, "0");
			return normalizeSelectedDate(`${year}-${month}-${day}`);
		}
	}
	if (typeof value === "string") {
		return normalizeSelectedDate(value);
	}
	return formatDateInput(new Date(fromScheduleDateTime(value)));
};

const toCalendarEventId = (value: string) => value as CalendarEventId;

const toDateInputValue = (input: unknown) => {
	if (!input) return formatDateInput(new Date());
	if (typeof input === "string") return input;
	if (typeof input === "object" && input !== null && "toString" in input) {
		const asString = input.toString();
		if (typeof asString === "string" && asString.length >= 10) return asString;
	}
	return formatDateInput(new Date());
};

const formatDateInput = (date: Date) => {
	const yearValue = date.getFullYear();
	if (!Number.isFinite(yearValue)) return "1970-01-01";
	const year = String(Math.min(9999, Math.max(0, yearValue))).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

type TemporalPlainDateLike = {
	year?: number;
	month?: number;
	day?: number;
	toString: () => string;
};
type TemporalZonedDateTimeLike = {
	year?: number;
	month?: number;
	day?: number;
	epochMilliseconds?: number;
	toInstant?: () => { epochMilliseconds: number };
	withTimeZone?: (timeZone: string) => TemporalZonedDateTimeLike;
	toString: () => string;
};
type TemporalApiLike = {
	PlainDate: {
		from: (value: string) => TemporalPlainDateLike;
	};
	Now: {
		plainDateISO: () => TemporalPlainDateLike;
	};
	Instant: {
		fromEpochMilliseconds: (value: number) => {
			toZonedDateTimeISO: (timeZone: string) => TemporalZonedDateTimeLike;
		};
	};
};

const getTemporalApi = () => (globalThis as { Temporal?: TemporalApiLike }).Temporal ?? null;

const toScheduleXPlainDate = (value: string): TemporalPlainDateLike | null => {
	const temporal = getTemporalApi();
	if (!temporal) return null;
	try {
		return temporal.PlainDate.from(value);
	} catch {
		return temporal.Now.plainDateISO();
	}
};

const toScheduleXZonedDateTime = (
	timestamp: number,
	timeZone: string,
): TemporalZonedDateTimeLike | null => {
	const temporal = getTemporalApi();
	if (!temporal) return null;
	try {
		return temporal.Instant.fromEpochMilliseconds(Math.trunc(timestamp)).toZonedDateTimeISO(
			timeZone,
		);
	} catch {
		try {
			return temporal.Instant.fromEpochMilliseconds(Math.trunc(timestamp)).toZonedDateTimeISO(
				"UTC",
			);
		} catch {
			return null;
		}
	}
};

const normalizeStrictYmd = (value: string) => {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	const year = Number.parseInt(match[1] ?? "0", 10);
	const month = Number.parseInt(match[2] ?? "0", 10);
	const day = Number.parseInt(match[3] ?? "0", 10);
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
	const parsed = new Date(year, month - 1, day);
	if (
		parsed.getFullYear() !== year ||
		parsed.getMonth() !== month - 1 ||
		parsed.getDate() !== day
	) {
		return null;
	}
	return formatDateInput(parsed);
};

const normalizeSelectedDate = (value: string) => {
	const trimmed = value.trim();
	const strict = normalizeStrictYmd(trimmed);
	if (strict) {
		return strict;
	}
	const ymdMatch = trimmed.match(/\d{4}-\d{2}-\d{2}/);
	if (ymdMatch?.[0]) {
		const matched = normalizeStrictYmd(ymdMatch[0]);
		if (matched) return matched;
	}
	const timestamp = Date.parse(trimmed);
	if (Number.isFinite(timestamp)) {
		return formatDateInput(new Date(timestamp));
	}
	return formatDateInput(new Date());
};

const toDateAnchorTimestamp = (value: string) => {
	const normalized = normalizeSelectedDate(value);
	const timestamp = Date.parse(`${normalized}T12:00:00`);
	return Number.isFinite(timestamp) ? timestamp : Date.now();
};

const hasCalendarControlsApp = (plugin: unknown): plugin is { $app: object } => {
	if (!plugin || typeof plugin !== "object") return false;
	return "$app" in plugin && Boolean((plugin as { $app?: object }).$app);
};

const hasScrollControllerApp = (
	plugin: unknown,
): plugin is { $app: object; scrollTo: (time: string) => void } => {
	if (!plugin || typeof plugin !== "object") return false;
	const maybePlugin = plugin as { $app?: object; scrollTo?: (time: string) => void };
	return Boolean(maybePlugin.$app) && typeof maybePlugin.scrollTo === "function";
};

const formatDuration = (start: number, end: number) => {
	const durationMs = Math.max(0, end - start);
	const minutes = Math.round(durationMs / (1000 * 60));
	const hoursPart = Math.floor(minutes / 60);
	const minutePart = minutes % 60;
	if (hoursPart > 0 && minutePart > 0) return `${hoursPart}h ${minutePart}min`;
	if (hoursPart > 0) return `${hoursPart}h`;
	return `${minutePart}min`;
};

const prettifyCalendarName = (id?: string) => {
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

const busyStatusLabel = (busyStatus: "free" | "busy" | "tentative") =>
	busyStatusOptions.find((option) => option.value === busyStatus)?.label ?? "Busy";

const visibilityLabel = (
	visibility: "default" | "public" | "private" | "confidential" | undefined,
) => visibilityOptions.find((option) => option.value === visibility)?.label ?? "Default visibility";

const normalizeDescription = (value?: string) => {
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

const runWhenCalendarControlsReady = (plugin: unknown, fn: () => void) => {
	if (hasCalendarControlsApp(plugin)) {
		fn();
		return () => {};
	}

	let frame = 0;
	const loop = () => {
		if (hasCalendarControlsApp(plugin)) {
			fn();
			return;
		}
		frame = window.requestAnimationFrame(loop);
	};
	loop();
	return () => {
		if (frame) window.cancelAnimationFrame(frame);
	};
};

const runWhenScrollControllerReady = (plugin: unknown, fn: () => void) => {
	if (hasScrollControllerApp(plugin)) {
		fn();
		return () => {};
	}

	let frame = 0;
	const loop = () => {
		if (hasScrollControllerApp(plugin)) {
			fn();
			return;
		}
		frame = window.requestAnimationFrame(loop);
	};
	loop();
	return () => {
		if (frame) window.cancelAnimationFrame(frame);
	};
};

const toTimestampFromDayAndMinutes = (day: string, minutes: number) => {
	const dayStart = new Date(`${day}T00:00:00`);
	dayStart.setMinutes(minutes);
	return dayStart.getTime();
};
const parseTimeToMinutes = (value: string) => {
	const [rawHours, rawMinutes] = value.split(":");
	const hoursInput = Number.parseInt(rawHours ?? "0", 10);
	const minutesInput = Number.parseInt(rawMinutes ?? "0", 10);
	const hours = Number.isFinite(hoursInput) ? hoursInput : 0;
	const minutes = Number.isFinite(minutesInput) ? minutesInput : 0;
	return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
};

const snapToStep = (timestamp: number, stepMs: number) => Math.round(timestamp / stepMs) * stepMs;
const DAY_MS = 1000 * 60 * 60 * 24;
const DRAG_CREATE_THRESHOLD_PX = 6;
const DEFAULT_SCROLL_TIME = "08:00";
const DEFAULT_SOURCE_FILTER: CalendarSource[] = ["google", "task", "habit", "manual"];
const QUERY_RANGE_PAST_DAYS = 7;
const QUERY_RANGE_FUTURE_DAYS = 70;

const getCurrentFocusScrollTime = () => {
	const now = new Date();
	const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
	const viewStart = 0;
	const viewEnd = 24 * 60;
	// Keep about two hours visible above "now" while staying in the full 24h range.
	const target = Math.max(viewStart, Math.min(viewEnd - 15, minutesFromMidnight - 120));
	const hours = String(Math.floor(target / 60)).padStart(2, "0");
	const minutes = String(target % 60).padStart(2, "0");
	return `${hours}:${minutes}`;
};

const isTodayDate = (dateString: string) => dateString === formatDateInput(new Date());

const useResettableCalendarApp = <TCalendarApp,>(factory: () => TCalendarApp, resetKey: string) => {
	const factoryRef = useRef(factory);
	const [calendarApp, setCalendarApp] = useState<TCalendarApp | null>(null);

	useEffect(() => {
		factoryRef.current = factory;
	}, [factory]);

	useEffect(() => {
		if (resetKey.length >= 0) {
			setCalendarApp(factoryRef.current());
		}
	}, [resetKey]);

	return calendarApp;
};

type CalendarClientProps = {
	initialErrorMessage?: string | null;
};

export function CalendarClient({ initialErrorMessage = null }: CalendarClientProps) {
	const { resolvedTheme } = useTheme();
	const [isThemeMounted, setIsThemeMounted] = useState(false);
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
	const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(initialErrorMessage);
	const [sourceFilter, setSourceFilter] = useState<CalendarSource[]>(DEFAULT_SOURCE_FILTER);
	const [editor, setEditor] = useState<EditorState | null>(null);
	const [quickCreateTaskOpen, setQuickCreateTaskOpen] = useState(false);
	const [quickCreateHabitOpen, setQuickCreateHabitOpen] = useState(false);
	const [isCustomRepeatDialogOpen, setIsCustomRepeatDialogOpen] = useState(false);
	const [customRecurrenceDraft, setCustomRecurrenceDraft] = useState<CustomRecurrenceDraft | null>(
		null,
	);
	const [dragPreview, setDragPreview] = useState<DragSelectionPreview | null>(null);
	const [resizePreview, setResizePreview] = useState<ResizeSelectionPreview | null>(null);
	const [optimisticEventUpdate, setOptimisticEventUpdate] = useState<OptimisticEventUpdate | null>(
		null,
	);
	const [pendingMoveUpdate, setPendingMoveUpdate] = useState<PendingMoveUpdate | null>(null);
	const [activeView, setActiveView] = useState<"week" | "day" | "month-grid">("week");
	const [selectedDate, setSelectedDate] = useState(() =>
		normalizeSelectedDate(formatDateInput(new Date())),
	);
	const [queryRangeAnchor, setQueryRangeAnchor] = useState(() =>
		toDateAnchorTimestamp(formatDateInput(new Date())),
	);
	const [eventSheetOpen, setEventSheetOpen] = useState(false);
	const dragCreateRef = useRef<DragCreateState | null>(null);
	const syncInFlightRef = useRef(false);
	const suppressClickCreateUntilRef = useRef(0);
	const preferEditEventUntilRef = useRef<{ eventId: string; until: number } | null>(null);
	const resizeEventRef = useRef<ResizeEventState | null>(null);
	const calendarContainerRef = useRef<HTMLDivElement>(null);
	const scheduleEventsByIdRef = useRef<Map<string, CalendarEventDTO>>(new Map());
	const syncedGoogleRangeRef = useRef<SyncRange | null>(null);
	const autoSyncAttemptedRangeKeyRef = useRef<string | null>(null);
	const autoWatchRegistrationAttemptedRef = useRef(false);
	const userPreferences = useUserPreferences();

	const calendarControlsPlugin = useMemo(() => createCalendarControlsPlugin(), []);
	const schedulingDefaultsQuery = useAuthenticatedQueryWithStatus(
		api.hours.queries.getTaskSchedulingDefaults,
		{},
	);
	const scheduleXTimeZone = userPreferences.timezone;
	const calendarTimeFormatPreference = userPreferences.timeFormatPreference;
	const schedulingStepMinutes = schedulingDefaultsQuery.data?.schedulingStepMinutes ?? 15;
	const schedulingStepMs = schedulingStepMinutes * 60 * 1000;
	const schedulingStepSeconds = schedulingStepMinutes * 60;
	const isTwelveHourClock = calendarTimeFormatPreference === "12h";
	const scrollControllerPlugin = useMemo(
		() => createScrollControllerPlugin({ initialScroll: DEFAULT_SCROLL_TIME }),
		[],
	);
	const currentTimePlugin = useMemo(() => createCurrentTimePlugin({ fullWeekWidth: true }), []);
	const dragAndDropPlugin = useMemo(
		() => createDragAndDropPlugin(schedulingStepMinutes),
		[schedulingStepMinutes],
	);
	const effectiveTheme = isThemeMounted ? (resolvedTheme === "dark" ? "dark" : "light") : "light";
	const isDarkTheme = effectiveTheme === "dark";

	useEffect(() => {
		setIsThemeMounted(true);
	}, []);

	const selectedDateTimestamp = useMemo(() => toDateAnchorTimestamp(selectedDate), [selectedDate]);

	const queryRange = useMemo(
		() => ({
			start: queryRangeAnchor - QUERY_RANGE_PAST_DAYS * DAY_MS,
			end: queryRangeAnchor + QUERY_RANGE_FUTURE_DAYS * DAY_MS,
		}),
		[queryRangeAnchor],
	);

	useEffect(() => {
		if (selectedDateTimestamp < queryRange.start || selectedDateTimestamp > queryRange.end) {
			setQueryRangeAnchor(selectedDateTimestamp);
		}
	}, [queryRange.end, queryRange.start, selectedDateTimestamp]);

	const eventsQuery = useAuthenticatedQueryWithStatus(api.calendar.queries.listEvents, {
		start: queryRange.start,
		end: queryRange.end,
		sourceFilter,
	});
	const events = (eventsQuery.data ?? []) as CalendarEventDTO[];
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const googleSyncHealthQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.getGoogleSyncHealth,
		{},
	);
	const googleCalendars = (googleCalendarsQuery.data ?? []) as GoogleCalendarListItem[];

	const { mutate: createEventMutation } = useMutationWithStatus(api.calendar.mutations.createEvent);
	const { mutate: updateEventMutation } = useMutationWithStatus(api.calendar.mutations.updateEvent);
	const { mutate: deleteEventMutation } = useMutationWithStatus(api.calendar.mutations.deleteEvent);
	const { mutate: moveResizeEventMutation } = useMutationWithStatus(
		api.calendar.mutations.moveResizeEvent,
	);
	const syncFromGoogle = useAction(api.calendar.actions.syncFromGoogle);
	const ensureGoogleWatchChannels = useAction(api.calendar.actions.ensureGoogleWatchChannels);
	const pushEventToGoogle = useAction(api.calendar.actions.pushEventToGoogle);

	const normalizedEvents = useMemo(() => {
		const deduped = new Map<string, CalendarEventDTO>();
		for (const event of events) {
			const key = buildDedupeKey(event);
			const previous = deduped.get(key);
			if (!previous || recencyScore(event) > recencyScore(previous)) {
				deduped.set(key, event);
			}
		}
		return Array.from(deduped.values()).sort((a, b) => a.start - b.start);
	}, [events]);

	const calendarTypes = useMemo(() => {
		const dynamicCalendars: Record<string, CalendarType> = {};
		for (const event of normalizedEvents) {
			if (!event.color?.trim()) continue;
			const key = getCalendarKey(event);
			if (key === event.source) continue;
			const resolved = resolveGoogleColor(event.color);
			dynamicCalendars[key] = {
				colorName: key,
				label: sourceCalendarLabel[event.source],
				lightColors: {
					main: resolved.main,
					container: resolved.lightContainer,
					onContainer: resolved.lightOnContainer,
				},
				darkColors: {
					main: resolved.main,
					container: resolved.container,
					onContainer: resolved.onContainer,
				},
			};
		}

		return {
			...defaultSourceCalendars,
			...dynamicCalendars,
		};
	}, [normalizedEvents]);

	const scheduleEvents = useMemo(() => {
		return normalizedEvents.map((event) => ({
			dedupeKey: buildDedupeKey(event),
			calendarKey: getCalendarKey(event),
			event,
		}));
	}, [normalizedEvents]);
	const scheduleXEvents = useMemo(() => {
		const baseEvents = scheduleEvents
			.map((event) => {
				const optimisticPatchedEvent =
					optimisticEventUpdate && event.event._id === optimisticEventUpdate.eventId
						? {
								...event.event,
								start: optimisticEventUpdate.start,
								end: optimisticEventUpdate.end,
							}
						: event.event;
				if (!resizePreview || optimisticPatchedEvent._id !== resizePreview.eventId) {
					if (optimisticPatchedEvent === event.event) return event;
					return {
						...event,
						event: optimisticPatchedEvent,
					};
				}
				return {
					...event,
					event: {
						...optimisticPatchedEvent,
						start: resizePreview.start,
						end: resizePreview.end,
					},
				};
			})
			.map((event) => toScheduleXEvent(event, scheduleXTimeZone))
			.filter((event): event is CalendarEventExternal => Boolean(event));
		if (!dragPreview || (editor && editor.mode !== "create")) return baseEvents;
		const previewStart = toScheduleXZonedDateTime(dragPreview.start, scheduleXTimeZone);
		const previewEnd = toScheduleXZonedDateTime(dragPreview.end, scheduleXTimeZone);
		if (!previewStart || !previewEnd) return baseEvents;
		return [
			...baseEvents,
			{
				id: "__drag_preview__",
				title: "New event",
				start: previewStart as never,
				end: previewEnd as never,
				calendarId: "manual",
				busyStatus: "free",
			},
		];
	}, [
		dragPreview,
		editor,
		optimisticEventUpdate,
		resizePreview,
		scheduleEvents,
		scheduleXTimeZone,
	]);
	const customComponents = useMemo(
		() => ({
			timeGridEvent: (props: ComponentProps<typeof TimeGridEvent>) => (
				<TimeGridEvent {...props} timeZone={scheduleXTimeZone} hour12={isTwelveHourClock} />
			),
			dateGridEvent: (props: ComponentProps<typeof DateGridEvent>) => (
				<DateGridEvent {...props} timeZone={scheduleXTimeZone} hour12={isTwelveHourClock} />
			),
			monthGridEvent: (props: ComponentProps<typeof DateGridEvent>) => (
				<DateGridEvent {...props} timeZone={scheduleXTimeZone} hour12={isTwelveHourClock} />
			),
		}),
		[isTwelveHourClock, scheduleXTimeZone],
	);

	const visibleEventCount = scheduleEvents.length;

	const allocationSegments = useMemo(() => {
		const totals = new Map<string, number>();
		for (const vm of scheduleEvents) {
			const duration = Math.max(0, vm.event.end - vm.event.start);
			totals.set(vm.event.source, (totals.get(vm.event.source) ?? 0) + duration);
		}
		const totalDuration = Array.from(totals.values()).reduce((acc, cur) => acc + cur, 0);
		if (!totalDuration) return [];

		return Array.from(totals.entries()).map(([source, duration]) => {
			const colorMap: Record<CalendarSource, string> = {
				google: "#5b8def",
				task: "#9b7af7",
				habit: "#4cd68f",
				manual: "#e8a74e",
			};
			const hours = duration / (1000 * 60 * 60);
			return {
				source: source as CalendarSource,
				hours,
				width: (duration / totalDuration) * 100,
				color: colorMap[source as CalendarSource],
			};
		});
	}, [scheduleEvents]);
	const scheduleEventsById = useMemo(
		() => new Map(scheduleEvents.map((vm) => [vm.event._id, vm.event] as const)),
		[scheduleEvents],
	);
	const recurrenceRuleBySeriesId = useMemo(() => {
		const map = new Map<string, string>();
		for (const event of normalizedEvents) {
			if (!event.recurringEventId || !event.recurrenceRule?.trim()) continue;
			if (!map.has(event.recurringEventId)) {
				map.set(event.recurringEventId, event.recurrenceRule.trim());
			}
		}
		return map;
	}, [normalizedEvents]);
	const googleCalendarNamesById = useMemo(() => {
		const names = new Map<string, string>();
		for (const calendar of googleCalendars) {
			names.set(
				calendar.id,
				calendar.name?.trim() ? calendar.name : prettifyCalendarName(calendar.id),
			);
		}
		if (!names.has("primary")) {
			names.set("primary", "Default");
		}
		return names;
	}, [googleCalendars]);
	const editableGoogleCalendars = useMemo(() => {
		const writable = googleCalendars.filter((calendar) => {
			const accessRole = calendar.accessRole;
			return !accessRole || accessRole === "owner" || accessRole === "writer";
		});
		if (writable.length) {
			return writable;
		}
		return [
			{
				id: "primary",
				name: "Default",
				primary: true,
				color: undefined,
				accessRole: "owner" as const,
				isExternal: false,
			},
		];
	}, [googleCalendars]);
	const defaultCreateCalendarId = useMemo(
		() =>
			editableGoogleCalendars.find((calendar) => calendar.primary)?.id ??
			editableGoogleCalendars[0]?.id ??
			"primary",
		[editableGoogleCalendars],
	);
	const googleCalendarColorById = useMemo(() => {
		const colorById = new Map<string, string | undefined>();
		for (const calendar of googleCalendars) {
			colorById.set(calendar.id, calendar.color);
		}
		return colorById;
	}, [googleCalendars]);

	const openEditorForEvent = useCallback(
		(event: CalendarEventDTO, panelMode: "details" | "edit") => {
			setDragPreview(null);
			const recurrenceRule =
				event.recurrenceRule?.trim() ||
				(event.recurringEventId
					? recurrenceRuleBySeriesId.get(event.recurringEventId)
					: undefined) ||
				inferRecurrenceRule(event, normalizedEvents) ||
				"";
			setEditor({
				mode: "edit",
				panelMode,
				eventId: event._id,
				title: event.title,
				description: event.description ?? "",
				start: toInputDateTime(event.start, scheduleXTimeZone),
				end: toInputDateTime(event.end, scheduleXTimeZone),
				allDay: event.allDay,
				calendarId: event.calendarId ?? defaultCreateCalendarId,
				busyStatus: event.busyStatus ?? "busy",
				visibility: event.visibility ?? "default",
				location: event.location ?? "",
				recurrenceRule,
				scope: "single",
			});
		},
		[defaultCreateCalendarId, normalizedEvents, recurrenceRuleBySeriesId, scheduleXTimeZone],
	);

	const applyMovedEventUpdate = useCallback(
		async ({
			eventId,
			start,
			end,
			scope,
		}: {
			eventId: CalendarEventId;
			start: number;
			end: number;
			scope: RecurrenceEditScope;
		}) => {
			await moveResizeEventMutation({
				id: eventId,
				start,
				end,
				scope,
			});
			await pushEventToGoogle({
				eventId,
				operation: "moveResize",
				scope,
			});
		},
		[moveResizeEventMutation, pushEventToGoogle],
	);
	const applyMovedEventUpdateRef = useRef(applyMovedEventUpdate);
	const openEditorForEventRef = useRef(openEditorForEvent);

	useEffect(() => {
		scheduleEventsByIdRef.current = scheduleEventsById;
	}, [scheduleEventsById]);

	useEffect(() => {
		applyMovedEventUpdateRef.current = applyMovedEventUpdate;
	}, [applyMovedEventUpdate]);

	useEffect(() => {
		openEditorForEventRef.current = openEditorForEvent;
	}, [openEditorForEvent]);

	const calendarViews = useMemo(() => {
		const weekView = createViewWeek();
		const dayView = createViewDay();
		const monthGridView = createViewMonthGrid();
		return [weekView, dayView, monthGridView] as [
			typeof weekView,
			typeof dayView,
			typeof monthGridView,
		];
	}, []);
	const dayBoundaries = useMemo(
		() => ({
			start: "00:00",
			end: "24:00",
		}),
		[],
	);
	const dayBoundaryMinutes = useMemo(() => {
		const start = parseTimeToMinutes(dayBoundaries.start);
		const parsedEnd = parseTimeToMinutes(dayBoundaries.end);
		const end = parsedEnd > start ? parsedEnd : start + 24 * 60;
		return { start, end };
	}, [dayBoundaries.end, dayBoundaries.start]);
	const weekOptions = useMemo(
		() => ({
			// Keep ~16 visible hours on desktop so the calendar itself scrolls through the day.
			gridHeight: 2100,
			eventWidth: 94,
			nDays: 7,
			eventOverlap: true,
			timeAxisFormatOptions: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: isTwelveHourClock,
				hourCycle: isTwelveHourClock ? "h12" : "h23",
			} as const,
		}),
		[isTwelveHourClock],
	);
	const safeSelectedDate = useMemo(() => normalizeSelectedDate(selectedDate), [selectedDate]);
	const selectedDateForScheduleX = useMemo(
		() => normalizeSelectedDate(safeSelectedDate),
		[safeSelectedDate],
	);
	const selectedPlainDateForScheduleX = useMemo(
		() => toScheduleXPlainDate(selectedDateForScheduleX),
		[selectedDateForScheduleX],
	);
	const calendarResetKey = [
		scheduleXTimeZone,
		calendarTimeFormatPreference,
		String(schedulingStepMinutes),
		isDarkTheme ? "dark" : "light",
		defaultCreateCalendarId,
	].join("|");
	const calendar = useResettableCalendarApp(
		() =>
			createCalendar(
				{
					selectedDate: selectedPlainDateForScheduleX as never,
					isDark: isDarkTheme,
					views: calendarViews,
					defaultView: "week",
					dayBoundaries,
					calendars: calendarTypes,
					weekOptions,
					events: scheduleXEvents,
					callbacks: {
						onSelectedDateUpdate: (date) => {
							setSelectedDate(normalizeSelectedDate(String(date)));
						},
						onClickDateTime: (dateTime) => {
							if (Date.now() < suppressClickCreateUntilRef.current) return;
							const start = snapToStep(fromScheduleDateTime(dateTime), schedulingStepMs);
							const end = snapToStep(start + schedulingStepMs, schedulingStepMs);
							setEditor({
								mode: "create",
								panelMode: "edit",
								title: "",
								description: "",
								start: toInputDateTime(start, scheduleXTimeZone),
								end: toInputDateTime(end, scheduleXTimeZone),
								allDay: false,
								calendarId: defaultCreateCalendarId,
								busyStatus: "busy",
								visibility: "default",
								location: "",
								recurrenceRule: "",
								scope: "single",
							});
						},
						onMouseDownDateTime: (dateTime, mouseDownEvent) => {
							if (mouseDownEvent.button !== 0) return;
							const start = snapToStep(fromScheduleDateTime(dateTime), schedulingStepMs);
							const day = getScheduleDatePart(dateTime);
							const rawPointerId = (mouseDownEvent as MouseEvent & { pointerId?: number })
								.pointerId;
							const pointerId = typeof rawPointerId === "number" ? rawPointerId : null;
							dragCreateRef.current = {
								active: true,
								start,
								current: start,
								day,
								pointerDownX: mouseDownEvent.clientX,
								pointerDownY: mouseDownEvent.clientY,
								hasMoved: false,
								pointerId,
							};
							setDragPreview({
								start,
								end: start + schedulingStepMs,
								day,
							});
						},
						onEventClick: (calendarEvent) => {
							const eventId = String(calendarEvent.id);
							const preferEdit = preferEditEventUntilRef.current;
							if (preferEdit && preferEdit.eventId === eventId && Date.now() < preferEdit.until) {
								preferEditEventUntilRef.current = null;
								const preferredEvent = scheduleEventsByIdRef.current.get(eventId);
								if (preferredEvent) {
									openEditorForEventRef.current(preferredEvent, "edit");
								}
								return;
							}

							const matched = scheduleEventsByIdRef.current.get(eventId);
							if (!matched) return;
							openEditorForEventRef.current(matched, "details");
						},
						onEventUpdate: async (updated) => {
							try {
								setError(null);
								const eventId = toCalendarEventId(String(updated.id));
								const start = fromScheduleDateTime(updated.start);
								const end = fromScheduleDateTime(updated.end);
								const snappedStart = snapToStep(start, schedulingStepMs);
								const snappedEnd = Math.max(
									snappedStart + schedulingStepMs,
									snapToStep(end, schedulingStepMs),
								);
								const current = scheduleEventsByIdRef.current.get(eventId);
								if (!current) return;
								if (current.recurrenceRule || current.recurringEventId) {
									setPendingMoveUpdate({
										eventId,
										start: snappedStart,
										end: snappedEnd,
										title: current.title,
									});
									return;
								}
								await applyMovedEventUpdateRef.current({
									eventId,
									start: snappedStart,
									end: snappedEnd,
									scope: "single",
								});
							} catch (updateError) {
								setError(
									updateError instanceof Error ? updateError.message : "Unable to move event.",
								);
							}
						},
					},
				},
				[calendarControlsPlugin, currentTimePlugin, dragAndDropPlugin, scrollControllerPlugin],
			),
		calendarResetKey,
	);

	useEffect(() => {
		const onPreviewEvent = (rawEvent: Event) => {
			const customEvent = rawEvent as CustomEvent<{ eventId?: string }>;
			const eventId = customEvent.detail?.eventId;
			if (!eventId) return;
			const matched = scheduleEventsByIdRef.current.get(eventId);
			if (!matched) return;
			openEditorForEventRef.current(matched, "details");
		};

		const onEditEvent = (rawEvent: Event) => {
			const customEvent = rawEvent as CustomEvent<{ eventId?: string }>;
			const eventId = customEvent.detail?.eventId;
			if (!eventId) return;
			preferEditEventUntilRef.current = { eventId, until: Date.now() + 300 };
			const matched = scheduleEventsByIdRef.current.get(eventId);
			if (!matched) return;
			openEditorForEventRef.current(matched, "edit");
		};
		window.addEventListener("calendar:event-preview", onPreviewEvent);
		window.addEventListener("calendar:event-edit", onEditEvent);
		return () => {
			window.removeEventListener("calendar:event-preview", onPreviewEvent);
			window.removeEventListener("calendar:event-edit", onEditEvent);
		};
	}, []);

	useEffect(() => {
		const onResizeStart = (rawEvent: Event) => {
			const customEvent = rawEvent as CustomEvent<{
				eventId?: string;
				eventDay?: string;
				pointerY?: number;
				pointerId?: number;
			}>;
			const eventId = customEvent.detail?.eventId;
			if (!eventId) return;
			const matched = scheduleEventsByIdRef.current.get(eventId);
			if (!matched || matched.allDay) return;
			const day = normalizeSelectedDate(
				customEvent.detail?.eventDay || formatDateInput(new Date(matched.start)),
			);
			const startPointerY =
				typeof customEvent.detail?.pointerY === "number"
					? customEvent.detail.pointerY
					: window.innerHeight / 2;
			resizeEventRef.current = {
				active: true,
				eventId,
				start: matched.start,
				originalEnd: matched.end,
				currentEnd: matched.end,
				startPointerY,
				day,
				pointerId:
					typeof customEvent.detail?.pointerId === "number" ? customEvent.detail.pointerId : null,
			};
			setResizePreview({
				eventId,
				start: matched.start,
				end: matched.end,
				day,
			});
			suppressClickCreateUntilRef.current = Date.now() + 250;
		};

		window.addEventListener("calendar:event-resize-start", onResizeStart);
		return () => {
			window.removeEventListener("calendar:event-resize-start", onResizeStart);
		};
	}, []);

	useEffect(() => {
		const updateDragCreate = (dragState: DragCreateState, clientX: number, clientY: number) => {
			const pointerDelta = Math.max(
				Math.abs(clientX - dragState.pointerDownX),
				Math.abs(clientY - dragState.pointerDownY),
			);
			if (!dragState.hasMoved && pointerDelta < DRAG_CREATE_THRESHOLD_PX) return;
			const target = document
				.elementFromPoint(clientX, clientY)
				?.closest<HTMLElement>(".sx__time-grid-day");
			if (!target) return;
			const day = target.dataset.timeGridDate;
			if (!day || day !== dragState.day) return;
			const rect = target.getBoundingClientRect();
			const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
			const ratio = rect.height === 0 ? 0 : y / rect.height;
			const dayStart = dayBoundaryMinutes.start;
			const dayEnd = dayBoundaryMinutes.end;
			const snappedMinutes =
				Math.round((dayStart + ratio * (dayEnd - dayStart)) / schedulingStepMinutes) *
				schedulingStepMinutes;
			const maxStartMinute = Math.max(dayStart, dayEnd - schedulingStepMinutes);
			const minutes = Math.max(dayStart, Math.min(maxStartMinute, snappedMinutes));
			const nextCurrent = snapToStep(toTimestampFromDayAndMinutes(day, minutes), schedulingStepMs);
			dragCreateRef.current = {
				...dragState,
				current: nextCurrent,
				hasMoved: true,
			};
			const start = Math.min(dragState.start, nextCurrent);
			const end = Math.max(dragState.start, nextCurrent);
			setDragPreview({
				start,
				end: end === start ? start + schedulingStepMs : end,
				day,
			});
		};

		const commitDragCreate = (dragState: DragCreateState) => {
			dragCreateRef.current = null;
			if (!dragState.hasMoved) {
				setDragPreview(null);
				return;
			}

			const minDurationMs = schedulingStepMs;
			const start = snapToStep(Math.min(dragState.start, dragState.current), schedulingStepMs);
			const end = snapToStep(Math.max(dragState.start, dragState.current), schedulingStepMs);
			const duration = end - start;
			if (duration < minDurationMs) return;
			setDragPreview({ start, end, day: dragState.day });

			suppressClickCreateUntilRef.current = Date.now() + 250;
			setEditor({
				mode: "create",
				panelMode: "edit",
				title: "",
				description: "",
				start: toInputDateTime(start, scheduleXTimeZone),
				end: toInputDateTime(end, scheduleXTimeZone),
				allDay: false,
				calendarId: defaultCreateCalendarId,
				busyStatus: "busy",
				visibility: "default",
				location: "",
				recurrenceRule: "",
				scope: "single",
			});
		};

		const onPointerMove = (event: PointerEvent) => {
			const dragState = dragCreateRef.current;
			if (!dragState?.active) return;
			if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
			if (event.pointerType === "mouse" && (event.buttons & 1) !== 1) {
				commitDragCreate(dragState);
				return;
			}
			updateDragCreate(dragState, event.clientX, event.clientY);
		};

		const onPointerUp = (event: PointerEvent) => {
			const dragState = dragCreateRef.current;
			if (!dragState?.active) return;
			if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
			commitDragCreate(dragState);
		};

		const onPointerCancel = (event: PointerEvent) => {
			const dragState = dragCreateRef.current;
			if (!dragState?.active) return;
			if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
			dragCreateRef.current = null;
			setDragPreview(null);
		};

		const onMouseMove = (event: MouseEvent) => {
			const dragState = dragCreateRef.current;
			if (!dragState?.active) return;
			if (dragState.pointerId !== null) return;
			if ((event.buttons & 1) !== 1) {
				commitDragCreate(dragState);
				return;
			}
			updateDragCreate(dragState, event.clientX, event.clientY);
		};

		const onMouseUp = () => {
			const dragState = dragCreateRef.current;
			if (!dragState?.active) return;
			if (dragState.pointerId !== null) return;
			commitDragCreate(dragState);
		};

		const supportsPointerEvents = typeof window.PointerEvent !== "undefined";
		if (supportsPointerEvents) {
			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
			window.addEventListener("pointercancel", onPointerCancel);
		} else {
			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
		}
		return () => {
			if (supportsPointerEvents) {
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
				window.removeEventListener("pointercancel", onPointerCancel);
			} else {
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
			}
		};
	}, [
		dayBoundaryMinutes.end,
		dayBoundaryMinutes.start,
		defaultCreateCalendarId,
		schedulingStepMinutes,
		schedulingStepMs,
		scheduleXTimeZone,
	]);

	useEffect(() => {
		const updateResizeEnd = (resizeState: ResizeEventState, pointerY: number) => {
			const dayElement = document.querySelector<HTMLElement>(
				`.sx__time-grid-day[data-time-grid-date="${resizeState.day}"]`,
			);
			if (!dayElement) return;
			const rect = dayElement.getBoundingClientRect();
			if (rect.height <= 0) return;
			const dayMinutes = dayBoundaryMinutes.end - dayBoundaryMinutes.start;
			const minutesPerPixel = dayMinutes / rect.height;
			const deltaY = pointerY - resizeState.startPointerY;
			const candidateEnd = resizeState.originalEnd + deltaY * minutesPerPixel * 60_000;
			const minEnd = resizeState.start + schedulingStepMs;
			const dayMaxEnd = toTimestampFromDayAndMinutes(resizeState.day, dayBoundaryMinutes.end);
			const boundedEnd = Math.max(minEnd, Math.min(dayMaxEnd, candidateEnd));
			const steppedEnd = Math.max(
				minEnd,
				Math.min(dayMaxEnd, snapToStep(boundedEnd, schedulingStepMs)),
			);
			if (steppedEnd === resizeState.currentEnd) return;
			resizeEventRef.current = { ...resizeState, currentEnd: steppedEnd };
			setResizePreview({
				eventId: resizeState.eventId,
				start: resizeState.start,
				end: steppedEnd,
				day: resizeState.day,
			});
		};

		const commitResize = (resizeState: ResizeEventState) => {
			resizeEventRef.current = null;
			setResizePreview(null);
			if (resizeState.currentEnd === resizeState.originalEnd) return;
			const minEnd = resizeState.start + schedulingStepMs;
			const nextEnd = snapToStep(Math.max(minEnd, resizeState.currentEnd), schedulingStepMs);

			void (async () => {
				try {
					setError(null);
					const current = scheduleEventsByIdRef.current.get(resizeState.eventId);
					if (!current) return;
					if (current.recurrenceRule || current.recurringEventId) {
						setPendingMoveUpdate({
							eventId: toCalendarEventId(resizeState.eventId),
							start: resizeState.start,
							end: nextEnd,
							title: current.title,
						});
						return;
					}
					await applyMovedEventUpdateRef.current({
						eventId: toCalendarEventId(resizeState.eventId),
						start: resizeState.start,
						end: nextEnd,
						scope: "single",
					});
				} catch (resizeError) {
					setError(resizeError instanceof Error ? resizeError.message : "Unable to resize event.");
				}
			})();
		};

		const onPointerMove = (event: PointerEvent) => {
			const resizeState = resizeEventRef.current;
			if (!resizeState?.active) return;
			if (resizeState.pointerId !== null && event.pointerId !== resizeState.pointerId) return;
			if (event.pointerType === "mouse" && (event.buttons & 1) !== 1) return;
			updateResizeEnd(resizeState, event.clientY);
		};

		const onPointerUp = (event: PointerEvent) => {
			const resizeState = resizeEventRef.current;
			if (!resizeState?.active) return;
			if (resizeState.pointerId !== null && event.pointerId !== resizeState.pointerId) return;
			commitResize(resizeState);
		};

		const onPointerCancel = (event: PointerEvent) => {
			const resizeState = resizeEventRef.current;
			if (!resizeState?.active) return;
			if (resizeState.pointerId !== null && event.pointerId !== resizeState.pointerId) return;
			resizeEventRef.current = null;
			setResizePreview(null);
		};

		const onMouseMove = (event: MouseEvent) => {
			const resizeState = resizeEventRef.current;
			if (!resizeState?.active) return;
			if (resizeState.pointerId !== null) return;
			if ((event.buttons & 1) !== 1) return;
			updateResizeEnd(resizeState, event.clientY);
		};

		const onMouseUp = () => {
			const resizeState = resizeEventRef.current;
			if (!resizeState?.active) return;
			if (resizeState.pointerId !== null) return;
			commitResize(resizeState);
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, [dayBoundaryMinutes.end, dayBoundaryMinutes.start, schedulingStepMs]);

	useEffect(() => {
		if (!editor || editor.mode !== "create") return;
		const start = snapToStep(parseDateTimeInput(editor.start, scheduleXTimeZone), schedulingStepMs);
		const end = snapToStep(parseDateTimeInput(editor.end, scheduleXTimeZone), schedulingStepMs);
		if (!Number.isFinite(start) || !Number.isFinite(end)) return;
		const normalizedStart = Math.min(start, end);
		const normalizedEnd = Math.max(start, end);
		setDragPreview({
			start: normalizedStart,
			end: normalizedEnd === normalizedStart ? normalizedStart + schedulingStepMs : normalizedEnd,
			day: formatDateInput(new Date(normalizedStart)),
		});
	}, [editor, scheduleXTimeZone, schedulingStepMs]);

	useEffect(() => {
		if (!calendar || pendingMoveUpdate) return;
		calendar.events.set(scheduleXEvents);
	}, [calendar, pendingMoveUpdate, scheduleXEvents]);

	useEffect(() => {
		if (!optimisticEventUpdate) return;
		const current = normalizedEvents.find((event) => event._id === optimisticEventUpdate.eventId);
		if (!current) return;
		if (
			current.start === optimisticEventUpdate.start &&
			current.end === optimisticEventUpdate.end
		) {
			setOptimisticEventUpdate(null);
		}
	}, [normalizedEvents, optimisticEventUpdate]);

	useEffect(() => {
		if (activeView === "month-grid") return;
		const container = calendarContainerRef.current;
		if (!container) return;

		let tickTimeoutId: number | null = null;
		let minuteIntervalId: number | null = null;

		const syncCurrentTimeBadge = () => {
			const weekGrid = container.querySelector<HTMLElement>(".sx__week-grid");
			const weekWrapper = container.querySelector<HTMLElement>(".sx__week-wrapper");
			if (!weekGrid || !weekWrapper) return;
			const indicator =
				weekGrid.querySelector<HTMLElement>(".sx__current-time-indicator-full-week") ??
				weekGrid.querySelector<HTMLElement>(".sx__current-time-indicator");
			if (!indicator) {
				weekWrapper.querySelector(".sx__current-time-badge")?.remove();
				return;
			}

			let badge = weekWrapper.querySelector<HTMLElement>(".sx__current-time-badge");
			if (!badge) {
				badge = document.createElement("div");
				badge.className = "sx__current-time-badge";
				weekWrapper.appendChild(badge);
			}

			const indicatorRect = indicator.getBoundingClientRect();
			const wrapperRect = weekWrapper.getBoundingClientRect();
			const top = indicatorRect.top - wrapperRect.top + indicatorRect.height / 2;
			badge.style.top = `${Math.max(0, Math.round(top))}px`;

			badge.textContent = new Date()
				.toLocaleTimeString([], {
					hour: "numeric",
					minute: "2-digit",
					hour12: isTwelveHourClock,
				})
				.replace(/\s/g, "");
		};

		const startMinuteTicker = () => {
			syncCurrentTimeBadge();
			const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
			tickTimeoutId = window.setTimeout(() => {
				syncCurrentTimeBadge();
				minuteIntervalId = window.setInterval(syncCurrentTimeBadge, 60_000);
			}, msUntilNextMinute);
		};

		startMinuteTicker();
		const bootstrapIntervalId = window.setInterval(syncCurrentTimeBadge, 400);
		window.setTimeout(() => {
			window.clearInterval(bootstrapIntervalId);
		}, 2_000);

		return () => {
			if (tickTimeoutId !== null) window.clearTimeout(tickTimeoutId);
			if (minuteIntervalId !== null) window.clearInterval(minuteIntervalId);
			window.clearInterval(bootstrapIntervalId);
			const badges = container.querySelectorAll(".sx__current-time-badge");
			for (const badge of badges) {
				badge.remove();
			}
		};
	}, [activeView, isTwelveHourClock]);

	useEffect(() => {
		if (!calendar) return;
		return runWhenCalendarControlsReady(calendarControlsPlugin, () => {
			try {
				calendarControlsPlugin.setCalendars(calendarTypes);
			} catch {
				// Ignore transient plugin lifecycle races in dev/hot-reload.
			}
		});
	}, [calendar, calendarControlsPlugin, calendarTypes]);

	useEffect(() => {
		if (!calendar || !isThemeMounted) return;
		try {
			calendar.setTheme(isDarkTheme ? "dark" : "light");
		} catch {
			// Ignore transient lifecycle races in dev/hot-reload.
		}
	}, [calendar, isDarkTheme, isThemeMounted]);

	useEffect(() => {
		if (!calendar) return;
		return runWhenCalendarControlsReady(calendarControlsPlugin, () => {
			try {
				calendarControlsPlugin.setView(activeView);
			} catch {
				// Ignore transient plugin lifecycle races in dev/hot-reload.
			}
		});
	}, [activeView, calendar, calendarControlsPlugin]);

	useEffect(() => {
		if (!calendar) return;
		if (!selectedPlainDateForScheduleX) return;
		return runWhenCalendarControlsReady(calendarControlsPlugin, () => {
			try {
				calendarControlsPlugin.setDate(selectedPlainDateForScheduleX as never);
			} catch {
				// Ignore transient plugin lifecycle races in dev/hot-reload.
			}
		});
	}, [calendar, calendarControlsPlugin, selectedPlainDateForScheduleX]);

	useEffect(() => {
		if (!calendar || activeView === "month-grid") return;
		const scrollToTime = isTodayDate(selectedDateForScheduleX)
			? getCurrentFocusScrollTime()
			: DEFAULT_SCROLL_TIME;
		return runWhenScrollControllerReady(scrollControllerPlugin, () => {
			try {
				scrollControllerPlugin.scrollTo(scrollToTime);
			} catch {
				// Ignore transient plugin lifecycle races in dev/hot-reload.
			}
		});
	}, [activeView, calendar, scrollControllerPlugin, selectedDateForScheduleX]);

	useEffect(() => {
		if (selectedDate === selectedDateForScheduleX) return;
		setSelectedDate(selectedDateForScheduleX);
	}, [selectedDateForScheduleX, selectedDate]);

	useEffect(() => {
		if (isAuthenticated) return;
		autoWatchRegistrationAttemptedRef.current = false;
	}, [isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated || isAuthLoading) return;
		if (autoWatchRegistrationAttemptedRef.current) return;
		const syncHealth = googleSyncHealthQuery.data;
		if (!syncHealth?.googleConnected) return;
		if (syncHealth.activeChannels > 0) {
			autoWatchRegistrationAttemptedRef.current = true;
			return;
		}

		autoWatchRegistrationAttemptedRef.current = true;
		void ensureGoogleWatchChannels({}).catch((registrationError) => {
			autoWatchRegistrationAttemptedRef.current = false;
			console.error("[calendar] failed to auto-register Google watch channels", {
				error: registrationError instanceof Error ? registrationError.message : registrationError,
			});
		});
	}, [ensureGoogleWatchChannels, googleSyncHealthQuery.data, isAuthenticated, isAuthLoading]);

	const syncNow = useCallback(
		async (reason: "manual" | "auto" = "manual", overrideRange?: SyncRange) => {
			if (!isAuthenticated || syncInFlightRef.current) return false;
			const targetRange = {
				start: overrideRange?.start ?? queryRange.start,
				end: overrideRange?.end ?? queryRange.end,
			};

			syncInFlightRef.current = true;
			setSyncStatus("syncing");
			if (reason === "manual") {
				setError(null);
			}

			try {
				await syncFromGoogle({
					fullSync: reason === "manual",
					rangeStart: targetRange.start,
					rangeEnd: targetRange.end,
				});
				const currentSyncedRange = syncedGoogleRangeRef.current;
				syncedGoogleRangeRef.current = currentSyncedRange
					? {
							start: Math.min(currentSyncedRange.start, targetRange.start),
							end: Math.max(currentSyncedRange.end, targetRange.end),
						}
					: targetRange;
				setSyncStatus("idle");
				setLastSyncedAt(Date.now());
				return true;
			} catch (syncError) {
				setSyncStatus("error");
				if (reason === "manual") {
					setError(syncError instanceof Error ? syncError.message : "Sync failed.");
				}
				return false;
			} finally {
				syncInFlightRef.current = false;
			}
		},
		[isAuthenticated, queryRange.end, queryRange.start, syncFromGoogle],
	);

	useEffect(() => {
		if (!isAuthenticated) return;
		const targetRange: SyncRange = {
			start: queryRange.start,
			end: queryRange.end,
		};
		const currentSyncedRange = syncedGoogleRangeRef.current;
		const rangeIsCovered = Boolean(
			currentSyncedRange &&
				targetRange.start >= currentSyncedRange.start &&
				targetRange.end <= currentSyncedRange.end,
		);
		if (rangeIsCovered) return;

		const rangeKey = `${targetRange.start}:${targetRange.end}`;
		if (autoSyncAttemptedRangeKeyRef.current === rangeKey) return;
		autoSyncAttemptedRangeKeyRef.current = rangeKey;
		void syncNow("auto", targetRange);
	}, [isAuthenticated, queryRange.end, queryRange.start, syncNow]);

	const createEvent = async (payload: CalendarEventCreateInput) => {
		const id = await createEventMutation({ input: payload });
		await pushEventToGoogle({
			eventId: id,
			operation: "create",
			scope: "single",
		});
	};

	const updateEvent = async (
		eventId: string,
		patch: CalendarEventUpdateInput,
		scope: RecurrenceEditScope,
		previousCalendarId?: string,
	) => {
		const id = toCalendarEventId(eventId);
		await updateEventMutation({ id, patch, scope });
		await pushEventToGoogle({
			eventId: id,
			operation: "update",
			scope,
			patch,
			previousCalendarId,
		});
	};

	const cancelCalendarPointerInteractions = useCallback(() => {
		dragCreateRef.current = null;
		resizeEventRef.current = null;
		setDragPreview(null);
		setResizePreview(null);
		document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
		document.dispatchEvent(new Event("touchend", { bubbles: true }));
		if (typeof PointerEvent !== "undefined") {
			document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
		}
	}, []);

	const deleteEvent = useCallback(
		async (eventId: string, scope: RecurrenceEditScope) => {
			const id = toCalendarEventId(eventId);
			cancelCalendarPointerInteractions();
			await deleteEventMutation({ id, scope });
			void pushEventToGoogle({ eventId: id, operation: "delete", scope }).catch(
				(deleteSyncError) => {
					console.warn(
						"Failed to delete event in Google calendar after local delete.",
						deleteSyncError,
					);
				},
			);
		},
		[cancelCalendarPointerInteractions, deleteEventMutation, pushEventToGoogle],
	);

	useEffect(() => {
		const onDeleteEvent = (rawEvent: Event) => {
			const customEvent = rawEvent as CustomEvent<{ eventId?: string }>;
			const eventId = customEvent.detail?.eventId;
			if (!eventId) return;
			const matched = scheduleEventsByIdRef.current.get(eventId);
			if (!matched) return;

			void (async () => {
				try {
					setError(null);
					await deleteEvent(eventId, "single");
					setEditor((current) => (current?.eventId === eventId ? null : current));
				} catch (deleteError) {
					setError(deleteError instanceof Error ? deleteError.message : "Unable to delete event.");
				}
			})();
		};

		window.addEventListener("calendar:event-delete", onDeleteEvent);
		return () => {
			window.removeEventListener("calendar:event-delete", onDeleteEvent);
		};
	}, [deleteEvent]);

	const onSubmitEditor = async () => {
		if (!editor) return;
		const parsedStart = parseDateTimeInput(editor.start, scheduleXTimeZone);
		const parsedEnd = parseDateTimeInput(editor.end, scheduleXTimeZone);
		const nextStart =
			editor.mode === "create" ? snapToStep(parsedStart, schedulingStepMs) : parsedStart;
		const nextEnd = editor.mode === "create" ? snapToStep(parsedEnd, schedulingStepMs) : parsedEnd;
		const normalizedLocation = editor.location.trim();
		const payload = {
			title: editor.title.trim(),
			description: editor.description.trim() || undefined,
			start: nextStart,
			end: nextEnd,
			allDay: editor.allDay,
			calendarId: editor.calendarId,
			recurrenceRule: editor.recurrenceRule.trim() || undefined,
			busyStatus: editor.busyStatus,
			visibility: editor.visibility,
			location: normalizedLocation,
		};
		if (!payload.title) return;

		try {
			setError(null);
			if (editor.mode === "create") {
				await createEvent({
					...payload,
					location: normalizedLocation || undefined,
				});
				setDragPreview(null);
			} else if (editor.eventId) {
				await updateEvent(
					editor.eventId,
					payload,
					editor.scope,
					selectedEvent?.calendarId ?? "primary",
				);
			}
			setEditor(null);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Unable to save event.");
		}
	};

	const closeEditor = useCallback(() => {
		setDragPreview(null);
		setIsCustomRepeatDialogOpen(false);
		setCustomRecurrenceDraft(null);
		setEditor(null);
	}, []);

	// Sync sheet open state with editor presence
	useEffect(() => {
		setEventSheetOpen(Boolean(editor));
	}, [editor]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (resizeEventRef.current?.active) {
				event.preventDefault();
				resizeEventRef.current = null;
				setResizePreview(null);
				return;
			}
			if (pendingMoveUpdate) {
				event.preventDefault();
				setPendingMoveUpdate(null);
				return;
			}
			if (isCustomRepeatDialogOpen) {
				event.preventDefault();
				setIsCustomRepeatDialogOpen(false);
				setCustomRecurrenceDraft(null);
				return;
			}
			if (!editor) return;
			event.preventDefault();
			closeEditor();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [closeEditor, editor, isCustomRepeatDialogOpen, pendingMoveUpdate]);

	const moveRecurringEvent = async (scope: RecurrenceEditScope) => {
		if (!pendingMoveUpdate) return;
		const payload = pendingMoveUpdate;
		setPendingMoveUpdate(null);
		setOptimisticEventUpdate({
			eventId: payload.eventId,
			start: payload.start,
			end: payload.end,
		});
		try {
			setError(null);
			await applyMovedEventUpdate({
				eventId: payload.eventId,
				start: payload.start,
				end: payload.end,
				scope,
			});
		} catch (updateError) {
			setOptimisticEventUpdate(null);
			setError(
				updateError instanceof Error ? updateError.message : "Unable to move recurring event.",
			);
		}
	};

	const changeView = (view: "week" | "day" | "month-grid") => {
		setActiveView(view);
	};

	const setDateValue = (value: string) => {
		setSelectedDate(normalizeSelectedDate(value));
	};

	const shiftDate = (direction: -1 | 1) => {
		const currentView = activeView;
		const deltaDays =
			currentView === "day"
				? direction
				: currentView === "month-grid"
					? direction * 30
					: direction * 7;
		const baseDate = new Date(`${selectedDateForScheduleX}T12:00:00`);
		if (Number.isNaN(baseDate.getTime())) {
			setSelectedDate(formatDateInput(new Date()));
			return;
		}
		baseDate.setDate(baseDate.getDate() + deltaDays);
		const next = formatDateInput(baseDate);
		setSelectedDate(next);
	};

	const monthLabel = useMemo(() => {
		const parsed = new Date(`${selectedDateForScheduleX}T00:00:00`);
		return monthYearFormatter.format(parsed);
	}, [selectedDateForScheduleX]);
	const selectedDateValue = useMemo(
		() => new Date(`${selectedDateForScheduleX}T00:00:00`),
		[selectedDateForScheduleX],
	);
	const latestSyncedAtFromEvents = useMemo(
		() =>
			normalizedEvents.reduce(
				(latest, event) =>
					event.lastSyncedAt && event.lastSyncedAt > latest ? event.lastSyncedAt : latest,
				0,
			),
		[normalizedEvents],
	);
	const syncStatusLabel = useMemo(() => {
		if (syncStatus === "syncing") return "Syncing with Google Calendar...";
		if (syncStatus === "error") return "Sync failed";
		const effectiveLastSyncedAt = Math.max(lastSyncedAt ?? 0, latestSyncedAtFromEvents);
		if (!effectiveLastSyncedAt) return "Auto sync every 15 minutes";
		return `Last synced ${new Date(effectiveLastSyncedAt).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		})}`;
	}, [lastSyncedAt, latestSyncedAtFromEvents, syncStatus]);
	const editorStartDate = useMemo(
		() =>
			editor?.start
				? toDateFromLocalDatePart(
						splitDateTimeLocal(editor.start).datePart || formatDateInput(new Date()),
					)
				: new Date(),
		[editor?.start],
	);
	const editorEndDate = useMemo(
		() =>
			editor?.end
				? toDateFromLocalDatePart(
						splitDateTimeLocal(editor.end).datePart || formatDateInput(new Date()),
					)
				: new Date(),
		[editor?.end],
	);
	const editorStartTime = useMemo(
		() => (editor?.start ? splitDateTimeLocal(editor.start).timePart : "09:00"),
		[editor?.start],
	);
	const editorEndTime = useMemo(
		() => (editor?.end ? splitDateTimeLocal(editor.end).timePart : "09:30"),
		[editor?.end],
	);
	const editorStartValue = editor?.start;
	const editorEndValue = editor?.end;
	const editorDurationMinutes = useMemo(() => {
		if (!editorStartValue || !editorEndValue) return schedulingStepMinutes;
		const start = parseDateTimeInput(editorStartValue, scheduleXTimeZone);
		const end = parseDateTimeInput(editorEndValue, scheduleXTimeZone);
		if (!Number.isFinite(start) || !Number.isFinite(end)) return schedulingStepMinutes;
		const rawMinutes = Math.max(schedulingStepMinutes, Math.round((end - start) / (1000 * 60)));
		return (
			Math.max(
				schedulingStepMinutes,
				Math.round(rawMinutes / schedulingStepMinutes) * schedulingStepMinutes,
			) || schedulingStepMinutes
		);
	}, [editorEndValue, editorStartValue, scheduleXTimeZone, schedulingStepMinutes]);
	const durationPresetMinutes = useMemo(
		() => durationPresetMultipliers.map((multiplier) => multiplier * schedulingStepMinutes),
		[schedulingStepMinutes],
	);
	const editorDurationSelectValue = useMemo(
		() =>
			durationPresetMinutes.includes(editorDurationMinutes)
				? String(editorDurationMinutes)
				: "custom",
		[durationPresetMinutes, editorDurationMinutes],
	);

	const applyEditorDurationMinutes = useCallback(
		(minutes: number) => {
			const normalizedMinutes = Math.max(
				schedulingStepMinutes,
				Math.round(minutes / schedulingStepMinutes) * schedulingStepMinutes,
			);
			setEditor((current) => {
				if (!current) return current;
				const start = parseDateTimeInput(current.start, scheduleXTimeZone);
				if (!Number.isFinite(start)) return current;
				const nextEnd = snapToStep(start + normalizedMinutes * 60 * 1000, schedulingStepMs);
				return {
					...current,
					end: toInputDateTime(nextEnd, scheduleXTimeZone),
				};
			});
		},
		[scheduleXTimeZone, schedulingStepMinutes, schedulingStepMs],
	);

	const dateOnlyFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(undefined, {
				timeZone: scheduleXTimeZone,
				weekday: "short",
				day: "numeric",
				month: "short",
			}),
		[scheduleXTimeZone],
	);
	const compactDateFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(undefined, {
				timeZone: scheduleXTimeZone,
				month: "short",
				day: "numeric",
			}),
		[scheduleXTimeZone],
	);
	const timeOnlyFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(undefined, {
				timeZone: scheduleXTimeZone,
				hour: "numeric",
				minute: "2-digit",
				hour12: isTwelveHourClock,
			}),
		[isTwelveHourClock, scheduleXTimeZone],
	);

	const sourceButtons: CalendarSource[] = ["google", "task", "habit", "manual"];
	const sourceColorDot: Record<CalendarSource, string> = {
		google: "bg-chart-1",
		task: "bg-chart-3",
		habit: "bg-chart-2",
		manual: "bg-chart-5",
	};
	const isLoading = isAuthLoading || (isAuthenticated && eventsQuery.isPending);
	const isDetailsMode = editor?.mode === "edit" && editor.panelMode === "details";
	const selectedEvent =
		editor?.mode === "edit" && editor.eventId ? scheduleEventsById.get(editor.eventId) : null;
	const defaultTravelMinutes =
		schedulingDefaultsQuery.data?.taskQuickCreateDefaults.travelMinutes ?? 0;
	const selectedEventSource =
		selectedEvent?.source ?? (editor?.mode === "create" ? "manual" : undefined);
	const isTravelBlockEvent =
		selectedEvent?.source === "task" && Boolean(selectedEvent.sourceId?.includes(":travel:"));
	const hasEditorLocation = Boolean(editor?.location.trim());
	const travelBufferAppliesToEvent =
		(selectedEventSource === "google" || selectedEventSource === "manual") &&
		!editor?.allDay &&
		hasEditorLocation &&
		defaultTravelMinutes > 0;
	const travelBufferDescription = (() => {
		if (!editor) return "No event selected.";
		if (isTravelBlockEvent) return "Generated travel block for a scheduled task.";
		if (selectedEventSource !== "google" && selectedEventSource !== "manual") {
			return "Shown for connected and manual events.";
		}
		if (editor.allDay) return "Not applied to all-day events.";
		if (!hasEditorLocation) return "Add a location to apply travel buffer.";
		if (defaultTravelMinutes <= 0) return "Set global travel time in Scheduling settings.";
		return `${formatDuration(0, defaultTravelMinutes * 60 * 1000)} before and after this event.`;
	})();
	const inferredSeriesRecurrenceRule = useMemo(() => {
		if (!selectedEvent || selectedEvent.recurrenceRule) return undefined;
		return inferRecurrenceRule(selectedEvent, normalizedEvents);
	}, [normalizedEvents, selectedEvent]);
	const selectedEventSeriesOccurrenceCount = useMemo(() => {
		const recurringEventId = selectedEvent?.recurringEventId;
		if (!recurringEventId) return 0;
		return normalizedEvents.reduce(
			(count, event) => count + (event.recurringEventId === recurringEventId ? 1 : 0),
			0,
		);
	}, [normalizedEvents, selectedEvent?.recurringEventId]);
	const effectiveRecurrenceRule = useMemo(() => {
		const directRule = editor?.recurrenceRule?.trim();
		return directRule || inferredSeriesRecurrenceRule || "";
	}, [editor?.recurrenceRule, inferredSeriesRecurrenceRule]);
	const parsedRecurrenceRule = useMemo(
		() => parseRRule(effectiveRecurrenceRule),
		[effectiveRecurrenceRule],
	);
	const selectedCalendarId =
		editor?.calendarId ?? selectedEvent?.calendarId ?? defaultCreateCalendarId;
	const selectedEventCalendarLabel = useMemo(() => {
		if (selectedEvent && selectedEvent.source !== "google") {
			return selectedEvent.source.charAt(0).toUpperCase() + selectedEvent.source.slice(1);
		}
		return (
			googleCalendarNamesById.get(selectedCalendarId) ?? prettifyCalendarName(selectedCalendarId)
		);
	}, [googleCalendarNamesById, selectedCalendarId, selectedEvent]);
	const selectedCalendarColor = useMemo(
		() => googleCalendarColorById.get(selectedCalendarId) ?? selectedEvent?.color,
		[googleCalendarColorById, selectedCalendarId, selectedEvent?.color],
	);
	const recurrenceDisplayLabel = useMemo(() => {
		if (!editor) return "Does not repeat";
		const start = parseDateTimeInput(editor.start, scheduleXTimeZone);
		return formatRecurrenceRule(
			effectiveRecurrenceRule || undefined,
			start,
			Boolean(
				selectedEvent?.recurringEventId &&
					!effectiveRecurrenceRule &&
					selectedEventSeriesOccurrenceCount > 1,
			),
		);
	}, [
		editor,
		effectiveRecurrenceRule,
		scheduleXTimeZone,
		selectedEvent?.recurringEventId,
		selectedEventSeriesOccurrenceCount,
	]);
	const recurrenceStartTimestamp = editor
		? parseDateTimeInput(editor.start, scheduleXTimeZone)
		: Date.now();
	const recurrenceWeekdayToken = toWeekdayToken(recurrenceStartTimestamp);
	const recurrencePresetOptions = useMemo(
		() =>
			(["DAILY", "WEEKDAYS", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"] as const).map((preset) => ({
				id: preset,
				label: toRecurrencePresetLabel(preset, recurrenceStartTimestamp, recurrenceWeekdayToken),
			})),
		[recurrenceStartTimestamp, recurrenceWeekdayToken],
	);

	const setEditorRecurrence = useCallback((next: ParsedRecurrenceRule | null) => {
		setEditor((current) =>
			current
				? {
						...current,
						recurrenceRule: serializeRRule(next),
					}
				: current,
		);
	}, []);

	const openCustomRecurrenceDialog = useCallback(() => {
		if (!editor) return;
		setCustomRecurrenceDraft(
			toCustomRecurrenceDraft(parsedRecurrenceRule, recurrenceStartTimestamp),
		);
		setIsCustomRepeatDialogOpen(true);
	}, [editor, parsedRecurrenceRule, recurrenceStartTimestamp]);

	const applyRecurrencePresetFromMenu = useCallback(
		(preset: RecurrencePresetId) => {
			if (preset === "NONE") {
				setEditorRecurrence(null);
				return;
			}
			const next = applyRecurrencePreset(preset, recurrenceStartTimestamp);
			setEditorRecurrence(next);
		},
		[recurrenceStartTimestamp, setEditorRecurrence],
	);

	const applyCustomRecurrence = useCallback(() => {
		if (!customRecurrenceDraft) return;
		const startDate = new Date(recurrenceStartTimestamp);
		const next: ParsedRecurrenceRule = {
			frequency: customRecurrenceDraft.frequency,
			interval: Math.max(1, customRecurrenceDraft.interval),
			byDay:
				customRecurrenceDraft.frequency === "WEEKLY"
					? sortWeekdayTokens(
							customRecurrenceDraft.byDay.length
								? customRecurrenceDraft.byDay
								: [toWeekdayToken(recurrenceStartTimestamp)],
						)
					: [],
			byMonthDay:
				customRecurrenceDraft.frequency === "MONTHLY" ||
				customRecurrenceDraft.frequency === "YEARLY"
					? startDate.getDate()
					: undefined,
			byMonth: customRecurrenceDraft.frequency === "YEARLY" ? startDate.getMonth() + 1 : undefined,
			untilDate:
				customRecurrenceDraft.endsMode === "on" ? customRecurrenceDraft.untilDate : undefined,
			count:
				customRecurrenceDraft.endsMode === "after"
					? Math.max(1, customRecurrenceDraft.count)
					: undefined,
		};

		setEditorRecurrence(next);
		setIsCustomRepeatDialogOpen(false);
	}, [customRecurrenceDraft, recurrenceStartTimestamp, setEditorRecurrence]);
	const eventEditorSheet = (
		<Sheet
			open={eventSheetOpen}
			onOpenChange={(open) => {
				setEventSheetOpen(open);
				if (!open) closeEditor();
			}}
		>
			<SheetContent side="right" className="w-96 p-0 sm:max-w-md" showCloseButton={false}>
				<SheetTitle className="sr-only">Event editor</SheetTitle>
				<div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
					<div className="flex items-center justify-between">
						<div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Event</div>
						<div className="text-[0.68rem] text-muted-foreground">{monthLabel}</div>
					</div>

					{editor ? (
						<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto pr-1">
							<div className="rounded-xl border border-border bg-card">
								<div className="px-3 py-3">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0 flex-1">
											{isDetailsMode ? (
												<div className="text-[1.65rem] leading-[1.12] font-semibold tracking-tight text-foreground break-words">
													{editor.title || "Untitled"}
												</div>
											) : (
												<Input
													value={editor.title}
													onChange={(event) =>
														setEditor((current) =>
															current ? { ...current, title: event.target.value } : current,
														)
													}
													className="h-10 border-border bg-background text-[1rem] font-semibold text-foreground focus-visible:ring-ring/30"
												/>
											)}
										</div>
										<span
											aria-hidden="true"
											className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground"
										>
											<MoreHorizontal className="size-4" />
										</span>
									</div>
								</div>

								<div className="border-t border-border px-3 py-3 space-y-2.5">
									<div className="grid grid-cols-[20px_1fr] items-center gap-3">
										<Clock3 className="size-4 text-muted-foreground" />
										<div>
											<div className="flex items-center gap-1.5 flex-wrap text-[0.92rem]">
												{isDetailsMode ? (
													<>
														<span className="text-foreground">
															{timeOnlyFormatter.format(
																new Date(parseDateTimeInput(editor.start, scheduleXTimeZone)),
															)}
														</span>
														<ArrowRight className="size-4 text-muted-foreground" />
														<span className="text-foreground">
															{timeOnlyFormatter.format(
																new Date(parseDateTimeInput(editor.end, scheduleXTimeZone)),
															)}
														</span>
														<span className="text-muted-foreground">
															{formatDuration(
																parseDateTimeInput(editor.start, scheduleXTimeZone),
																parseDateTimeInput(editor.end, scheduleXTimeZone),
															)}
														</span>
													</>
												) : (
													<>
														<Input
															type="time"
															step={schedulingStepSeconds}
															value={editorStartTime}
															onChange={(event) =>
																setEditor((current) =>
																	current
																		? {
																				...current,
																				start: setLocalTimePart(current.start, event.target.value),
																			}
																		: current,
																)
															}
															className="h-8 w-[92px] border-border bg-background text-sm"
														/>
														<ArrowRight className="size-4 text-muted-foreground" />
														<Input
															type="time"
															step={schedulingStepSeconds}
															value={editorEndTime}
															onChange={(event) =>
																setEditor((current) =>
																	current
																		? {
																				...current,
																				end: setLocalTimePart(current.end, event.target.value),
																			}
																		: current,
																)
															}
															className="h-8 w-[92px] border-border bg-background text-sm"
														/>
														<span className="text-muted-foreground text-[0.85rem]">
															{formatDuration(
																parseDateTimeInput(editor.start, scheduleXTimeZone),
																parseDateTimeInput(editor.end, scheduleXTimeZone),
															)}
														</span>
													</>
												)}
											</div>
											<div className="mt-0.5 text-[0.8rem] text-muted-foreground">
												{isDetailsMode
													? dateOnlyFormatter.format(
															new Date(parseDateTimeInput(editor.start, scheduleXTimeZone)),
														)
													: null}
											</div>
										</div>
									</div>

									<div className="grid grid-cols-[20px_1fr] items-center gap-3">
										<CalendarDays className="size-4 text-muted-foreground" />
										<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 min-w-0">
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														disabled={isDetailsMode}
														className="h-8 w-full min-w-0 border-border bg-background px-2 text-[0.78rem] text-foreground/85 justify-start truncate disabled:opacity-100 disabled:text-foreground/75"
													>
														{compactDateFormatter.format(editorStartDate)}
													</Button>
												</PopoverTrigger>
												<PopoverContent
													align="start"
													className="w-auto border-border bg-popover p-0 text-popover-foreground"
												>
													<DatePickerCalendar
														mode="single"
														selected={editorStartDate}
														onSelect={(date) => {
															if (!date) return;
															setEditor((current) =>
																current
																	? { ...current, start: setLocalDatePart(current.start, date) }
																	: current,
															);
														}}
														initialFocus
														className="rounded-md border-0 bg-transparent"
													/>
												</PopoverContent>
											</Popover>
											<ArrowRight className="size-4 text-muted-foreground" />
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														disabled={isDetailsMode}
														className="h-8 w-full min-w-0 border-border bg-background px-2 text-[0.78rem] text-foreground/85 justify-start truncate disabled:opacity-100 disabled:text-foreground/75"
													>
														{compactDateFormatter.format(editorEndDate)}
													</Button>
												</PopoverTrigger>
												<PopoverContent
													align="start"
													className="w-auto border-border bg-popover p-0 text-popover-foreground"
												>
													<DatePickerCalendar
														mode="single"
														selected={editorEndDate}
														onSelect={(date) => {
															if (!date) return;
															setEditor((current) =>
																current
																	? { ...current, end: setLocalDatePart(current.end, date) }
																	: current,
															);
														}}
														initialFocus
														className="rounded-md border-0 bg-transparent"
													/>
												</PopoverContent>
											</Popover>
										</div>
									</div>

									<div className="grid grid-cols-[20px_1fr] items-center gap-3">
										<div className="size-4 rounded-full border border-muted-foreground" />
										<div className="flex items-center justify-between">
											<span className="text-[0.95rem] text-foreground/90">All-day</span>
											<Switch
												checked={editor.allDay}
												disabled={isDetailsMode}
												onCheckedChange={(checked) =>
													setEditor((current) =>
														current ? { ...current, allDay: checked } : current,
													)
												}
											/>
										</div>
									</div>

									<div className="grid grid-cols-[20px_1fr] items-center gap-3">
										<Globe2 className="size-4 text-muted-foreground" />
										<div className="text-[0.95rem] text-foreground/90">{scheduleXTimeZone}</div>
									</div>

									<div className="grid grid-cols-[20px_1fr] items-start gap-3">
										<Repeat2 className="size-4 text-muted-foreground" />
										{isDetailsMode ? (
											<div className="flex items-center justify-between gap-2">
												<div className="text-[0.95rem] text-foreground/90">
													{recurrenceDisplayLabel}
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-[0.72rem] text-muted-foreground hover:bg-accent hover:text-foreground"
													onClick={() =>
														setEditor((current) =>
															current
																? {
																		...current,
																		panelMode: "edit",
																		recurrenceRule:
																			current.recurrenceRule.trim() ||
																			effectiveRecurrenceRule ||
																			"",
																	}
																: current,
														)
													}
												>
													Change
												</Button>
											</div>
										) : (
											<div className="space-y-2">
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															type="button"
															variant="outline"
															className="h-9 w-full justify-between border-border bg-background px-3 text-[0.86rem] text-foreground/90 hover:bg-accent"
														>
															<span>{recurrenceDisplayLabel}</span>
															<ChevronDown className="size-4 text-muted-foreground" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent
														align="start"
														className="w-[18rem] border-border bg-popover p-1.5 text-foreground"
													>
														<DropdownMenuItem
															className="rounded-md px-2.5 py-2 text-[0.9rem]"
															onSelect={() => applyRecurrencePresetFromMenu("NONE")}
														>
															Does not repeat
														</DropdownMenuItem>
														{recurrencePresetOptions.map((option) => (
															<DropdownMenuItem
																key={option.id}
																className="rounded-md px-2.5 py-2 text-[0.9rem]"
																onSelect={() => applyRecurrencePresetFromMenu(option.id)}
															>
																{option.label}
															</DropdownMenuItem>
														))}
														<DropdownMenuSeparator className="my-1 bg-border" />
														<DropdownMenuItem
															className="rounded-md px-2.5 py-2 text-[0.9rem]"
															onSelect={(event) => {
																event.preventDefault();
																openCustomRecurrenceDialog();
															}}
														>
															Custom...
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>

												<div className="text-[0.72rem] text-muted-foreground">
													Google-compatible RRULE stored in event metadata.
												</div>
											</div>
										)}
									</div>

									<Dialog
										open={isCustomRepeatDialogOpen}
										onOpenChange={(open) => {
											setIsCustomRepeatDialogOpen(open);
											if (!open) setCustomRecurrenceDraft(null);
										}}
									>
										<DialogContent
											showCloseButton={false}
											className="max-w-[36rem] border-border bg-popover p-0 text-popover-foreground"
										>
											<DialogHeader className="border-b border-border px-6 pt-5 pb-4">
												<DialogTitle className="text-[1.05rem] font-semibold text-foreground">
													Repeat
												</DialogTitle>
											</DialogHeader>

											{customRecurrenceDraft ? (
												<div className="space-y-6 px-6 py-5">
													<div className="flex flex-wrap items-center gap-3">
														<span className="text-[0.95rem] text-foreground/80">Every</span>
														<Input
															type="number"
															min={1}
															max={365}
															value={customRecurrenceDraft.interval}
															onChange={(event) =>
																setCustomRecurrenceDraft((current) =>
																	current
																		? {
																				...current,
																				interval: Math.max(
																					1,
																					Number.parseInt(event.target.value || "1", 10) || 1,
																				),
																			}
																		: current,
																)
															}
															className="h-10 w-[92px] border-border bg-secondary text-[1.05rem] text-foreground"
														/>
														<Select
															value={customRecurrenceDraft.frequency}
															onValueChange={(value) =>
																setCustomRecurrenceDraft((current) =>
																	current
																		? {
																				...current,
																				frequency: value as Exclude<RecurrenceFrequency, "NONE">,
																			}
																		: current,
																)
															}
														>
															<SelectTrigger
																size="default"
																className="h-10 min-w-[140px] border-border bg-secondary text-[1.02rem] text-foreground"
															>
																<SelectValue />
															</SelectTrigger>
															<SelectContent className="border-border bg-popover text-popover-foreground">
																<SelectItem value="DAILY">day</SelectItem>
																<SelectItem value="WEEKLY">week</SelectItem>
																<SelectItem value="MONTHLY">month</SelectItem>
																<SelectItem value="YEARLY">year</SelectItem>
															</SelectContent>
														</Select>
													</div>

													{customRecurrenceDraft.frequency === "WEEKLY" ? (
														<div className="space-y-2">
															<div className="text-[0.95rem] text-foreground/80">On</div>
															<ToggleGroup
																type="multiple"
																value={customRecurrenceDraft.byDay}
																onValueChange={(values) =>
																	setCustomRecurrenceDraft((current) =>
																		current
																			? {
																					...current,
																					byDay: sortWeekdayTokens(
																						values.filter((value): value is WeekdayToken =>
																							weekdayTokens.includes(value as WeekdayToken),
																						),
																					),
																				}
																			: current,
																	)
																}
																className="flex flex-wrap gap-2"
															>
																{weekdayTokens.map((token) => (
																	<ToggleGroupItem
																		key={token}
																		value={token}
																		variant="outline"
																		size="sm"
																		className="h-9 min-w-10 rounded-full border border-border bg-secondary px-3 text-[0.92rem] text-foreground/80 data-[state=on]:border-accent data-[state=on]:bg-accent/20 data-[state=on]:text-accent-foreground"
																	>
																		{weekdayTokenToLabel[token].slice(0, 3)}
																	</ToggleGroupItem>
																))}
															</ToggleGroup>
														</div>
													) : null}

													<div className="space-y-3">
														<div className="text-[0.95rem] text-foreground/80">Ends</div>
														<RadioGroup
															value={customRecurrenceDraft.endsMode}
															onValueChange={(value) =>
																setCustomRecurrenceDraft((current) =>
																	current
																		? { ...current, endsMode: value as RecurrenceEndsMode }
																		: current,
																)
															}
															className="gap-3"
														>
															<div className="grid grid-cols-[20px_1fr] items-center gap-3">
																<RadioGroupItem
																	value="never"
																	className="size-6 border-border bg-secondary data-[state=checked]:border-accent"
																/>
																<div className="text-[0.95rem] text-foreground/85">Never</div>
															</div>
															<div className="grid grid-cols-[20px_1fr] items-center gap-3">
																<RadioGroupItem
																	value="on"
																	className="size-6 border-border bg-secondary data-[state=checked]:border-accent"
																/>
																<div className="flex items-center gap-3">
																	<span className="text-[0.95rem] text-foreground/85">On</span>
																	<Popover>
																		<PopoverTrigger asChild>
																			<Button
																				type="button"
																				variant="outline"
																				disabled={customRecurrenceDraft.endsMode !== "on"}
																				className="h-9 min-w-[148px] border-border bg-secondary px-3 text-[0.95rem] text-foreground/85 disabled:opacity-60"
																			>
																				{compactDateFormatter.format(
																					toDateFromLocalDatePart(customRecurrenceDraft.untilDate),
																				)}
																			</Button>
																		</PopoverTrigger>
																		<PopoverContent
																			align="start"
																			className="w-auto border-border bg-popover p-0 text-popover-foreground"
																		>
																			<DatePickerCalendar
																				mode="single"
																				selected={toDateFromLocalDatePart(
																					customRecurrenceDraft.untilDate,
																				)}
																				onSelect={(date) => {
																					if (!date) return;
																					setCustomRecurrenceDraft((current) =>
																						current
																							? { ...current, untilDate: formatDateInput(date) }
																							: current,
																					);
																				}}
																				initialFocus
																				className="rounded-md border-0 bg-transparent"
																			/>
																		</PopoverContent>
																	</Popover>
																</div>
															</div>
															<div className="grid grid-cols-[20px_1fr] items-center gap-3">
																<RadioGroupItem
																	value="after"
																	className="size-6 border-border bg-secondary data-[state=checked]:border-accent"
																/>
																<div className="flex items-center gap-3">
																	<span className="text-[0.95rem] text-foreground/85">After</span>
																	<Input
																		type="number"
																		min={1}
																		max={500}
																		disabled={customRecurrenceDraft.endsMode !== "after"}
																		value={customRecurrenceDraft.count}
																		onChange={(event) =>
																			setCustomRecurrenceDraft((current) =>
																				current
																					? {
																							...current,
																							count: Math.max(
																								1,
																								Number.parseInt(event.target.value || "1", 10) || 1,
																							),
																						}
																					: current,
																			)
																		}
																		className="h-9 w-[90px] border-border bg-secondary text-[0.95rem] disabled:opacity-60"
																	/>
																	<span className="text-[0.95rem] text-muted-foreground">
																		times
																	</span>
																</div>
															</div>
														</RadioGroup>
													</div>
												</div>
											) : null}

											<DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
												<Button
													variant="outline"
													className="h-10 border-border bg-secondary px-5 text-foreground hover:bg-secondary/80"
													onClick={() => {
														setIsCustomRepeatDialogOpen(false);
														setCustomRecurrenceDraft(null);
													}}
												>
													Cancel
												</Button>
												<Button
													className="h-10 bg-accent px-5 text-accent-foreground hover:bg-accent/85"
													onClick={applyCustomRecurrence}
												>
													Done
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</div>

								<div className="border-t border-border px-3 py-3 space-y-2.5">
									<div className="grid grid-cols-[20px_1fr] items-center gap-3">
										<User className="size-4 text-muted-foreground" />
										<div className="text-[0.95rem] text-foreground/90 truncate">
											Created by connected account
										</div>
									</div>
									<div className="grid grid-cols-[20px_1fr] items-center gap-3 opacity-60">
										<Video className="size-4 text-muted-foreground" />
										<div className="text-[0.95rem] text-muted-foreground">Conferencing</div>
									</div>
									<div className="grid grid-cols-[20px_1fr] items-center gap-3 opacity-60">
										<FileText className="size-4 text-muted-foreground" />
										<div className="text-[0.95rem] text-muted-foreground">
											AI Meeting Notes and Docs
										</div>
									</div>
									<div className="grid grid-cols-[20px_1fr] items-center gap-3">
										<MapPin className="size-4 text-muted-foreground" />
										{isDetailsMode ? (
											<div className="text-[0.95rem] text-foreground/85">
												{editor.location.trim() || "No location"}
											</div>
										) : (
											<Input
												value={editor.location}
												onChange={(event) =>
													setEditor((current) =>
														current ? { ...current, location: event.target.value } : current,
													)
												}
												placeholder="Add location"
												className="h-8 border-border bg-background text-sm"
											/>
										)}
									</div>
									<div className="grid grid-cols-[20px_1fr] items-center gap-3">
										<Route className="size-4 text-muted-foreground" />
										<div
											className={`text-[0.95rem] ${
												travelBufferAppliesToEvent ? "text-foreground/85" : "text-muted-foreground"
											}`}
										>
											{`Travel buffer: ${travelBufferDescription}`}
										</div>
									</div>
								</div>

								<div className="border-t border-border px-3 py-3">
									<div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
										Description
									</div>
									{isDetailsMode ? (
										<div className="text-[0.92rem] text-foreground/80 whitespace-pre-wrap">
											{normalizeDescription(editor.description) || "No description"}
										</div>
									) : (
										<Textarea
											value={editor.description}
											onChange={(event) =>
												setEditor((current) =>
													current ? { ...current, description: event.target.value } : current,
												)
											}
											className="min-h-[120px] border-border bg-background text-sm leading-relaxed"
										/>
									)}
								</div>

								<div className="border-t border-border px-3 py-3 space-y-2.5">
									<div className="flex items-center gap-2 text-[0.95rem] text-foreground/90">
										<span
											className="size-3 rounded-[5px]"
											style={{
												backgroundColor: resolveGoogleColor(selectedCalendarColor).main,
											}}
										/>
										{isDetailsMode ? (
											<span>{selectedEventCalendarLabel}</span>
										) : (
											<Select
												value={editor.calendarId}
												onValueChange={(value) =>
													setEditor((current) =>
														current ? { ...current, calendarId: value } : current,
													)
												}
											>
												<SelectTrigger
													size="sm"
													className="h-8 min-w-[200px] border-border bg-background text-[0.84rem] text-foreground/90"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent className="border-border bg-popover text-popover-foreground">
													{editableGoogleCalendars.map((calendar) => (
														<SelectItem key={calendar.id} value={calendar.id}>
															{googleCalendarNamesById.get(calendar.id) ??
																prettifyCalendarName(calendar.id)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									</div>
									<div className="grid grid-cols-1 gap-2 text-[0.84rem] sm:grid-cols-2">
										{isDetailsMode ? (
											<>
												<div className="text-foreground/80">
													{busyStatusLabel(editor.busyStatus)}
												</div>
												<div className="text-foreground/80">
													{visibilityLabel(editor.visibility)}
												</div>
											</>
										) : (
											<>
												<Select
													value={editor.busyStatus}
													onValueChange={(value) =>
														setEditor((current) =>
															current
																? {
																		...current,
																		busyStatus: value as "free" | "busy" | "tentative",
																	}
																: current,
														)
													}
												>
													<SelectTrigger
														size="sm"
														className="h-8 min-w-0 border-border bg-background text-[0.82rem] text-foreground/85"
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="border-border bg-popover text-popover-foreground">
														{busyStatusOptions.map((option) => (
															<SelectItem key={option.value} value={option.value}>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Select
													value={editor.visibility}
													onValueChange={(value) =>
														setEditor((current) =>
															current
																? {
																		...current,
																		visibility: value as
																			| "default"
																			| "public"
																			| "private"
																			| "confidential",
																	}
																: current,
														)
													}
												>
													<SelectTrigger
														size="sm"
														className="h-8 min-w-0 border-border bg-background text-[0.82rem] text-foreground/85"
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="border-border bg-popover text-popover-foreground">
														{visibilityOptions.map((option) => (
															<SelectItem key={option.value} value={option.value}>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</>
										)}
									</div>
									<div className="grid grid-cols-[20px_1fr] items-center gap-3 opacity-60">
										<Bell className="size-4 text-muted-foreground" />
										<div className="text-[0.95rem] text-muted-foreground">Reminders</div>
									</div>
								</div>

								<div className="border-t border-border px-3 py-3 space-y-2">
									<div className="grid grid-cols-[20px_1fr] items-start gap-3">
										<Clock3 className="size-4 text-muted-foreground" />
										<div className="space-y-1.5">
											<div className="text-[0.9rem] text-foreground/85">Duration</div>
											{isDetailsMode ? (
												<div className="text-[0.92rem] text-foreground/80">
													{formatDuration(
														parseDateTimeInput(editor.start, scheduleXTimeZone),
														parseDateTimeInput(editor.end, scheduleXTimeZone),
													)}
												</div>
											) : (
												<>
													<div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
														<Select
															value={editorDurationSelectValue}
															onValueChange={(value) => {
																if (value === "custom") return;
																const parsed = Number.parseInt(value, 10);
																if (!Number.isFinite(parsed)) return;
																applyEditorDurationMinutes(parsed);
															}}
														>
															<SelectTrigger
																size="sm"
																className="h-8 w-full min-w-0 border-border bg-background text-[0.82rem] text-foreground/85 sm:w-[130px]"
															>
																<SelectValue />
															</SelectTrigger>
															<SelectContent className="border-border bg-popover text-popover-foreground">
																{durationPresetMinutes.map((minutes) => (
																	<SelectItem key={minutes} value={String(minutes)}>
																		{minutes} min
																	</SelectItem>
																))}
																<SelectItem value="custom">Custom</SelectItem>
															</SelectContent>
														</Select>
														<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:w-auto">
															<Input
																type="number"
																min={schedulingStepMinutes}
																step={schedulingStepMinutes}
																value={editorDurationMinutes}
																onChange={(event) => {
																	const parsed = Number.parseInt(event.target.value, 10);
																	if (!Number.isFinite(parsed)) return;
																	applyEditorDurationMinutes(parsed);
																}}
																className="h-8 w-full min-w-0 border-border bg-background text-sm sm:w-[90px]"
															/>
															<span className="text-[0.82rem] text-muted-foreground">min</span>
														</div>
													</div>
													<div className="text-[0.72rem] text-muted-foreground">
														Snaps to {schedulingStepMinutes}-minute increments.
													</div>
												</>
											)}
										</div>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-between border-t border-border pt-2.5">
								{editor.mode === "edit" && editor.eventId ? (
									<Button
										variant="outline"
										size="sm"
										className="border-border text-destructive text-[0.72rem] hover:bg-destructive/10 hover:border-destructive/30"
										onClick={async () => {
											const eventId = editor.eventId;
											if (!eventId) return;
											try {
												setError(null);
												await deleteEvent(eventId, editor.scope);
												setEditor(null);
											} catch (deleteError) {
												setError(
													deleteError instanceof Error
														? deleteError.message
														: "Unable to delete event.",
												);
											}
										}}
									>
										Delete
									</Button>
								) : (
									<div />
								)}
								<div className="flex items-center gap-2">
									{isDetailsMode ? (
										<Button
											size="sm"
											variant="outline"
											className="border-border text-foreground text-[0.72rem] hover:bg-accent"
											onClick={() =>
												setEditor((current) =>
													current ? { ...current, panelMode: "edit" } : current,
												)
											}
										>
											Edit
										</Button>
									) : null}
									<Button
										variant="outline"
										size="sm"
										className="border-border text-muted-foreground text-[0.72rem] hover:bg-accent hover:text-foreground"
										onClick={closeEditor}
									>
										Close
									</Button>
									{!isDetailsMode ? (
										<Button
											size="sm"
											className="bg-accent text-accent-foreground text-[0.72rem] font-medium hover:bg-accent/85"
											onClick={onSubmitEditor}
										>
											Save
										</Button>
									) : null}
								</div>
							</div>
						</div>
					) : (
						<>
							<div className="rounded-xl border border-border/60 bg-card/60 p-4 text-center">
								<CalendarDays className="mx-auto mb-2 size-6 text-muted-foreground/40" />
								<div className="text-[0.78rem] font-medium text-muted-foreground">
									Select an event to view details
								</div>
								<div className="mt-0.5 text-[0.66rem] text-muted-foreground/60">
									Click any event on the calendar
								</div>
							</div>
							<div className="rounded-xl border border-border/60 bg-card/60 p-4">
								<div className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium">
									Shortcuts
								</div>
								<ul className="mt-2.5 space-y-2 text-[0.72rem] text-muted-foreground">
									<li className="flex items-center gap-2">
										<span className="inline-flex size-5 items-center justify-center rounded bg-muted text-[0.58rem] font-semibold text-muted-foreground/70">
											1×
										</span>
										Open event details
									</li>
									<li className="flex items-center gap-2">
										<span className="inline-flex size-5 items-center justify-center rounded bg-muted text-[0.58rem] font-semibold text-muted-foreground/70">
											2×
										</span>
										Edit event
									</li>
									<li className="flex items-center gap-2">
										<span className="inline-flex size-5 items-center justify-center rounded bg-muted text-[0.55rem] font-semibold text-muted-foreground/70">
											⇕
										</span>
										Drag to create event
									</li>
								</ul>
							</div>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);

	return (
		<>
			<div className="h-full min-h-0 overflow-hidden bg-background text-foreground flex flex-col gap-0">
				<header className="shrink-0 sticky top-0 z-20 border-b border-border bg-card px-4 py-2.5 flex flex-col gap-2">
					<div className="flex items-center justify-between gap-3 flex-wrap">
						<div className="flex items-center gap-3">
							<h1 className="text-[1.05rem] font-semibold uppercase tracking-[0.04em] text-foreground">
								{monthLabel}
							</h1>
							<div className="flex items-center gap-1">
								<Button
									variant="outline"
									size="icon-sm"
									className="size-8 border-border bg-secondary text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
									onClick={() => shiftDate(-1)}
									aria-label="Previous period"
								>
									<ChevronLeft className="size-3.5" />
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="h-7 px-2.5 border-border bg-secondary text-foreground/80 text-[0.72rem] hover:border-border hover:bg-accent hover:text-foreground"
									onClick={() => setDateValue(formatDateInput(new Date()))}
								>
									Today
								</Button>
								<Button
									variant="outline"
									size="icon-sm"
									className="size-7 border-border bg-secondary text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
									onClick={() => shiftDate(1)}
									aria-label="Next period"
								>
									<ChevronRight className="size-3.5" />
								</Button>
							</div>
						</div>

						<div className="flex items-center gap-2 flex-wrap" suppressHydrationWarning>
							<ToggleGroup
								type="single"
								value={activeView}
								onValueChange={(value) => {
									if (value) changeView(value as "week" | "day" | "month-grid");
								}}
								className="gap-0 rounded-lg border border-border bg-secondary p-0.5"
							>
								{[
									{ key: "week", label: "Week" },
									{ key: "day", label: "Day" },
									{ key: "month-grid", label: "Month" },
								].map((tab) => (
									<ToggleGroupItem
										key={tab.key}
										value={tab.key}
										variant="outline"
										size="sm"
										className="h-6 px-2.5 border-0 bg-transparent text-muted-foreground text-[0.7rem] font-medium hover:text-foreground hover:bg-transparent data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:shadow-sm rounded-md"
									>
										{tab.label}
									</ToggleGroupItem>
								))}
							</ToggleGroup>

							<div className="w-px h-4 bg-border" />

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										size="sm"
										className="h-7 px-2.5 bg-accent text-accent-foreground text-[0.72rem] font-semibold gap-1.5 border-accent hover:bg-accent/90 shadow-[0_2px_8px_-2px_rgba(252,163,17,0.3)]"
									>
										<Sparkles className="size-3" />
										Create new
										<ChevronDown className="size-3 opacity-60" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-44">
									<DropdownMenuItem onSelect={() => setQuickCreateTaskOpen(true)} className="gap-2">
										<Rocket className="size-3.5" />
										New task
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={() => {
											const start = snapToStep(Date.now(), schedulingStepMs);
											const end = snapToStep(start + schedulingStepMs, schedulingStepMs);
											setEditor({
												mode: "create",
												panelMode: "edit",
												title: "",
												description: "",
												start: toInputDateTime(start, scheduleXTimeZone),
												end: toInputDateTime(end, scheduleXTimeZone),
												allDay: false,
												calendarId: defaultCreateCalendarId,
												busyStatus: "busy",
												visibility: "default",
												location: "",
												recurrenceRule: "",
												scope: "single",
											});
										}}
										className="gap-2"
									>
										<Sparkles className="size-3.5" />
										New event
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={() => setQuickCreateHabitOpen(true)}
										className="gap-2"
									>
										<Repeat2 className="size-3.5" />
										New habit
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							<Button
								variant="outline"
								size="icon-sm"
								className="size-7 border-border bg-secondary text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
								onClick={() => {
									void syncNow("manual");
								}}
								disabled={syncStatus === "syncing"}
								aria-label="Sync"
							>
								<RefreshCw
									className={`size-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
								/>
							</Button>

							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										aria-label="Choose date"
										className="h-8 px-2.5 border-border bg-secondary text-foreground/70 text-[0.72rem] gap-1.5 hover:border-border hover:bg-accent hover:text-foreground"
									>
										<CalendarDays className="size-3.5" />
										{selectedDate}
									</Button>
								</PopoverTrigger>
								<PopoverContent
									align="end"
									className="w-auto border-border bg-popover p-0 text-popover-foreground"
								>
									<DatePickerCalendar
										mode="single"
										selected={selectedDateValue}
										onSelect={(date) => {
											if (!date) return;
											setDateValue(formatDateInput(date));
										}}
										initialFocus
										className="rounded-md border-0 bg-transparent"
									/>
								</PopoverContent>
							</Popover>

							<SchedulingDiagnostics />
						</div>
					</div>

					<div className="flex items-center justify-between gap-2 flex-wrap">
						<ToggleGroup
							type="multiple"
							value={sourceFilter}
							onValueChange={(value) =>
								setSourceFilter(value.length ? (value as CalendarSource[]) : DEFAULT_SOURCE_FILTER)
							}
							className="gap-1"
						>
							{sourceButtons.map((source) => (
								<ToggleGroupItem
									key={source}
									value={source}
									variant="outline"
									size="sm"
									className="h-7 rounded-md border border-border bg-secondary px-2 text-[0.68rem] uppercase tracking-[0.06em] text-muted-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/20 gap-1.5"
								>
									<span className={`size-1.5 rounded-full ${sourceColorDot[source]}`} />
									{source}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
						<div className="flex items-center gap-2 text-[0.66rem] text-muted-foreground/70">
							<span className="tabular-nums">{visibleEventCount} events</span>
							<span className="text-border">·</span>
							<div
								className={`flex items-center gap-1.5 ${
									syncStatus === "error"
										? "text-destructive"
										: syncStatus === "syncing"
											? "text-chart-1"
											: "text-muted-foreground/70"
								}`}
							>
								<span
									className={`inline-block size-1.5 rounded-full ${
										syncStatus === "error"
											? "bg-destructive"
											: syncStatus === "syncing"
												? "bg-chart-1 animate-pulse"
												: "bg-chart-2"
									}`}
								/>
								{syncStatusLabel}
							</div>
						</div>
					</div>
				</header>

				{error ? (
					<div className="mx-4 mt-2 border border-destructive/30 bg-destructive/10 rounded-lg px-3 py-2 text-[0.8rem] text-destructive">
						{error}
					</div>
				) : null}
				{isLoading ? (
					<div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-[0.78rem] text-muted-foreground">
						<RefreshCw className="size-3.5 shrink-0 animate-spin opacity-50" />
						Loading events...
					</div>
				) : null}
				{!isLoading && !error && visibleEventCount === 0 ? (
					<div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-[0.78rem] text-muted-foreground">
						<RefreshCw className="size-3.5 shrink-0 opacity-50" />
						No events loaded. Click sync to fetch from Google.
					</div>
				) : null}

				<div className="flex flex-1 min-h-0 overflow-hidden">
					<div
						ref={calendarContainerRef}
						className={`${effectiveTheme === "dark" ? "sx-autocron-dark" : "sx-autocron-light"} flex-1 min-w-0 min-h-0 h-full overflow-hidden`}
					>
						<ScheduleXCalendar calendarApp={calendar} customComponents={customComponents} />
					</div>
				</div>
				<Dialog
					open={Boolean(pendingMoveUpdate)}
					onOpenChange={(open) => !open && setPendingMoveUpdate(null)}
				>
					<DialogContent className="max-w-sm border-border bg-popover text-popover-foreground">
						<DialogHeader>
							<DialogTitle className="text-[1rem] font-semibold text-foreground">
								Move recurring event
							</DialogTitle>
						</DialogHeader>
						<div className="space-y-2 text-sm text-foreground/80">
							<div>
								You moved{" "}
								<span className="font-medium text-foreground">{pendingMoveUpdate?.title}</span>.
							</div>
							<div>Apply the move to just this event or the full series?</div>
						</div>
						<DialogFooter className="gap-2 sm:justify-end">
							<Button
								variant="outline"
								className="border-border bg-secondary text-foreground/85 hover:bg-accent"
								onClick={() => setPendingMoveUpdate(null)}
							>
								Cancel
							</Button>
							<Button
								variant="outline"
								className="border-border bg-secondary text-foreground/85 hover:bg-accent"
								onClick={() => void moveRecurringEvent("single")}
							>
								Only this event
							</Button>
							<Button
								className="bg-accent text-accent-foreground hover:bg-accent/90"
								onClick={() => void moveRecurringEvent("series")}
							>
								Entire series
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<QuickCreateTaskDialog open={quickCreateTaskOpen} onOpenChange={setQuickCreateTaskOpen} />
				<QuickCreateHabitDialog
					open={quickCreateHabitOpen}
					onOpenChange={setQuickCreateHabitOpen}
				/>
			</div>
			{eventEditorSheet}
		</>
	);
}
