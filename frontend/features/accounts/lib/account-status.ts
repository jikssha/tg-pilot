"use client";

import { AccountStatusItem } from "@/lib/api";

export type AccountStatusTone = "online" | "checking" | "invalid" | "error" | "unknown";

export interface AccountStatusPresentation {
  tone: AccountStatusTone;
  labelKey: "connected" | "account_status_checking" | "account_status_invalid" | "account_status_error" | "account_status_unknown";
  needsRelogin: boolean;
}

export function normalizeAccountStatus(status?: AccountStatusItem | null): AccountStatusPresentation {
  const rawStatus = status?.status;
  const needsRelogin = Boolean(status?.needs_relogin);

  if (rawStatus === "valid" || rawStatus === "connected") {
    return { tone: "online", labelKey: "connected", needsRelogin: false };
  }

  if (rawStatus === "checking") {
    return { tone: "checking", labelKey: "account_status_checking", needsRelogin: false };
  }

  if (rawStatus === "invalid" || rawStatus === "not_found" || (rawStatus === "error" && needsRelogin)) {
    return { tone: "invalid", labelKey: "account_status_invalid", needsRelogin: true };
  }

  if (rawStatus === "error") {
    return { tone: "error", labelKey: "account_status_error", needsRelogin: false };
  }

  return { tone: "unknown", labelKey: "account_status_unknown", needsRelogin: false };
}

