import { afterEach, beforeEach, describe, expect, test } from "vitest";
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

const ORIGINAL_INTERNAL_ADMIN_USER_IDS = process.env.INTERNAL_ADMIN_USER_IDS;

describe("hardening contracts", () => {
	beforeEach(() => {
		process.env.INTERNAL_ADMIN_USER_IDS = "";
	});

	afterEach(() => {
		process.env.INTERNAL_ADMIN_USER_IDS = ORIGINAL_INTERNAL_ADMIN_USER_IDS;
	});

	test("categories queries require authentication", async () => {
		const testConvex = createTestConvex();
		await expectErrorCode(
			testConvex.query(api.categories.queries.getDefaultCategory, {}),
			"UNAUTHORIZED",
		);
	});

	test("seedDevTasks is restricted to internal admin allowlist", async () => {
		const testConvex = createTestConvex();
		const unauthorizedUser = testConvex.withIdentity({ subject: "user_regular" });
		await expectErrorCode(
			unauthorizedUser.mutation(api.tasks.mutations.seedDevTasks, { count: 2 }),
			"UNAUTHORIZED",
		);

		process.env.INTERNAL_ADMIN_USER_IDS = "user_internal_admin";
		await testConvex.mutation(internal.hours.mutations.internalBootstrapHoursSetsForUser, {
			userId: "user_internal_admin",
		});
		const adminUser = testConvex.withIdentity({ subject: "user_internal_admin" });
		const result = await adminUser.mutation(api.tasks.mutations.seedDevTasks, { count: 2 });
		expect(result.created).toBe(2);
	});

	test("anonymous feedback is rate limited per fingerprint", async () => {
		const testConvex = createTestConvex();
		const args = {
			category: "idea" as const,
			subject: "Feedback",
			message: "This is valid feedback",
			fingerprint: "anon-fingerprint-12345",
			page: "https://example.test/app/tasks",
			timezone: "Europe/Vienna",
			userAgent: "vitest",
		};

		await testConvex.mutation(api["feedback/mutations"].createFeedback, args);
		await testConvex.mutation(api["feedback/mutations"].createFeedback, args);
		await testConvex.mutation(api["feedback/mutations"].createFeedback, args);
		await expectErrorCode(
			testConvex.mutation(api["feedback/mutations"].createFeedback, args),
			"RATE_LIMITED",
		);
	});
});
