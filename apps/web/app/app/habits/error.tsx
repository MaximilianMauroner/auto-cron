"use client";

import { SegmentErrorBoundary } from "@/components/errors/segment-error-boundary";

export default function HabitsError({
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
			title="Habits failed to load"
			fallbackMessage="Something went wrong while loading your habits."
		/>
	);
}
