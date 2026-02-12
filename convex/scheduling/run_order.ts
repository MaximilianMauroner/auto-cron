import type { Id } from "../_generated/dataModel";

type RunOrderComparable = {
	_id: Id<"schedulingRuns">;
	startedAt: number;
	_creationTime?: number;
};

// Deterministic strict ordering for runs:
// 1) larger startedAt is newer
// 2) on equal startedAt, larger creationTime is newer
// 3) on equal startedAt and creationTime, larger id string wins as final tiebreaker
export const isRunNewer = (candidate: RunOrderComparable, current: RunOrderComparable) => {
	if (candidate.startedAt !== current.startedAt) {
		return candidate.startedAt > current.startedAt;
	}
	const candidateCreated = candidate._creationTime ?? 0;
	const currentCreated = current._creationTime ?? 0;
	if (candidateCreated !== currentCreated) {
		return candidateCreated > currentCreated;
	}
	return String(candidate._id) > String(current._id);
};
