import { env } from "./index";

export const serverEnv = env;

export const getConvexUrl = () => {
	const resolved = process.env.NEXT_PUBLIC_CONVEX_URL ?? serverEnv.CONVEX_URL;
	if (!resolved) {
		throw new Error("Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL or CONVEX_URL.");
	}
	return resolved;
};
