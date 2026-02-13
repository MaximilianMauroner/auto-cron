import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle2 } from "lucide-react";

export default function AccountSettingsPage() {
	return (
		<Card className="border-border/70 bg-card/70">
			<CardHeader>
				<CardDescription className="text-xs uppercase tracking-[0.14em]">Account</CardDescription>
				<CardTitle className="flex items-center gap-2 text-xl">
					<UserCircle2 className="size-4 text-primary" />
					Account Settings
				</CardTitle>
			</CardHeader>
			<CardContent className="text-sm text-muted-foreground">
				Account-specific controls live here. Profile and identity options can be expanded in this
				section without mixing them into hours or scheduling pages.
			</CardContent>
		</Card>
	);
}
