import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEBOUNCE_WINDOW_MS } from "../../convex/scheduling/constants";
import { createTestConvex } from "./_setup";

type ErrorWithData = {
	data?: unknown;
	message?: unknown;
};
const HOUR_MS = 60 * 60 * 1000;

const extractErrorCode = (error: unknown): string | undefined => {
	if (!error || typeof error !== "object") return undefined;
	const data = (error as ErrorWithData).data;
	if (data && typeof data === "object") return (data as { code?: string }).code;
	const message = (error as ErrorWithData).message;
	if (typeof message !== "string") return undefined;
	try {
		const parsed = JSON.parse(message) as { code?: string };
		return parsed.code;
	} catch {
		return undefined;
	}
};

const ensureDefined = <T>(value: T | undefined, label: string): T => {
	if (value === undefined) {
		throw new Error(`Expected ${label} to be defined`);
	}
	return value;
};

const bootstrapAndGetDefaultCategoryId = async (
	testConvex: ReturnType<typeof createTestConvex>,
	userId: string,
) => {
	await testConvex.mutation(internal.hours.mutations.internalBootstrapDefaultPlannerDataForUser, {
		userId,
	});
	const categories = await testConvex.run(async (ctx) => {
		return await ctx.db
			.query("taskCategories")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
	});
	const defaultCategory = categories.find((c) => c.isDefault);
	if (!defaultCategory) throw new Error("Expected default category after bootstrap");
	return defaultCategory._id;
};

const latestRun = async (user: ReturnType<ReturnType<typeof createTestConvex>["withIdentity"]>) => {
	return user.query(api.scheduling.queries.getLatestRun, {});
};

const settleAllActiveRuns = async (
	testConvex: ReturnType<typeof createTestConvex>,
	user: ReturnType<ReturnType<typeof createTestConvex>["withIdentity"]>,
) => {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const run = await latestRun(user);
		if (!run) return;
		if (run.status !== "pending" && run.status !== "running") return;
		await testConvex.mutation(internal.scheduling.mutations.failRun, {
			runId: run._id,
			error: "test-settled",
			reasonCode: "TEST_SETTLED",
		});
	}
};

const seedScheduledTaskBlock = async (
	testConvex: ReturnType<typeof createTestConvex>,
	user: ReturnType<ReturnType<typeof createTestConvex>["withIdentity"]>,
	userId: string,
	{
		taskRequestId,
		taskTitle,
		start,
		end,
	}: { taskRequestId: string; taskTitle: string; start: number; end: number },
) => {
	const taskId = await user.action(api.tasks.actions.createTask, {
		requestId: taskRequestId,
		input: {
			title: taskTitle,
			estimatedMinutes: Math.max(15, Math.round((end - start) / (60 * 1000))),
			status: "queued",
		},
	});
	await settleAllActiveRuns(testConvex, user);

	const run = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
		userId,
		triggeredBy: "task_change",
		force: true,
	});
	await testConvex.mutation(internal.scheduling.mutations.applySchedulingBlocks, {
		runId: run.runId,
		userId,
		horizonStart: start - 2 * 60 * 60 * 1000,
		horizonEnd: end + 2 * 60 * 60 * 1000,
		blocks: [
			{
				source: "task" as const,
				sourceId: String(taskId),
				title: taskTitle,
				start,
				end,
				priority: "high" as const,
			},
		],
	});
	await testConvex.mutation(internal.scheduling.mutations.failRun, {
		runId: run.runId,
		error: "test-settled-after-seed",
		reasonCode: "TEST_SETTLED",
	});
	return taskId;
};

const seedScheduledHabitBlock = async (
	testConvex: ReturnType<typeof createTestConvex>,
	user: ReturnType<ReturnType<typeof createTestConvex>["withIdentity"]>,
	userId: string,
	{
		habitRequestId,
		habitTitle,
		start,
		end,
		categoryId,
	}: {
		habitRequestId: string;
		habitTitle: string;
		start: number;
		end: number;
		categoryId: Id<"taskCategories">;
	},
) => {
	const habitId = await user.action(api.habits.actions.createHabit, {
		requestId: habitRequestId,
		input: {
			title: habitTitle,
			categoryId,
			frequency: "weekly",
			durationMinutes: Math.max(15, Math.round((end - start) / (60 * 1000))),
		},
	});
	await settleAllActiveRuns(testConvex, user);

	const run = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
		userId,
		triggeredBy: "habit_change",
		force: true,
	});
	await testConvex.mutation(internal.scheduling.mutations.applySchedulingBlocks, {
		runId: run.runId,
		userId,
		horizonStart: start - 2 * 60 * 60 * 1000,
		horizonEnd: end + 2 * 60 * 60 * 1000,
		blocks: [
			{
				source: "habit" as const,
				sourceId: String(habitId),
				title: habitTitle,
				start,
				end,
				priority: "high" as const,
			},
		],
	});
	await testConvex.mutation(internal.scheduling.mutations.failRun, {
		runId: run.runId,
		error: "test-settled-after-seed",
		reasonCode: "TEST_SETTLED",
	});
	return habitId;
};

describe("scheduling run queueing", () => {
	beforeEach(() => {
		process.env.AUTUMN_BILLING_MODE = "allow_all";
	});

	describe("enqueue semantics", () => {
		test("dedupes when a pending run already exists for the same user", async () => {
			const testConvex = createTestConvex();
			const userId = "user-pending-dedupe";

			const first = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			const second = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "calendar_change",
			});

			expect(first.enqueued).toBe(true);
			expect(second.enqueued).toBe(false);
			expect(second.runId).toBe(first.runId);
		});

		test("force enqueue bypasses pending dedupe", async () => {
			const testConvex = createTestConvex();
			const userId = "user-force-enqueue";

			const first = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			const forced = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "manual",
				force: true,
			});

			expect(forced.enqueued).toBe(true);
			expect(forced.runId).not.toBe(first.runId);
		});

		test("pending dedupe still applies after debounce window expiry", async () => {
			const testConvex = createTestConvex();
			const userId = "user-pending-singleton";
			const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

			vi.useFakeTimers();
			try {
				vi.setSystemTime(base);
				const first = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);
				vi.setSystemTime(base + DEBOUNCE_WINDOW_MS + 1);
				const second = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "calendar_change",
					},
				);

				expect(second.enqueued).toBe(false);
				expect(second.runId).toBe(first.runId);
			} finally {
				vi.useRealTimers();
			}
		});

		test("force enqueue can still create a new pending run when one is already pending", async () => {
			const testConvex = createTestConvex();
			const userId = "user-force-pending-singleton";
			const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

			vi.useFakeTimers();
			try {
				vi.setSystemTime(base);
				const first = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);
				vi.setSystemTime(base + DEBOUNCE_WINDOW_MS + 1);
				const second = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "manual",
						force: true,
					},
				);

				expect(second.enqueued).toBe(true);
				expect(second.runId).not.toBe(first.runId);
			} finally {
				vi.useRealTimers();
			}
		});

		test("manual run action dedupes while a pending run exists", async () => {
			const testConvex = createTestConvex();
			const user = testConvex.withIdentity({ subject: "user-run-now-dedupe" });

			const first = await user.action(api.scheduling.actions.runNow, {});
			const second = await user.action(api.scheduling.actions.runNow, {});

			expect(first.enqueued).toBe(true);
			expect(second.enqueued).toBe(false);
			expect(second.runId).toBe(first.runId);
		});

		test("queueing is isolated per user", async () => {
			const testConvex = createTestConvex();

			const userA = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId: "user-a",
				triggeredBy: "task_change",
			});
			const userB = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId: "user-b",
				triggeredBy: "task_change",
			});

			expect(userA.enqueued).toBe(true);
			expect(userB.enqueued).toBe(true);
			expect(userA.runId).not.toBe(userB.runId);
		});

		test("getLatestRun deterministically returns newest run when startedAt ties", async () => {
			const testConvex = createTestConvex();
			const userId = "user-latest-run-tie";
			const user = testConvex.withIdentity({ subject: userId });
			const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

			vi.useFakeTimers();
			try {
				vi.setSystemTime(base);
				const first = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);
				const second = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "manual",
						force: true,
					},
				);

				const latest = await user.query(api.scheduling.queries.getLatestRun, {});
				expect(latest?._id).toBe(second.runId);
				expect(latest?._id).not.toBe(first.runId);
			} finally {
				vi.useRealTimers();
			}
		});

		test("dedupes repeated trigger while previous run is running inside debounce window", async () => {
			const testConvex = createTestConvex();
			const userId = "user-running-followup";

			const first = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			await testConvex.mutation(internal.scheduling.mutations.markRunRunning, {
				runId: first.runId,
			});

			const second = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});

			expect(second.enqueued).toBe(false);
			expect(second.runId).toBe(first.runId);
		});

		test("enqueues repeated trigger after debounce window when previous run is running", async () => {
			const testConvex = createTestConvex();
			const userId = "user-running-followup-after-window";
			const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

			vi.useFakeTimers();
			try {
				vi.setSystemTime(base);
				const first = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);
				await testConvex.mutation(internal.scheduling.mutations.markRunRunning, {
					runId: first.runId,
				});
				vi.setSystemTime(base + DEBOUNCE_WINDOW_MS + 1);

				const second = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);

				expect(second.enqueued).toBe(true);
				expect(second.runId).not.toBe(first.runId);
			} finally {
				vi.useRealTimers();
			}
		});

		test("failed runs do not debounce follow-up enqueue", async () => {
			const testConvex = createTestConvex();
			const userId = "user-failed-followup-window";
			const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

			vi.useFakeTimers();
			try {
				vi.setSystemTime(base);
				const first = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);
				await testConvex.mutation(internal.scheduling.mutations.failRun, {
					runId: first.runId,
					error: "test-fail",
					reasonCode: "TEST_FAILED",
				});
				vi.setSystemTime(base + DEBOUNCE_WINDOW_MS - 1);

				const second = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);

				expect(second.enqueued).toBe(true);
				expect(second.runId).not.toBe(first.runId);
			} finally {
				vi.useRealTimers();
			}
		});
	});

	describe("supersede semantics", () => {
		test("isRunSuperseded is false when only the run itself exists", async () => {
			const testConvex = createTestConvex();
			const userId = "user-supersede-false";

			const run = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			const superseded = await testConvex.query(internal.scheduling.queries.isRunSuperseded, {
				runId: run.runId,
				userId,
			});

			expect(superseded).toBe(false);
		});

		test("isRunSuperseded is true for missing run or user mismatch", async () => {
			const testConvex = createTestConvex();
			const run = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId: "user-supersede-mismatch-a",
				triggeredBy: "task_change",
			});
			const mismatched = await testConvex.query(internal.scheduling.queries.isRunSuperseded, {
				runId: run.runId,
				userId: "user-supersede-mismatch-b",
			});

			expect(mismatched).toBe(true);
		});

		test("isRunSuperseded is true when a newer/equal-timestamp run exists", async () => {
			const testConvex = createTestConvex();
			const userId = "user-supersede-true";
			const first = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "calendar_change",
				force: true,
			});

			const superseded = await testConvex.query(internal.scheduling.queries.isRunSuperseded, {
				runId: first.runId,
				userId,
			});

			expect(superseded).toBe(true);
		});

		test("equal-millisecond runs do not mutually supersede", async () => {
			const testConvex = createTestConvex();
			const userId = "user-equal-ts-ordering";
			const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

			vi.useFakeTimers();
			try {
				vi.setSystemTime(base);
				const first = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "task_change",
					},
				);
				const second = await testConvex.mutation(
					internal.scheduling.mutations.enqueueSchedulingRun,
					{
						userId,
						triggeredBy: "calendar_change",
						force: true,
					},
				);

				const firstSuperseded = await testConvex.query(
					internal.scheduling.queries.isRunSuperseded,
					{
						runId: first.runId,
						userId,
					},
				);
				const secondSuperseded = await testConvex.query(
					internal.scheduling.queries.isRunSuperseded,
					{
						runId: second.runId,
						userId,
					},
				);

				expect(firstSuperseded).not.toBe(secondSuperseded);
				expect(secondSuperseded).toBe(false);
			} finally {
				vi.useRealTimers();
			}
		});

		test("blocks stale run apply when a newer run is queued for the same user", async () => {
			const testConvex = createTestConvex();
			const userId = "user-stale-run";
			const now = Date.now();

			const first = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			await testConvex.mutation(internal.scheduling.mutations.markRunRunning, {
				runId: first.runId,
			});
			await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "calendar_change",
			});

			await expect(
				testConvex.mutation(internal.scheduling.mutations.applySchedulingBlocks, {
					runId: first.runId,
					userId,
					horizonStart: now,
					horizonEnd: now + 60 * 60 * 1000,
					blocks: [],
				}),
			).rejects.toSatisfy((error: unknown) => {
				return extractErrorCode(error) === "SUPERSEDED_BY_NEWER_RUN";
			});
		});

		test("runForUser returns failed when run is superseded at start", async () => {
			const testConvex = createTestConvex();
			const userId = "user-run-for-user-superseded";

			const first = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "calendar_change",
				force: true,
			});

			const result = await testConvex.action(internal.scheduling.actions.runForUser, {
				runId: first.runId,
				userId,
				triggeredBy: "task_change",
			});

			expect(result.status).toBe("failed");
			expect(result.reasonCode).toBe("SUPERSEDED_BY_NEWER_RUN");
		});

		test("running run is stopped when newer run is queued for the same user", async () => {
			const testConvex = createTestConvex();
			const userId = "user-stop-running-on-newer";

			const first = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
			});
			await testConvex.mutation(internal.scheduling.mutations.markRunRunning, {
				runId: first.runId,
			});
			await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "calendar_change",
			});

			const result = await testConvex.action(internal.scheduling.actions.runForUser, {
				runId: first.runId,
				userId,
				triggeredBy: "task_change",
			});

			expect(result.status).toBe("failed");
			expect(result.reasonCode).toBe("SUPERSEDED_BY_NEWER_RUN");
		});

		test("markRunRunning does not transition failed/completed runs back to running", async () => {
			const testConvex = createTestConvex();
			const userId = "user-mark-run-guard";
			const user = testConvex.withIdentity({ subject: userId });

			const failedRun = await testConvex.mutation(
				internal.scheduling.mutations.enqueueSchedulingRun,
				{
					userId,
					triggeredBy: "task_change",
				},
			);
			await testConvex.mutation(internal.scheduling.mutations.failRun, {
				runId: failedRun.runId,
				error: "explicit failure",
			});
			await testConvex.mutation(internal.scheduling.mutations.markRunRunning, {
				runId: failedRun.runId,
			});
			const failedRow = await latestRun(user);
			expect(failedRow?._id).toBe(failedRun.runId);
			expect(failedRow?.status).toBe("failed");

			const completedRun = await testConvex.mutation(
				internal.scheduling.mutations.enqueueSchedulingRun,
				{
					userId,
					triggeredBy: "task_change",
					force: true,
				},
			);
			await testConvex.mutation(internal.scheduling.mutations.completeRun, {
				runId: completedRun.runId,
				tasksScheduled: 0,
				habitsScheduled: 0,
				feasibleOnTime: true,
				horizonStart: Date.now(),
				horizonEnd: Date.now() + HOUR_MS,
				objectiveScore: 0,
				lateTasks: [],
				habitShortfalls: [],
				dropSummary: [],
			});
			await testConvex.mutation(internal.scheduling.mutations.markRunRunning, {
				runId: completedRun.runId,
			});
			const completedRow = await latestRun(user);
			expect(completedRow?._id).toBe(completedRun.runId);
			expect(completedRow?.status).toBe("completed");
		});
	});

	describe("trigger integration", () => {
		test("task create/update/reorder/delete paths all enqueue task_change runs", async () => {
			const testConvex = createTestConvex();
			const user = testConvex.withIdentity({ subject: "user-task-trigger" });

			const taskId = await user.action(api.tasks.actions.createTask, {
				requestId: "task-trigger-create",
				input: {
					title: "Task trigger",
					estimatedMinutes: 30,
				},
			});
			expect((await latestRun(user))?.triggeredBy).toBe("task_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.tasks.mutations.updateTask, {
				id: taskId,
				patch: { title: "Task trigger updated" },
			});
			expect((await latestRun(user))?.triggeredBy).toBe("task_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.tasks.mutations.reorderTasks, {
				items: [{ id: taskId, sortOrder: 0, status: "queued" }],
			});
			expect((await latestRun(user))?.triggeredBy).toBe("task_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.tasks.mutations.deleteTask, { id: taskId });
			expect((await latestRun(user))?.triggeredBy).toBe("task_change");
		});

		test("habit create/update/toggle/delete paths all enqueue habit_change runs", async () => {
			const testConvex = createTestConvex();
			const user = testConvex.withIdentity({ subject: "user-habit-trigger" });
			const categoryId = await bootstrapAndGetDefaultCategoryId(testConvex, "user-habit-trigger");

			const habitId = await user.action(api.habits.actions.createHabit, {
				requestId: "habit-trigger-create",
				input: {
					title: "Habit trigger",
					categoryId,
					frequency: "weekly",
					durationMinutes: 30,
				},
			});
			expect((await latestRun(user))?.triggeredBy).toBe("habit_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.habits.mutations.updateHabit, {
				id: habitId,
				patch: { title: "Habit trigger updated" },
			});
			expect((await latestRun(user))?.triggeredBy).toBe("habit_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.habits.mutations.toggleHabitActive, {
				id: habitId,
				isActive: false,
			});
			expect((await latestRun(user))?.triggeredBy).toBe("habit_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.habits.mutations.deleteHabit, { id: habitId });
			expect((await latestRun(user))?.triggeredBy).toBe("habit_change");
		});

		test("hours mutations enqueue hours_change runs across CRUD + defaults", async () => {
			const testConvex = createTestConvex();
			const user = testConvex.withIdentity({ subject: "user-hours-trigger" });

			await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});
			await settleAllActiveRuns(testConvex, user);

			const customSetA = await user.mutation(api.hours.mutations.createHoursSet, {
				input: {
					name: "Custom A",
					windows: [{ day: 1, startMinute: 8 * 60, endMinute: 9 * 60 }],
				},
			});
			expect((await latestRun(user))?.triggeredBy).toBe("hours_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.hours.mutations.updateHoursSet, {
				id: customSetA,
				input: {
					name: "Custom A Updated",
					windows: [{ day: 1, startMinute: 9 * 60, endMinute: 10 * 60 }],
				},
			});
			expect((await latestRun(user))?.triggeredBy).toBe("hours_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.hours.mutations.setDefaultHoursSet, {
				id: customSetA,
			});
			expect((await latestRun(user))?.triggeredBy).toBe("hours_change");
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.hours.mutations.setDefaultTaskSchedulingMode, {
				mode: "packed",
			});
			expect((await latestRun(user))?.triggeredBy).toBe("hours_change");
			await settleAllActiveRuns(testConvex, user);

			const customSetB = await user.mutation(api.hours.mutations.createHoursSet, {
				input: {
					name: "Custom B",
					windows: [{ day: 2, startMinute: 10 * 60, endMinute: 11 * 60 }],
				},
			});
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.hours.mutations.deleteHoursSet, { id: customSetB });
			const latest = await latestRun(user);
			expect(latest?.triggeredBy).toBe("hours_change");
			expect(latest?.status).toBe("pending");
		});

		test("new overlapping busy event enqueues calendar_change even when another run is running", async () => {
			const testConvex = createTestConvex();
			const userId = "user-overlap-event";
			const user = testConvex.withIdentity({ subject: userId });

			const now = Date.now();
			await seedScheduledTaskBlock(testConvex, user, userId, {
				taskRequestId: "overlap-task-create",
				taskTitle: "Overlap task",
				start: now + 15 * 60 * 1000,
				end: now + 75 * 60 * 1000,
			});
			const run = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "task_change",
				force: true,
			});
			await testConvex.mutation(internal.scheduling.mutations.markRunRunning, {
				runId: run.runId,
			});

			await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Overlapping manual busy",
					start: now + 30 * 60 * 1000,
					end: now + 60 * 60 * 1000,
					busyStatus: "busy",
				},
			});

			const latest = await latestRun(user);
			expect(latest?.status).toBe("pending");
			expect(latest?.triggeredBy).toBe("calendar_change");

			const events = await user.query(api.calendar.queries.listEvents, {
				start: now,
				end: now + 2 * 60 * 60 * 1000,
			});
			expect(events.some((event) => event.source === "task")).toBe(true);
			expect(events.some((event) => event.source === "manual")).toBe(true);
		});

		test("updating an event into overlap with scheduled task enqueues calendar_change", async () => {
			const testConvex = createTestConvex();
			const userId = "user-overlap-update";
			const user = testConvex.withIdentity({ subject: userId });
			const now = Date.now();

			await seedScheduledTaskBlock(testConvex, user, userId, {
				taskRequestId: "overlap-update-task",
				taskTitle: "Overlap update task",
				start: now + 30 * 60 * 1000,
				end: now + 90 * 60 * 1000,
			});
			await settleAllActiveRuns(testConvex, user);

			const eventId = await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Move me into overlap",
					start: now + 3 * 60 * 60 * 1000,
					end: now + 4 * 60 * 60 * 1000,
					busyStatus: "busy",
				},
			});
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.calendar.mutations.updateEvent, {
				id: eventId,
				patch: {
					start: now + 45 * 60 * 1000,
					end: now + 70 * 60 * 1000,
					busyStatus: "busy",
				},
			});
			const latest = await latestRun(user);
			expect(latest?.triggeredBy).toBe("calendar_change");
			expect(latest?.status).toBe("pending");
		});

		test("new overlapping busy event with existing habit slot enqueues calendar_change", async () => {
			const testConvex = createTestConvex();
			const userId = "user-overlap-habit-event";
			const user = testConvex.withIdentity({ subject: userId });
			const now = Date.now();
			const categoryId = await bootstrapAndGetDefaultCategoryId(testConvex, userId);

			const habitId = await seedScheduledHabitBlock(testConvex, user, userId, {
				habitRequestId: "overlap-habit-create",
				habitTitle: "Overlap habit",
				start: now + 30 * 60 * 1000,
				end: now + 90 * 60 * 1000,
				categoryId,
			});
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Overlapping with habit",
					start: now + 45 * 60 * 1000,
					end: now + 75 * 60 * 1000,
					busyStatus: "busy",
				},
			});

			const latest = await latestRun(user);
			expect(latest?.triggeredBy).toBe("calendar_change");
			expect(latest?.status).toBe("pending");

			const events = await user.query(api.calendar.queries.listEvents, {
				start: now,
				end: now + 2 * 60 * 60 * 1000,
			});
			expect(events.some((event) => event.source === "habit")).toBe(true);
			expect(events.some((event) => event.sourceId === String(habitId))).toBe(true);
		});

		test("moveResizeEvent into overlap enqueues calendar_change", async () => {
			const testConvex = createTestConvex();
			const userId = "user-overlap-move";
			const user = testConvex.withIdentity({ subject: userId });
			const now = Date.now();

			await seedScheduledTaskBlock(testConvex, user, userId, {
				taskRequestId: "overlap-move-task",
				taskTitle: "Overlap move task",
				start: now + 60 * 60 * 1000,
				end: now + 120 * 60 * 1000,
			});
			await settleAllActiveRuns(testConvex, user);

			const eventId = await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Move overlap target",
					start: now + 4 * 60 * 60 * 1000,
					end: now + 5 * 60 * 60 * 1000,
					busyStatus: "busy",
				},
			});
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.calendar.mutations.moveResizeEvent, {
				id: eventId,
				start: now + 75 * 60 * 1000,
				end: now + 105 * 60 * 1000,
			});
			const latest = await latestRun(user);
			expect(latest?.triggeredBy).toBe("calendar_change");
			expect(latest?.status).toBe("pending");
		});

		test("deleting an overlapping event enqueues calendar_change", async () => {
			const testConvex = createTestConvex();
			const userId = "user-overlap-delete";
			const user = testConvex.withIdentity({ subject: userId });
			const now = Date.now();

			await seedScheduledTaskBlock(testConvex, user, userId, {
				taskRequestId: "overlap-delete-task",
				taskTitle: "Overlap delete task",
				start: now + 30 * 60 * 1000,
				end: now + 90 * 60 * 1000,
			});
			await settleAllActiveRuns(testConvex, user);

			const eventId = await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Delete overlap target",
					start: now + 45 * 60 * 1000,
					end: now + 80 * 60 * 1000,
					busyStatus: "busy",
				},
			});
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.calendar.mutations.deleteEvent, { id: eventId });
			const latest = await latestRun(user);
			expect(latest?.triggeredBy).toBe("calendar_change");
			expect(latest?.status).toBe("pending");
		});

		test("upsertSyncedEventsForUser enqueues calendar_change", async () => {
			const testConvex = createTestConvex();
			const userId = "user-sync-upsert-trigger";
			const user = testConvex.withIdentity({ subject: userId });
			const now = Date.now();

			await testConvex.mutation(internal.calendar.mutations.upsertSyncedEventsForUser, {
				userId,
				events: [
					{
						googleEventId: "google-evt-1",
						title: "Synced event",
						start: now + 60 * 60 * 1000,
						end: now + 90 * 60 * 1000,
						allDay: false,
						calendarId: "primary",
						busyStatus: "busy",
						lastSyncedAt: now,
					},
				],
				deletedEvents: [],
			});

			const latest = await latestRun(user);
			expect(latest?.triggeredBy).toBe("calendar_change");
			expect(latest?.status).toBe("pending");
		});

		test("scheduling input counts only non-free calendar events as busy", async () => {
			const testConvex = createTestConvex();
			const userId = "user-busy-status-filter";
			const user = testConvex.withIdentity({ subject: userId });
			const now = Date.now();

			const freeStart = now + 15 * 60 * 1000;
			const busyStart = now + 45 * 60 * 1000;
			const tentativeStart = now + 75 * 60 * 1000;

			await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Free event",
					start: freeStart,
					end: freeStart + 30 * 60 * 1000,
					busyStatus: "free",
				},
			});
			await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Busy event",
					start: busyStart,
					end: busyStart + 30 * 60 * 1000,
					busyStatus: "busy",
				},
			});
			await user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Tentative event",
					start: tentativeStart,
					end: tentativeStart + 30 * 60 * 1000,
					busyStatus: "tentative",
				},
			});

			const input = await testConvex.query(internal.scheduling.queries.getSchedulingInputForUser, {
				userId,
				now,
			});

			expect(input.busy.some((interval) => interval.start === freeStart)).toBe(false);
			expect(input.busy.some((interval) => interval.start === busyStart)).toBe(true);
			expect(input.busy.some((interval) => interval.start === tentativeStart)).toBe(true);
		});

		test("synced recurring events keep busyStatus on occurrences for scheduling busy filtering", async () => {
			const testConvex = createTestConvex();
			const userId = "user-sync-recurring-busy";
			const now = Date.now();

			const recurringBusyStart = now + 2 * HOUR_MS;
			const recurringFreeStart = now + 4 * HOUR_MS;

			await testConvex.mutation(internal.calendar.mutations.upsertSyncedEventsForUser, {
				userId,
				events: [
					{
						googleEventId: "sync-busy-1",
						title: "Recurring busy",
						start: recurringBusyStart,
						end: recurringBusyStart + 30 * 60 * 1000,
						allDay: false,
						calendarId: "primary",
						recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
						recurringEventId: "series-busy",
						originalStartTime: recurringBusyStart,
						busyStatus: "busy",
						lastSyncedAt: now,
					},
					{
						googleEventId: "sync-free-1",
						title: "Recurring free",
						start: recurringFreeStart,
						end: recurringFreeStart + 30 * 60 * 1000,
						allDay: false,
						calendarId: "primary",
						recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=TU",
						recurringEventId: "series-free",
						originalStartTime: recurringFreeStart,
						busyStatus: "free",
						lastSyncedAt: now,
					},
				],
				deletedEvents: [],
			});

			const input = await testConvex.query(internal.scheduling.queries.getSchedulingInputForUser, {
				userId,
				now,
			});

			expect(input.busy.some((interval) => interval.start === recurringBusyStart)).toBe(true);
			expect(input.busy.some((interval) => interval.start === recurringFreeStart)).toBe(false);
		});
	});

	describe("run execution", () => {
		test("runForUser can complete and apply task placements", async () => {
			const testConvex = createTestConvex();
			const userId = "user-run-complete";
			const user = testConvex.withIdentity({ subject: userId });

			const taskId = await user.action(api.tasks.actions.createTask, {
				requestId: "run-complete-create",
				input: {
					title: "Run completion task",
					estimatedMinutes: 30,
					status: "queued",
				},
			});
			await settleAllActiveRuns(testConvex, user);

			const run = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "manual",
				force: true,
			});
			const result = await testConvex.action(internal.scheduling.actions.runForUser, {
				runId: run.runId,
				userId,
				triggeredBy: "manual",
			});
			expect(result.status).toBe("completed");

			const latest = await latestRun(user);
			expect(latest?._id).toBe(run.runId);
			expect(latest?.status).toBe("completed");

			const tasks = await user.query(api.tasks.queries.listTasks, {});
			const scheduledTask = tasks.find((task) => task._id === (taskId as Id<"tasks">));
			expect(scheduledTask?.scheduledStart).toBeTypeOf("number");
			expect(scheduledTask?.scheduledEnd).toBeTypeOf("number");
		});

		test("runForUser hard infeasible leaves existing schedule unchanged", async () => {
			const testConvex = createTestConvex();
			const userId = "user-hard-infeasible-no-mutation";
			const user = testConvex.withIdentity({ subject: userId });
			const now = Date.now();

			const taskId = await seedScheduledTaskBlock(testConvex, user, userId, {
				taskRequestId: "hard-infeasible-seed-task",
				taskTitle: "Seeded scheduled task",
				start: now + HOUR_MS,
				end: now + 90 * 60 * 1000,
			});
			await settleAllActiveRuns(testConvex, user);

			const hoursSets = await user.query(api.hours.queries.listHoursSets, {});
			const defaultSet = hoursSets.find((set) => set.isDefault);
			expect(defaultSet?._id).toBeDefined();
			await user.mutation(api.hours.mutations.updateHoursSet, {
				id: ensureDefined(defaultSet?._id, "defaultHoursSetId"),
				input: {
					windows: [{ day: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 15 }],
				},
			});
			await settleAllActiveRuns(testConvex, user);

			await user.mutation(api.tasks.mutations.updateTask, {
				id: taskId,
				patch: {
					estimatedMinutes: 180,
					status: "queued",
				},
			});
			await settleAllActiveRuns(testConvex, user);

			const beforeEvents = await user.query(api.calendar.queries.listEvents, {
				start: now,
				end: now + 6 * HOUR_MS,
			});
			const seededBefore = beforeEvents.find(
				(event) => event.source === "task" && event.sourceId === String(taskId),
			);
			expect(seededBefore).toBeDefined();

			const run = await testConvex.mutation(internal.scheduling.mutations.enqueueSchedulingRun, {
				userId,
				triggeredBy: "manual",
				force: true,
			});
			const result = await testConvex.action(internal.scheduling.actions.runForUser, {
				runId: run.runId,
				userId,
				triggeredBy: "manual",
			});
			expect(result.status).toBe("failed");
			expect(result.reasonCode).toBe("INFEASIBLE_HARD");

			const afterEvents = await user.query(api.calendar.queries.listEvents, {
				start: now,
				end: now + 6 * HOUR_MS,
			});
			const seededAfter = afterEvents.find(
				(event) => event.source === "task" && event.sourceId === String(taskId),
			);
			expect(seededAfter).toBeDefined();
			expect(seededAfter?.start).toBe(seededBefore?.start);
			expect(seededAfter?.end).toBe(seededBefore?.end);
		});
	});
});
