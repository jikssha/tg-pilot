export const queryKeys = {
  dashboardOverview: (token: string) => ["dashboard-overview", token] as const,
  accountTasks: (token: string, accountName: string) => ["account-tasks", token, accountName] as const,
  accountChats: (token: string, accountName: string) => ["account-chats", token, accountName] as const,
  settingsData: (token: string) => ["settings-data", token] as const,
};
