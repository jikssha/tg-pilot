"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAIConfig,
  getBotNotifyConfig,
  getGlobalSettings,
  getTelegramConfig,
  getTOTPStatus,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const DEFAULT_GLOBAL_SETTINGS = { sign_interval: null, log_retention_days: 7, data_dir: null };

export function useSettingsData(token: string | null) {
  const settingsQuery = useQuery({
    queryKey: token ? queryKeys.settingsData(token) : ["settings-data", "anonymous"],
    queryFn: async () => {
      const [totp, ai, global, telegram, bot] = await Promise.all([
        getTOTPStatus(token!),
        getAIConfig(token!),
        getGlobalSettings(token!),
        getTelegramConfig(token!),
        getBotNotifyConfig(token!),
      ]);

      return {
        totpEnabled: totp.enabled,
        aiConfig: ai,
        globalSettings: global || DEFAULT_GLOBAL_SETTINGS,
        telegramConfig: telegram,
        botNotifyConfig: bot,
      };
    },
    enabled: Boolean(token),
  });

  return {
    ...settingsQuery,
    totpEnabled: settingsQuery.data?.totpEnabled ?? false,
    aiConfig: settingsQuery.data?.aiConfig ?? null,
    globalSettings: settingsQuery.data?.globalSettings ?? DEFAULT_GLOBAL_SETTINGS,
    telegramConfig: settingsQuery.data?.telegramConfig ?? null,
    botNotifyConfig: settingsQuery.data?.botNotifyConfig ?? null,
  };
}
