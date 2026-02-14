import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { createTestConvex } from "./_setup";

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

const bootstrapAndGetDefaultCategoryId = async (
	testConvex: ReturnType<typeof createTestConvex>,
	userId: string,
) => {
	await testConvex.mutation(internal.hours.mutations.internalBootstrapHoursSetsForUser, {
		userId,
	});
	const categoryId = await testConvex.run(async (ctx) => {
		const existing = await ctx.db
			.query("taskCategories")
			.withIndex("by_userId_isDefault", (q) => q.eq("userId", userId).eq("isDefault", true))
			.first();
		if (existing) return existing._id;
		const now = Date.now();
		return ctx.db.insert("taskCategories", {
			userId,
			name: "Personal",
			color: "#f59e0b",
			isSystem: true,
			isDefault: true,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		});
	});
	return categoryId;
};

describe("hours sets", () => {
	beforeEach(() => {
		process.env.AUTUMN_BILLING_MODE = "allow_all";
	});

	test("bootstrap creates Work and Anytime system sets", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "hours_bootstrap_user" });

		const bootstrapResult = await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});
		const hoursSets = await user.query(api.hours.queries.listHoursSets, {});

		expect(hoursSets.length).toBeGreaterThanOrEqual(2);
		expect(hoursSets.some((hoursSet) => hoursSet.name === "Work" && hoursSet.isSystem)).toBe(true);
		expect(
			hoursSets.some((hoursSet) => hoursSet.name === "Anytime (24/7)" && hoursSet.isSystem),
		).toBe(true);
		expect(hoursSets.filter((hoursSet) => hoursSet.isDefault)).toHaveLength(1);
		expect(hoursSets.some((hoursSet) => hoursSet._id === bootstrapResult.defaultHoursSetId)).toBe(
			true,
		);
	});

	test("default planner bootstrap seeds starter tasks and habits idempotently", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "hours_default_seed_user" });

		const firstRun = await user.action(api.hours.actions.bootstrapDefaultPlannerDataForUser, {});
		expect(firstRun.createdTasks).toBeGreaterThan(0);
		expect(firstRun.createdHabits).toBeGreaterThan(0);

		const tasksAfterFirstRun = await user.query(api.tasks.queries.listTasks, {});
		const habitsAfterFirstRun = await user.query(api.habits.queries.listHabits, {});
		expect(tasksAfterFirstRun.length).toBe(firstRun.createdTasks);
		expect(habitsAfterFirstRun.length).toBe(firstRun.createdHabits);
		expect(tasksAfterFirstRun.every((task) => task.hoursSetId === firstRun.defaultHoursSetId)).toBe(
			true,
		);
		expect(
			habitsAfterFirstRun.every((habit) => habit.hoursSetId === firstRun.defaultHoursSetId),
		).toBe(true);

		const secondRun = await user.action(api.hours.actions.bootstrapDefaultPlannerDataForUser, {});
		expect(secondRun.createdTasks).toBe(0);
		expect(secondRun.createdHabits).toBe(0);

		const tasksAfterSecondRun = await user.query(api.tasks.queries.listTasks, {});
		const habitsAfterSecondRun = await user.query(api.habits.queries.listHabits, {});
		expect(tasksAfterSecondRun).toHaveLength(tasksAfterFirstRun.length);
		expect(habitsAfterSecondRun).toHaveLength(habitsAfterFirstRun.length);
	});

	test("hours windows validation rejects overlapping windows", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "hours_invalid_windows" });
		await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});

		await expectErrorCode(
			user.mutation(api.hours.mutations.createHoursSet, {
				input: {
					name: "Overlap test",
					windows: [
						{ day: 1, startMinute: 9 * 60, endMinute: 11 * 60 },
						{ day: 1, startMinute: 10 * 60, endMinute: 12 * 60 },
					],
				},
			}),
			"OVERLAPPING_HOURS_WINDOWS",
		);
	});

	test("deleting non-default set reassigns tasks and habits to default", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "hours_delete_reassign" });
		await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});
		const initialSets = await user.query(api.hours.queries.listHoursSets, {});
		const defaultSet = initialSets.find((hoursSet) => hoursSet.isDefault);
		expect(defaultSet).toBeTruthy();

		const customSetId = await user.mutation(api.hours.mutations.createHoursSet, {
			input: {
				name: "Weekend",
				windows: [
					{ day: 6, startMinute: 16 * 60, endMinute: 20 * 60 },
					{ day: 0, startMinute: 16 * 60, endMinute: 20 * 60 },
				],
			},
		});

		await user.action(api.tasks.actions.createTask, {
			requestId: "hours-delete-task",
			input: {
				title: "Task on custom set",
				estimatedMinutes: 60,
				hoursSetId: customSetId,
			},
		});
		const categoryId = await bootstrapAndGetDefaultCategoryId(testConvex, "hours_delete_reassign");
		await user.action(api.habits.actions.createHabit, {
			requestId: "hours-delete-habit",
			input: {
				title: "Habit on custom set",
				categoryId,
				frequency: "weekly",
				durationMinutes: 45,
				hoursSetId: customSetId,
			},
		});

		await user.mutation(api.hours.mutations.deleteHoursSet, { id: customSetId });

		const tasks = await user.query(api.tasks.queries.listTasks, {});
		const habits = await user.query(api.habits.queries.listHabits, {});
		expect(tasks[0]?.hoursSetId).toBe(defaultSet?._id);
		expect(habits[0]?.hoursSetId).toBe(defaultSet?._id);
	});

	test("task scheduling mode uses default and supports per-task override", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "task_mode_user" });
		await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});

		await user.mutation(api.hours.mutations.setDefaultTaskSchedulingMode, {
			mode: "packed",
		});

		const taskId = await user.action(api.tasks.actions.createTask, {
			requestId: "task-mode-default",
			input: {
				title: "Default mode task",
				estimatedMinutes: 30,
			},
		});

		let tasks = await user.query(api.tasks.queries.listTasks, {});
		expect(tasks[0]?.schedulingMode).toBeUndefined();
		expect(tasks[0]?.effectiveSchedulingMode).toBe("packed");

		await user.mutation(api.tasks.mutations.updateTask, {
			id: taskId,
			patch: {
				schedulingMode: "balanced",
			},
		});

		tasks = await user.query(api.tasks.queries.listTasks, {});
		const updated = tasks.find((task) => task._id === taskId);
		expect(updated?.schedulingMode).toBe("balanced");
		expect(updated?.effectiveSchedulingMode).toBe("balanced");
	});

	test("scheduling downtime defaults to zero and can be updated", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "scheduling_downtime_user" });
		await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});

		const initialDefaults = await user.query(api.hours.queries.getTaskSchedulingDefaults, {});
		expect(initialDefaults.schedulingDowntimeMinutes).toBe(0);

		const updatedDowntime = await user.mutation(api.hours.mutations.setSchedulingDowntimeMinutes, {
			minutes: 30,
		});
		expect(updatedDowntime).toBe(30);

		const updatedDefaults = await user.query(api.hours.queries.getTaskSchedulingDefaults, {});
		expect(updatedDefaults.schedulingDowntimeMinutes).toBe(30);
	});

	test("scheduling step defaults to 15 and can be updated globally", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "scheduling_step_user" });
		await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});

		const initialDefaults = await user.query(api.hours.queries.getTaskSchedulingDefaults, {});
		expect(initialDefaults.schedulingStepMinutes).toBe(15);

		const updatedStep = await user.mutation(api.hours.mutations.setSchedulingStepMinutes, {
			minutes: 30,
		});
		expect(updatedStep).toBe(30);

		const updatedDefaults = await user.query(api.hours.queries.getTaskSchedulingDefaults, {});
		expect(updatedDefaults.schedulingStepMinutes).toBe(30);
	});

	test("system hours sets are not deletable", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "hours_system_delete" });
		await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});
		const hoursSets = await user.query(api.hours.queries.listHoursSets, {});
		const systemSet = hoursSets.find((hoursSet) => hoursSet.isSystem);
		expect(systemSet).toBeTruthy();
		if (!systemSet) throw new Error("Expected system set to exist");

		await expectErrorCode(
			user.mutation(api.hours.mutations.deleteHoursSet, { id: systemSet._id }),
			"SYSTEM_HOURS_SET_NOT_DELETABLE",
		);
	});

	test("system hours sets cannot be renamed", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "hours_system_rename" });
		await user.action(api.hours.actions.bootstrapHoursSetsForUser, {});
		const hoursSets = await user.query(api.hours.queries.listHoursSets, {});
		const systemSet = hoursSets.find((hoursSet) => hoursSet.isSystem && hoursSet.name === "Work");
		expect(systemSet).toBeTruthy();
		if (!systemSet) throw new Error("Expected Work system set to exist");

		await expectErrorCode(
			user.mutation(api.hours.mutations.updateHoursSet, {
				id: systemSet._id,
				input: {
					name: "Custom Work Name",
				},
			}),
			"SYSTEM_HOURS_SET_NAME_IMMUTABLE",
		);
	});
});
