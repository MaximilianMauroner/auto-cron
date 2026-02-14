"use client";

import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-full min-h-0 overflow-auto">
			{/* Horizontal nav bar */}
			<div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
				<div className="mx-auto max-w-4xl px-4 md:px-6">
					<div className="flex items-center gap-4 py-2">
						<h2 className="hidden shrink-0 font-[family-name:var(--font-bebas)] text-lg uppercase tracking-wide text-foreground/80 sm:block">
							Settings
						</h2>
						<div className="hidden h-5 w-px bg-border/60 sm:block" />
						<SettingsNav />
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">{children}</div>
		</div>
	);
}
