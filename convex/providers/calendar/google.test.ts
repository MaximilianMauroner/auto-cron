import { afterEach, describe, expect, test, vi } from "vitest";
import { googleCalendarProvider } from "./google";

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});

describe("google calendar provider watch channels", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("watchEvents starts a webhook channel and parses expiration", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					access_token: "token",
					expires_in: 3600,
					token_type: "Bearer",
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					id: "channel-123",
					resourceId: "resource-123",
					resourceUri: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
					expiration: "1893456000000",
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = await googleCalendarProvider.watchEvents({
			refreshToken: "refresh-token",
			calendarId: "primary",
			address: "https://example.com/google/calendar/webhook",
			channelId: "channel-123",
			channelToken: "channel-token",
			ttlSeconds: 3600,
		});

		expect(result.channelId).toBe("channel-123");
		expect(result.resourceId).toBe("resource-123");
		expect(result.expirationAt).toBe(1893456000000);

		const watchCall = fetchMock.mock.calls[1];
		expect(watchCall?.[0]).toContain("/calendars/primary/events/watch");
		const init = watchCall?.[1] as RequestInit;
		const payload = JSON.parse(String(init.body)) as {
			type: string;
			address: string;
			token: string;
			params?: { ttl?: string };
		};
		expect(payload.type).toBe("web_hook");
		expect(payload.address).toBe("https://example.com/google/calendar/webhook");
		expect(payload.token).toBe("channel-token");
		expect(payload.params?.ttl).toBe("3600");
	});

	test("stopWatchChannel calls Google channels.stop endpoint", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					access_token: "token",
					expires_in: 3600,
					token_type: "Bearer",
				}),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await googleCalendarProvider.stopWatchChannel({
			refreshToken: "refresh-token",
			channelId: "channel-9",
			resourceId: "resource-9",
		});

		const stopCall = fetchMock.mock.calls[1];
		expect(stopCall?.[0]).toContain("/channels/stop");
		const init = stopCall?.[1] as RequestInit;
		const payload = JSON.parse(String(init.body)) as {
			id: string;
			resourceId: string;
		};
		expect(payload.id).toBe("channel-9");
		expect(payload.resourceId).toBe("resource-9");
	});
});
