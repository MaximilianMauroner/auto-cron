"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthenticatedQueryWithStatus } from "@/hooks/use-convex-status";
import type { TaskDTO } from "@auto-cron/types";
import { api } from "../../../../convex/_generated/api";
import { PrioritiesTabContent } from "./priorities-tab-content";
import { TasksTabContent } from "./tasks-tab-content";

export function TasksPrioritiesAside() {
	const tasksQuery = useAuthenticatedQueryWithStatus(api.tasks.queries.listTasks, {});
	const tasks = (tasksQuery.data ?? []) as TaskDTO[];
	const tasksPending = tasksQuery.isPending;

	return (
		<Tabs defaultValue="tasks" className="flex h-full flex-col">
			<div className="shrink-0 border-b border-border/60 px-3 pt-3 pb-0">
				<TabsList variant="line" className="w-full">
					<TabsTrigger
						value="tasks"
						className="font-[family-name:var(--font-outfit)] text-[0.76rem]"
					>
						Tasks
					</TabsTrigger>
					<TabsTrigger
						value="priorities"
						className="font-[family-name:var(--font-outfit)] text-[0.76rem]"
					>
						Priorities
					</TabsTrigger>
				</TabsList>
			</div>
			<TabsContent value="tasks" className="min-h-0 overflow-y-auto">
				<TasksTabContent tasks={tasks} tasksPending={tasksPending} />
			</TabsContent>
			<TabsContent value="priorities" className="min-h-0 overflow-y-auto">
				<PrioritiesTabContent tasks={tasks} tasksPending={tasksPending} />
			</TabsContent>
		</Tabs>
	);
}
