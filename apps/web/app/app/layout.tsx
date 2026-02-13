import { AppSidebar } from "@/components/app-sidebar";
import {
	AsidePanel,
	AsidePanelContent,
	AsidePanelProvider,
	AsidePanelTrigger,
} from "@/components/aside-panel";
import { FeedbackButton } from "@/components/feedback-floating-button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { user } = await withAuth();
	if (!user) {
		redirect("/sign-in");
	}

	const cookieStore = await cookies();
	const asidePanelOpen = cookieStore.get("aside_panel_state")?.value !== "false";

	return (
		<SidebarProvider className="h-screen! min-h-0!">
			<AppSidebar />
			<AsidePanelProvider defaultOpen={asidePanelOpen}>
				<main className="flex-1 min-h-0 overflow-hidden bg-background flex flex-col">
					<header
						className="flex items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-sm px-2 py-1 shrink-0"
						aria-label="Sidebar and panel controls"
					>
						<div className="flex items-center gap-2">
							<SidebarTrigger />
							<div className="h-4 w-px bg-border/60" />
							<Image
								src="/logo.png"
								alt="Auto Cron"
								width={18}
								height={18}
								className="size-[18px] rounded-sm"
							/>
							<span className="font-[family-name:var(--font-outfit)] text-[0.8rem] font-semibold tracking-tight text-foreground/80">
								Auto Cron
							</span>
						</div>
						<div className="flex items-center gap-1">
							<FeedbackButton />
							<AsidePanelTrigger />
						</div>
					</header>
					<div className="flex flex-1 min-h-0 overflow-hidden">
						<div className="flex-1 min-w-0 overflow-hidden">{children}</div>
						<AsidePanel>
							<AsidePanelContent />
						</AsidePanel>
					</div>
				</main>
			</AsidePanelProvider>
		</SidebarProvider>
	);
}
