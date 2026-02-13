interface ImportMeta {
	glob(
		patterns: string | readonly string[],
		options?: {
			eager?: boolean;
		},
	): Record<string, () => Promise<unknown>>;
}
