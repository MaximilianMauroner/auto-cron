"use client";

import { makeUseQueryWithStatus } from "convex-helpers/react";
import { useQueries } from "convex-helpers/react/cache/hooks";
import {
	type OptionalRestArgsOrSkip,
	type PaginatedQueryArgs,
	type PaginatedQueryReference,
	useAction,
	useConvexAuth,
	useMutation,
	usePaginatedQuery,
} from "convex/react";
import type { FunctionReference, OptionalRestArgs } from "convex/server";
import { useCallback, useState } from "react";

export type MutationStatus = "idle" | "pending" | "success" | "error";
export type ActionStatus = "idle" | "pending" | "success" | "error";

export const useQueryWithStatus = makeUseQueryWithStatus(useQueries);

export function useAuthenticatedQueryWithStatus<Query extends FunctionReference<"query">>(
	query: Query,
	args: OptionalRestArgsOrSkip<Query>[0] | "skip",
) {
	const { isAuthenticated, isLoading } = useConvexAuth();
	return useQueryWithStatus(query, isAuthenticated && !isLoading ? args : "skip");
}

export function useAuthenticatedPaginatedQuery<Query extends PaginatedQueryReference>(
	query: Query,
	args: PaginatedQueryArgs<Query> | "skip",
	options: { initialNumItems: number },
) {
	const { isAuthenticated, isLoading } = useConvexAuth();
	return usePaginatedQuery(query, isAuthenticated && !isLoading ? args : "skip", options);
}

export const useMutationWithStatus = <Mutation extends FunctionReference<"mutation">>(
	mutationRef: Mutation,
) => {
	const mutation = useMutation(mutationRef);
	const [status, setStatus] = useState<MutationStatus>("idle");
	const [error, setError] = useState<unknown>(null);

	const mutate = useCallback(
		async (...args: OptionalRestArgs<Mutation>): Promise<Mutation["_returnType"]> => {
			setStatus("pending");
			setError(null);
			try {
				const result = await mutation(...args);
				setStatus("success");
				return result;
			} catch (err) {
				setStatus("error");
				setError(err);
				throw err;
			}
		},
		[mutation],
	);

	const reset = useCallback(() => {
		setStatus("idle");
		setError(null);
	}, []);

	return {
		mutate,
		status,
		error,
		reset,
		isIdle: status === "idle",
		isPending: status === "pending",
		isSuccess: status === "success",
		isError: status === "error",
	};
};

export const useActionWithStatus = <Action extends FunctionReference<"action">>(
	actionRef: Action,
) => {
	const action = useAction(actionRef);
	const [status, setStatus] = useState<ActionStatus>("idle");
	const [error, setError] = useState<unknown>(null);

	const execute = useCallback(
		async (...args: OptionalRestArgs<Action>): Promise<Action["_returnType"]> => {
			setStatus("pending");
			setError(null);
			try {
				const result = await action(...args);
				setStatus("success");
				return result;
			} catch (err) {
				setStatus("error");
				setError(err);
				throw err;
			}
		},
		[action],
	);

	const reset = useCallback(() => {
		setStatus("idle");
		setError(null);
	}, []);

	return {
		execute,
		status,
		error,
		reset,
		isIdle: status === "idle",
		isPending: status === "pending",
		isSuccess: status === "success",
		isError: status === "error",
	};
};
