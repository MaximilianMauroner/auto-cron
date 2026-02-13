import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Bell } from "lucide-react";

export default function NotificationSettingsPage() {
	return (
		<>
			<SettingsSectionHeader
				sectionNumber="05"
				sectionLabel="Notifications"
				title="Notification Settings"
				description="Configure how and when you receive reminders and alerts."
			/>
			<div className="rounded-xl border border-border/60 bg-card/60 p-6 text-center">
				<Bell className="mx-auto mb-3 size-8 text-muted-foreground/30" />
				<p className="text-sm font-medium text-muted-foreground">Coming soon</p>
				<p className="mt-1 mx-auto max-w-sm text-xs text-muted-foreground/60">
					Notification and reminder delivery preferences will be configurable here as this section
					grows.
				</p>
			</div>
		</>
	);
}
