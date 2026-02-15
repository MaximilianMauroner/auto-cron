"use client";

import { SegmentErrorBoundary } from "@/components/errors/segment-error-boundary";

export default function CalendarError({
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
			title="Calendar failed to load"
			fallbackMessage="Something went wrong while loading your calendar."
		/>
	);
}
