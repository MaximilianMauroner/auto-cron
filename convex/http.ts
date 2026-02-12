import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authKit } from "./auth";

const http = httpRouter();
authKit.registerRoutes(http);

http.route({
	path: "/google/calendar/webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const rawMessageNumber = request.headers.get("x-goog-message-number");
		const parsedMessageNumber = Number.parseInt(rawMessageNumber ?? "", 10);
		await ctx.runAction(internal.calendar.actions.handleGoogleCalendarWebhook, {
			channelId: request.headers.get("x-goog-channel-id") ?? undefined,
			channelToken: request.headers.get("x-goog-channel-token") ?? undefined,
			resourceId: request.headers.get("x-goog-resource-id") ?? undefined,
			resourceState: request.headers.get("x-goog-resource-state") ?? undefined,
			messageNumber: Number.isFinite(parsedMessageNumber) ? parsedMessageNumber : undefined,
		});
		return new Response(null, { status: 204 });
	}),
});

export default http;
