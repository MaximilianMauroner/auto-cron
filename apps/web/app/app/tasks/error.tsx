"use client";

import { SegmentErrorBoundary } from "@/components/errors/segment-error-boundary";

export default function TasksError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<SegmentErrorBoundary
			error={error}
			reset={reset}
			title="Tasks failed to load"
			fallbackMessage="Something went wrong while loading your tasks."
		/>
	);
}
