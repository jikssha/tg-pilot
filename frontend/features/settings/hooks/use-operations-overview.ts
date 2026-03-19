"use client";

import { useQuery } from "@tanstack/react-query";

import { getOperationsOverview } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useOperationsOverview(token: string | null) {
  return useQuery({
    queryKey: token ? queryKeys.operationsOverview(token) : ["operations-overview", "anonymous"],
    queryFn: () => getOperationsOverview(token!),
    enabled: Boolean(token),
  });
}
