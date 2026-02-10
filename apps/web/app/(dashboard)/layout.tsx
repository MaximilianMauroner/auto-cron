import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	// TODO: Add auth guard — redirect to /sign-in if not authenticated
	return (
		<SidebarProvider>
			<AppSidebar />
			<main className="flex-1 overflow-auto p-6">{children}</main>
		</SidebarProvider>
	);
}
