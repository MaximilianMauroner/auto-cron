"use client";

import { clientEnv } from "@/env/client";
import { AutumnProvider as BaseAutumnProvider } from "autumn-js/react";
import type { ReactNode } from "react";

function normalizeBaseUrl(url: string) {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveBackendUrl() {
	const explicitUrl = clientEnv.NEXT_PUBLIC_AUTUMN_BACKEND_URL;

	if (explicitUrl) return normalizeBaseUrl(explicitUrl);

	if (typeof window !== "undefined") return window.location.origin;

	return "http://localhost:3000";
}

export function AutumnProvider({ children }: { children: ReactNode }) {
	return (
		<BaseAutumnProvider backendUrl={resolveBackendUrl()} suppressLogs>
			{children}
		</BaseAutumnProvider>
	);
}
