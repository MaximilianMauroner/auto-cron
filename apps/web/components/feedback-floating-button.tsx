"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutationWithStatus } from "@/hooks/use-convex-status";
import type { FunctionReference } from "convex/server";
import { Check, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";

type FeedbackCategory = "bug" | "idea" | "general";

type Position = {
	x: number;
	y: number;
};

const FAB_WIDTH = 136;
const FAB_HEIGHT = 44;
const FAB_MARGIN = 16;
const DRAG_DISTANCE_THRESHOLD = 6;
const STORAGE_KEY = "autocron.feedback.fab.position.v2";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getDefaultPosition = () => {
	if (typeof window === "undefined") {
		return { x: FAB_MARGIN, y: FAB_MARGIN };
	}
	return {
		x: Math.max(FAB_MARGIN, window.innerWidth - FAB_WIDTH - FAB_MARGIN),
		y: Math.max(FAB_MARGIN, window.innerHeight - FAB_HEIGHT - FAB_MARGIN),
	};
};

const getClampedPosition = (position: Position): Position => {
	if (typeof window === "undefined") return position;
	const maxX = Math.max(FAB_MARGIN, window.innerWidth - FAB_WIDTH - FAB_MARGIN);
	const maxY = Math.max(FAB_MARGIN, window.innerHeight - FAB_HEIGHT - FAB_MARGIN);
	return {
		x: clamp(position.x, FAB_MARGIN, maxX),
		y: clamp(position.y, FAB_MARGIN, maxY),
	};
};

export function FeedbackFloatingButton() {
	const [isMounted, setIsMounted] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [position, setPosition] = useState<Position | null>(null);
	const [category, setCategory] = useState<FeedbackCategory>("idea");
	const [subject, setSubject] = useState("");
	const [message, setMessage] = useState("");
	const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
	const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle");
	const [submitError, setSubmitError] = useState<string | null>(null);
	const createFeedbackMutationRef = (
		api as unknown as {
			feedback: { mutations: { createFeedback: FunctionReference<"mutation"> } };
		}
	).feedback.mutations.createFeedback;
	const { mutate: createFeedback, isPending: isSubmitting } =
		useMutationWithStatus(createFeedbackMutationRef);

	const dragStateRef = useRef<{
		pointerId: number;
		offsetX: number;
		offsetY: number;
		startX: number;
		startY: number;
		hasMoved: boolean;
	} | null>(null);
	const suppressNextClickRef = useRef(false);

	useEffect(() => {
		setIsMounted(true);
		const defaultPosition = getDefaultPosition();
		if (typeof window === "undefined") {
			setPosition(defaultPosition);
			return;
		}
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (!raw) {
				setPosition(defaultPosition);
				return;
			}
			const parsed = JSON.parse(raw) as Partial<Position>;
			if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
				setPosition(defaultPosition);
				return;
			}
			setPosition(getClampedPosition({ x: parsed.x, y: parsed.y }));
		} catch {
			setPosition(defaultPosition);
		}
	}, []);

	useEffect(() => {
		if (!isMounted) return;
		const onResize = () => {
			setPosition((current) => {
				if (!current) return getDefaultPosition();
				return getClampedPosition(current);
			});
		};
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
		};
	}, [isMounted]);

	useEffect(() => {
		if (!isMounted) return;

		const onPointerMove = (event: PointerEvent) => {
			const dragState = dragStateRef.current;
			if (!dragState) return;
			if (event.pointerId !== dragState.pointerId) return;
			const next = getClampedPosition({
				x: event.clientX - dragState.offsetX,
				y: event.clientY - dragState.offsetY,
			});
			const movedDistance = Math.hypot(
				event.clientX - dragState.startX,
				event.clientY - dragState.startY,
			);
			dragState.hasMoved = dragState.hasMoved || movedDistance >= DRAG_DISTANCE_THRESHOLD;
			setPosition(next);
		};

		const onPointerUp = (event: PointerEvent) => {
			const dragState = dragStateRef.current;
			if (!dragState || event.pointerId !== dragState.pointerId) return;
			dragStateRef.current = null;
			if (dragState.hasMoved) {
				suppressNextClickRef.current = true;
				setTimeout(() => {
					suppressNextClickRef.current = false;
				}, 120);
			}
			if (position) {
				try {
					window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
				} catch {
					// noop
				}
			}
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [isMounted, position]);

	const feedbackDetails = useMemo(() => {
		const location = typeof window !== "undefined" ? window.location.href : "unknown";
		const timezone =
			typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "unknown";
		const timestamp = new Date().toISOString();
		return [
			`Category: ${category}`,
			`Subject: ${subject.trim() || "(none)"}`,
			`Page: ${location}`,
			`Timezone: ${timezone}`,
			`Timestamp: ${timestamp}`,
			"",
			"Message:",
			message.trim(),
		].join("\n");
	}, [category, message, subject]);

	if (!isMounted || !position) return null;

	const canSubmit = message.trim().length > 0;

	const onPointerDown: React.PointerEventHandler<HTMLButtonElement> = (event) => {
		dragStateRef.current = {
			pointerId: event.pointerId,
			offsetX: event.clientX - position.x,
			offsetY: event.clientY - position.y,
			startX: event.clientX,
			startY: event.clientY,
			hasMoved: false,
		};
	};

	const onOpenDialog = () => {
		if (suppressNextClickRef.current) return;
		setIsDialogOpen(true);
	};

	const onCopyDetails = async () => {
		try {
			await navigator.clipboard.writeText(feedbackDetails);
			setCopyState("copied");
		} catch {
			setCopyState("error");
		}
		setTimeout(() => {
			setCopyState("idle");
		}, 1400);
	};

	const onSubmitFeedback = async () => {
		if (!canSubmit || typeof window === "undefined") return;
		setSubmitState("idle");
		setSubmitError(null);
		try {
			await createFeedback({
				category,
				subject: subject.trim() || undefined,
				message: message.trim(),
				page: window.location.href,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				userAgent: navigator.userAgent,
			});
			setSubmitState("success");
			setIsDialogOpen(false);
			setSubject("");
			setMessage("");
		} catch (error) {
			setSubmitState("error");
			setSubmitError(error instanceof Error ? error.message : "Could not save feedback.");
		}
	};

	return (
		<>
			<div
				className="fixed z-[90]"
				style={{
					left: position.x,
					top: position.y,
				}}
			>
				<Button
					type="button"
					onPointerDown={onPointerDown}
					onClick={onOpenDialog}
					className="group relative h-11 w-[136px] cursor-grab overflow-hidden border-none bg-accent px-6 text-accent-foreground shadow-[0_8px_24px_-8px_rgba(252,163,17,0.35)] transition-[color,shadow] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] before:pointer-events-none before:absolute before:inset-0 before:-translate-x-full before:bg-primary before:transition-transform before:duration-500 before:ease-[cubic-bezier(0.19,1,0.22,1)] hover:text-primary-foreground hover:shadow-[0_14px_36px_-10px_rgba(252,163,17,0.4)] hover:before:translate-x-0 active:cursor-grabbing active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[3px]"
					aria-label="Open feedback"
				>
					<span className="relative z-[1] inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em]">
						<MessageSquare className="size-3.5" />
						Issue
					</span>
				</Button>
			</div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="max-w-[520px] border-border/80 bg-card/95 backdrop-blur">
					<DialogHeader>
						<DialogTitle className="text-xl">Report an issue</DialogTitle>
						<DialogDescription>
							Send this directly to the feedback table. Include expected vs actual behavior.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-1">
						<div className="grid gap-2 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="feedback-category">Category</Label>
								<Select
									value={category}
									onValueChange={(value) => setCategory(value as FeedbackCategory)}
								>
									<SelectTrigger id="feedback-category">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="idea">Idea</SelectItem>
										<SelectItem value="bug">Bug</SelectItem>
										<SelectItem value="general">General</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="feedback-subject">Subject (optional)</Label>
								<Input
									id="feedback-subject"
									value={subject}
									onChange={(event) => setSubject(event.target.value)}
									placeholder="Short summary"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="feedback-message">Message</Label>
							<Textarea
								id="feedback-message"
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								placeholder="What should we change?"
								rows={7}
							/>
						</div>
					</div>
					{submitState === "error" && submitError ? (
						<p className="text-sm text-destructive">{submitError}</p>
					) : null}

					<DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
						<Button type="button" variant="outline" onClick={() => void onCopyDetails()}>
							{copyState === "copied" ? (
								<>
									<Check className="size-4" />
									Copied
								</>
							) : copyState === "error" ? (
								"Copy failed"
							) : (
								"Copy details"
							)}
						</Button>
						<Button
							type="button"
							onClick={() => void onSubmitFeedback()}
							disabled={!canSubmit || isSubmitting}
						>
							<Send className="size-4" />
							{isSubmitting ? "Saving..." : submitState === "success" ? "Saved" : "Save issue"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
