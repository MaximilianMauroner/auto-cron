"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
	AsidePanel,
	AsidePanelContent,
	AsidePanelProvider,
	AsidePanelTrigger,
	EventDetailProvider,
} from "@/components/aside-panel";
import { FeedbackButton } from "@/components/feedback-floating-button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type { Layout, PanelImperativeHandle, PanelSize } from "react-resizable-panels";

const PANEL_SIZES_COOKIE = "panel_sizes";
const PANEL_SIZES_MAX_AGE = 60 * 60 * 24 * 365;

function LayoutHeader() {
	return (
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
					<EventDetailProvider>
						<main className="flex-1 min-h-0 overflow-hidden bg-background flex flex-col">
							<LayoutHeader />
							<div className="flex flex-1 min-h-0 overflow-hidden">
								<div className="flex-1 min-w-0 overflow-hidden">{children}</div>
								<AsidePanel>
									<AsidePanelContent />
								</AsidePanel>
							</div>
						</main>
					</EventDetailProvider>
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
				<EventDetailProvider>
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
							minSize="180px"
							maxSize="25%"
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
				</EventDetailProvider>
			</AsidePanelProvider>
		</SidebarProvider>
	);
}
