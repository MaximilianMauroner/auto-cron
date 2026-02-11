"use client";

import { AutumnProvider as BaseAutumnProvider } from "autumn-js/react";
import type { ReactNode } from "react";

function normalizeBaseUrl(url: string) {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveBackendUrl() {
	const explicitUrl =
		process.env.NEXT_PUBLIC_AUTUMN_BACKEND_URL ??
		process.env.NEXT_PUBLIC_APP_URL ??
		process.env.NEXT_PUBLIC_SITE_URL;

	if (explicitUrl) return normalizeBaseUrl(explicitUrl);

	if (typeof window !== "undefined") return window.location.origin;

	const vercelUrl = process.env.VERCEL_URL;
	if (vercelUrl) return `https://${vercelUrl}`;

	return "http://localhost:3000";
}

export function AutumnProvider({ children }: { children: ReactNode }) {
	return (
		<BaseAutumnProvider backendUrl={resolveBackendUrl()} suppressLogs>
			{children}
		</BaseAutumnProvider>
	);
}
