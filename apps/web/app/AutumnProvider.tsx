"use client";

import { AutumnProvider as BaseAutumnProvider } from "autumn-js/react";
import type { ReactNode } from "react";

export function AutumnProvider({ children }: { children: ReactNode }) {
	return <BaseAutumnProvider>{children}</BaseAutumnProvider>;
}
