import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.test.ts", "!./**/*.d.ts"]);
const createTestConvex = () => convexTest(schema, modules);

type ErrorWithData = {
	data?: unknown;
};

const extractErrorCode = (error: unknown): string | undefined => {
	if (!error || typeof error !== "object") return undefined;
	const data = (error as ErrorWithData).data;
	if (typeof data === "string") {
		try {
			const parsed = JSON.parse(data) as { code?: string };
			return parsed.code;
		} catch {
			return undefined;
		}
	}
	if (data && typeof data === "object") {
		return (data as { code?: string }).code;
	}
	return undefined;
};

const expectErrorCode = async (promise: Promise<unknown>, code: string) => {
	await expect(promise).rejects.toSatisfy((error: unknown) => extractErrorCode(error) === code);
};

const setBillingMode = (
	mode: "live" | "allow_all" | "deny_tasks" | "deny_habits" | "track_fail",
) => {
	process.env.AUTUMN_BILLING_MODE = mode;
};

describe("tasks/habits billing checks", () => {
	beforeEach(() => {
		setBillingMode("allow_all");
	});

	test("unauthenticated task and habit creates are rejected", async () => {
		const testConvex = createTestConvex();

		await expectErrorCode(
			testConvex.action(api.tasks.actions.createTask, {
				requestId: "req-task-unauth",
				input: {
					title: "Blocked task",
					estimatedMinutes: 30,
				},
			}),
			"UNAUTHORIZED",
		);

		await expectErrorCode(
			testConvex.action(api.habits.actions.createHabit, {
				requestId: "req-habit-unauth",
				input: {
					title: "Blocked habit",
					// biome-ignore lint/suspicious/noExplicitAny: placeholder until tests use real category IDs
					categoryId: "placeholder_category_id" as any,
					frequency: "daily",
					durationMinutes: 20,
				},
			}),
			"UNAUTHORIZED",
		);
	});

	test("over-limit create returns FEATURE_LIMIT_REACHED with no insert", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "user_limit" });

		setBillingMode("deny_tasks");
		await expectErrorCode(
			user.action(api.tasks.actions.createTask, {
				requestId: "deny-task",
				input: {
					title: "Denied task",
					estimatedMinutes: 25,
				},
			}),
			"FEATURE_LIMIT_REACHED",
		);
		expect(await user.query(api.tasks.queries.listTasks, {})).toHaveLength(0);

		setBillingMode("deny_habits");
		await expectErrorCode(
			user.action(api.habits.actions.createHabit, {
				requestId: "deny-habit",
				input: {
					title: "Denied habit",
					// biome-ignore lint/suspicious/noExplicitAny: placeholder until tests use real category IDs
					categoryId: "placeholder_category_id" as any,
					frequency: "weekly",
					durationMinutes: 45,
				},
			}),
			"FEATURE_LIMIT_REACHED",
		);
		expect(await user.query(api.habits.queries.listHabits, {})).toHaveLength(0);
	});

	test("successful create is idempotent per requestId and commits reservation", async () => {
		const testConvex = createTestConvex();
		const userId = "user_idempotent";
		const user = testConvex.withIdentity({ subject: userId });
		const requestId = "task-op-1";

		setBillingMode("allow_all");
		const firstTaskId = await user.action(api.tasks.actions.createTask, {
			requestId,
			input: {
				title: "Idempotent task",
				estimatedMinutes: 30,
			},
		});
		const secondTaskId = await user.action(api.tasks.actions.createTask, {
			requestId,
			input: {
				title: "Idempotent task duplicate call",
				estimatedMinutes: 30,
			},
		});

		expect(secondTaskId).toBe(firstTaskId);
		const tasks = await user.query(api.tasks.queries.listTasks, {});
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?._id).toBe(firstTaskId);

		const reservation = await user.query(internal.billing.internalGetReservationByOperationKey, {
			operationKey: `tasks:${userId}:${requestId}`,
		});
		expect(reservation?.status).toBe("committed");
		expect(reservation?.entityId).toBe(String(firstTaskId));
	});

	test("track failure compensates by deleting inserted task", async () => {
		const testConvex = createTestConvex();
		const userId = "user_track_failure";
		const user = testConvex.withIdentity({ subject: userId });
		const requestId = "track-fail-task";

		setBillingMode("track_fail");
		await expectErrorCode(
			user.action(api.tasks.actions.createTask, {
				requestId,
				input: {
					title: "Rollback task",
					estimatedMinutes: 20,
				},
			}),
			"BILLING_TRACK_FAILED",
		);

		expect(await user.query(api.tasks.queries.listTasks, {})).toHaveLength(0);
		const reservation = await user.query(internal.billing.internalGetReservationByOperationKey, {
			operationKey: `tasks:${userId}:${requestId}`,
		});
		expect(["rolled_back", "rollback_failed"]).toContain(reservation?.status);
	});

	test("task and habit update/delete paths are not billing-gated", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "user_ungated_updates" });

		setBillingMode("allow_all");
		const taskId = await user.action(api.tasks.actions.createTask, {
			requestId: "seed-task",
			input: {
				title: "Task to update",
				estimatedMinutes: 35,
			},
		});
		const habitId = await user.action(api.habits.actions.createHabit, {
			requestId: "seed-habit",
			input: {
				title: "Habit to update",
				// biome-ignore lint/suspicious/noExplicitAny: placeholder until tests use real category IDs
				categoryId: "placeholder_category_id" as any,
				frequency: "daily",
				durationMinutes: 15,
			},
		});

		setBillingMode("deny_tasks");
		await expect(
			user.mutation(api.tasks.mutations.updateTask, {
				id: taskId,
				patch: { title: "Updated while deny_tasks" },
			}),
		).resolves.toBe(taskId);
		await expect(user.mutation(api.tasks.mutations.deleteTask, { id: taskId })).resolves.toBeNull();
		expect(await user.query(api.tasks.queries.listTasks, {})).toHaveLength(0);

		setBillingMode("deny_habits");
		await expect(
			user.mutation(api.habits.mutations.updateHabit, {
				id: habitId,
				patch: { title: "Updated while deny_habits" },
			}),
		).resolves.toBe(habitId);
		await expect(
			user.mutation(api.habits.mutations.toggleHabitActive, {
				id: habitId,
				isActive: false,
			}),
		).resolves.toBe(habitId);
		await expect(
			user.mutation(api.habits.mutations.deleteHabit, { id: habitId }),
		).resolves.toBeNull();
		expect(await user.query(api.habits.queries.listHabits, {})).toHaveLength(0);
	});

	test("calendar scheduling endpoints remain ungated", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "user_calendar_ungated" });
		const now = Date.now();

		setBillingMode("deny_tasks");
		await expect(
			user.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Ungated calendar event",
					start: now,
					end: now + 30 * 60 * 1000,
				},
			}),
		).resolves.toBeDefined();

		const events = await user.query(api.calendar.queries.listEvents, {
			start: now - 60 * 60 * 1000,
			end: now + 60 * 60 * 1000,
		});
		expect(events.some((event) => event.title === "Ungated calendar event")).toBe(true);
	});

	test("optional task and habit fields can be cleared on update", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "user_clear_optional_fields" });
		const now = Date.now();

		setBillingMode("allow_all");
		const taskId = await user.action(api.tasks.actions.createTask, {
			requestId: "clear-task-fields",
			input: {
				title: "Task with optional fields",
				estimatedMinutes: 30,
				deadline: now + 60 * 60 * 1000,
				scheduleAfter: now,
				splitAllowed: true,
				minChunkMinutes: 15,
				maxChunkMinutes: 60,
				preferredCalendarId: "primary",
			},
		});

		await user.mutation(api.tasks.mutations.updateTask, {
			id: taskId,
			patch: {
				deadline: null,
				scheduleAfter: null,
				minChunkMinutes: null,
				maxChunkMinutes: null,
				preferredCalendarId: null,
			},
		});

		const task = (await user.query(api.tasks.queries.listTasks, {})).find(
			(item) => item._id === taskId,
		);
		expect(task?.deadline).toBeUndefined();
		expect(task?.scheduleAfter).toBeUndefined();
		expect(task?.minChunkMinutes).toBeUndefined();
		expect(task?.maxChunkMinutes).toBeUndefined();
		expect(task?.preferredCalendarId).toBeUndefined();

		const habitId = await user.action(api.habits.actions.createHabit, {
			requestId: "clear-habit-fields",
			input: {
				title: "Habit with optional fields",
				// biome-ignore lint/suspicious/noExplicitAny: placeholder until tests use real category IDs
				categoryId: "placeholder_category_id" as any,
				frequency: "weekly",
				durationMinutes: 45,
				location: "Gym",
				startDate: now,
				endDate: now + 7 * 24 * 60 * 60 * 1000,
				reminderMode: "custom",
				customReminderMinutes: 10,
				preferredCalendarId: "primary",
			},
		});

		await user.mutation(api.habits.mutations.updateHabit, {
			id: habitId,
			patch: {
				location: null,
				startDate: null,
				endDate: null,
				customReminderMinutes: null,
				preferredCalendarId: null,
			},
		});

		const habit = (await user.query(api.habits.queries.listHabits, {})).find(
			(item) => item._id === habitId,
		);
		expect(habit?.location).toBeUndefined();
		expect(habit?.startDate).toBeUndefined();
		expect(habit?.endDate).toBeUndefined();
		expect(habit?.customReminderMinutes).toBeUndefined();
		expect(habit?.preferredCalendarId).toBeUndefined();
	});
});
