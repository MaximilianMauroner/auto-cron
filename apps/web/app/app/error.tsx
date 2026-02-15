"use client";

import { SegmentErrorBoundary } from "@/components/errors/segment-error-boundary";

export default function AppShellError({
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
			title="Could not render this view"
			fallbackMessage="An unexpected error occurred while rendering this section."
		/>
	);
}
