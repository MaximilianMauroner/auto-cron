import dynamic from "next/dynamic";

const CalendarClient = dynamic(
	() => import("./calendar-client").then((module) => module.CalendarClient),
	{
		loading: () => (
			<div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-border/70 bg-card/70 p-4 font-[family-name:var(--font-cutive)] text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
				Loading calendar…
			</div>
		),
	},
);

export default function CalendarPage() {
	return (
		<div className="h-full min-h-0">
			<CalendarClient initialErrorMessage={null} />
		</div>
	);
}
