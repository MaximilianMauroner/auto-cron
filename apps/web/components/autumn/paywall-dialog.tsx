"use client";

import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { getPaywallContent } from "@/lib/autumn/paywall-content";
import { cn } from "@/lib/utils";
import { useCustomer, usePaywall } from "autumn-js/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export interface PaywallDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	featureId: string;
	entityId?: string;
}

export default function PaywallDialog(params?: PaywallDialogProps) {
	const [isRedirecting, setIsRedirecting] = useState(false);
	const { checkout } = useCustomer({ errorOnNotFound: false });
	const { data: preview } = usePaywall({
		featureId: params?.featureId,
		entityId: params?.entityId,
	});

	if (!params) {
		return <></>;
	}

	const { open, setOpen } = params;
	const { title, message } = getPaywallContent(preview);
	const nextProductId = preview?.products?.[0]?.id;

	const onConfirm = async () => {
		if (isRedirecting) return;
		setIsRedirecting(true);
		try {
			if (nextProductId) {
				await checkout({
					productId: nextProductId,
					successUrl: typeof window !== "undefined" ? window.location.href : undefined,
				});
				return;
			}
			if (typeof window !== "undefined") {
				window.location.assign("/pricing");
			}
		} catch (error) {
			console.error("Autumn checkout redirect failed", error);
			if (typeof window !== "undefined") {
				window.location.assign("/pricing");
			}
		} finally {
			setOpen(false);
			setIsRedirecting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="p-0 pt-4 gap-0 text-foreground overflow-hidden text-sm">
				<DialogTitle className={cn("font-bold text-xl px-6")}>{title}</DialogTitle>
				<div className="px-6 my-2">{message}</div>
				<DialogFooter className="flex flex-col sm:flex-row justify-between gap-x-4 py-2 mt-4 pl-6 pr-3 bg-secondary border-t">
					<Button
						size="sm"
						className="font-medium shadow transition min-w-20"
						onClick={() => void onConfirm()}
						disabled={isRedirecting}
					>
						{isRedirecting ? (
							<span className="inline-flex items-center gap-2">
								<Loader2 className="size-4 animate-spin" />
								Redirecting
							</span>
						) : nextProductId ? (
							"Go to purchase"
						) : (
							"View pricing"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
