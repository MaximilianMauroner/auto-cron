import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type CalendarRecurringMoveDialogProps = {
	open: boolean;
	title: string | null;
	onOpenChange: (open: boolean) => void;
	onCancel: () => void;
	onMoveSingle: () => void;
	onMoveSeries: () => void;
};

export function CalendarRecurringMoveDialog({
	open,
	title,
	onOpenChange,
	onCancel,
	onMoveSingle,
	onMoveSeries,
}: CalendarRecurringMoveDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm border-border bg-popover text-popover-foreground">
				<DialogHeader>
					<DialogTitle className="text-[1rem] font-semibold text-foreground">
						Move recurring event
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-2 text-sm text-foreground/80">
					<div>
						You moved <span className="font-medium text-foreground">{title}</span>.
					</div>
					<div>Apply the move to just this event or the full series?</div>
				</div>
				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						variant="outline"
						className="border-border bg-secondary text-foreground/85 hover:bg-accent"
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button
						variant="outline"
						className="border-border bg-secondary text-foreground/85 hover:bg-accent"
						onClick={onMoveSingle}
					>
						Only this event
					</Button>
					<Button
						className="bg-accent text-accent-foreground hover:bg-accent/90"
						onClick={onMoveSeries}
					>
						Entire series
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
