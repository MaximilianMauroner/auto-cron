"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../../../convex/_generated/api";

type ChangeLogTarget = {
	entityType: "task" | "habit" | "event" | "occurrence";
	entityId: string;
	title?: string;
};

type ChangeLogEntry = {
	_id: string;
	action: string;
	scope?: "single" | "following" | "series";
	timestamp: number;
	metadata?: {
		changedFields?: string[];
		[key: string]: unknown;
	};
};

type PageResult = {
	items: ChangeLogEntry[];
	nextCursor?: number;
	hasMore: boolean;
	totalLoaded: number;
};

const formatTimestamp = (timestamp: number) =>
	new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(timestamp));

const humanizeAction = (action: string) =>
	action.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function ChangeLogDialog({
	open,
	onOpenChange,
	target,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	target: ChangeLogTarget | null;
}) {
	const [cursor, setCursor] = useState<number | undefined>(undefined);
	const [items, setItems] = useState<ChangeLogEntry[]>([]);
	const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
	const [hasMore, setHasMore] = useState(false);
	const requestKeyRef = useRef("");
	const identity = target ? `${target.entityType}:${target.entityId}` : "__none__";

	useEffect(() => {
		setCursor(undefined);
		setItems([]);
		setNextCursor(undefined);
		setHasMore(false);
		requestKeyRef.current = `${identity}:${open ? "open" : "closed"}`;
	}, [identity, open]);

	const pageQuery = useAuthenticatedQueryWithStatus(
		api.calendar.queries.listEntityChangeLogPage,
		open && target
			? {
					entityType: target.entityType,
					entityId: target.entityId,
					cursor,
					limit: 10,
				}
			: "skip",
	);
	const requestKey = `${identity}:${cursor ?? "initial"}`;

	useEffect(() => {
		const page = pageQuery.data as PageResult | undefined;
		if (!page) return;
		if (requestKeyRef.current === requestKey) return;
		requestKeyRef.current = requestKey;
		setItems((prev) => (cursor === undefined ? page.items : [...prev, ...page.items]));
		setHasMore(page.hasMore);
		setNextCursor(page.nextCursor);
	}, [cursor, pageQuery.data, requestKey]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						Change log
						{target?.title ? (
							<span className="ml-2 text-sm font-normal text-muted-foreground">{target.title}</span>
						) : null}
					</DialogTitle>
				</DialogHeader>
				<div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
					{pageQuery.isPending && items.length === 0 ? (
						<div className="text-sm text-muted-foreground">Loading change log...</div>
					) : items.length === 0 ? (
						<div className="text-sm text-muted-foreground">No changes recorded yet.</div>
					) : (
						items.map((entry) => (
							<div key={entry._id} className="rounded-lg border border-border/60 bg-card/60 p-3">
								<div className="flex items-start justify-between gap-2">
									<p className="text-sm font-medium">{humanizeAction(entry.action)}</p>
									{entry.scope ? (
										<Badge variant="outline" className="text-[0.62rem]">
											{entry.scope}
										</Badge>
									) : null}
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									{formatTimestamp(entry.timestamp)}
								</p>
								{entry.metadata?.changedFields?.length ? (
									<p className="mt-2 text-xs text-muted-foreground">
										Fields: {entry.metadata.changedFields.join(", ")}
									</p>
								) : null}
							</div>
						))
					)}
				</div>
				{hasMore ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							if (nextCursor === undefined) return;
							setCursor(nextCursor);
						}}
						className="w-full"
					>
						Load more
					</Button>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
