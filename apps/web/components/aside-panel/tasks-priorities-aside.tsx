"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrioritiesTabContent } from "./priorities-tab-content";
import { TasksTabContent } from "./tasks-tab-content";

export function TasksPrioritiesAside() {
	return (
		<Tabs defaultValue="tasks" className="flex h-full flex-col">
			<div className="shrink-0 border-b border-border px-3 pt-3 pb-0">
				<TabsList variant="line" className="w-full">
					<TabsTrigger value="tasks" className="text-[0.76rem]">
						Tasks
					</TabsTrigger>
					<TabsTrigger value="priorities" className="text-[0.76rem]">
						Priorities
					</TabsTrigger>
				</TabsList>
			</div>
			<TabsContent value="tasks" className="min-h-0 overflow-y-auto">
				<TasksTabContent />
			</TabsContent>
			<TabsContent value="priorities" className="min-h-0 overflow-y-auto">
				<PrioritiesTabContent />
			</TabsContent>
		</Tabs>
	);
}
