/**
 * Factory hook for standard CRUD mutations with consistent patterns.
 *
 * Eliminates the boilerplate of:
 *   const queryClient = useQueryClient();
 *   return useMutation({
 *     mutationFn: ...,
 *     onSuccess: () => { queryClient.invalidateQueries(...); toast.success(...) },
 *     onError: (error: Error) => toast.error(error.message || "Failed to ..."),
 *   });
 *
 * Usage:
 *   const create = useCrudMutation({
 *     mutationFn: (data: CreateData) => createEntity(data),
 *     invalidateKeys: [queryKeys.entity.all],
 *     successMessage: "Created successfully",
 *     errorMessage: "Failed to create",
 *   });
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface CrudMutationOptions<TData, TVariables = void> {
  /** The async function that performs the mutation */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query keys to invalidate on success. Each key invalidates all queries prefixed with it. */
  invalidateKeys: readonly (readonly unknown[])[];
  /** Optional toast message on success. Pass `false` to suppress. */
  successMessage?: string | false;
  /** Fallback error message when the thrown error has no message. */
  errorMessage?: string;
}

export function useCrudMutation<TData, TVariables>({
  mutationFn,
  invalidateKeys,
  successMessage,
  errorMessage,
}: CrudMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
      }
      if (successMessage) {
        toast.success(successMessage);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || errorMessage || "Operation failed");
    },
  });
}
