import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { withQueryAuth } from "../auth";
import { normalizeSchedulingDowntimeMinutes } from "../hours/shared";
import { recurrenceFromLegacyFrequency } from "./rrule";
import { isRunNewer } from "./run_order";

const schedulingModeValidator = v.union(
	v.literal("fastest"),
	v.literal("balanced"),
	v.literal("packed"),
);

const taskPriorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
	v.literal("blocker"),
);
const habitPriorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("critical"),
);

const recoveryPolicyValidator = v.union(v.literal("skip"), v.literal("recover"));

const runSummaryValidator = v.union(
	v.null(),
	v.object({
		_id: v.id("schedulingRuns"),
		status: v.union(
			v.literal("pending"),
			v.literal("running"),
			v.literal("completed"),
			v.literal("failed"),
		),
		triggeredBy: v.string(),
		startedAt: v.number(),
		completedAt: v.optional(v.number()),
		feasibleOnTime: v.optional(v.boolean()),
		horizonStart: v.optional(v.number()),
		horizonEnd: v.optional(v.number()),
		objectiveScore: v.optional(v.number()),
		tasksScheduled: v.number(),
		habitsScheduled: v.number(),
		lateTasks: v.optional(
			v.array(
				v.object({
					taskId: v.id("tasks"),
					dueDate: v.optional(v.number()),
					completionEnd: v.number(),
					tardinessSlots: v.number(),
					priority: taskPriorityValidator,
					blocker: v.boolean(),
					reason: v.optional(v.string()),
				}),
			),
		),
		habitShortfalls: v.optional(
			v.array(
				v.object({
					habitId: v.id("habits"),
					periodStart: v.number(),
					periodEnd: v.number(),
					targetCount: v.number(),
					scheduledCount: v.number(),
					shortfall: v.number(),
					recoveryPolicy: recoveryPolicyValidator,
				}),
			),
		),
		dropSummary: v.optional(
			v.array(
				v.object({
					habitId: v.id("habits"),
					recoveryPolicy: recoveryPolicyValidator,
					priority: habitPriorityValidator,
					reason: v.string(),
				}),
			),
		),
		reasonCode: v.optional(v.string()),
		error: v.optional(v.string()),
	}),
);

const sanitizeTaskMode = (mode: string | undefined): "fastest" | "balanced" | "packed" => {
	if (mode === "fastest" || mode === "balanced" || mode === "packed") return mode;
	return "fastest";
};

const sanitizeTaskPriority = (
	priority: string | undefined,
): "low" | "medium" | "high" | "critical" | "blocker" => {
	if (
		priority === "low" ||
		priority === "medium" ||
		priority === "high" ||
		priority === "critical" ||
		priority === "blocker"
	) {
		return priority;
	}
	return "medium";
};

const sanitizeHabitPriority = (
	priority: string | undefined,
): "low" | "medium" | "high" | "critical" => {
	if (priority === "low" || priority === "medium" || priority === "high") return priority;
	if (priority === "critical" || priority === "blocker") return "critical";
	return "medium";
};

const isBlockingBusyStatus = (busyStatus: string | undefined) =>
	busyStatus === "busy" || busyStatus === "tentative";

const normalizeTravelMinutes = (value: number | undefined) => {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.round(value ?? 0));
};

type SchedulableTaskStatus = "queued" | "scheduled";

const isSchedulableTaskStatus = (status: string): status is SchedulableTaskStatus =>
	status === "queued" || status === "scheduled";

export const getSchedulingInputForUser = internalQuery({
	args: {
		userId: v.string(),
		now: v.number(),
	},
	returns: v.object({
		userId: v.string(),
		timezone: v.string(),
		horizonWeeks: v.number(),
		downtimeMinutes: v.number(),
		defaultTaskMode: schedulingModeValidator,
		defaultHoursSetId: v.optional(v.id("hoursSets")),
		tasks: v.array(
			v.object({
				id: v.id("tasks"),
				creationTime: v.number(),
				title: v.string(),
				priority: taskPriorityValidator,
				blocker: v.boolean(),
				status: v.union(v.literal("queued"), v.literal("scheduled")),
				estimatedMinutes: v.number(),
				deadline: v.optional(v.number()),
				scheduleAfter: v.optional(v.number()),
				splitAllowed: v.optional(v.boolean()),
				minChunkMinutes: v.optional(v.number()),
				maxChunkMinutes: v.optional(v.number()),
				restMinutes: v.optional(v.number()),
				travelMinutes: v.optional(v.number()),
				location: v.optional(v.string()),
				hoursSetId: v.optional(v.id("hoursSets")),
				schedulingMode: v.optional(schedulingModeValidator),
				effectiveSchedulingMode: schedulingModeValidator,
				preferredCalendarId: v.optional(v.string()),
				color: v.optional(v.string()),
				pinnedEventMinutes: v.optional(v.number()),
			}),
		),
		habits: v.array(
			v.object({
				id: v.id("habits"),
				creationTime: v.number(),
				title: v.string(),
				priority: habitPriorityValidator,
				recoveryPolicy: recoveryPolicyValidator,
				recurrenceRule: v.string(),
				startDate: v.optional(v.number()),
				endDate: v.optional(v.number()),
				durationMinutes: v.number(),
				minDurationMinutes: v.optional(v.number()),
				maxDurationMinutes: v.optional(v.number()),
				repeatsPerPeriod: v.optional(v.number()),
				idealTime: v.optional(v.string()),
				preferredDays: v.optional(v.array(v.number())),
				hoursSetId: v.optional(v.id("hoursSets")),
				preferredCalendarId: v.optional(v.string()),
				color: v.optional(v.string()),
				isActive: v.boolean(),
			}),
		),
		busy: v.array(
			v.object({
				start: v.number(),
				end: v.number(),
			}),
		),
		hoursBySetId: v.record(
			v.string(),
			v.array(
				v.object({
					day: v.union(
						v.literal(0),
						v.literal(1),
						v.literal(2),
						v.literal(3),
						v.literal(4),
						v.literal(5),
						v.literal(6),
					),
					startMinute: v.number(),
					endMinute: v.number(),
				}),
			),
		),
		existingPlacements: v.array(
			v.object({
				source: v.union(v.literal("task"), v.literal("habit")),
				sourceId: v.string(),
				start: v.number(),
				end: v.number(),
			}),
		),
		now: v.number(),
	}),
	handler: async (ctx, args) => {
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.unique();
		const timezone = settings?.timezone ?? "UTC";
		const defaultTravelMinutes = normalizeTravelMinutes(
			(settings as { taskQuickCreateTravelMinutes?: number } | undefined)
				?.taskQuickCreateTravelMinutes,
		);
		const horizonDays = settings?.schedulingHorizonDays ?? 7 * 8;
		const horizonWeeks = Math.max(4, Math.min(12, Math.floor(horizonDays / 7)));
		const defaultTaskMode = sanitizeTaskMode(
			(settings as { defaultTaskSchedulingMode?: string } | undefined)?.defaultTaskSchedulingMode,
		);

		const horizonEnd = args.now + horizonWeeks * 7 * 24 * 60 * 60 * 1000;
		const events = await ctx.db
			.query("calendarEvents")
			.withIndex("by_userId_start", (q) => q.eq("userId", args.userId).lte("start", horizonEnd))
			.filter((q) => q.gte(q.field("end"), args.now))
			.collect();

		// Compute pinned event minutes per task
		const pinnedMinutesByTask = new Map<string, number>();
		for (const event of events) {
			if (
				event.source === "task" &&
				event.status !== "cancelled" &&
				event.pinned === true &&
				event.sourceId &&
				!event.sourceId.includes(":travel:")
			) {
				const mins = (event.end - event.start) / 60_000;
				pinnedMinutesByTask.set(
					event.sourceId,
					(pinnedMinutesByTask.get(event.sourceId) ?? 0) + mins,
				);
			}
		}

		const [tasks, habits, hoursSets] = await Promise.all([
			ctx.db
				.query("tasks")
				.withIndex("by_userId", (q) => q.eq("userId", args.userId))
				.collect(),
			ctx.db
				.query("habits")
				.withIndex("by_userId", (q) => q.eq("userId", args.userId))
				.collect(),
			ctx.db
				.query("hoursSets")
				.withIndex("by_userId", (q) => q.eq("userId", args.userId))
				.collect(),
		]);
		const schedulableTasks = tasks
			.filter((task) => isSchedulableTaskStatus(task.status))
			.map((task) => ({
				id: task._id,
				creationTime: task._creationTime,
				title: task.title,
				priority: sanitizeTaskPriority(task.priority),
				blocker: task.priority === "blocker",
				status: task.status as SchedulableTaskStatus,
				estimatedMinutes: task.estimatedMinutes,
				deadline: task.deadline,
				scheduleAfter: task.scheduleAfter,
				splitAllowed: task.splitAllowed,
				minChunkMinutes: task.minChunkMinutes,
				maxChunkMinutes: task.maxChunkMinutes,
				restMinutes: task.restMinutes,
				travelMinutes: task.travelMinutes,
				location: task.location,
				hoursSetId: task.hoursSetId,
				schedulingMode: task.schedulingMode ? sanitizeTaskMode(task.schedulingMode) : undefined,
				effectiveSchedulingMode: task.schedulingMode
					? sanitizeTaskMode(task.schedulingMode)
					: defaultTaskMode,
				preferredCalendarId: task.preferredCalendarId,
				color: task.color,
				pinnedEventMinutes: pinnedMinutesByTask.get(String(task._id)) ?? 0,
			}));

		const mappedHabits = habits.map((habit) => ({
			id: habit._id,
			creationTime: habit._creationTime,
			title: habit.title,
			priority: sanitizeHabitPriority(habit.priority),
			recoveryPolicy: habit.recoveryPolicy ?? "skip",
			recurrenceRule:
				habit.recurrenceRule ??
				recurrenceFromLegacyFrequency((habit as { frequency?: string }).frequency),
			startDate: habit.startDate,
			endDate: habit.endDate,
			durationMinutes: habit.durationMinutes,
			minDurationMinutes: habit.minDurationMinutes,
			maxDurationMinutes: habit.maxDurationMinutes,
			repeatsPerPeriod: habit.repeatsPerPeriod,
			idealTime: habit.idealTime,
			preferredDays: habit.preferredDays,
			hoursSetId: habit.hoursSetId,
			preferredCalendarId: habit.preferredCalendarId,
			color: habit.color,
			isActive: habit.isActive,
		}));

		const hoursBySetId = Object.fromEntries(
			hoursSets.map((set) => [String(set._id), set.windows] as const),
		) as Record<
			string,
			Array<{ day: 0 | 1 | 2 | 3 | 4 | 5 | 6; startMinute: number; endMinute: number }>
		>;
		const defaultHoursSetId = hoursSets.find((set) => set.isDefault)?._id;

		const busy = events
			.filter(
				(event) =>
					event.status !== "cancelled" &&
					(event.source === "manual" || event.source === "google" || event.pinned === true) &&
					isBlockingBusyStatus(event.busyStatus),
			)
			.map((event) => ({
				start:
					defaultTravelMinutes > 0 && Boolean(event.location?.trim()) && !event.allDay
						? event.start - defaultTravelMinutes * 60 * 1000
						: event.start,
				end:
					defaultTravelMinutes > 0 && Boolean(event.location?.trim()) && !event.allDay
						? event.end + defaultTravelMinutes * 60 * 1000
						: event.end,
			}));
		const existingPlacements = events
			.filter(
				(
					event,
				): event is typeof event & {
					source: "task" | "habit";
					sourceId: string;
				} =>
					(event.source === "task" || event.source === "habit") &&
					typeof event.sourceId === "string",
			)
			.map((event) => ({
				source: event.source,
				sourceId: event.sourceId,
				start: event.start,
				end: event.end,
			}));

		return {
			userId: args.userId,
			timezone,
			horizonWeeks,
			downtimeMinutes: normalizeSchedulingDowntimeMinutes(settings?.schedulingDowntimeMinutes),
			defaultTaskMode,
			defaultHoursSetId,
			tasks: schedulableTasks,
			habits: mappedHabits,
			busy,
			hoursBySetId,
			existingPlacements,
			now: args.now,
		};
	},
});

export const getLatestRun = query({
	args: {},
	returns: runSummaryValidator,
	handler: withQueryAuth(async (ctx) => {
		const latestByStartedAt = (
			await ctx.db
				.query("schedulingRuns")
				.withIndex("by_userId_startedAt", (q) => q.eq("userId", ctx.userId))
				.order("desc")
				.take(1)
		)[0];
		if (!latestByStartedAt) return null;
		const tiedRuns = await ctx.db
			.query("schedulingRuns")
			.withIndex("by_userId_startedAt", (q) =>
				q.eq("userId", ctx.userId).eq("startedAt", latestByStartedAt.startedAt),
			)
			.collect();
		const latest = tiedRuns.reduce<(typeof tiedRuns)[number] | undefined>((current, candidate) => {
			if (!current) return candidate;
			return isRunNewer(candidate, current) ? candidate : current;
		}, undefined);
		if (!latest) return null;
		return {
			_id: latest._id,
			status: latest.status,
			triggeredBy: latest.triggeredBy,
			startedAt: latest.startedAt,
			completedAt: latest.completedAt,
			feasibleOnTime: latest.feasibleOnTime,
			horizonStart: latest.horizonStart,
			horizonEnd: latest.horizonEnd,
			objectiveScore: latest.objectiveScore,
			tasksScheduled: latest.tasksScheduled,
			habitsScheduled: latest.habitsScheduled,
			lateTasks: latest.lateTasks,
			habitShortfalls: latest.habitShortfalls,
			reasonCode: latest.reasonCode,
			error: latest.error,
			dropSummary: latest.dropSummary?.map((drop) => ({
				...drop,
				priority: drop.priority === "blocker" ? "critical" : drop.priority,
			})),
		};
	}),
});

export const isRunSuperseded = internalQuery({
	args: {
		runId: v.id("schedulingRuns"),
		userId: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.runId);
		if (!run || run.userId !== args.userId) return true;

		const [latestPending, latestRunning] = await Promise.all([
			ctx.db
				.query("schedulingRuns")
				.withIndex("by_userId_status_startedAt", (q) =>
					q.eq("userId", args.userId).eq("status", "pending"),
				)
				.order("desc")
				.take(1),
			ctx.db
				.query("schedulingRuns")
				.withIndex("by_userId_status_startedAt", (q) =>
					q.eq("userId", args.userId).eq("status", "running"),
				)
				.order("desc")
				.take(1),
		]);

		for (const candidate of [latestPending[0], latestRunning[0]]) {
			if (!candidate || candidate._id === args.runId) continue;
			if (candidate.startedAt > run.startedAt) {
				return true;
			}
		}

		if (
			latestPending[0]?.startedAt !== run.startedAt &&
			latestRunning[0]?.startedAt !== run.startedAt
		) {
			return false;
		}

		const tiedRuns = await ctx.db
			.query("schedulingRuns")
			.withIndex("by_userId_startedAt", (q) =>
				q.eq("userId", args.userId).eq("startedAt", run.startedAt),
			)
			.collect();

		return tiedRuns.some(
			(candidate) =>
				(candidate.status === "pending" || candidate.status === "running") &&
				candidate._id !== args.runId &&
				isRunNewer(candidate, run),
		);
	},
});
