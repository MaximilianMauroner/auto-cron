import { httpRouter } from "convex/server";

const http = httpRouter();

// TODO: Add WorkOS webhook callback route
// http.route({
//   path: "/api/webhooks/workos",
//   method: "POST",
//   handler: workosWebhookHandler,
// });

export default http;
