import { useQuery } from "@tanstack/react-query";
import { comparePrograms, compareClients } from "@/lib/api/comparison";
import { queryKeys } from "@/lib/query-keys";

export function useProgramComparison(ids: string[]) {
  return useQuery({
    queryKey: queryKeys.programs.compare(ids),
    queryFn: () => comparePrograms(ids),
    enabled: ids.length >= 2 && ids.length <= 4,
  });
}

export function useClientComparison(ids: string[]) {
  return useQuery({
    queryKey: queryKeys.clients.compare(ids),
    queryFn: () => compareClients(ids),
    enabled: ids.length >= 2 && ids.length <= 4,
  });
}
