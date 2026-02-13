"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuthenticatedQueryWithStatus, useMutationWithStatus } from "@/hooks/use-convex-status";
import { getConvexErrorPayload } from "@/lib/convex-errors";
import { cn } from "@/lib/utils";
import { GOOGLE_CALENDAR_COLORS } from "@auto-cron/types";
import { Check, Pencil, Plus, Shield, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

const COLOR_LABELS: Record<string, string> = {
	"#f59e0b": "Amber",
	"#ef4444": "Red",
	"#22c55e": "Green",
	"#0ea5e9": "Sky",
	"#6366f1": "Indigo",
	"#a855f7": "Purple",
	"#ec4899": "Pink",
	"#14b8a6": "Teal",
};

type CategoryDoc = {
	_id: Id<"taskCategories">;
	userId: string;
	name: string;
	description?: string;
	color: string;
	isSystem: boolean;
	isDefault: boolean;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
};

type EditState = {
	categoryId: Id<"taskCategories">;
	name: string;
	description: string;
	color: string;
};

export default function SettingsCategoriesPage() {
	const [createOpen, setCreateOpen] = useState(false);
	const [editState, setEditState] = useState<EditState | null>(null);
	const [createName, setCreateName] = useState("");
	const [createDescription, setCreateDescription] = useState("");
	const [createColor, setCreateColor] = useState<string>(GOOGLE_CALENDAR_COLORS[0]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<Id<"taskCategories"> | null>(null);

	const categoriesQuery = useAuthenticatedQueryWithStatus(api.categories.queries.getCategories, {});
	const categories = (categoriesQuery.data ?? []) as CategoryDoc[];

	const { mutate: createCategory, isPending: isCreating } = useMutationWithStatus(
		api.categories.mutations.createCategory,
	);
	const { mutate: updateCategory, isPending: isUpdating } = useMutationWithStatus(
		api.categories.mutations.updateCategory,
	);
	const { mutate: deleteCategory, isPending: isDeleting } = useMutationWithStatus(
		api.categories.mutations.deleteCategory,
	);
	const { mutate: setDefaultCategory, isPending: isSettingDefault } = useMutationWithStatus(
		api.categories.mutations.setDefaultCategory,
	);

	const isBusy = isCreating || isUpdating || isDeleting || isSettingDefault;

	useEffect(() => {
		if (!createOpen) {
			setCreateName("");
			setCreateDescription("");
			setCreateColor(GOOGLE_CALENDAR_COLORS[0]);
			setErrorMessage(null);
		}
	}, [createOpen]);

	const handleCreate = useCallback(async () => {
		if (!createName.trim()) {
			setErrorMessage("Name is required.");
			return;
		}
		setErrorMessage(null);
		try {
			await createCategory({
				name: createName.trim(),
				description: createDescription.trim() || undefined,
				color: createColor,
			});
			setCreateOpen(false);
		} catch (error) {
			const payload = getConvexErrorPayload(error);
			setErrorMessage(payload?.message ?? "Could not create category.");
		}
	}, [createName, createDescription, createColor, createCategory]);

	const handleUpdate = useCallback(async () => {
		if (!editState) return;
		setErrorMessage(null);
		try {
			await updateCategory({
				categoryId: editState.categoryId,
				name: editState.name.trim() || undefined,
				description: editState.description.trim() || undefined,
				color: editState.color || undefined,
			});
			setEditState(null);
		} catch (error) {
			const payload = getConvexErrorPayload(error);
			setErrorMessage(payload?.message ?? "Could not update category.");
		}
	}, [editState, updateCategory]);

	const handleDelete = useCallback(
		async (categoryId: Id<"taskCategories">) => {
			try {
				await deleteCategory({ categoryId });
				setDeleteConfirm(null);
			} catch (error) {
				const payload = getConvexErrorPayload(error);
				setErrorMessage(payload?.message ?? "Could not delete category.");
			}
		},
		[deleteCategory],
	);

	const handleSetDefault = useCallback(
		async (categoryId: Id<"taskCategories">) => {
			try {
				await setDefaultCategory({ categoryId });
			} catch (error) {
				const payload = getConvexErrorPayload(error);
				setErrorMessage(payload?.message ?? "Could not set default.");
			}
		},
		[setDefaultCategory],
	);

	const openEdit = (cat: CategoryDoc) => {
		setEditState({
			categoryId: cat._id,
			name: cat.name,
			description: cat.description ?? "",
			color: cat.color,
		});
		setErrorMessage(null);
	};

	return (
		<>
			<Card className="border-border/70 bg-card/70">
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<div>
						<CardTitle className="text-lg font-semibold tracking-tight">Categories</CardTitle>
						<CardDescription className="mt-1 text-sm">
							Organize tasks and habits with color-coded categories. Colors cascade to all items in
							a category unless manually overridden.
						</CardDescription>
					</div>
					<Button
						size="sm"
						className="shrink-0 gap-1.5"
						onClick={() => setCreateOpen(true)}
						disabled={isBusy}
					>
						<Plus className="size-3.5" />
						Add category
					</Button>
				</CardHeader>
				<CardContent>
					{categories.length === 0 ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							No categories yet. Create one to get started.
						</p>
					) : (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{categories.map((cat) => (
								<div
									key={cat._id}
									className={cn(
										"group relative rounded-lg border border-border/60 bg-background/60 p-4 transition-colors hover:border-border hover:bg-background/80",
										editState?.categoryId === cat._id && "border-primary/40 bg-primary/5",
									)}
								>
									{/* Color bar top accent */}
									<div
										className="absolute inset-x-0 top-0 h-1 rounded-t-lg"
										style={{ backgroundColor: cat.color }}
									/>

									<div className="flex items-start gap-3 pt-1">
										{/* Color swatch */}
										<div
											className="mt-0.5 size-8 shrink-0 rounded-md shadow-sm ring-1 ring-black/10"
											style={{ backgroundColor: cat.color }}
										/>

										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<p className="truncate text-sm font-semibold">{cat.name}</p>
												{cat.isSystem ? (
													<Badge
														variant="outline"
														className="shrink-0 gap-1 px-1.5 py-0 text-[10px]"
													>
														<Shield className="size-2.5" />
														System
													</Badge>
												) : null}
												{cat.isDefault ? (
													<Badge
														variant="secondary"
														className="shrink-0 gap-1 px-1.5 py-0 text-[10px]"
													>
														<Star className="size-2.5" />
														Default
													</Badge>
												) : null}
											</div>
											{cat.description ? (
												<p className="mt-0.5 truncate text-xs text-muted-foreground">
													{cat.description}
												</p>
											) : null}
										</div>
									</div>

									{/* Actions */}
									<div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3">
										<button
											type="button"
											onClick={() => openEdit(cat)}
											disabled={isBusy}
											className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
										>
											<Pencil className="size-3" />
											Edit
										</button>
										{!cat.isDefault ? (
											<button
												type="button"
												onClick={() => void handleSetDefault(cat._id)}
												disabled={isBusy}
												className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
											>
												<Star className="size-3" />
												Set default
											</button>
										) : null}
										{!cat.isSystem ? (
											<button
												type="button"
												onClick={() => setDeleteConfirm(cat._id)}
												disabled={isBusy}
												className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600/80 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400/80 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
											>
												<Trash2 className="size-3" />
												Delete
											</button>
										) : null}
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create Dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>New category</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-1.5">
							<Label htmlFor="cat-create-name" className="text-xs uppercase tracking-[0.1em]">
								Name
							</Label>
							<Input
								id="cat-create-name"
								value={createName}
								onChange={(e) => {
									setCreateName(e.target.value);
									if (errorMessage) setErrorMessage(null);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") void handleCreate();
								}}
								placeholder="e.g. Work, Fitness, Side Project"
								autoFocus
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="cat-create-desc" className="text-xs uppercase tracking-[0.1em]">
								Description
							</Label>
							<Textarea
								id="cat-create-desc"
								value={createDescription}
								onChange={(e) => setCreateDescription(e.target.value)}
								placeholder="Optional short description"
								rows={2}
								className="resize-none"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs uppercase tracking-[0.1em]">Color</Label>
							<ColorPalette value={createColor} onChange={setCreateColor} />
						</div>
						{errorMessage ? (
							<p className="text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button onClick={() => void handleCreate()} disabled={isCreating}>
							{isCreating ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog
				open={editState !== null}
				onOpenChange={(open) => {
					if (!open) setEditState(null);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Edit category</DialogTitle>
					</DialogHeader>
					{editState ? (
						<div className="space-y-4 py-2">
							<div className="space-y-1.5">
								<Label className="text-xs uppercase tracking-[0.1em]">Name</Label>
								<Input
									value={editState.name}
									onChange={(e) => setEditState({ ...editState, name: e.target.value })}
									onKeyDown={(e) => {
										if (e.key === "Enter") void handleUpdate();
									}}
									disabled={
										categories.find((c) => c._id === editState.categoryId)?.isSystem ?? false
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs uppercase tracking-[0.1em]">Description</Label>
								<Textarea
									value={editState.description}
									onChange={(e) =>
										setEditState({
											...editState,
											description: e.target.value,
										})
									}
									rows={2}
									className="resize-none"
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs uppercase tracking-[0.1em]">Color</Label>
								<ColorPalette
									value={editState.color}
									onChange={(color) => setEditState({ ...editState, color })}
								/>
							</div>
							{errorMessage ? (
								<p className="text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
							) : null}
						</div>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditState(null)}>
							Cancel
						</Button>
						<Button onClick={() => void handleUpdate()} disabled={isUpdating}>
							{isUpdating ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation */}
			<Dialog
				open={deleteConfirm !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteConfirm(null);
				}}
			>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Delete category?</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						All tasks and habits in this category will be reassigned to your default category. This
						cannot be undone.
					</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteConfirm(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => deleteConfirm && void handleDelete(deleteConfirm)}
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function ColorPalette({
	value,
	onChange,
}: {
	value: string;
	onChange: (color: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{GOOGLE_CALENDAR_COLORS.map((color) => (
				<button
					key={color}
					type="button"
					onClick={() => onChange(color)}
					className={cn(
						"relative size-8 rounded-full shadow-sm ring-1 ring-black/10 transition-all hover:scale-110 hover:shadow-md",
						value === color && "ring-2 ring-primary ring-offset-2 ring-offset-background",
					)}
					style={{ backgroundColor: color }}
					title={COLOR_LABELS[color] ?? color}
				>
					{value === color ? (
						<Check className="absolute inset-0 m-auto size-4 text-white drop-shadow-sm" />
					) : null}
				</button>
			))}
		</div>
	);
}
