const FALLBACK_COLOR_KEY = "google-default";

export const toCssSafeColorKey = (value?: string) => {
	if (!value) return FALLBACK_COLOR_KEY;

	const sanitized = value
		.trim()
		.replace(/[^a-zA-Z0-9_-]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");

	return sanitized || FALLBACK_COLOR_KEY;
};
