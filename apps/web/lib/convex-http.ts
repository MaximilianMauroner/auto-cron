import { ConvexHttpClient } from "convex/browser";

const getConvexUrl = () => {
	const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
	if (!url) {
		throw new Error("Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL or CONVEX_URL.");
	}
	return url;
};

export const createConvexHttpClient = (accessToken: string) => {
	const client = new ConvexHttpClient(getConvexUrl());
	client.setAuth(accessToken);
	return client;
};
