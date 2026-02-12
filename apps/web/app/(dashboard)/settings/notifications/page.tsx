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
			<CardContent className="text-sm text-muted-foreground">
				Notification and reminder delivery preferences can be configured here as this section grows.
			</CardContent>
		</Card>
	);
}
