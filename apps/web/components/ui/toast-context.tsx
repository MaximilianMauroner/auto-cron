"use client";

import { Toaster } from "@/components/ui/sonner";
import { type ReactNode, createContext, useCallback, useContext, useMemo } from "react";
import { type ExternalToast, type ToastT, toast } from "sonner";

type ToastMessage = string | ReactNode;

type ToastContextValue = {
	show: (message: ToastMessage, options?: ExternalToast) => string | number;
	success: (message: ToastMessage, options?: ExternalToast) => string | number;
	error: (message: ToastMessage, options?: ExternalToast) => string | number;
	info: (message: ToastMessage, options?: ExternalToast) => string | number;
	warning: (message: ToastMessage, options?: ExternalToast) => string | number;
	loading: (message: ToastMessage, options?: ExternalToast) => string | number;
	promise: (...args: Parameters<typeof toast.promise>) => ReturnType<typeof toast.promise>;
	dismiss: (toastId?: string | number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
	const show = useCallback((message: ToastMessage, options?: ExternalToast) => {
		return toast(message, options);
	}, []);

	const success = useCallback((message: ToastMessage, options?: ExternalToast) => {
		return toast.success(message, options);
	}, []);

	const error = useCallback((message: ToastMessage, options?: ExternalToast) => {
		return toast.error(message, options);
	}, []);

	const info = useCallback((message: ToastMessage, options?: ExternalToast) => {
		return toast.info(message, options);
	}, []);

	const warning = useCallback((message: ToastMessage, options?: ExternalToast) => {
		return toast.warning(message, options);
	}, []);

	const loading = useCallback((message: ToastMessage, options?: ExternalToast) => {
		return toast.loading(message, options);
	}, []);

	const promise = useCallback((...args: Parameters<typeof toast.promise>) => {
		return toast.promise(...args);
	}, []);

	const dismiss = useCallback((toastId?: string | number) => {
		toast.dismiss(toastId);
	}, []);

	const value = useMemo<ToastContextValue>(
		() => ({
			show,
			success,
			error,
			info,
			warning,
			loading,
			promise,
			dismiss,
		}),
		[show, success, error, info, warning, loading, promise, dismiss],
	);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<Toaster richColors closeButton />
		</ToastContext.Provider>
	);
}

export const useToastContext = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToastContext must be used within <ToastProvider />.");
	}
	return context;
};

export type { ExternalToast, ToastT };
