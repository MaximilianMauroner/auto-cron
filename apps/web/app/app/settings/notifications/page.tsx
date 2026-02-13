import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function NotificationSettingsPage() {
	return (
		<Card className="border-border/70 bg-card/70">
			<CardHeader>
				<CardDescription className="text-xs uppercase tracking-[0.14em]">
					Notifications
				</CardDescription>
				<CardTitle className="flex items-center gap-2 text-xl">
					<Bell className="size-4 text-primary" />
					Notification Settings
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-xl border border-border/60 bg-card/60 p-6 text-center">
					<Bell className="mx-auto mb-3 size-8 text-muted-foreground/30" />
					<p className="text-sm font-medium text-muted-foreground">Coming soon</p>
					<p className="mt-1 max-w-sm mx-auto text-xs text-muted-foreground/60">
						Notification and reminder delivery preferences will be configurable here as this section
						grows.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
