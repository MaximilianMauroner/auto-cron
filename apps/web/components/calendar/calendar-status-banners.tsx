import { AlertTriangle, RefreshCw } from "lucide-react";

type CalendarStatusBannersProps = {
	error: string | null;
	isLoading: boolean;
	visibleEventCount: number;
};

export function CalendarStatusBanners({
	error,
	isLoading,
	visibleEventCount,
}: CalendarStatusBannersProps) {
	if (error) {
		return (
			<div className="mx-4 mt-3 flex items-center gap-2 border border-destructive/30 bg-destructive/10 rounded-xl px-3 py-2 font-[family-name:var(--font-cutive)] text-[0.62rem] uppercase tracking-[0.06em] text-destructive">
				<AlertTriangle className="size-3.5 shrink-0" />
				{error}
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 font-[family-name:var(--font-cutive)] text-[0.62rem] uppercase tracking-[0.06em] text-muted-foreground">
				<RefreshCw className="size-3.5 shrink-0 animate-spin opacity-50" />
				Loading events…
			</div>
		);
	}

	if (visibleEventCount === 0) {
		return (
			<div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/40 px-3 py-2 font-[family-name:var(--font-cutive)] text-[0.62rem] uppercase tracking-[0.06em] text-muted-foreground">
				<RefreshCw className="size-3.5 shrink-0 opacity-50" />
				No events loaded… Click sync to fetch from Google.
			</div>
		);
	}

	return null;
}
