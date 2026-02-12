const HOUR_ALIASES = /hours?|hrs?/g;
const MINUTE_ALIASES = /minutes?|mins?/g;

const HOUR_MINUTE_COMPACT = /^(\d{1,2}):([0-5]\d)$/;

export const parseDurationToMinutes = (value: string): number | null => {
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return null;

	if (/^\d+$/.test(trimmed)) {
		const minutes = Number.parseInt(trimmed, 10);
		return Number.isFinite(minutes) ? minutes : null;
	}

	const compactMatch = trimmed.match(HOUR_MINUTE_COMPACT);
	if (compactMatch) {
		const hours = Number.parseInt(compactMatch[1] ?? "0", 10);
		const minutes = Number.parseInt(compactMatch[2] ?? "0", 10);
		if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
		return hours * 60 + minutes;
	}

	const normalized = trimmed
		.replace(HOUR_ALIASES, "h")
		.replace(MINUTE_ALIASES, "m")
		.replace(/,/g, ".")
		.replace(/\s+/g, "");

	if (!normalized) return null;

	let totalMinutes = 0;
	let consumedLength = 0;
	const matcher = /(\d+(?:\.\d+)?)([hm])/g;
	let segment: RegExpExecArray | null = null;
	while (true) {
		segment = matcher.exec(normalized);
		if (!segment) break;
		const rawAmount = segment[1];
		const rawUnit = segment[2];
		const amount = Number.parseFloat(rawAmount ?? "");
		const unit = rawUnit ?? "";
		if (!Number.isFinite(amount)) return null;
		if (unit === "h") totalMinutes += amount * 60;
		if (unit === "m") totalMinutes += amount;
		consumedLength += segment[0]?.length ?? 0;
	}

	if (consumedLength === normalized.length && totalMinutes > 0) {
		return Math.round(totalMinutes);
	}

	return null;
};

export const formatDurationFromMinutes = (minutes: number): string => {
	const safeMinutes = Math.max(0, Math.round(minutes));
	if (safeMinutes < 60) {
		return `${safeMinutes} min${safeMinutes === 1 ? "" : "s"}`;
	}

	const hours = Math.floor(safeMinutes / 60);
	const remainderMinutes = safeMinutes % 60;
	if (remainderMinutes === 0) {
		return `${hours} hr${hours === 1 ? "" : "s"}`;
	}

	return `${hours} hr${hours === 1 ? "" : "s"} ${remainderMinutes} min${
		remainderMinutes === 1 ? "" : "s"
	}`;
};
