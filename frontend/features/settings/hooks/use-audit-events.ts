"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAuditEvents } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

interface AuditQueryParams {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  status?: string;
}

export function useAuditEvents(token: string | null, params: AuditQueryParams) {
  const normalizedParams = useMemo(
    () => ({
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      action: params.action || "",
      resourceType: params.resourceType || "",
      status: params.status || "",
    }),
    [params.action, params.limit, params.offset, params.resourceType, params.status]
  );

  return useQuery({
    queryKey: token
      ? queryKeys.auditEvents(token, normalizedParams)
      : ["audit-events", "anonymous"],
    queryFn: () =>
      getAuditEvents(token!, {
        limit: normalizedParams.limit,
        offset: normalizedParams.offset,
        action: normalizedParams.action || undefined,
        resourceType: normalizedParams.resourceType || undefined,
        status: normalizedParams.status || undefined,
      }),
    enabled: Boolean(token),
  });
}
