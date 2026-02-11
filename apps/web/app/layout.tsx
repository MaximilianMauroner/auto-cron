import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AutumnProvider } from "./AutumnProvider";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
	title: "Auto Cron",
	description: "Intelligent auto-scheduling for tasks, habits, and calendar events",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;

	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<ConvexClientProvider convexUrl={convexUrl}>
						<AutumnProvider>
							<TooltipProvider>{children}</TooltipProvider>
						</AutumnProvider>
					</ConvexClientProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
