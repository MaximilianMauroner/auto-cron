import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { RecurrenceEditScope } from "../types/providers";

type ChangeLogEntityType = "task" | "habit" | "event" | "occurrence";

type ChangeLogMetadata =
	| {
			changedFields?: string[];
			[key: string]: unknown;
	  }
	| undefined;

type InsertChangeLogInput = {
	userId: string;
	entityType: ChangeLogEntityType;
	entityId: string;
	action: string;
	scope?: RecurrenceEditScope;
	eventId?: Id<"calendarEvents">;
	seriesId?: Id<"calendarEventSeries">;
	metadata?: ChangeLogMetadata;
	timestamp?: number;
};

export const insertChangeLog = async (ctx: MutationCtx, input: InsertChangeLogInput) => {
	const timestamp = input.timestamp ?? Date.now();
	await ctx.db.insert("changeLogs", {
		userId: input.userId,
		entityType: input.entityType,
		entityId: input.entityId,
		action: input.action,
		scope: input.scope,
		eventId: input.eventId,
		seriesId: input.seriesId,
		actor: {
			type: "user",
			id: input.userId,
		},
		metadata: input.metadata,
		timestamp,
		createdAt: timestamp,
	});
};
