export const queryKeys = {
  dashboardOverview: (token: string) => ["dashboard-overview", token] as const,
  appHealth: () => ["app-health"] as const,
  accountTasks: (token: string, accountName: string) => ["account-tasks", token, accountName] as const,
  accountChats: (token: string, accountName: string) => ["account-chats", token, accountName] as const,
  settingsData: (token: string) => ["settings-data", token] as const,
  updateCheck: (token: string) => ["update-check", token] as const,
  operationsOverview: (token: string) => ["operations-overview", token] as const,
  auditEvents: (
    token: string,
    params: { limit: number; offset: number; action?: string; resourceType?: string; status?: string }
  ) =>
    ["audit-events", token, params.limit, params.offset, params.action || "", params.resourceType || "", params.status || ""] as const,
};
