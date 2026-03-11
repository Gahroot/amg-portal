import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { listDecisions, getDecision, respondToDecision } from '@/lib/api/decisions';
import type { DecisionRequestStatus, DecisionResponseData } from '@/types/decision';

export function useDecisions(status?: DecisionRequestStatus) {
  return useQuery({
    queryKey: ['client-decisions', status],
    queryFn: () => listDecisions({ status, limit: 50 }),
  });
}

export function useDecision(id: string) {
  return useQuery({
    queryKey: ['decision', id],
    queryFn: () => getDecision(id),
    enabled: !!id,
  });
}

export function useRespondToDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DecisionResponseData }) =>
      respondToDecision(id, data),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['decision', id] });
      const previous = queryClient.getQueryData(['decision', id]);
      return { previous };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['decision', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['client-decisions'] });
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['decision', _variables.id], context.previous);
      }
      Alert.alert('Error', error.message || 'Failed to submit response.');
    },
  });
}

export function usePendingDecisionsCount() {
  return useQuery({
    queryKey: ['client-decisions', 'pending'],
    queryFn: () => listDecisions({ status: 'pending', limit: 1 }),
    select: (data) => data.total,
    refetchInterval: 30_000,
  });
}
