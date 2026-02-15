"use client";

import { useAsideContent } from "@/components/aside-panel";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import { HabitActionsMenu } from "@/components/entity-actions";
import { HabitDialog } from "@/components/habits/habit-dialog";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/components/user-preferences-context";
import {
	useActionWithStatus,
	useAuthenticatedQueryWithStatus,
	useMutationWithStatus,
} from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration";
import {
	type HabitEditorState,
	type HabitRecoveryPolicy,
	type HabitTimeDefenseMode,
	type HabitVisibilityPreference,
	addMinutesToTime,
	createRequestId,
	defenseModeLabels,
	frequencyLabels,
	initialHabitForm,
	parseCsv,
	priorityLabels,
	toDateTimeInput,
	toTimestamp,
} from "@/lib/habit-editor";
import type { GoogleCalendarListItem } from "@/lib/habit-editor";
import {
	DAY_OPTIONS,
	recurrenceStateToLegacyFrequency,
	recurrenceStateToRRule,
	rruleToRecurrenceState,
} from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import type { HabitDTO, HabitFrequency, HabitPriority, HoursSetDTO } from "@auto-cron/types";
import { Clock3, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

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
	habitCategory: string;
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

const dayOptions = DAY_OPTIONS;

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

const asHabitId = (id: string) => id as Id<"habits">;

const frequencyFromRecurrenceRule = (rule: string | undefined): HabitFrequency => {
	return recurrenceStateToLegacyFrequency(rruleToRecurrenceState(rule));
};

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

const formatTemplateCadence = (template: HabitTemplate) => {
	const days = formatDays(template.preferredDays);
	const duration = `${formatDurationFromMinutes(template.minDurationMinutes)} - ${formatDurationFromMinutes(
		template.maxDurationMinutes,
	)}`;
	const frequency = frequencyLabels[template.frequency];
	return `${frequency} • ${days} • ${duration}`;
};

export default function HabitsPage() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [paywallOpen, setPaywallOpen] = useState(false);
	const [createForm, setCreateForm] = useState<HabitEditorState>(initialHabitForm);
	const [editForm, setEditForm] = useState<HabitEditorState | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"all" | "templates">("all");
	const [templateCategory, setTemplateCategory] = useState<HabitTemplateCategory>("All");
	const [templateQuery, setTemplateQuery] = useState("");
	const { openHabit } = useAsideContent();

	const categoriesQuery = useAuthenticatedQueryWithStatus(api.categories.queries.getCategories, {});
	const categories = categoriesQuery.data ?? [];

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
		const calendarExists = editableGoogleCalendars.some(
			(c) => c.id === createForm.preferredCalendarId,
		);
		if (!calendarExists && defaultCalendarId) patch.preferredCalendarId = defaultCalendarId;
		if (Object.keys(patch).length > 0) {
			setCreateForm((current) => ({ ...current, ...patch }));
		}
	}, [
		createForm.hoursSetId,
		createForm.preferredCalendarId,
		defaultCalendarId,
		defaultHoursSetId,
		editableGoogleCalendars,
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

	const editHabitIdFromQuery = searchParams.get("editHabitId");

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
		const boundedEndDate =
			form.recurrenceState.endCondition === "on_date" ? toTimestamp(form.endDate) : undefined;

		return {
			title: form.title.trim(),
			description: form.description.trim() || undefined,
			priority: form.priority,
			categoryId: form.categoryId as Id<"taskCategories">,
			recurrenceRule: recurrenceStateToRRule(form.recurrenceState),
			recoveryPolicy: form.recoveryPolicy,
			frequency: recurrenceStateToLegacyFrequency(form.recurrenceState),
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
			endDate: boundedEndDate,
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
				...initialHabitForm,
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

	const openEdit = useCallback(
		(habit: HabitDTO) => {
			openHabit(habit._id, "edit");
		},
		[openHabit],
	);

	useEffect(() => {
		if (!editHabitIdFromQuery) return;
		const habitToEdit = habits.find((habit) => habit._id === editHabitIdFromQuery);
		if (!habitToEdit) return;
		openEdit(habitToEdit);

		const nextParams = new URLSearchParams(searchParams.toString());
		nextParams.delete("editHabitId");
		const nextQuery = nextParams.toString();
		router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
	}, [editHabitIdFromQuery, habits, openEdit, searchParams, router, pathname]);

	const applyTemplate = (template: HabitTemplate) => {
		setErrorMessage(null);
		const templateRecurrence = rruleToRecurrenceState(undefined, template.frequency);
		if (template.preferredDays.length > 0 && templateRecurrence.unit === "week") {
			templateRecurrence.byDay = template.preferredDays;
		}
		setCreateForm({
			...initialHabitForm,
			title: template.name,
			description: template.description,
			priority: template.priority,
			categoryId: "",
			frequency: template.frequency,
			recurrenceState: templateRecurrence,
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
		// Open on next frame so dialog renders with the freshly applied template state.
		requestAnimationFrame(() => setIsCreateOpen(true));
	};

	return (
		<div className="h-full min-h-0 overflow-auto p-4 md:p-6 lg:p-8">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
				<div className="flex items-start justify-between gap-4">
					<SettingsSectionHeader
						sectionNumber="02"
						sectionLabel="Routines"
						title="Habits"
						description="Configure recurring routines with scheduling controls, then let the engine place them."
					/>
					<Button
						onClick={() => setIsCreateOpen(true)}
						disabled={busy}
						className="mt-6 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_2px_8px_-2px_rgba(252,163,17,0.2)]"
					>
						<Plus className="size-4" />
						New habit
					</Button>
				</div>

				<div className="flex items-center gap-6 border-b border-border/60">
					<button
						type="button"
						className={cn(
							"pb-2.5 text-sm font-medium transition-colors",
							activeTab === "all"
								? "border-b-2 border-accent text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setActiveTab("all")}
					>
						All habits
					</button>
					<button
						type="button"
						className={cn(
							"pb-2.5 text-sm font-medium transition-colors",
							activeTab === "templates"
								? "border-b-2 border-accent text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setActiveTab("templates")}
					>
						Templates
					</button>
				</div>

				{activeTab === "templates" ? (
					<div className="space-y-3">
						<div className="flex flex-wrap gap-2">
							{templateCategories.map((category) => (
								<button
									key={category}
									type="button"
									onClick={() => setTemplateCategory(category)}
									className={cn(
										"rounded-full px-3 py-1.5 font-[family-name:var(--font-cutive)] text-[11px] uppercase tracking-[0.1em] transition-colors",
										templateCategory === category
											? "bg-accent/20 text-foreground ring-1 ring-accent/40"
											: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
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
				) : null}

				{errorMessage ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
						{errorMessage}
					</div>
				) : null}

				{activeTab === "templates" ? (
					<div className="space-y-5">
						<div className="rounded-xl border border-border/60 px-8 py-12 text-center">
							<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
								Template Library
							</p>
							<h2 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
								Start from proven routines
							</h2>
							<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
								Pick a template, customize every detail, then save.
							</p>
							<Button
								className="mt-5 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
								onClick={() => setIsCreateOpen(true)}
							>
								<Plus className="size-4" /> Create from scratch
							</Button>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
									{filteredTemplates.length} templates
								</p>
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
							<MetricTile label="Total" value={habits.length} />
							<MetricTile label="Active" value={activeHabits.length} />
							<MetricTile label="Paused" value={pausedHabits.length} />
							<MetricTile
								label="Planned mins"
								value={activeHabits.reduce((sum, habit) => sum + habit.durationMinutes, 0)}
							/>
						</div>

						{habitsQuery.isPending ? (
							<div className="grid gap-4 md:grid-cols-2">
								{["habit-skeleton-left", "habit-skeleton-right"].map((key) => (
									<div key={key} className="h-72 animate-pulse rounded-xl bg-muted/30" />
								))}
							</div>
						) : habits.length === 0 ? (
							<Empty className="border-border/60 bg-card/40">
								<EmptyHeader>
									<EmptyTitle className="font-[family-name:var(--font-outfit)]">
										No habits configured
									</EmptyTitle>
									<EmptyDescription>
										Create your first habit with full scheduling controls.
									</EmptyDescription>
								</EmptyHeader>
								<Button
									onClick={() => setIsCreateOpen(true)}
									className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
								>
									<Plus className="size-4" />
									Create habit
								</Button>
							</Empty>
						) : (
							<div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
								{/* Active routines column */}
								<div>
									<div className="mb-4">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
											02 / Active Routines
										</p>
										<div className="mt-2 flex items-center justify-between">
											<h2 className="text-lg font-semibold">Active routines</h2>
											<span className="text-xs tabular-nums text-muted-foreground">
												{activeHabits.length}
											</span>
										</div>
										<div className="mt-2 h-px bg-border/60" />
									</div>
									<div className="space-y-2">
										{activeHabits.length === 0 ? (
											<p className="text-sm text-muted-foreground">No active habits.</p>
										) : (
											activeHabits.map((habit) => (
												<HabitCard
													key={habit._id}
													habit={habit}
													categories={categories}
													onViewEvents={() => openHabit(habit._id, "details")}
													onEdit={() => openEdit(habit)}
													onDelete={() => deleteHabit({ id: asHabitId(habit._id) })}
													onToggle={(isActive) =>
														toggleHabitActive({ id: asHabitId(habit._id), isActive })
													}
													onChangePriority={(priority) =>
														updateHabit({
															id: asHabitId(habit._id),
															patch: { priority },
														})
													}
													isBusy={busy}
												/>
											))
										)}
									</div>
								</div>

								{/* Paused routines column */}
								<div>
									<div className="mb-4">
										<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
											03 / Paused
										</p>
										<div className="mt-2 flex items-center justify-between">
											<h2 className="text-lg font-semibold">Paused routines</h2>
											<span className="text-xs tabular-nums text-muted-foreground">
												{pausedHabits.length}
											</span>
										</div>
										<div className="mt-2 h-px bg-border/60" />
									</div>
									<div className="space-y-2">
										{pausedHabits.length === 0 ? (
											<p className="text-sm text-muted-foreground">No paused habits.</p>
										) : (
											pausedHabits.map((habit) => (
												<div
													key={habit._id}
													className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 px-4 py-3 opacity-70"
												>
													<div className="min-w-0">
														<p className="truncate text-sm font-medium">{habit.title}</p>
														<p className="text-[11px] text-muted-foreground">
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
											))
										)}
									</div>
								</div>
							</div>
						)}
					</>
				)}
			</div>

			<HabitDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				title="New habit"
				compactCreate
				value={createForm}
				onChange={setCreateForm}
				onSubmit={onCreateHabit}
				submitLabel={isCreatingHabit ? "Creating..." : "Create habit"}
				busy={isCreatingHabit}
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
				value={editForm ?? initialHabitForm}
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

function MetricTile({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-xl border border-border/60 p-4">
			<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-2 font-[family-name:var(--font-outfit)] text-3xl font-bold tabular-nums">
				{value}
			</p>
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
		<button
			type="button"
			onClick={onUse}
			className="group relative w-full overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 text-left cursor-pointer"
		>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-1"
				style={{ backgroundColor: template.color }}
			/>
			<div className="space-y-2 pt-1">
				<div className="flex items-start justify-between gap-3">
					<div className="space-y-1">
						<p className="font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
							{template.category}
						</p>
						<p className="text-base font-semibold">
							<span className="mr-1.5" role="img" aria-label={`${template.name} icon`}>
								{template.emoji}
							</span>
							{template.name}
						</p>
					</div>
					<Badge variant="outline" className="text-[11px]">
						{priorityLabels[template.priority]}
					</Badge>
				</div>
			</div>
			<div className="mt-3 space-y-3">
				<p className="line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
				<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
					{formatTemplateCadence(template)}
				</p>
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant="secondary" className="text-[11px]">
							{template.habitCategory.charAt(0).toUpperCase() + template.habitCategory.slice(1)}
						</Badge>
						<Badge variant="outline" className="text-[11px]">
							{defenseModeLabels[template.timeDefenseMode]}
						</Badge>
					</div>
					<span className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground shadow-sm">
						Use template
					</span>
				</div>
			</div>
		</button>
	);
}

function HabitCard({
	habit,
	categories,
	onViewEvents,
	onEdit,
	onDelete,
	onToggle,
	onChangePriority,
	isBusy,
}: {
	habit: HabitDTO;
	categories: { _id: string; name: string }[];
	onViewEvents: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onToggle: (isActive: boolean) => void;
	onChangePriority: (priority: HabitPriority) => void;
	isBusy: boolean;
}) {
	const { hour12 } = useUserPreferences();
	const categoryName =
		categories.find((c: { _id: string; name: string }) => c._id === habit.categoryId)?.name ??
		"Uncategorized";
	const freq =
		frequencyLabels[habit.frequency ?? frequencyFromRecurrenceRule(habit.recurrenceRule)];

	return (
		<div
			className="group cursor-pointer rounded-xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-border hover:bg-card/95"
			style={{
				borderLeftWidth: 3,
				borderLeftColor: habit.effectiveColor ?? habit.color ?? "#f59e0b",
			}}
			onClick={onViewEvents}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onViewEvents();
			}}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">{habit.title}</p>
					{habit.description && (
						<p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{habit.description}</p>
					)}
				</div>
				<div className="flex items-center gap-1">
					<div
						onClick={(event) => event.stopPropagation()}
						onKeyDown={(event) => event.stopPropagation()}
					>
						<Switch checked={habit.isActive} disabled={isBusy} onCheckedChange={onToggle} />
					</div>
					<HabitActionsMenu
						priority={habit.priority ?? "medium"}
						isActive={habit.isActive}
						disabled={isBusy}
						onOpenDetails={onViewEvents}
						onEdit={onEdit}
						onDelete={onDelete}
						onOpenInCalendar={() => {
							window.location.assign("/app/calendar");
						}}
						onToggleActive={onToggle}
						onChangePriority={onChangePriority}
					/>
				</div>
			</div>

			<div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
				<Badge variant="outline" className="text-[11px]">
					{categoryName}
				</Badge>
				<span>{freq}</span>
				<span>{habit.durationMinutes}m</span>
				{habit.idealTime && <span>at {formatTimeString(habit.idealTime, hour12)}</span>}
			</div>

			{habit.preferredDays && habit.preferredDays.length > 0 && (
				<div className="mt-2 font-[family-name:var(--font-cutive)] text-[9px] uppercase tracking-[0.12em] text-muted-foreground/80">
					{formatDays(habit.preferredDays)}
				</div>
			)}

			<div className="mt-3 border-t border-border/30 pt-2.5">
				<Badge variant="outline" className="text-[11px]">
					{habit.priority ?? "medium"}
				</Badge>
			</div>
		</div>
	);
}
