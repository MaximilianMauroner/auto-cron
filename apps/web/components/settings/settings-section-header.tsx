interface SettingsSectionHeaderProps {
	sectionNumber: string;
	sectionLabel: string;
	title: string;
	description: string;
}

export function SettingsSectionHeader({
	sectionNumber,
	sectionLabel,
	title,
	description,
}: SettingsSectionHeaderProps) {
	return (
		<div className="mb-8">
			<p className="font-[family-name:var(--font-cutive)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
				{sectionNumber} / {sectionLabel}
			</p>
			<h1 className="mt-1.5 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
				{title}
			</h1>
			<p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{description}</p>
			<div className="mt-5 h-px bg-border/60" />
		</div>
	);
}
