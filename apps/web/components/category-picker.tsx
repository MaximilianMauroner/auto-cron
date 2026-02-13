"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

type CategoryPickerProps = {
	value: string;
	onValueChange: (categoryId: string) => void;
	className?: string;
	placeholder?: string;
};

export function CategoryPicker({
	value,
	onValueChange,
	className,
	placeholder = "Select category",
}: CategoryPickerProps) {
	const categoriesQuery = useAuthenticatedQueryWithStatus(api.categories.queries.getCategories, {});

	const categories: { _id: string; name: string; color: string }[] = categoriesQuery.data ?? [];

	return (
		<Select value={value} onValueChange={onValueChange}>
			<SelectTrigger className={cn("w-full", className)}>
				<SelectValue placeholder={placeholder}>
					{value
						? (() => {
								const cat = categories.find((c) => c._id === value);
								if (!cat) return placeholder;
								return (
									<span className="flex items-center gap-2">
										<span
											className="inline-block size-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: cat.color }}
										/>
										{cat.name}
									</span>
								);
							})()
						: null}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{categories.map((cat) => (
					<SelectItem key={cat._id} value={cat._id}>
						<span className="flex items-center gap-2">
							<span
								className="inline-block size-2.5 shrink-0 rounded-full"
								style={{ backgroundColor: cat.color }}
							/>
							{cat.name}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
