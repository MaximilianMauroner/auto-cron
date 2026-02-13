"use client";

import PaywallDialog from "@/components/autumn/paywall-dialog";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DurationInput } from "@/components/ui/duration-input";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUserPreferences } from "@/components/user-preferences-context";
import {
	useActionWithStatus,
	useAuthenticatedQueryWithStatus,
	useMutationWithStatus,
} from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type {
	HabitCategory,
	HabitDTO,
	HabitFrequency,
	HabitPriority,
	HoursSetDTO,
} from "@auto-cron/types";
import {
	Calendar,
	CalendarDays,
	Clock3,
	Flame,
	MapPin,
	Plus,
	Repeat2,
	Search,
	Shield,
	Sparkles,
	Timer,
	Waves,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type HabitVisibilityPreference = "default" | "public" | "private";
type HabitTimeDefenseMode = "always_free" | "auto" | "always_busy";
type HabitReminderMode = "default" | "custom" | "none";
type HabitUnscheduledBehavior = "leave_on_calendar" | "remove_from_calendar";
type HabitRecoveryPolicy = "skip" | "recover";

type HabitEditorState = {
	id?: string;
	title: string;
	description: string;
	priority: HabitPriority;
	category: HabitCategory;
	frequency: HabitFrequency;
	repeatsPerPeriod: string;
	minDurationMinutes: string;
	maxDurationMinutes: string;
	idealTime: string;
	preferredDays: number[];
	hoursSetId: string;
	preferredCalendarId: string;
	color: string;
	location: string;
	startDate: string;
	endDate: string;
	visibilityPreference: HabitVisibilityPreference;
	timeDefenseMode: HabitTimeDefenseMode;
	reminderMode: HabitReminderMode;
	customReminderMinutes: string;
	unscheduledBehavior: HabitUnscheduledBehavior;
	recoveryPolicy: HabitRecoveryPolicy;
	autoDeclineInvites: boolean;
	ccEmails: string;
	duplicateAvoidKeywords: string;
	dependencyNote: string;
	publicDescription: string;
	isActive: boolean;
};

type GoogleCalendarListItem = {
	id: string;
	name: string;
	primary: boolean;
	color?: string;
	accessRole?: "owner" | "writer" | "reader" | "freeBusyReader";
	isExternal: boolean;
};

type HabitTemplateCategory =
	| "All"
	| "Product"
	| "Engineering"
	| "Support"
	| "Design"
	| "Sales"
	| "Marketing"
	| "Leadership"
	| "Wellness"
	| "Learning";

type HabitTemplate = {
	id: string;
	name: string;
	emoji: string;
	category: HabitTemplateCategory;
	description: string;
	habitCategory: HabitCategory;
	priority: HabitPriority;
	frequency: HabitFrequency;
	minDurationMinutes: number;
	maxDurationMinutes: number;
	idealTime: string;
	preferredDays: number[];
	color: string;
	timeDefenseMode: HabitTimeDefenseMode;
	recoveryPolicy: HabitRecoveryPolicy;
	visibilityPreference: HabitVisibilityPreference;
};

const categoryLabels: Record<HabitCategory, string> = {
	health: "Health",
	fitness: "Fitness",
	learning: "Learning",
	mindfulness: "Mindfulness",
	productivity: "Productivity",
	social: "Social",
	other: "Other",
};

const priorityLabels: Record<HabitPriority, string> = {
	low: "Low priority",
	medium: "Medium priority",
	high: "High priority",
	critical: "Critical priority",
};

const priorityClass: Record<HabitPriority, string> = {
	low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
	medium: "bg-sky-500/10 text-sky-700 border-sky-500/30",
	high: "bg-amber-500/10 text-amber-700 border-amber-500/30",
	critical: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

const frequencyLabels: Record<HabitFrequency, string> = {
	daily: "Daily",
	weekly: "Weekly",
	biweekly: "Biweekly",
	monthly: "Monthly",
};

const reminderModeLabels: Record<HabitReminderMode, string> = {
	default: "Use calendar default reminders",
	custom: "Custom reminders",
	none: "Disable reminders",
};

const unscheduledLabels: Record<HabitUnscheduledBehavior, string> = {
	leave_on_calendar: "Leave it on the calendar",
	remove_from_calendar: "Remove it from the calendar",
};

const recoveryLabels: Record<HabitRecoveryPolicy, string> = {
	skip: "Skip missed occurrences",
	recover: "Recover missed occurrences",
};

const visibilityLabels: Record<HabitVisibilityPreference, string> = {
	public: "Public",
	default: "Default visibility",
	private: "Private",
};

const defenseModeLabels: Record<HabitTimeDefenseMode, string> = {
	always_free: "Always free",
	auto: "Use Auto Cron AI",
	always_busy: "Always busy",
};

const dayOptions = [
	{ value: 1, short: "Mo", label: "Monday" },
	{ value: 2, short: "Tu", label: "Tuesday" },
	{ value: 3, short: "We", label: "Wednesday" },
	{ value: 4, short: "Th", label: "Thursday" },
	{ value: 5, short: "Fr", label: "Friday" },
	{ value: 6, short: "Sa", label: "Saturday" },
	{ value: 0, short: "Su", label: "Sunday" },
] as const;

const habitColors = [
	"#f59e0b",
	"#f97316",
	"#ef4444",
	"#84cc16",
	"#22c55e",
	"#14b8a6",
	"#0ea5e9",
	"#8b5cf6",
	"#ec4899",
] as const;

const templateCategories: HabitTemplateCategory[] = [
	"All",
	"Product",
	"Engineering",
	"Support",
	"Design",
	"Sales",
	"Marketing",
	"Leadership",
	"Wellness",
	"Learning",
];

const habitTemplates: HabitTemplate[] = [
	{
		id: "lunch-reset",
		name: "Lunch Reset",
		emoji: "🍱",
		category: "Wellness",
		description: "Protect a true midday break so afternoons stay sharp.",
		habitCategory: "health",
		priority: "medium",
		frequency: "daily",
		minDurationMinutes: 30,
		maxDurationMinutes: 60,
		idealTime: "12:30",
		preferredDays: [1, 2, 3, 4, 5],
		color: "#22c55e",
		timeDefenseMode: "always_free",
		recoveryPolicy: "skip",
		visibilityPreference: "default",
	},
	{
		id: "product-spec",
		name: "Spec Writing",
		emoji: "📝",
		category: "Product",
		description: "Block concentrated time for product specs and tradeoffs.",
		habitCategory: "productivity",
		priority: "high",
		frequency: "weekly",
		minDurationMinutes: 45,
		maxDurationMinutes: 120,
		idealTime: "10:00",
		preferredDays: [2, 4],
		color: "#0ea5e9",
		timeDefenseMode: "always_busy",
		recoveryPolicy: "recover",
		visibilityPreference: "default",
	},
	{
		id: "eng-deep-work",
		name: "Engineering Deep Work",
		emoji: "💻",
		category: "Engineering",
		description: "Uninterrupted build window for complex technical work.",
		habitCategory: "productivity",
		priority: "high",
		frequency: "daily",
		minDurationMinutes: 60,
		maxDurationMinutes: 120,
		idealTime: "09:00",
		preferredDays: [1, 2, 3, 4, 5],
		color: "#6366f1",
		timeDefenseMode: "always_busy",
		recoveryPolicy: "recover",
		visibilityPreference: "private",
	},
	{
		id: "support-inbox",
		name: "Support Catch-up",
		emoji: "📨",
		category: "Support",
		description: "Predictable windows for triage and customer follow-ups.",
		habitCategory: "social",
		priority: "medium",
		frequency: "daily",
		minDurationMinutes: 20,
		maxDurationMinutes: 40,
		idealTime: "14:00",
		preferredDays: [1, 2, 3, 4, 5],
		color: "#14b8a6",
		timeDefenseMode: "auto",
		recoveryPolicy: "skip",
		visibilityPreference: "default",
	},
	{
		id: "design-critique",
		name: "Design Critique Prep",
		emoji: "🎨",
		category: "Design",
		description: "Prepare mockups and rationale before critique sessions.",
		habitCategory: "learning",
		priority: "medium",
		frequency: "weekly",
		minDurationMinutes: 45,
		maxDurationMinutes: 90,
		idealTime: "15:00",
		preferredDays: [1, 3],
		color: "#ec4899",
		timeDefenseMode: "auto",
		recoveryPolicy: "recover",
		visibilityPreference: "default",
	},
	{
		id: "sales-followups",
		name: "Pipeline Follow-ups",
		emoji: "📈",
		category: "Sales",
		description: "Daily momentum block for prospect and customer follow-ups.",
		habitCategory: "social",
		priority: "high",
		frequency: "daily",
		minDurationMinutes: 25,
		maxDurationMinutes: 45,
		idealTime: "16:00",
		preferredDays: [1, 2, 3, 4, 5],
		color: "#f97316",
		timeDefenseMode: "always_busy",
		recoveryPolicy: "recover",
		visibilityPreference: "default",
	},
	{
		id: "marketing-content",
		name: "Content Sprint",
		emoji: "📣",
		category: "Marketing",
		description: "Ship campaigns, copy, and creative without context switching.",
		habitCategory: "learning",
		priority: "medium",
		frequency: "weekly",
		minDurationMinutes: 60,
		maxDurationMinutes: 120,
		idealTime: "11:00",
		preferredDays: [2, 4],
		color: "#a855f7",
		timeDefenseMode: "auto",
		recoveryPolicy: "recover",
		visibilityPreference: "default",
	},
	{
		id: "leadership-1on1-notes",
		name: "1:1 Preparation",
		emoji: "🧭",
		category: "Leadership",
		description: "Prepare coaching notes and decision context before meetings.",
		habitCategory: "productivity",
		priority: "high",
		frequency: "weekly",
		minDurationMinutes: 30,
		maxDurationMinutes: 60,
		idealTime: "08:00",
		preferredDays: [1],
		color: "#f59e0b",
		timeDefenseMode: "always_busy",
		recoveryPolicy: "recover",
		visibilityPreference: "default",
	},
	{
		id: "walking-break",
		name: "Take a Walk",
		emoji: "🌿",
		category: "Wellness",
		description: "Recharge with short movement to maintain energy and focus.",
		habitCategory: "health",
		priority: "medium",
		frequency: "daily",
		minDurationMinutes: 15,
		maxDurationMinutes: 30,
		idealTime: "15:30",
		preferredDays: [1, 2, 3, 4, 5],
		color: "#84cc16",
		timeDefenseMode: "always_free",
		recoveryPolicy: "skip",
		visibilityPreference: "default",
	},
	{
		id: "reading-hour",
		name: "Reading Hour",
		emoji: "📚",
		category: "Learning",
		description: "Reserved learning window for books, papers, or industry updates.",
		habitCategory: "learning",
		priority: "medium",
		frequency: "daily",
		minDurationMinutes: 30,
		maxDurationMinutes: 120,
		idealTime: "20:00",
		preferredDays: [1, 2, 3, 4, 5],
		color: "#0ea5e9",
		timeDefenseMode: "auto",
		recoveryPolicy: "skip",
		visibilityPreference: "private",
	},
	{
		id: "monthly-metrics",
		name: "Monthly Metrics Review",
		emoji: "📊",
		category: "Leadership",
		description: "Review KPIs and decide adjustments for the next cycle.",
		habitCategory: "productivity",
		priority: "high",
		frequency: "monthly",
		minDurationMinutes: 60,
		maxDurationMinutes: 120,
		idealTime: "10:00",
		preferredDays: [1],
		color: "#ef4444",
		timeDefenseMode: "always_busy",
		recoveryPolicy: "recover",
		visibilityPreference: "default",
	},
	{
		id: "mindful-reset",
		name: "Mindful Reset",
		emoji: "🧘",
		category: "Wellness",
		description: "Short calm block to reset stress and attention.",
		habitCategory: "mindfulness",
		priority: "medium",
		frequency: "daily",
		minDurationMinutes: 10,
		maxDurationMinutes: 20,
		idealTime: "13:00",
		preferredDays: [1, 2, 3, 4, 5, 6, 0],
		color: "#06b6d4",
		timeDefenseMode: "always_free",
		recoveryPolicy: "skip",
		visibilityPreference: "private",
	},
];

const initialForm: HabitEditorState = {
	title: "",
	description: "",
	priority: "medium",
	category: "productivity",
	frequency: "weekly",
	repeatsPerPeriod: "1",
	minDurationMinutes: "30 mins",
	maxDurationMinutes: "30 mins",
	idealTime: "09:00",
	preferredDays: [1, 2, 3, 4, 5],
	hoursSetId: "",
	preferredCalendarId: "primary",
	color: "#f59e0b",
	location: "",
	startDate: "",
	endDate: "",
	visibilityPreference: "default",
	timeDefenseMode: "auto",
	reminderMode: "default",
	customReminderMinutes: "15",
	unscheduledBehavior: "remove_from_calendar",
	recoveryPolicy: "skip",
	autoDeclineInvites: false,
	ccEmails: "",
	duplicateAvoidKeywords: "",
	dependencyNote: "",
	publicDescription: "",
	isActive: true,
};

const asHabitId = (id: string) => id as Id<"habits">;

const createRequestId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `habit-${Date.now()}-${Math.round(Math.random() * 10_000)}`;
};

const toDateTimeInput = (timestamp?: number) => {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	const hours = `${date.getHours()}`.padStart(2, "0");
	const minutes = `${date.getMinutes()}`.padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toTimestamp = (value: string) => {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

const addMinutesToTime = (time: string, minutesToAdd: number) => {
	const match = time.match(/^(\d{2}):(\d{2})$/);
	if (!match) return undefined;
	const hours = Number.parseInt(match[1] ?? "0", 10);
	const minutes = Number.parseInt(match[2] ?? "0", 10);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
	const total = (((hours * 60 + minutes + minutesToAdd) % 1440) + 1440) % 1440;
	const nextHours = Math.floor(total / 60);
	const nextMinutes = total % 60;
	return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
};

const recurrenceFromFrequency = (frequency: HabitFrequency) => {
	switch (frequency) {
		case "daily":
			return "RRULE:FREQ=DAILY;INTERVAL=1";
		case "weekly":
			return "RRULE:FREQ=WEEKLY;INTERVAL=1";
		case "biweekly":
			return "RRULE:FREQ=WEEKLY;INTERVAL=2";
		case "monthly":
			return "RRULE:FREQ=MONTHLY;INTERVAL=1";
		default:
			return "RRULE:FREQ=WEEKLY;INTERVAL=1";
	}
};

const frequencyFromRecurrenceRule = (rule: string | undefined): HabitFrequency => {
	if (!rule) return "weekly";
	const normalized = rule.trim().replace(/^RRULE:/i, "");
	const fields = new Map<string, string>();
	for (const chunk of normalized.split(";")) {
		const [key, value] = chunk.split("=", 2);
		if (!key || !value) continue;
		fields.set(key.toUpperCase(), value.toUpperCase());
	}
	const freq = fields.get("FREQ");
	const interval = Number.parseInt(fields.get("INTERVAL") ?? "1", 10);
	if (freq === "DAILY") return "daily";
	if (freq === "WEEKLY" && interval >= 2) return "biweekly";
	if (freq === "WEEKLY") return "weekly";
	if (freq === "MONTHLY") return "monthly";
	return "weekly";
};

const parseCsv = (value: string) =>
	value
		.split(",")
		.map((segment) => segment.trim())
		.filter(Boolean);

const formatTimeString = (time: string, hour12: boolean) => {
	if (!hour12) return time;
	const match = time.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return time;
	const hours = Number.parseInt(match[1] ?? "0", 10);
	const minutes = match[2] ?? "00";
	const period = hours >= 12 ? "PM" : "AM";
	const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
	return `${displayHour}:${minutes} ${period}`;
};

const formatWindow = (start?: string, end?: string, hour12 = false) => {
	if (!start && !end) return "Any time";
	if (start && end) return `${formatTimeString(start, hour12)} - ${formatTimeString(end, hour12)}`;
	if (start) return `After ${formatTimeString(start, hour12)}`;
	return end ? `Before ${formatTimeString(end, hour12)}` : "Any time";
};

const formatDays = (days?: number[]) => {
	if (!days?.length) return "Any day";
	const ordered = [...days].sort((a, b) => {
		const left = a === 0 ? 7 : a;
		const right = b === 0 ? 7 : b;
		return left - right;
	});
	return ordered
		.map((day) => dayOptions.find((option) => option.value === day)?.short ?? String(day))
		.join(" ");
};

const formatDate = (value?: number, hour12?: boolean) => {
	if (!value) return "";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12,
	}).format(new Date(value));
};

const formatTemplateCadence = (template: HabitTemplate) => {
	const days = formatDays(template.preferredDays);
	const duration = `${formatDurationFromMinutes(template.minDurationMinutes)} - ${formatDurationFromMinutes(
		template.maxDurationMinutes,
	)}`;
	const frequency = frequencyLabels[template.frequency];
	return `${frequency} • ${days} • ${duration}`;
};

export default function HabitsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [paywallOpen, setPaywallOpen] = useState(false);
	const [createForm, setCreateForm] = useState<HabitEditorState>(initialForm);
	const [editForm, setEditForm] = useState<HabitEditorState | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"all" | "templates">("all");
	const [templateCategory, setTemplateCategory] = useState<HabitTemplateCategory>("All");
	const [templateQuery, setTemplateQuery] = useState("");

	const habitsQuery = useAuthenticatedQueryWithStatus(api.habits.queries.listHabits, {});
	const habits = (habitsQuery.data ?? []) as HabitDTO[];
	const hoursSetsQuery = useAuthenticatedQueryWithStatus(api.hours.queries.listHoursSets, {});
	const hoursSets = (hoursSetsQuery.data ?? []) as HoursSetDTO[];
	const googleCalendarsQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listGoogleCalendars,
		{},
	);
	const googleCalendars = (googleCalendarsQuery.data ?? []) as GoogleCalendarListItem[];

	const editableGoogleCalendars = useMemo(() => {
		const writable = googleCalendars.filter((calendar) => {
			const accessRole = calendar.accessRole;
			return !accessRole || accessRole === "owner" || accessRole === "writer";
		});
		if (writable.length > 0) return writable;
		return [{ id: "primary", name: "Default", primary: true, isExternal: false }];
	}, [googleCalendars]);

	const defaultCalendarId =
		editableGoogleCalendars.find((calendar) => calendar.primary)?.id ?? "primary";
	const defaultHoursSetId = hoursSets.find((hoursSet) => hoursSet.isDefault)?._id ?? "";

	const { execute: createHabit, isPending: isCreatingHabit } = useActionWithStatus(
		api.habits.actions.createHabit,
	);
	const { mutate: updateHabit, isPending: isUpdatingHabit } = useMutationWithStatus(
		api.habits.mutations.updateHabit,
	);
	const { mutate: deleteHabit, isPending: isDeletingHabit } = useMutationWithStatus(
		api.habits.mutations.deleteHabit,
	);
	const { mutate: toggleHabitActive, isPending: isTogglingHabit } = useMutationWithStatus(
		api.habits.mutations.toggleHabitActive,
	);

	const busy = isCreatingHabit || isUpdatingHabit || isDeletingHabit || isTogglingHabit;

	useEffect(() => {
		if (!isCreateOpen) return;
		const patch: Partial<HabitEditorState> = {};
		if (!createForm.hoursSetId && defaultHoursSetId) patch.hoursSetId = defaultHoursSetId;
		if (!createForm.preferredCalendarId) patch.preferredCalendarId = defaultCalendarId;
		if (Object.keys(patch).length > 0) {
			setCreateForm((current) => ({ ...current, ...patch }));
		}
	}, [
		createForm.hoursSetId,
		createForm.preferredCalendarId,
		defaultCalendarId,
		defaultHoursSetId,
		isCreateOpen,
	]);

	useEffect(() => {
		if (!isEditOpen || !editForm) return;
		const patch: Partial<HabitEditorState> = {};
		if (!editForm.hoursSetId && defaultHoursSetId) patch.hoursSetId = defaultHoursSetId;
		if (!editForm.preferredCalendarId) patch.preferredCalendarId = defaultCalendarId;
		if (Object.keys(patch).length > 0) {
			setEditForm((current) => (current ? { ...current, ...patch } : current));
		}
	}, [defaultCalendarId, defaultHoursSetId, editForm, isEditOpen]);

	const { activeHabits, pausedHabits } = useMemo(() => {
		const sorted = [...habits].sort((a, b) => a.title.localeCompare(b.title));
		return {
			activeHabits: sorted.filter((habit) => habit.isActive),
			pausedHabits: sorted.filter((habit) => !habit.isActive),
		};
	}, [habits]);

	const filteredTemplates = useMemo(() => {
		const query = templateQuery.trim().toLowerCase();
		return habitTemplates.filter((template) => {
			if (templateCategory !== "All" && template.category !== templateCategory) return false;
			if (!query) return true;
			return (
				template.name.toLowerCase().includes(query) ||
				template.description.toLowerCase().includes(query) ||
				template.category.toLowerCase().includes(query)
			);
		});
	}, [templateCategory, templateQuery]);

	const hoursSetNameById = useMemo(() => {
		return new Map(hoursSets.map((hoursSet) => [hoursSet._id, hoursSet.name] as const));
	}, [hoursSets]);

	const calendarNameById = useMemo(() => {
		return new Map(
			editableGoogleCalendars.map((calendar) => [calendar.id, calendar.name] as const),
		);
	}, [editableGoogleCalendars]);

	const applyBillingAwareError = (error: unknown) => {
		const payload = getConvexErrorPayload(error);
		if (payload?.code === "FEATURE_LIMIT_REACHED" && payload.featureId === "habits") {
			setPaywallOpen(true);
			setErrorMessage(payload.message ?? "Habit limit reached.");
			return;
		}
		setErrorMessage(payload?.message ?? "Could not save habit.");
	};

	const toPayload = (form: HabitEditorState) => {
		const repeatsPerPeriod = Number.parseInt(form.repeatsPerPeriod, 10);
		const minDurationMinutesParsed = parseDurationToMinutes(form.minDurationMinutes);
		const maxDurationMinutesParsed = parseDurationToMinutes(form.maxDurationMinutes);
		const customReminderMinutes = Number.parseInt(form.customReminderMinutes, 10);
		if (!form.title.trim()) {
			setErrorMessage("Habit title is required.");
			return null;
		}
		if (
			minDurationMinutesParsed === null ||
			maxDurationMinutesParsed === null ||
			minDurationMinutesParsed <= 0 ||
			maxDurationMinutesParsed <= 0 ||
			maxDurationMinutesParsed < minDurationMinutesParsed
		) {
			setErrorMessage("Duration settings are invalid.");
			return null;
		}
		if (!Number.isFinite(repeatsPerPeriod) || repeatsPerPeriod <= 0) {
			setErrorMessage("Repeat value must be greater than 0.");
			return null;
		}
		if (
			form.reminderMode === "custom" &&
			(!Number.isFinite(customReminderMinutes) || customReminderMinutes <= 0)
		) {
			setErrorMessage("Custom reminder minutes must be a positive number.");
			return null;
		}

		const minDurationMinutes = minDurationMinutesParsed;
		const maxDurationMinutes = maxDurationMinutesParsed;
		const preferredWindowStart = form.idealTime || undefined;
		const preferredWindowEnd =
			form.idealTime && maxDurationMinutes
				? addMinutesToTime(form.idealTime, maxDurationMinutes)
				: undefined;

		return {
			title: form.title.trim(),
			description: form.description.trim() || undefined,
			priority: form.priority,
			category: form.category,
			recurrenceRule: recurrenceFromFrequency(form.frequency),
			recoveryPolicy: form.recoveryPolicy,
			frequency: form.frequency,
			durationMinutes: maxDurationMinutes,
			minDurationMinutes,
			maxDurationMinutes,
			repeatsPerPeriod,
			idealTime: form.idealTime || undefined,
			preferredWindowStart,
			preferredWindowEnd,
			preferredDays: form.preferredDays.length > 0 ? form.preferredDays : undefined,
			hoursSetId: form.hoursSetId ? (form.hoursSetId as Id<"hoursSets">) : undefined,
			preferredCalendarId: form.preferredCalendarId || undefined,
			color: form.color,
			location: form.location.trim() || undefined,
			startDate: toTimestamp(form.startDate),
			endDate: toTimestamp(form.endDate),
			visibilityPreference: form.visibilityPreference,
			timeDefenseMode: form.timeDefenseMode,
			reminderMode: form.reminderMode,
			customReminderMinutes: form.reminderMode === "custom" ? customReminderMinutes : undefined,
			unscheduledBehavior: form.unscheduledBehavior,
			autoDeclineInvites: form.autoDeclineInvites,
			ccEmails: parseCsv(form.ccEmails),
			duplicateAvoidKeywords: parseCsv(form.duplicateAvoidKeywords),
			dependencyNote: form.dependencyNote.trim() || undefined,
			publicDescription: form.publicDescription.trim() || undefined,
			isActive: form.isActive,
		};
	};

	const toUpdatePatch = (form: HabitEditorState) => {
		const payload = toPayload(form);
		if (!payload) return null;

		const clearableFields = [
			"description",
			"idealTime",
			"preferredWindowStart",
			"preferredWindowEnd",
			"preferredDays",
			"hoursSetId",
			"preferredCalendarId",
			"location",
			"startDate",
			"endDate",
			"customReminderMinutes",
			"dependencyNote",
			"publicDescription",
		] as const;

		const patch = { ...payload } as Record<string, unknown>;
		for (const field of clearableFields) {
			if (patch[field] !== undefined) continue;
			patch[field] = null;
		}
		return patch;
	};

	const onCreateHabit = async () => {
		const payload = toPayload(createForm);
		if (!payload) return;
		setErrorMessage(null);
		try {
			await createHabit({ requestId: createRequestId(), input: payload });
			setCreateForm({
				...initialForm,
				hoursSetId: defaultHoursSetId,
				preferredCalendarId: defaultCalendarId,
			});
			setIsCreateOpen(false);
		} catch (error) {
			applyBillingAwareError(error);
		}
	};

	const onSaveEdit = async () => {
		if (!editForm?.id) return;
		const payload = toUpdatePatch(editForm);
		if (!payload) return;
		setErrorMessage(null);
		try {
			await updateHabit({ id: asHabitId(editForm.id), patch: payload });
			setEditForm(null);
			setIsEditOpen(false);
		} catch (error) {
			applyBillingAwareError(error);
		}
	};

	const openEdit = (habit: HabitDTO) => {
		setEditForm({
			id: habit._id,
			title: habit.title,
			description: habit.description ?? "",
			priority: habit.priority ?? "medium",
			category: habit.category,
			frequency: habit.frequency ?? frequencyFromRecurrenceRule(habit.recurrenceRule),
			repeatsPerPeriod: String(habit.repeatsPerPeriod ?? 1),
			minDurationMinutes: formatDurationFromMinutes(
				habit.minDurationMinutes ?? habit.durationMinutes,
			),
			maxDurationMinutes: formatDurationFromMinutes(
				habit.maxDurationMinutes ?? habit.durationMinutes,
			),
			idealTime: habit.idealTime ?? habit.preferredWindowStart ?? "",
			preferredDays: habit.preferredDays ?? [],
			hoursSetId: habit.hoursSetId ?? defaultHoursSetId,
			preferredCalendarId: habit.preferredCalendarId ?? defaultCalendarId,
			color: habit.color ?? "#f59e0b",
			location: habit.location ?? "",
			startDate: toDateTimeInput(habit.startDate),
			endDate: toDateTimeInput(habit.endDate),
			visibilityPreference: habit.visibilityPreference ?? "default",
			timeDefenseMode: habit.timeDefenseMode ?? "auto",
			reminderMode: habit.reminderMode ?? "default",
			customReminderMinutes: String(habit.customReminderMinutes ?? 15),
			unscheduledBehavior: habit.unscheduledBehavior ?? "remove_from_calendar",
			recoveryPolicy: habit.recoveryPolicy ?? "skip",
			autoDeclineInvites: habit.autoDeclineInvites ?? false,
			ccEmails: (habit.ccEmails ?? []).join(", "),
			duplicateAvoidKeywords: (habit.duplicateAvoidKeywords ?? []).join(", "),
			dependencyNote: habit.dependencyNote ?? "",
			publicDescription: habit.publicDescription ?? "",
			isActive: habit.isActive,
		});
		setIsEditOpen(true);
	};

	const applyTemplate = (template: HabitTemplate) => {
		setErrorMessage(null);
		setCreateForm({
			...initialForm,
			title: template.name,
			description: template.description,
			priority: template.priority,
			category: template.habitCategory,
			frequency: template.frequency,
			repeatsPerPeriod: "1",
			minDurationMinutes: formatDurationFromMinutes(template.minDurationMinutes),
			maxDurationMinutes: formatDurationFromMinutes(template.maxDurationMinutes),
			idealTime: template.idealTime,
			preferredDays: template.preferredDays,
			hoursSetId: defaultHoursSetId,
			preferredCalendarId: defaultCalendarId,
			color: template.color,
			visibilityPreference: template.visibilityPreference,
			timeDefenseMode: template.timeDefenseMode,
			recoveryPolicy: template.recoveryPolicy,
		});
		setIsCreateOpen(true);
	};

	return (
		<div className="h-full min-h-0 overflow-auto p-4 md:p-6 lg:p-8">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
				<Card className="border-border/60 bg-card/80">
					<CardContent className="space-y-4 p-4 md:p-5">
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div className="inline-flex w-full rounded-xl border border-border/70 bg-background/60 p-1 md:w-auto">
								<button
									type="button"
									onClick={() => setActiveTab("all")}
									className={cn(
										"rounded-lg px-4 py-2 text-sm font-medium transition-colors",
										activeTab === "all"
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									All habits
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("templates")}
									className={cn(
										"rounded-lg px-4 py-2 text-sm font-medium transition-colors",
										activeTab === "templates"
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									Templates
								</button>
							</div>
							<Button
								onClick={() => setIsCreateOpen(true)}
								disabled={busy}
								className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_2px_8px_-2px_rgba(252,163,17,0.2)]"
							>
								<Plus className="size-4" />
								New habit
							</Button>
						</div>
						{activeTab === "templates" ? (
							<div className="space-y-3 border-t border-border/70 pt-4">
								<div className="flex flex-wrap gap-2">
									{templateCategories.map((category) => (
										<button
											key={category}
											type="button"
											onClick={() => setTemplateCategory(category)}
											className={cn(
												"rounded-full border px-3 py-1.5 text-sm transition-colors",
												templateCategory === category
													? "border-primary/60 bg-primary/10 text-primary"
													: "border-border/70 bg-background/50 text-muted-foreground hover:text-foreground",
											)}
										>
											{category}
										</button>
									))}
								</div>
								<div className="relative max-w-sm">
									<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										value={templateQuery}
										onChange={(event) => setTemplateQuery(event.target.value)}
										placeholder="Search templates"
										className="pl-9"
									/>
								</div>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								Configure habits with advanced scheduling controls, then tune details in the editor.
							</p>
						)}
					</CardContent>
				</Card>

				{errorMessage ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
						{errorMessage}
					</div>
				) : null}

				{activeTab === "templates" ? (
					<div className="space-y-5">
						<Card className="overflow-hidden border-border/70 bg-gradient-to-r from-primary/8 via-accent/6 to-primary/4">
							<CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
								<div className="rounded-full border border-primary/30 bg-primary/10 p-3">
									<Sparkles className="size-6 text-primary" />
								</div>
								<div className="space-y-1">
									<p className="text-2xl font-semibold uppercase tracking-[0.04em]">
										Team Habit Templates
									</p>
									<p className="max-w-2xl text-sm text-muted-foreground">
										Start from proven routines, then customize every detail before saving.
									</p>
								</div>
								<Button
									onClick={() => setIsCreateOpen(true)}
									className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_2px_8px_-2px_rgba(252,163,17,0.2)]"
								>
									<Plus className="size-4" />
									Create from scratch
								</Button>
							</CardContent>
						</Card>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<p className="text-lg font-semibold uppercase tracking-[0.04em]">
									Template library
								</p>
								<Badge variant="secondary">{filteredTemplates.length} templates</Badge>
							</div>
							{filteredTemplates.length === 0 ? (
								<Empty className="border-border/70 bg-card/40">
									<EmptyHeader>
										<EmptyTitle>No templates match</EmptyTitle>
										<EmptyDescription>Try another category or search term.</EmptyDescription>
									</EmptyHeader>
								</Empty>
							) : (
								<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
									{filteredTemplates.map((template) => (
										<TemplateCard
											key={template.id}
											template={template}
											onUse={() => applyTemplate(template)}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				) : (
					<>
						<div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
							<MetricTile label="Total" value={habits.length} icon={Sparkles} />
							<MetricTile label="Active" value={activeHabits.length} icon={Flame} />
							<MetricTile label="Paused" value={pausedHabits.length} icon={Waves} />
							<MetricTile
								label="Planned mins"
								value={activeHabits.reduce((sum, habit) => sum + habit.durationMinutes, 0)}
								icon={Timer}
							/>
						</div>

						{habitsQuery.isPending ? (
							<div className="grid gap-4 md:grid-cols-2">
								{["habit-skeleton-left", "habit-skeleton-right"].map((key) => (
									<Card key={key} className="h-72 animate-pulse bg-muted/30" />
								))}
							</div>
						) : habits.length === 0 ? (
							<Empty className="border-border/70 bg-card/40">
								<EmptyHeader>
									<EmptyTitle>No habits configured</EmptyTitle>
									<EmptyDescription>
										Create your first habit with full scheduling controls.
									</EmptyDescription>
								</EmptyHeader>
								<Button onClick={() => setIsCreateOpen(true)} className="gap-1.5">
									<Plus className="size-4" />
									Create habit
								</Button>
							</Empty>
						) : (
							<div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
								<Card className="border-border/70 bg-card/70">
									<CardHeader className="pb-2">
										<CardTitle className="flex items-center justify-between text-base">
											<span>Active routines</span>
											<Badge variant="secondary">{activeHabits.length}</Badge>
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										{activeHabits.length === 0 ? (
											<p className="text-sm text-muted-foreground">No active habits.</p>
										) : (
											activeHabits.map((habit) => (
												<HabitCard
													key={habit._id}
													habit={habit}
													hoursSetName={
														habit.hoursSetId ? hoursSetNameById.get(habit.hoursSetId) : undefined
													}
													calendarName={
														habit.preferredCalendarId
															? calendarNameById.get(habit.preferredCalendarId)
															: undefined
													}
													onEdit={() => openEdit(habit)}
													onDelete={() => deleteHabit({ id: asHabitId(habit._id) })}
													onToggle={(isActive) =>
														toggleHabitActive({ id: asHabitId(habit._id), isActive })
													}
													isBusy={busy}
												/>
											))
										)}
									</CardContent>
								</Card>

								<Card className="border-border/70 bg-card/70">
									<CardHeader className="pb-2">
										<CardTitle className="flex items-center justify-between text-base">
											<span>Paused routines</span>
											<Badge variant="outline">{pausedHabits.length}</Badge>
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										{pausedHabits.length === 0 ? (
											<p className="text-sm text-muted-foreground">No paused habits.</p>
										) : (
											pausedHabits.map((habit) => (
												<div
													key={habit._id}
													className="rounded-lg border border-border/70 bg-background/70 p-3"
												>
													<div className="flex items-start justify-between gap-2">
														<div className="min-w-0">
															<p className="truncate text-sm font-semibold">{habit.title}</p>
															<p className="text-xs text-muted-foreground">
																{
																	frequencyLabels[
																		habit.frequency ??
																			frequencyFromRecurrenceRule(habit.recurrenceRule)
																	]
																}{" "}
																/ {habit.durationMinutes}m
															</p>
														</div>
														<Button
															size="sm"
															variant="outline"
															disabled={busy}
															onClick={() =>
																toggleHabitActive({
																	id: asHabitId(habit._id),
																	isActive: true,
																})
															}
														>
															Resume
														</Button>
													</div>
												</div>
											))
										)}
									</CardContent>
								</Card>
							</div>
						)}
					</>
				)}
			</div>

			<HabitDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				title="Create habit"
				value={createForm}
				onChange={setCreateForm}
				onSubmit={onCreateHabit}
				submitLabel={isCreatingHabit ? "Creating..." : "Create habit"}
				busy={busy}
				hoursSets={hoursSets}
				calendars={editableGoogleCalendars}
			/>

			<HabitDialog
				open={isEditOpen}
				onOpenChange={(open) => {
					setIsEditOpen(open);
					if (!open) setEditForm(null);
				}}
				title="Edit habit"
				value={editForm ?? initialForm}
				onChange={(next) => setEditForm(next)}
				onSubmit={onSaveEdit}
				submitLabel={isUpdatingHabit ? "Saving..." : "Save changes"}
				busy={busy}
				hoursSets={hoursSets}
				calendars={editableGoogleCalendars}
			/>

			<PaywallDialog open={paywallOpen} setOpen={setPaywallOpen} featureId="habits" />
		</div>
	);
}

function MetricTile({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string | number;
	icon: ComponentType<{ className?: string }>;
}) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/50 p-3 transition-colors hover:border-primary/30">
			<div className="flex items-center justify-between text-muted-foreground">
				<span className="text-xs uppercase tracking-[0.08em]">{label}</span>
				<Icon className="size-3.5" />
			</div>
			<div className="mt-1.5 text-xl font-semibold">{value}</div>
		</div>
	);
}

function TemplateCard({
	template,
	onUse,
}: {
	template: HabitTemplate;
	onUse: () => void;
}) {
	return (
		<Card className="group relative overflow-hidden border-border/70 bg-card/60">
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-1"
				style={{ backgroundColor: template.color }}
			/>
			<CardHeader className="space-y-2 pb-1">
				<div className="flex items-start justify-between gap-3">
					<div className="space-y-1">
						<CardDescription className="text-xs uppercase tracking-[0.14em]">
							{template.category}
						</CardDescription>
						<CardTitle className="text-lg">
							<span className="mr-2" role="img" aria-label={`${template.name} icon`}>
								{template.emoji}
							</span>
							{template.name}
						</CardTitle>
					</div>
					<Badge variant="outline">{priorityLabels[template.priority]}</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<p className="line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
				<div className="rounded-md border border-border/70 bg-background/60 px-2.5 py-2 text-xs text-muted-foreground">
					{formatTemplateCadence(template)}
				</div>
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant="secondary">{categoryLabels[template.habitCategory]}</Badge>
						<Badge variant="outline">{defenseModeLabels[template.timeDefenseMode]}</Badge>
					</div>
					<Button
						size="sm"
						onClick={onUse}
						className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
					>
						Use template
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function HabitCard({
	habit,
	hoursSetName,
	calendarName,
	onEdit,
	onDelete,
	onToggle,
	isBusy,
}: {
	habit: HabitDTO;
	hoursSetName?: string;
	calendarName?: string;
	onEdit: () => void;
	onDelete: () => void;
	onToggle: (isActive: boolean) => void;
	isBusy: boolean;
}) {
	const { hour12 } = useUserPreferences();
	return (
		<div className="rounded-lg border border-border/70 bg-background/70 p-3 shadow-sm">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="truncate text-sm font-semibold inline-flex items-center gap-2">
						<span
							className="size-2.5 rounded-full border border-border/70"
							style={{ backgroundColor: habit.color ?? "#f59e0b" }}
						/>
						{habit.title}
					</p>
					<p className="line-clamp-2 text-xs text-muted-foreground">
						{habit.description || "No description"}
					</p>
				</div>
				<Switch checked={habit.isActive} disabled={isBusy} onCheckedChange={onToggle} />
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
				<Badge variant="outline">{categoryLabels[habit.category]}</Badge>
				<Badge className={priorityClass[habit.priority ?? "medium"]}>
					{priorityLabels[habit.priority ?? "medium"]}
				</Badge>
				<Badge variant="secondary">{habit.durationMinutes}m</Badge>
				{hoursSetName ? <Badge variant="outline">{hoursSetName}</Badge> : null}
				{calendarName ? <Badge variant="outline">{calendarName}</Badge> : null}
			</div>
			<div className="mt-2 text-xs text-muted-foreground">
				{habit.idealTime
					? `Ideal time ${formatTimeString(habit.idealTime, hour12)}`
					: formatWindow(habit.preferredWindowStart, habit.preferredWindowEnd, hour12)}{" "}
				| {formatDays(habit.preferredDays)}
				{habit.startDate ? ` | Starts ${formatDate(habit.startDate, hour12)}` : ""}
				{habit.endDate ? ` | Ends ${formatDate(habit.endDate, hour12)}` : ""}
			</div>
			<div className="mt-2 flex items-center justify-end gap-1">
				<Button
					size="sm"
					variant="ghost"
					disabled={isBusy}
					onClick={onEdit}
					className="h-7 px-2 text-xs"
				>
					Edit
				</Button>
				<Button
					size="sm"
					variant="ghost"
					disabled={isBusy}
					onClick={onDelete}
					className="h-7 px-2 text-xs text-rose-600 hover:text-rose-600"
				>
					Delete
				</Button>
			</div>
		</div>
	);
}

function HabitDialog({
	open,
	onOpenChange,
	title,
	value,
	onChange,
	onSubmit,
	submitLabel,
	busy,
	hoursSets,
	calendars,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	value: HabitEditorState;
	onChange: (value: HabitEditorState) => void;
	onSubmit: () => void;
	submitLabel: string;
	busy: boolean;
	hoursSets: HoursSetDTO[];
	calendars: GoogleCalendarListItem[];
}) {
	const selectedHoursSet = hoursSets.find((hoursSet) => hoursSet._id === value.hoursSetId);

	const toggleDay = (day: number) => {
		const set = new Set(value.preferredDays);
		if (set.has(day)) {
			set.delete(day);
		} else {
			set.add(day);
		}
		onChange({ ...value, preferredDays: Array.from(set) });
	};

	const stepDuration = (field: "minDurationMinutes" | "maxDurationMinutes", delta: number) => {
		const current = parseDurationToMinutes(value[field]);
		const base = current ?? 30;
		const next = Math.max(15, base + delta);
		onChange({ ...value, [field]: formatDurationFromMinutes(next) });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-lg">
						<Repeat2 className="size-4 text-primary" />
						{title}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<Accordion type="multiple" defaultValue={["details", "scheduling", "options"]}>
						<AccordionItem value="details" className="rounded-xl border border-border/70 px-4">
							<AccordionTrigger className="py-4">
								<div className="text-left">
									<p className="text-2xl font-semibold tracking-tight">Habit details</p>
									<p className="text-base font-normal text-muted-foreground">
										Name, priority, and general settings
									</p>
								</div>
							</AccordionTrigger>
							<AccordionContent className="space-y-6 pb-4">
								<div className="space-y-2">
									<Label>Habit name</Label>
									<div className="flex items-center gap-2 rounded-lg border border-primary/60 px-3 py-2">
										<span className="text-2xl">🙂</span>
										<Input
											value={value.title}
											onChange={(event) => onChange({ ...value, title: event.target.value })}
											placeholder="Enter a Habit name..."
											className="border-0 px-0 text-lg shadow-none focus-visible:ring-0"
										/>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label>Priority</Label>
										<Select
											value={value.priority}
											onValueChange={(priority) =>
												onChange({ ...value, priority: priority as HabitPriority })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(priorityLabels).map(([priority, label]) => (
													<SelectItem key={priority} value={priority}>
														{label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Calendar to schedule events on</Label>
										<Select
											value={value.preferredCalendarId || undefined}
											onValueChange={(preferredCalendarId) =>
												onChange({ ...value, preferredCalendarId })
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select calendar" />
											</SelectTrigger>
											<SelectContent>
												{calendars.map((calendar) => (
													<SelectItem key={calendar.id} value={calendar.id}>
														{calendar.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-[180px_1fr]">
									<div className="space-y-2">
										<Label>Color</Label>
										<div className="flex flex-wrap gap-2 rounded-lg border border-border p-2">
											{habitColors.map((color) => (
												<button
													key={color}
													type="button"
													aria-label={`Select ${color}`}
													className={cn(
														"size-6 rounded-full border transition-transform hover:scale-105",
														value.color === color
															? "border-foreground ring-2 ring-foreground/20"
															: "border-border",
													)}
													style={{ backgroundColor: color }}
													onClick={() => onChange({ ...value, color })}
												/>
											))}
										</div>
									</div>
									<div className="space-y-2">
										<Label>Category</Label>
										<Select
											value={value.category}
											onValueChange={(category) =>
												onChange({ ...value, category: category as HabitCategory })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(categoryLabels).map(([category, label]) => (
													<SelectItem key={category} value={category}>
														{label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Notes</Label>
									<Textarea
										value={value.description}
										onChange={(event) => onChange({ ...value, description: event.target.value })}
										placeholder="Add notes..."
										className="min-h-24"
									/>
								</div>

								<div className="space-y-2">
									<Label>Location</Label>
									<Input
										value={value.location}
										onChange={(event) => onChange({ ...value, location: event.target.value })}
										placeholder="Add location"
									/>
								</div>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem
							value="scheduling"
							className="mt-4 rounded-xl border border-border/70 px-4"
						>
							<AccordionTrigger className="py-4">
								<div className="text-left">
									<p className="text-2xl font-semibold tracking-tight">Scheduling</p>
									<p className="text-base font-normal text-muted-foreground">
										Hours, duration, and scheduling preferences
									</p>
								</div>
							</AccordionTrigger>
							<AccordionContent className="space-y-6 pb-4">
								<div className="grid gap-4 md:grid-cols-[minmax(260px,1fr)_auto] md:items-end">
									<div className="space-y-2">
										<Label>Hours</Label>
										<Select
											value={value.hoursSetId || undefined}
											onValueChange={(hoursSetId) => onChange({ ...value, hoursSetId })}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select hours set" />
											</SelectTrigger>
											<SelectContent>
												{hoursSets.map((hoursSet) => (
													<SelectItem key={hoursSet._id} value={hoursSet._id}>
														{hoursSet.name}
														{hoursSet.isDefault ? " (Default)" : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<Button variant="link" className="justify-start px-0" asChild>
										<a href="/app/settings/hours">Edit your Working Hours</a>
									</Button>
								</div>

								<div className="space-y-3">
									<p className="text-sm font-semibold">
										Eligible days based on the Hours selected above
									</p>
									<EligibleHoursGrid hoursSet={selectedHoursSet} />
								</div>

								<div className="grid gap-4 md:grid-cols-[1fr_140px_auto] md:items-end">
									<div className="space-y-2">
										<Label>Repeat</Label>
										<Select
											value={value.frequency}
											onValueChange={(frequency) =>
												onChange({ ...value, frequency: frequency as HabitFrequency })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(frequencyLabels).map(([frequency, label]) => (
													<SelectItem key={frequency} value={frequency}>
														{label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Count</Label>
										<Input
											type="number"
											min={1}
											step={1}
											value={value.repeatsPerPeriod}
											onChange={(event) =>
												onChange({ ...value, repeatsPerPeriod: event.target.value })
											}
										/>
									</div>
									<p className="pb-2 text-sm text-muted-foreground">
										time{value.repeatsPerPeriod === "1" ? "" : "s"} a{" "}
										{value.frequency === "daily" ? "day" : "week"}
									</p>
								</div>

								<div className="space-y-2">
									<Label>Ideal days</Label>
									<div className="flex flex-wrap gap-1.5">
										{dayOptions.map((day) => {
											const selected = value.preferredDays.includes(day.value);
											return (
												<Button
													key={day.value}
													type="button"
													size="sm"
													variant={selected ? "default" : "outline"}
													className="h-9 min-w-9 rounded-full px-3"
													onClick={() => toggleDay(day.value)}
												>
													{day.short}
												</Button>
											);
										})}
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-3">
									<div className="space-y-2">
										<Label>Ideal time</Label>
										<Input
											type="time"
											value={value.idealTime}
											onChange={(event) => onChange({ ...value, idealTime: event.target.value })}
										/>
									</div>
									<div className="space-y-2">
										<Label>Minimum duration</Label>
										<div className="flex items-center gap-2">
											<DurationInput
												value={value.minDurationMinutes}
												onChange={(minDurationMinutes) =>
													onChange({ ...value, minDurationMinutes })
												}
												placeholder="e.g. 30 mins"
												className="min-w-0"
											/>
											<Button
												type="button"
												size="icon"
												variant="outline"
												onClick={() => stepDuration("minDurationMinutes", -15)}
											>
												-
											</Button>
											<Button
												type="button"
												size="icon"
												variant="outline"
												onClick={() => stepDuration("minDurationMinutes", 15)}
											>
												+
											</Button>
										</div>
									</div>
									<div className="space-y-2">
										<Label>Maximum duration</Label>
										<div className="flex items-center gap-2">
											<DurationInput
												value={value.maxDurationMinutes}
												onChange={(maxDurationMinutes) =>
													onChange({ ...value, maxDurationMinutes })
												}
												placeholder="e.g. 2 hrs"
												className="min-w-0"
											/>
											<Button
												type="button"
												size="icon"
												variant="outline"
												onClick={() => stepDuration("maxDurationMinutes", -15)}
											>
												-
											</Button>
											<Button
												type="button"
												size="icon"
												variant="outline"
												onClick={() => stepDuration("maxDurationMinutes", 15)}
											>
												+
											</Button>
										</div>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label>Start date</Label>
										<DateTimePicker
											value={value.startDate}
											onChange={(startDate) => onChange({ ...value, startDate })}
											placeholder="Anytime"
											minuteStep={15}
										/>
									</div>
									<div className="space-y-2">
										<Label>End date</Label>
										<DateTimePicker
											value={value.endDate}
											onChange={(endDate) => onChange({ ...value, endDate })}
											placeholder="Anytime"
											minuteStep={15}
										/>
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="options" className="mt-4 rounded-xl border border-border/70 px-4">
							<AccordionTrigger className="py-4">
								<div className="text-left">
									<p className="text-2xl font-semibold tracking-tight">Other options</p>
									<p className="text-base font-normal text-muted-foreground">
										Reminders, visibility, time defense, and delivery rules
									</p>
								</div>
							</AccordionTrigger>
							<AccordionContent className="space-y-6 pb-4">
								<div className="space-y-2">
									<Label>Reminders</Label>
									<RadioGroup
										value={value.reminderMode}
										onValueChange={(reminderMode) =>
											onChange({ ...value, reminderMode: reminderMode as HabitReminderMode })
										}
										className="rounded-lg border border-border/70"
									>
										{Object.entries(reminderModeLabels).map(([mode, label]) => (
											<div
												key={mode}
												className={cn(
													"flex cursor-pointer items-center gap-3 border-b border-border/70 px-3 py-3 last:border-b-0",
													value.reminderMode === mode && "bg-muted/50",
												)}
											>
												<RadioGroupItem value={mode} id={`habit-reminder-${mode}`} />
												<Label htmlFor={`habit-reminder-${mode}`} className="cursor-pointer">
													{label}
												</Label>
											</div>
										))}
									</RadioGroup>
									{value.reminderMode === "custom" ? (
										<div className="pt-2">
											<Label>Custom reminder minutes</Label>
											<Input
												type="number"
												min={1}
												step={1}
												value={value.customReminderMinutes}
												onChange={(event) =>
													onChange({ ...value, customReminderMinutes: event.target.value })
												}
											/>
										</div>
									) : null}
								</div>

								<div className="space-y-2">
									<Label>If your Habit can&apos;t be scheduled</Label>
									<RadioGroup
										value={value.unscheduledBehavior}
										onValueChange={(unscheduledBehavior) =>
											onChange({
												...value,
												unscheduledBehavior: unscheduledBehavior as HabitUnscheduledBehavior,
											})
										}
										className="rounded-lg border border-border/70"
									>
										{Object.entries(unscheduledLabels).map(([mode, label]) => (
											<div
												key={mode}
												className={cn(
													"flex cursor-pointer items-center gap-3 border-b border-border/70 px-3 py-3 last:border-b-0",
													value.unscheduledBehavior === mode && "bg-muted/50",
												)}
											>
												<RadioGroupItem value={mode} id={`habit-unscheduled-${mode}`} />
												<Label htmlFor={`habit-unscheduled-${mode}`} className="cursor-pointer">
													{label}
												</Label>
											</div>
										))}
									</RadioGroup>
								</div>

								<div className="space-y-2">
									<Label>Recovery policy</Label>
									<p className="text-sm text-muted-foreground">
										Control whether missed occurrences should be recovered in later slots.
									</p>
									<RadioGroup
										value={value.recoveryPolicy}
										onValueChange={(recoveryPolicy) =>
											onChange({
												...value,
												recoveryPolicy: recoveryPolicy as HabitRecoveryPolicy,
											})
										}
										className="rounded-lg border border-border/70"
									>
										{Object.entries(recoveryLabels).map(([mode, label]) => (
											<div
												key={mode}
												className={cn(
													"flex cursor-pointer items-center gap-3 border-b border-border/70 px-3 py-3 last:border-b-0",
													value.recoveryPolicy === mode && "bg-muted/50",
												)}
											>
												<RadioGroupItem value={mode} id={`habit-recovery-${mode}`} />
												<Label htmlFor={`habit-recovery-${mode}`} className="cursor-pointer">
													{label}
												</Label>
											</div>
										))}
									</RadioGroup>
								</div>

								<div className="space-y-2">
									<Label>Visibility</Label>
									<p className="text-sm text-muted-foreground">
										How others see this event on your calendar.
									</p>
									<RadioGroup
										value={value.visibilityPreference}
										onValueChange={(visibilityPreference) =>
											onChange({
												...value,
												visibilityPreference: visibilityPreference as HabitVisibilityPreference,
											})
										}
										className="rounded-lg border border-border/70"
									>
										{Object.entries(visibilityLabels).map(([mode, label]) => (
											<div
												key={mode}
												className={cn(
													"flex cursor-pointer items-center gap-3 border-b border-border/70 px-3 py-3 last:border-b-0",
													value.visibilityPreference === mode && "bg-muted/50",
												)}
											>
												<RadioGroupItem value={mode} id={`habit-visibility-${mode}`} />
												<div className="space-y-1">
													<Label
														htmlFor={`habit-visibility-${mode}`}
														className="cursor-pointer font-normal"
													>
														{label}
													</Label>
													{mode === "public" ? (
														<Textarea
															value={value.publicDescription}
															onChange={(event) =>
																onChange({ ...value, publicDescription: event.target.value })
															}
															placeholder="Optional public description for defended events"
															className="mt-1 min-h-16"
														/>
													) : null}
												</div>
											</div>
										))}
									</RadioGroup>
								</div>

								<div className="space-y-2">
									<Label>Time defense</Label>
									<p className="text-sm text-muted-foreground">
										How aggressively Auto Cron should defend this event on your calendar.
									</p>
									<RadioGroup
										value={value.timeDefenseMode}
										onValueChange={(timeDefenseMode) =>
											onChange({
												...value,
												timeDefenseMode: timeDefenseMode as HabitTimeDefenseMode,
											})
										}
										className="rounded-lg border border-border/70"
									>
										{Object.entries(defenseModeLabels).map(([mode, label]) => (
											<div
												key={mode}
												className={cn(
													"flex cursor-pointer items-center gap-3 border-b border-border/70 px-3 py-3 last:border-b-0",
													value.timeDefenseMode === mode && "bg-muted/50",
												)}
											>
												<RadioGroupItem value={mode} id={`habit-defense-${mode}`} />
												<Label htmlFor={`habit-defense-${mode}`} className="cursor-pointer">
													{label}
												</Label>
											</div>
										))}
									</RadioGroup>
								</div>

								<div className="rounded-lg border border-border/70 p-3">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="auto-decline"
											checked={value.autoDeclineInvites}
											onCheckedChange={(checked) =>
												onChange({ ...value, autoDeclineInvites: checked === true })
											}
										/>
										<Label htmlFor="auto-decline">Auto-decline invites</Label>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-3">
									<div className="space-y-2">
										<Label>CC others</Label>
										<Input
											value={value.ccEmails}
											onChange={(event) => onChange({ ...value, ccEmails: event.target.value })}
											placeholder="a@x.com, b@y.com"
										/>
									</div>
									<div className="space-y-2">
										<Label>Avoid duplicate keywords</Label>
										<Input
											value={value.duplicateAvoidKeywords}
											onChange={(event) =>
												onChange({ ...value, duplicateAvoidKeywords: event.target.value })
											}
											placeholder="meeting, class"
										/>
									</div>
									<div className="space-y-2">
										<Label>Dependency note</Label>
										<Input
											value={value.dependencyNote}
											onChange={(event) =>
												onChange({ ...value, dependencyNote: event.target.value })
											}
											placeholder="Depends on..."
										/>
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>

					<div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
						<div className="text-sm">
							<div className="font-medium">Active</div>
							<div className="text-xs text-muted-foreground">Enable this habit for scheduling</div>
						</div>
						<Switch
							checked={value.isActive}
							onCheckedChange={(isActive) => onChange({ ...value, isActive })}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
						Cancel
					</Button>
					<Button onClick={onSubmit} disabled={busy}>
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function EligibleHoursGrid({ hoursSet }: { hoursSet?: HoursSetDTO }) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/40 p-3">
			<div className="space-y-1.5">
				{dayOptions.map((day) => (
					<div key={day.value} className="grid grid-cols-[40px_1fr] items-center gap-2">
						<div className="text-sm text-muted-foreground">{day.short}</div>
						<div className="grid grid-cols-24 gap-1">
							{Array.from({ length: 24 }).map((_, hour) => {
								const cellStart = hour * 60;
								const cellEnd = cellStart + 60;
								const active =
									hoursSet?.windows.some(
										(window) =>
											window.day === day.value &&
											cellStart < window.endMinute &&
											cellEnd > window.startMinute,
									) ?? false;
								return (
									<div
										key={`${day.value}-${hour}`}
										className={cn(
											"h-4 rounded-[4px] border border-border/30",
											active ? "bg-emerald-400/60" : "bg-muted/40",
										)}
									/>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
