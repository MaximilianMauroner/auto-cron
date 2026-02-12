import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		include: ["convex/**/*.test.ts"],
		env: {
			WORKOS_CLIENT_ID: "test-client-id",
			WORKOS_API_KEY: "test-api-key",
			WORKOS_WEBHOOK_SECRET: "test-webhook-secret",
		},
	},
	server: {
		deps: {
			inline: ["convex-test"],
		},
	},
});
