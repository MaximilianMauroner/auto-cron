import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SchedulingBlock } from "./mutationTypes";
import { isRunNewer } from "./run_order";
export type { SchedulingBlock } from "./mutationTypes";

export const MINUTES_TO_MS = 60 * 1000;
export const TRAVEL_CATEGORY_NAME = "Travel";
export const DEFAULT_TRAVEL_COLOR_INDEX = 7;
const TRAVEL_BLOCK_MARKER = ":travel:";

export const blockGroupKey = (block: Pick<SchedulingBlock, "source" | "sourceId">) =>
	`${block.source}:${block.sourceId}`;

const buildTravelSourceId = (
	taskId: string,
	placementStart: number,
	placementEnd: number,
	segment: "before" | "after",
) => `task:${taskId}:travel:${segment}:${placementStart}:${placementEnd}`;

export const appendRemovedGoogleEvent = (
	removedGoogleEvents: Array<{ googleEventId: string; calendarId: string }>,
	event: { googleEventId?: string; calendarId?: string },
) => {
	if (!event.googleEventId) return;
	removedGoogleEvents.push({
		googleEventId: event.googleEventId,
		calendarId: resolveGoogleCalendarId(event.calendarId),
	});
};

export const isTravelSourceId = (sourceId: string | undefined) =>
	Boolean(sourceId?.includes(TRAVEL_BLOCK_MARKER));

export const upsertGroupedBlock = (
	groupedBlocks: Map<string, SchedulingBlock[]>,
	key: string,
	block: SchedulingBlock,
) => {
	const group = groupedBlocks.get(key) ?? [];
	const exists = group.some((item) => item.start === block.start && item.end === block.end);
	if (exists) return;
	group.push(block);
	group.sort((a, b) => {
		if (a.start !== b.start) return a.start - b.start;
		return a.end - b.end;
	});
	groupedBlocks.set(key, group);
};

export const resolveBlockColor = (block: SchedulingBlock, travelColor: string) =>
	block.source === "task" && isTravelSourceId(block.sourceId) ? travelColor : block.color;

export const isTravelBufferCandidate = (event: {
	source: string;
	pinned?: boolean;
	sourceId?: string;
}): event is {
	source: "task";
	pinned: true;
	sourceId: string;
} =>
	event.source === "task" &&
	event.pinned === true &&
	Boolean(event.sourceId) &&
	!isTravelSourceId(event.sourceId);

export const recordTaskPlacement = (
	tasksById: Map<string, { starts: number[]; ends: number[] }>,
	taskId: string,
	start: number,
	end: number,
) => {
	const placement = tasksById.get(taskId) ?? { starts: [], ends: [] };
	placement.starts.push(start);
	placement.ends.push(end);
	tasksById.set(taskId, placement);
};

export const resolveTaskPriority = (
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

export const createTravelBlock = ({
	task,
	event,
	segment,
	start,
	end,
	travelColor,
}: {
	task: { title: string; priority?: string; preferredCalendarId?: string; location?: string };
	event: { sourceId: string; start: number; end: number; calendarId?: string };
	segment: "before" | "after";
	start: number;
	end: number;
	travelColor: string;
}): { key: string; block: SchedulingBlock } => {
	const sourceId = buildTravelSourceId(event.sourceId, event.start, event.end, segment);
	return {
		key: blockGroupKey({ source: "task", sourceId }),
		block: {
			source: "task",
			sourceId,
			title: `Travel: ${task.title}`,
			start,
			end,
			priority: resolveTaskPriority(task.priority),
			calendarId: event.calendarId ?? task.preferredCalendarId,
			color: travelColor,
			location: task.location,
		},
	};
};

export const listLatestRunCandidates = async (ctx: MutationCtx, userId: string) => {
	const [latestPending, latestRunning] = await Promise.all([
		ctx.db
			.query("schedulingRuns")
			.withIndex("by_userId_status_startedAt", (q) =>
				q.eq("userId", userId).eq("status", "pending"),
			)
			.order("desc")
			.take(1),
		ctx.db
			.query("schedulingRuns")
			.withIndex("by_userId_status_startedAt", (q) =>
				q.eq("userId", userId).eq("status", "running"),
			)
			.order("desc")
			.take(1),
	]);
	return [latestPending[0], latestRunning[0]].filter(
		(run): run is Doc<"schedulingRuns"> => run !== undefined,
	);
};

export const isRunSuperseded = async ({
	ctx,
	userId,
	currentRun,
	latestCandidates,
}: {
	ctx: MutationCtx;
	userId: string;
	currentRun: Doc<"schedulingRuns">;
	latestCandidates: Doc<"schedulingRuns">[];
}) => {
	const newerExists = latestCandidates.some(
		(run) => run._id !== currentRun._id && run.startedAt > currentRun.startedAt,
	);
	if (newerExists) return true;

	const needTieCheck = latestCandidates.some((run) => run.startedAt === currentRun.startedAt);
	if (!needTieCheck) return false;

	const tiedRuns = await ctx.db
		.query("schedulingRuns")
		.withIndex("by_userId_startedAt", (q) =>
			q.eq("userId", userId).eq("startedAt", currentRun.startedAt),
		)
		.collect();

	return tiedRuns.some(
		(run) =>
			(run.status === "pending" || run.status === "running") &&
			run._id !== currentRun._id &&
			isRunNewer(run, currentRun),
	);
};

export const resolveTravelMinutes = (value: number | undefined) =>
	Math.max(0, Math.round(value ?? 0));

export const resolveTravelWindow = (
	horizonStart: number,
	horizonEnd: number,
	eventStart: number,
	eventEnd: number,
	travelDurationMs: number,
) => ({
	beforeStart: Math.max(horizonStart, eventStart - travelDurationMs),
	afterEnd: Math.min(horizonEnd, eventEnd + travelDurationMs),
});

export const resolveGoogleCalendarId = (calendarId: string | undefined) => calendarId ?? "primary";

export const resolveScheduledTaskStatus = (
	status: "backlog" | "queued" | "scheduled" | "in_progress" | "done",
): "backlog" | "scheduled" | "in_progress" | "done" => (status === "queued" ? "scheduled" : status);
