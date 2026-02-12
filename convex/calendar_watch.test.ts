import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.test.ts", "!./**/*.d.ts"]);
const createTestConvex = () => convexTest(schema, modules);

const hashToken = (token: string, secret: string) =>
	createHash("sha256").update(`${secret}:${token}`).digest("hex");

describe("google calendar watch + sync queue", () => {
	beforeEach(() => {
		process.env.GOOGLE_CALENDAR_WEBHOOK_URL = "https://example.com/google/calendar/webhook";
		process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET = "watch-test-secret";
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("enqueueGoogleSyncRun dedupes while pending run exists", async () => {
		const testConvex = createTestConvex();
		const first = await testConvex.mutation(internal.calendar.mutations.enqueueGoogleSyncRun, {
			userId: "watch-user-1",
			triggeredBy: "webhook",
		});
		const second = await testConvex.mutation(internal.calendar.mutations.enqueueGoogleSyncRun, {
			userId: "watch-user-1",
			triggeredBy: "webhook",
		});

		expect(first.enqueued).toBe(true);
		expect(second.enqueued).toBe(false);
		expect(second.runId).toBe(first.runId);
	});

	test("webhook ignores unknown channels", async () => {
		const testConvex = createTestConvex();
		const result = await testConvex.action(internal.calendar.actions.handleGoogleCalendarWebhook, {
			channelId: "missing-channel",
			channelToken: "token",
			resourceId: "resource",
			resourceState: "exists",
			messageNumber: 1,
		});

		expect(result.accepted).toBe(true);
		expect(result.enqueued).toBe(false);
		expect(result.reason).toBe("unknown_channel");
	});

	test("webhook validates channel token before enqueueing", async () => {
		const testConvex = createTestConvex();
		const tokenSecret = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET ?? "";

		await testConvex.mutation(internal.calendar.mutations.upsertWatchChannel, {
			userId: "watch-user-2",
			calendarId: "primary",
			channelId: "channel-2",
			resourceId: "resource-2",
			channelTokenHash: hashToken("correct-token", tokenSecret),
			expirationAt: Date.now() + 60_000,
		});

		const result = await testConvex.action(internal.calendar.actions.handleGoogleCalendarWebhook, {
			channelId: "channel-2",
			channelToken: "wrong-token",
			resourceId: "resource-2",
			resourceState: "exists",
			messageNumber: 2,
		});
		expect(result.accepted).toBe(true);
		expect(result.enqueued).toBe(false);
		expect(result.reason).toBe("token_mismatch");
	});

	test("webhook sync handshake updates channel metadata without enqueue", async () => {
		const testConvex = createTestConvex();
		const tokenSecret = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET ?? "";
		await testConvex.mutation(internal.calendar.mutations.upsertWatchChannel, {
			userId: "watch-user-3",
			calendarId: "primary",
			channelId: "channel-3",
			resourceId: "resource-3",
			channelTokenHash: hashToken("token-3", tokenSecret),
			expirationAt: Date.now() + 60_000,
		});

		const result = await testConvex.action(internal.calendar.actions.handleGoogleCalendarWebhook, {
			channelId: "channel-3",
			channelToken: "token-3",
			resourceId: "resource-3",
			resourceState: "sync",
			messageNumber: 9,
		});
		expect(result.accepted).toBe(true);
		expect(result.enqueued).toBe(false);
		expect(result.reason).toBe("sync_handshake");

		const channel = await testConvex.query(internal.calendar.internal.getWatchChannelByChannelId, {
			channelId: "channel-3",
		});
		expect(channel?.lastNotifiedAt).toBeTypeOf("number");
		expect(channel?.lastMessageNumber).toBe(9);
	});

	test("webhook burst enqueues only one pending sync run", async () => {
		const testConvex = createTestConvex();
		const tokenSecret = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET ?? "";
		await testConvex.mutation(internal.calendar.mutations.upsertWatchChannel, {
			userId: "watch-user-4",
			calendarId: "primary",
			channelId: "channel-4",
			resourceId: "resource-4",
			channelTokenHash: hashToken("token-4", tokenSecret),
			expirationAt: Date.now() + 60_000,
		});

		const first = await testConvex.action(internal.calendar.actions.handleGoogleCalendarWebhook, {
			channelId: "channel-4",
			channelToken: "token-4",
			resourceId: "resource-4",
			resourceState: "exists",
			messageNumber: 11,
		});
		const second = await testConvex.action(internal.calendar.actions.handleGoogleCalendarWebhook, {
			channelId: "channel-4",
			channelToken: "token-4",
			resourceId: "resource-4",
			resourceState: "not_exists",
			messageNumber: 12,
		});

		expect(first.enqueued).toBe(true);
		expect(second.enqueued).toBe(false);
		expect(second.reason).toBe("already_pending");
	});

	test("ensureWatchChannelsForUser creates channels for writable calendars", async () => {
		const testConvex = createTestConvex();
		const userId = "watch-user-5";
		const user = testConvex.withIdentity({ subject: userId });
		await user.mutation(api.calendar.mutations.upsertGoogleTokens, {
			refreshToken: "refresh-user-5",
		});

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						access_token: "token-list",
						expires_in: 3600,
						token_type: "Bearer",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								id: "primary",
								summary: "Primary",
								primary: true,
								accessRole: "owner",
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						access_token: "token-watch",
						expires_in: 3600,
						token_type: "Bearer",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "watch-channel-5",
						resourceId: "watch-resource-5",
						resourceUri: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
						expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = await testConvex.action(internal.calendar.actions.ensureWatchChannelsForUser, {
			userId,
		});
		expect(result.configured).toBe(true);
		expect(result.created).toBe(1);

		const channels = await testConvex.query(internal.calendar.internal.listWatchChannelsForUser, {
			userId,
		});
		expect(channels).toHaveLength(1);
		expect(channels[0]?.status).toBe("active");
		expect(channels[0]?.channelId).toBe("watch-channel-5");
	});
});
