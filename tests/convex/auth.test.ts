import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { requireAuth } from "../../convex/auth";
import { createTestConvex } from "./_setup";

const extractErrorCode = (error: unknown): string | undefined => {
	if (!error || typeof error !== "object") return undefined;
	const maybeData = (error as Record<string, unknown>).data;
	if (!maybeData) return undefined;
	if (typeof maybeData === "string") {
		try {
			const parsed = JSON.parse(maybeData) as { code?: string };
			return parsed.code;
		} catch {
			return undefined;
		}
	}
	if (typeof maybeData === "object") {
		return (maybeData as { code?: string }).code;
	}
	return undefined;
};

const expectUnauthorized = async (promise: Promise<unknown>) => {
	await expect(promise).rejects.toSatisfy((error: unknown) => {
		return extractErrorCode(error) === "UNAUTHORIZED";
	});
};

describe("auth hardening", () => {
	test("requireAuth throws a structured unauthorized error without identity", async () => {
		await expectUnauthorized(
			requireAuth({
				auth: {
					getUserIdentity: async () => null,
				} as never,
			}),
		);
	});

	test("requireAuth returns the subject with a valid identity", async () => {
		await expect(
			requireAuth({
				auth: {
					getUserIdentity: async () =>
						({
							subject: "user_auth_test",
						}) as never,
				} as never,
			}),
		).resolves.toBe("user_auth_test");
	});

	test("public calendar query and mutation reject unauthenticated calls", async () => {
		const testConvex = createTestConvex();
		await expectUnauthorized(
			testConvex.query(api.calendar.queries.listEvents, {
				start: Date.now() - 1000 * 60 * 60,
				end: Date.now() + 1000 * 60 * 60,
			}),
		);
		await expectUnauthorized(
			testConvex.mutation(api.calendar.mutations.createEvent, {
				input: {
					title: "Unauthorized event",
					start: Date.now(),
					end: Date.now() + 1000 * 60 * 30,
				},
			}),
		);
	});

	test("listEvents only returns events scoped to the authenticated user", async () => {
		const testConvex = createTestConvex();
		const userA = testConvex.withIdentity({ subject: "user_A" });
		const userB = testConvex.withIdentity({ subject: "user_B" });
		const now = Date.now();
		const windowStart = now - 1000 * 60 * 60;
		const windowEnd = now + 1000 * 60 * 60 * 2;

		await userA.mutation(api.calendar.mutations.createEvent, {
			input: {
				title: "User A event",
				start: now,
				end: now + 1000 * 60 * 30,
			},
		});
		await userB.mutation(api.calendar.mutations.createEvent, {
			input: {
				title: "User B event",
				start: now + 1000 * 60 * 5,
				end: now + 1000 * 60 * 35,
			},
		});

		const userAEvents = await userA.query(api.calendar.queries.listEvents, {
			start: windowStart,
			end: windowEnd,
		});
		expect(userAEvents.length).toBe(1);
		expect(userAEvents[0]?.title).toBe("User A event");
		expect(userAEvents.every((event) => event.userId === "user_A")).toBe(true);
	});

	test("removed public upsertSyncedEvents mutation cannot be called", async () => {
		const testConvex = createTestConvex();
		const user = testConvex.withIdentity({ subject: "user_removed_public_mutation" });
		const removedMutationRef = makeFunctionReference<
			"mutation",
			{
				resetCalendars?: string[];
				events: Array<{
					googleEventId: string;
					title: string;
					start: number;
					end: number;
					allDay: boolean;
					calendarId: string;
					busyStatus: "free" | "busy" | "tentative";
					lastSyncedAt: number;
				}>;
			},
			{ upserted: number }
		>("calendar/mutations:upsertSyncedEvents");

		await expect(
			user.mutation(removedMutationRef, {
				events: [],
			}),
		).rejects.toMatchObject({
			message: expect.stringMatching(/not found|does not exist|unknown function|no such export/i),
		});
	});
});
