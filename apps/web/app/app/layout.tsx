import { DashboardShell } from "@/components/dashboard-shell";
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

	let panelSizes: Record<string, number> | undefined;
	try {
		const raw = cookieStore.get("panel_sizes")?.value;
		if (raw) panelSizes = JSON.parse(raw);
	} catch {
		// ignore
	}

	return (
		<DashboardShell defaultAsidePanelOpen={asidePanelOpen} defaultPanelSizes={panelSizes}>
			{children}
		</DashboardShell>
	);
}
