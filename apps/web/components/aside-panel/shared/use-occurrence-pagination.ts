"use client";

import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { useEffect, useMemo, useRef, useState } from "react";

type PageResult<T> = {
	items: T[];
	nextCursor?: number;
	hasMore: boolean;
	totalLoaded: number;
};

export function useOccurrencePagination<T>({
	queryRef,
	args,
	bucket,
	enabled,
}: {
	queryRef: unknown;
	args: Record<string, unknown>;
	bucket: "upcoming" | "past";
	enabled: boolean;
}) {
	const [cursor, setCursor] = useState<number | undefined>(undefined);
	const [items, setItems] = useState<T[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
	const processedKeyRef = useRef<string>("");
	const identity = JSON.stringify({ args, bucket });
	const identityRef = useRef(identity);

	useEffect(() => {
		if (identityRef.current === identity) return;
		identityRef.current = identity;
		setCursor(undefined);
		setItems([]);
		setHasMore(false);
		setNextCursor(undefined);
		processedKeyRef.current = "";
	});

	const queryArgs = useMemo(
		() => ({
			...args,
			bucket,
			cursor,
			limit: 5,
		}),
		[args, bucket, cursor],
	);

	const pageQuery = useAuthenticatedQueryWithStatus(
		queryRef as never,
		enabled ? (queryArgs as never) : "skip",
	);
	const requestKey = `${identity}:${cursor ?? "initial"}`;

	useEffect(() => {
		const page = pageQuery.data as PageResult<T> | undefined;
		if (!page || processedKeyRef.current === requestKey) return;
		processedKeyRef.current = requestKey;
		setItems((prev) => (cursor === undefined ? page.items : [...prev, ...page.items]));
		setHasMore(page.hasMore);
		setNextCursor(page.nextCursor);
	}, [cursor, pageQuery.data, requestKey]);

	return {
		items,
		hasMore,
		isPending: pageQuery.isPending,
		loadMore: () => {
			if (nextCursor === undefined) return;
			setCursor(nextCursor);
		},
	};
}
