"use client";

import { Button } from "@/components/ui/button";

type SegmentErrorBoundaryProps = {
	error: Error & { digest?: string };
	reset: () => void;
	title: string;
	fallbackMessage: string;
	fullScreen?: boolean;
};

export function SegmentErrorBoundary({
	error,
	reset,
	title,
	fallbackMessage,
	fullScreen = false,
}: SegmentErrorBoundaryProps) {
	return (
		<div
			className={`flex ${fullScreen ? "min-h-screen" : "h-full min-h-0"} flex-col items-center justify-center gap-4 px-6 text-center`}
		>
			<p className="font-[family-name:var(--font-cutive)] text-xs uppercase tracking-[0.12em] text-muted-foreground">
				Something went wrong
			</p>
			<h1 className="font-[family-name:var(--font-outfit)] text-xl font-semibold">{title}</h1>
			<p className="max-w-md text-sm text-muted-foreground">{error.message || fallbackMessage}</p>
			<Button onClick={reset}>Try again</Button>
		</div>
	);
}
