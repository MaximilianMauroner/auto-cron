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
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

type FeedbackCategory = "bug" | "idea" | "general";

export function FeedbackButton() {
	const pathname = usePathname();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
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

	// Allow opening the feedback dialog from other components via custom event
	useEffect(() => {
		const onOpen = () => setIsDialogOpen(true);
		window.addEventListener("open-feedback-dialog", onOpen);
		return () => window.removeEventListener("open-feedback-dialog", onOpen);
	}, []);

	if (!pathname.startsWith("/app")) return null;

	const canSubmit = message.trim().length > 0;

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
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-7"
				onClick={() => setIsDialogOpen(true)}
				aria-label="Report an issue"
			>
				<MessageSquare className="size-4" />
			</Button>

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
