const runtimeEnv =
	typeof process !== "undefined" && process.env
		? (process.env as Record<string, string | undefined>)
		: {};

export const shouldDispatchBackgroundWork = () => {
	return runtimeEnv.CONVEX_DISABLE_BACKGROUND_DISPATCH !== "true";
};
