import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { listPrograms, getProgram } from '@/lib/api/programs';
import type { ProgramStatus } from '@/types/program';

export function useClientPrograms(filter?: { status?: ProgramStatus | 'all'; search?: string }) {
  const statusParam = filter?.status && filter.status !== 'all' ? filter.status : undefined;

  return useQuery({
    queryKey: ['client-programs', statusParam, filter?.search],
    queryFn: () => listPrograms({ status: statusParam, limit: 50 }),
    select: (data) => {
      if (!filter?.search) return data;
      const q = filter.search.toLowerCase();
      return {
        ...data,
        programs: data.programs.filter((p) => p.title.toLowerCase().includes(q)),
        total: data.programs.filter((p) => p.title.toLowerCase().includes(q)).length,
      };
    },
  });
}

export function useProgram(id: string) {
  return useQuery({
    queryKey: ['program', id],
    queryFn: () => getProgram(id),
    enabled: !!id,
  });
}

export function useProgramMilestones(programId: string) {
  return useQuery({
    queryKey: ['program', programId],
    queryFn: () => getProgram(programId),
    enabled: !!programId,
    select: (data) => data.milestones,
  });
}

export function useInvalidatePrograms() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['client-programs'] });
    queryClient.invalidateQueries({ queryKey: ['program'] });
  }, [queryClient]);
}
