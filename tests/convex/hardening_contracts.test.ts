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
		const seededUser = testConvex.withIdentity({ subject: "seeded_user_for_auth_test" });
		const seededCategoryId = await seededUser.mutation(api.categories.mutations.createCategory, {
			name: "Auth Test Category",
			color: "#f59e0b",
		});

		await expectErrorCode(
			testConvex.query(api.categories.queries.getDefaultCategory, {}),
			"UNAUTHORIZED",
		);
		await expectErrorCode(
			testConvex.query(api.categories.queries.getCategoryById, {
				categoryId: seededCategoryId,
			}),
			"UNAUTHORIZED",
		);
	});

	test("getCategoryById returns null for non-owned categories", async () => {
		const testConvex = createTestConvex();
		const userA = testConvex.withIdentity({ subject: "user_a" });
		const userB = testConvex.withIdentity({ subject: "user_b" });

		const categoryId = await userA.mutation(api.categories.mutations.createCategory, {
			name: "Personal Projects",
			color: "#f59e0b",
		});

		const owned = await userA.query(api.categories.queries.getCategoryById, {
			categoryId,
		});
		expect(owned?._id).toBe(categoryId);

		const foreign = await userB.query(api.categories.queries.getCategoryById, {
			categoryId,
		});
		expect(foreign).toBeNull();
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

	test("anonymous feedback requires a fingerprint", async () => {
		const testConvex = createTestConvex();
		await expectErrorCode(
			testConvex.mutation(api["feedback/mutations"].createFeedback, {
				category: "bug",
				subject: "No fingerprint",
				message: "Cannot submit anonymously without fingerprint.",
			}),
			"INVALID_FEEDBACK",
		);
	});

	test("feedback enforces message and subject length limits", async () => {
		const testConvex = createTestConvex();
		const longMessage = "x".repeat(2001);
		const longSubject = "y".repeat(121);

		await expectErrorCode(
			testConvex.mutation(api["feedback/mutations"].createFeedback, {
				category: "idea",
				subject: "Too long message",
				message: longMessage,
				fingerprint: "anon-fingerprint-length-check",
			}),
			"INVALID_FEEDBACK",
		);

		await expectErrorCode(
			testConvex.mutation(api["feedback/mutations"].createFeedback, {
				category: "idea",
				subject: longSubject,
				message: "Valid message",
				fingerprint: "anon-fingerprint-length-check-2",
			}),
			"INVALID_FEEDBACK",
		);
	});

	test("authenticated feedback is rate limited per user", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "feedback_user_1" });

		for (let index = 0; index < 3; index += 1) {
			await user.mutation(api["feedback/mutations"].createFeedback, {
				category: "general",
				subject: `Submission ${index + 1}`,
				message: `Valid message ${index + 1}`,
				fingerprint: `ignored-when-authenticated-${index + 1}`,
			});
		}

		await expectErrorCode(
			user.mutation(api["feedback/mutations"].createFeedback, {
				category: "general",
				subject: "Submission 4",
				message: "This one should be rate limited.",
				fingerprint: "ignored-when-authenticated-4",
			}),
			"RATE_LIMITED",
		);
	});
});
