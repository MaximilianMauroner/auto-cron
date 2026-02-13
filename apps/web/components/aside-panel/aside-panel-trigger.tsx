"use client";

import { Button } from "@/components/ui/button";
import { PanelRight } from "lucide-react";
import { useAsidePanel } from "./aside-panel-context";

export function AsidePanelTrigger() {
	const { toggle } = useAsidePanel();

	return (
		<Button
			variant="ghost"
			size="icon"
			className="size-7"
			onClick={toggle}
			aria-label="Toggle aside panel"
		>
			<PanelRight className="size-4" />
		</Button>
	);
}
