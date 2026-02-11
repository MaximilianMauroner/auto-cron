import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { user } = await withAuth();
	if (!user) {
		redirect("/sign-in");
	}

	return (
		<SidebarProvider className="!h-svh !min-h-0">
			<AppSidebar />
			<main className="flex-1 min-h-0 overflow-hidden bg-background">{children}</main>
		</SidebarProvider>
	);
}
