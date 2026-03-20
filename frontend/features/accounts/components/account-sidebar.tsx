"use client";

import Link from "next/link";
import { CheckSquare, CheckSquareOffset, Gear, ListChecks, Plus, Square, Spinner, Warning } from "@phosphor-icons/react";
import { AccountInfo, AccountStatusItem } from "@/lib/api";
import { AccountStatusLamp } from "@/features/accounts/components/account-status-lamp";
import { normalizeAccountStatus } from "@/features/accounts/lib/account-status";
import { formatAppVersion } from "@/lib/version";

interface AccountSidebarProps {
  accounts: AccountInfo[];
  loading: boolean;
  appVersion: string;
  isSelectionMode: boolean;
  selectedAccounts: Set<string>;
  selectedAccountName: string | null;
  accountStatusMap: Record<string, AccountStatusItem>;
  isZh: boolean;
  t: (key: string) => string;
  getAccountTaskCount: (accountName: string) => number;
  onToggleSelectionMode: () => void;
  onOpenAddDialog: () => void;
  onSelectAccount: (account: AccountInfo) => void;
  onToggleAccountSelection: (accountName: string) => void;
}

export function AccountSidebar({
  accounts,
  loading,
  appVersion,
  isSelectionMode,
  selectedAccounts,
  selectedAccountName,
  accountStatusMap,
  isZh,
  t,
  getAccountTaskCount,
  onToggleSelectionMode,
  onOpenAddDialog,
  onSelectAccount,
  onToggleAccountSelection,
}: AccountSidebarProps) {
  return (
    <aside className="w-[260px] bg-[#070707] border-r border-[var(--border-color)] flex flex-col shrink-0 flex-shrink-0">
      <div className="h-[52px] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-sm text-[var(--text-main)] cursor-pointer px-2 py-1 rounded-md hover:bg-white/5 -ml-2 transition-colors">
          <div className="w-5 h-5 bg-[#EDEDED] rounded text-[#0A0A0A] flex items-center justify-center">
            <CheckSquareOffset weight="fill" className="text-xs" />
          </div>
          TG-Pilot
          <span
            data-testid="app-version-badge"
            className="text-[10px] font-mono bg-white/5 border border-white/10 px-1 rounded-sm text-main/30 ml-0.5"
          >
            {formatAppVersion(appVersion)}
          </span>
        </div>
        <Link
          href="/dashboard/settings"
          title={t("sidebar_settings")}
          className="text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-white/5 p-1 rounded transition-colors"
        >
          <Gear weight="bold" />
        </Link>
      </div>

      <div className="px-4 pt-4 pb-2 flex justify-between items-center text-[11px] font-semibold text-[#555962] uppercase tracking-wider">
        {isSelectionMode ? (isZh ? "多选模式" : "Selection") : (isZh ? "账号列表" : "Accounts")}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSelectionMode}
            className={`p-1 rounded transition-colors ${
              isSelectionMode ? "text-sky-400 bg-sky-400/10" : "text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-white/5"
            }`}
            title={isZh ? "切换多选模式" : "Toggle Multi-Selection"}
          >
            <ListChecks weight="bold" />
          </button>
          {!isSelectionMode ? (
            <button
              onClick={onOpenAddDialog}
              className="text-[var(--text-sub)] hover:text-[var(--text-main)] p-1 hover:bg-white/5 rounded transition-colors"
              title={t("add_account")}
            >
              <Plus weight="bold" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 sidebar-scrollbar">
        {loading && accounts.length === 0 ? (
          <div className="flex flex-col gap-2 py-10 text-main/10 items-center">
            <Spinner className="animate-spin mb-2" size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t("loading")}</span>
          </div>
        ) : (
          accounts.map((account) => {
            const statusInfo = accountStatusMap[account.name];
            const presentation = normalizeAccountStatus(statusInfo);
            const isInvalid = presentation.tone === "invalid";
            const isActive = selectedAccountName === account.name;
            const isSelected = selectedAccounts.has(account.name);

            return (
              <div
                key={account.name}
                onClick={() => (isSelectionMode ? onToggleAccountSelection(account.name) : onSelectAccount(account))}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer text-[13px] transition-all mb-[2px] relative group/item ${
                  isActive && !isSelectionMode
                    ? "bg-white/10 text-[var(--text-main)] font-medium"
                    : "text-[var(--text-sub)] hover:bg-white/5 hover:text-[var(--text-main)]"
                } ${isInvalid ? "opacity-60" : ""} ${isSelected && isSelectionMode ? "bg-sky-500/10 !text-sky-400" : ""}`}
              >
                {isSelectionMode ? (
                  <div className="shrink-0 text-sky-400/60 group-hover/item:text-sky-400 transition-colors">
                    {isSelected ? <CheckSquare weight="fill" size={16} /> : <Square weight="bold" size={16} />}
                  </div>
                ) : null}
                <AccountStatusLamp
                  status={statusInfo}
                  t={t}
                  size="sm"
                  testId={`account-status-lamp-${account.name}`}
                />
                <div className="flex-1 truncate">{account.name}</div>
                {!isSelectionMode ? (
                  <div className="text-[10px] text-[#555962] font-mono shrink-0 group-hover/item:hidden">
                    {getAccountTaskCount(account.name)}
                  </div>
                ) : null}
                {isInvalid && !isSelectionMode ? (
                  <div className="text-rose-500 shrink-0 text-xs">
                    <Warning weight="bold" />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
