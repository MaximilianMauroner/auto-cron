import { FeedbackFloatingButton } from "@/components/feedback-floating-button";
import { ToastProvider } from "@/components/ui/toast-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getConvexUrl } from "@/env/server";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AutumnProvider } from "./AutumnProvider";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
	metadataBase: new URL(
		process.env.VERCEL_PROJECT_PRODUCTION_URL
			? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
			: "http://localhost:3000",
	),
	title: "Auto Cron",
	description: "Intelligent auto-scheduling for tasks, habits, and calendar events",
	icons: {
		icon: [
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/logo.png", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
		shortcut: ["/favicon.png"],
	},
	openGraph: {
		title: "Auto Cron",
		description: "Intelligent auto-scheduling for tasks, habits, and calendar events",
		images: [{ url: "/logo.png", width: 540, height: 546, alt: "Auto Cron logo" }],
	},
	twitter: {
		card: "summary",
		title: "Auto Cron",
		description: "Intelligent auto-scheduling for tasks, habits, and calendar events",
		images: ["/logo.png"],
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	const convexUrl = getConvexUrl();

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
							<ToastProvider>
								<TooltipProvider>
									{children}
									<FeedbackFloatingButton />
								</TooltipProvider>
							</ToastProvider>
						</AutumnProvider>
					</ConvexClientProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
