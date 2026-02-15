"use client";

import { SegmentErrorBoundary } from "@/components/errors/segment-error-boundary";

export default function RootError({
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
			title="Unable to load Auto Cron"
			fallbackMessage="An unexpected error occurred while loading this page."
			fullScreen
		/>
	);
}
