"use client";

import { AuthKitProvider, useAccessToken, useAuth } from "@workos-inc/authkit-nextjs/components";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { type ReactNode, useCallback, useMemo } from "react";

const useWorkOSAuthForConvex = () => {
	const { user, loading } = useAuth();
	const { getAccessToken, refresh } = useAccessToken();

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			const token = forceRefreshToken ? await refresh() : await getAccessToken();
			return token ?? null;
		},
		[getAccessToken, refresh],
	);

	return {
		isLoading: loading,
		isAuthenticated: Boolean(user),
		fetchAccessToken,
	};
};

export function ConvexClientProvider({
	children,
	convexUrl,
}: {
	children: ReactNode;
	convexUrl?: string;
}) {
	const convex = useMemo(() => {
		const url = convexUrl;
		if (!url) return null;
		return new ConvexReactClient(url);
	}, [convexUrl]);

	if (!convex) {
		return <AuthKitProvider>{children}</AuthKitProvider>;
	}

	return (
		<AuthKitProvider>
			<ConvexProviderWithAuth client={convex} useAuth={useWorkOSAuthForConvex}>
				<ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
			</ConvexProviderWithAuth>
		</AuthKitProvider>
	);
}
