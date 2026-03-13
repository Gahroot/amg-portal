"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllKPIs } from "@/lib/api/analytics";

export function useAllKPIs() {
  return useQuery({
    queryKey: ["analytics", "all-kpis"],
    queryFn: () => getAllKPIs(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
