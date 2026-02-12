export type ConvexErrorPayload = {
	code?: string;
	message?: string;
	featureId?: string;
	scenario?: string;
	preview?: unknown;
};

const parseMaybeJson = (value: string): unknown => {
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
};

export const getConvexErrorPayload = (error: unknown): ConvexErrorPayload | null => {
	if (!error || typeof error !== "object") return null;
	const record = error as Record<string, unknown>;
	const data = record.data;
	if (typeof data === "string") {
		const parsed = parseMaybeJson(data);
		if (parsed && typeof parsed === "object") {
			return parsed as ConvexErrorPayload;
		}
		return null;
	}
	if (data && typeof data === "object") {
		return data as ConvexErrorPayload;
	}
	return null;
};
