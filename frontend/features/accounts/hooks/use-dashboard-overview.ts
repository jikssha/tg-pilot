"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAccounts, listSignTasks } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useDashboardOverview(token: string | null) {
  const overviewQuery = useQuery({
    queryKey: token ? queryKeys.dashboardOverview(token) : ["dashboard-overview", "anonymous"],
    queryFn: async () => {
      const [accountsData, tasksData] = await Promise.all([listAccounts(token!), listSignTasks(token!)]);
      const sortedAccounts = [...accountsData.accounts].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );

      return {
        accounts: sortedAccounts,
        tasks: tasksData,
      };
    },
    enabled: Boolean(token),
  });

  const taskCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of overviewQuery.data?.tasks ?? []) {
      const nextCount = (map.get(task.account_name) ?? 0) + 1;
      map.set(task.account_name, nextCount);
    }
    return map;
  }, [overviewQuery.data?.tasks]);

  return {
    ...overviewQuery,
    accounts: overviewQuery.data?.accounts ?? [],
    tasks: overviewQuery.data?.tasks ?? [],
    taskCountMap,
  };
}
