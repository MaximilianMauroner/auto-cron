import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		include: ["tests/**/*.test.ts"],
		env: {
			AUTUMN_SECRET_KEY: "test-autumn-secret",
			GOOGLE_CLIENT_ID: "test-google-client-id",
			GOOGLE_CLIENT_SECRET: "test-google-client-secret",
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
