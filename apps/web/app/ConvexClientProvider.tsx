"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
	const convex = useMemo(() => {
		const url = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!url) return null;
		return new ConvexReactClient(url);
	}, []);

	if (!convex) {
		// Render without Convex during build or when env var is missing
		return <>{children}</>;
	}

	// TODO: Replace with ConvexProviderWithAuthKit once WorkOS is configured
	return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
