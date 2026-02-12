import { getConvexUrl as getServerConvexUrl } from "@/env/server";
import { ConvexHttpClient } from "convex/browser";

export const createConvexHttpClient = (accessToken: string) => {
	const client = new ConvexHttpClient(getServerConvexUrl());
	client.setAuth(accessToken);
	return client;
};
