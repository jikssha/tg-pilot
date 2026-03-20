"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { getAccountChats, listSignTasks } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useAccountTaskData(token: string | null, accountName: string) {
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({
    queryKey: token ? queryKeys.accountTasks(token, accountName) : ["account-tasks", "anonymous", accountName],
    queryFn: () => listSignTasks(token!, accountName),
    enabled: Boolean(token && accountName),
  });

  const chatsQuery = useQuery({
    queryKey: token ? queryKeys.accountChats(token, accountName) : ["account-chats", "anonymous", accountName],
    queryFn: () => getAccountChats(token!, accountName),
    enabled: Boolean(token && accountName),
  });

  return {
    tasksQuery,
    chatsQuery,
    tasks: tasksQuery.data ?? [],
    chats: chatsQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    isChatsLoading: chatsQuery.isLoading,
    isFetching: tasksQuery.isFetching || chatsQuery.isFetching,
    async refetchAll() {
      await Promise.allSettled([tasksQuery.refetch(), chatsQuery.refetch()]);
    },
    async refreshChats(forceRefresh = false) {
      const chats = await getAccountChats(token!, accountName, forceRefresh);
      queryClient.setQueryData(queryKeys.accountChats(token!, accountName), chats);
      return chats;
    },
  };
}
