import { AppSidebar } from "@/components/app-sidebar";
import {
	AsidePanel,
	AsidePanelContent,
	AsidePanelProvider,
	AsidePanelTrigger,
} from "@/components/aside-panel";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
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
						className="flex items-center justify-between border-b border-border px-2 py-1 shrink-0"
						aria-label="Sidebar and panel controls"
					>
						<SidebarTrigger />
						<AsidePanelTrigger />
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
