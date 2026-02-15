"use client";

import { SegmentErrorBoundary } from "@/components/errors/segment-error-boundary";

export default function SettingsError({
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
			title="Settings failed to load"
			fallbackMessage="Something went wrong while loading settings."
		/>
	);
}
