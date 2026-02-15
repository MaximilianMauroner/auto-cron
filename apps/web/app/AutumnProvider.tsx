"use client";

import { clientEnv } from "@/env/client";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { AutumnProvider as BaseAutumnProvider } from "autumn-js/react";
import type { ReactNode } from "react";

function normalizeBaseUrl(url: string) {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveBackendUrl() {
	const explicitUrl = clientEnv.NEXT_PUBLIC_AUTUMN_BACKEND_URL;

	if (explicitUrl) return normalizeBaseUrl(explicitUrl);

	if (clientEnv.NEXT_PUBLIC_APP_URL) return normalizeBaseUrl(clientEnv.NEXT_PUBLIC_APP_URL);

	return normalizeBaseUrl(new URL(clientEnv.NEXT_PUBLIC_WORKOS_REDIRECT_URI).origin);
}

export function AutumnProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const name =
		[user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || undefined;
	const customerData = user?.email
		? {
				name,
				email: user.email,
			}
		: undefined;

	return (
		<BaseAutumnProvider backendUrl={resolveBackendUrl()} customerData={customerData} suppressLogs>
			{children}
		</BaseAutumnProvider>
	);
}
