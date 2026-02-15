"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
	AsideContentProvider,
	AsidePanel,
	AsidePanelContent,
	AsidePanelProvider,
	AsidePanelTrigger,
} from "@/components/aside-panel";
import { FeedbackButton } from "@/components/feedback-floating-button";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { Layout, PanelImperativeHandle, PanelSize } from "react-resizable-panels";

const PANEL_SIZES_COOKIE = "panel_sizes";
const PANEL_SIZES_MAX_AGE = 60 * 60 * 24 * 365;

const breadcrumbMap: Record<string, { label: string; parent?: { label: string; href: string } }> = {
	"/app/calendar": { label: "Calendar" },
	"/app/tasks": { label: "Tasks" },
	"/app/habits": { label: "Habits" },
	"/app/priorities": { label: "Priorities" },
	"/app/settings": { label: "Display", parent: { label: "Settings", href: "/app/settings" } },
	"/app/settings/scheduling": {
		label: "Scheduling",
		parent: { label: "Settings", href: "/app/settings" },
	},
	"/app/settings/hours": {
		label: "Hours",
		parent: { label: "Settings", href: "/app/settings" },
	},
	"/app/settings/categories": {
		label: "Categories",
		parent: { label: "Settings", href: "/app/settings" },
	},
	"/app/settings/calendars": {
		label: "Calendars",
		parent: { label: "Settings", href: "/app/settings" },
	},
	"/app/settings/account": {
		label: "Account",
		parent: { label: "Settings", href: "/app/settings" },
	},
	"/app/settings/notifications": {
		label: "Alerts",
		parent: { label: "Settings", href: "/app/settings" },
	},
	"/app/pricing": { label: "Pricing" },
};

function LayoutHeader() {
	const pathname = usePathname();

	const crumb = breadcrumbMap[pathname];
	const pageLabel = crumb?.label ?? pathname.split("/").pop() ?? "";
	const parent = crumb?.parent;

	return (
		<header
			className="flex items-center justify-between border-b border-border/60 bg-background/80 px-2 py-1 backdrop-blur-sm shrink-0"
			aria-label="Sidebar and panel controls"
		>
			<div className="flex items-center gap-2">
				<SidebarTrigger />
				<div className="h-4 w-px bg-border/60" />
				<Breadcrumb>
					<BreadcrumbList>
						{parent ? (
							<>
								<BreadcrumbItem>
									<BreadcrumbLink asChild>
										<Link
											href={parent.href}
											className="font-(family-name:--font-outfit) text-[0.8rem] font-medium"
										>
											{parent.label}
										</Link>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage className="font-(family-name:--font-outfit) text-[0.8rem] font-medium">
										{pageLabel}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						) : (
							<BreadcrumbItem>
								<BreadcrumbPage className="font-(family-name:--font-outfit) text-[0.8rem] font-semibold">
									{pageLabel}
								</BreadcrumbPage>
							</BreadcrumbItem>
						)}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<div className="flex items-center gap-1">
				<FeedbackButton />
				<AsidePanelTrigger />
			</div>
		</header>
	);
}

export function DashboardShell({
	defaultAsidePanelOpen,
	defaultPanelSizes,
	children,
}: {
	defaultAsidePanelOpen: boolean;
	defaultPanelSizes?: Layout;
	children: React.ReactNode;
}) {
	const isMobile = useIsMobile();
	const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
	const asidePanelRef = useRef<PanelImperativeHandle>(null);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [asideOpen, setAsideOpen] = useState(defaultAsidePanelOpen);

	const handleSidebarOpenChange = useCallback(
		(open: boolean) => {
			setSidebarOpen(open);
			if (!isMobile) {
				if (open) {
					sidebarPanelRef.current?.expand();
				} else {
					sidebarPanelRef.current?.collapse();
				}
			}
		},
		[isMobile],
	);

	const handleAsideOpenChange = useCallback(
		(open: boolean) => {
			setAsideOpen(open);
			if (!isMobile) {
				if (open) {
					asidePanelRef.current?.expand();
				} else {
					asidePanelRef.current?.collapse();
				}
			}
		},
		[isMobile],
	);

	const onLayout = useCallback((layout: Layout) => {
		document.cookie = `${PANEL_SIZES_COOKIE}=${JSON.stringify(layout)}; path=/; max-age=${PANEL_SIZES_MAX_AGE}; SameSite=Lax; Secure`;
	}, []);

	if (isMobile) {
		return (
			<SidebarProvider className="h-screen! min-h-0!">
				<AppSidebar />
				<AsidePanelProvider defaultOpen={defaultAsidePanelOpen}>
					<AsideContentProvider>
						<main className="flex-1 min-h-0 overflow-hidden bg-background flex flex-col">
							<LayoutHeader />
							<div className="flex flex-1 min-h-0 overflow-hidden">
								<div className="flex-1 min-w-0 overflow-hidden">{children}</div>
								<AsidePanel>
									<AsidePanelContent />
								</AsidePanel>
							</div>
						</main>
					</AsideContentProvider>
				</AsidePanelProvider>
			</SidebarProvider>
		);
	}

	return (
		<SidebarProvider
			className="h-screen! min-h-0!"
			open={sidebarOpen}
			onOpenChange={handleSidebarOpenChange}
			resizable
		>
			<AsidePanelProvider
				defaultOpen={defaultAsidePanelOpen}
				open={asideOpen}
				onOpenChange={handleAsideOpenChange}
			>
				<AsideContentProvider>
					<ResizablePanelGroup
						orientation="horizontal"
						defaultLayout={defaultPanelSizes}
						onLayoutChanged={onLayout}
						className="h-screen!"
					>
						<ResizablePanel
							id="sidebar"
							panelRef={sidebarPanelRef}
							defaultSize="16%"
							minSize="200px"
							maxSize="30%"
							collapsible
							onResize={(size: PanelSize) => setSidebarOpen(size.asPercentage > 0)}
						>
							<AppSidebar />
						</ResizablePanel>

						<ResizableHandle withHandle />

						<ResizablePanel id="main" defaultSize="64%" minSize="400px">
							<main className="min-h-0 overflow-hidden bg-background flex flex-col h-full">
								<LayoutHeader />
								<div className="flex-1 min-h-0 overflow-hidden">{children}</div>
							</main>
						</ResizablePanel>

						<ResizableHandle withHandle />

						<ResizablePanel
							id="aside"
							panelRef={asidePanelRef}
							defaultSize="20%"
							minSize="240px"
							maxSize="35%"
							collapsible
							onResize={(size: PanelSize) => setAsideOpen(size.asPercentage > 0)}
						>
							<aside className="h-full border-l border-border/60 bg-card/95 overflow-hidden">
								<div className="flex h-full flex-col overflow-hidden">
									<AsidePanelContent />
								</div>
							</aside>
						</ResizablePanel>
					</ResizablePanelGroup>
				</AsideContentProvider>
			</AsidePanelProvider>
		</SidebarProvider>
	);
}
