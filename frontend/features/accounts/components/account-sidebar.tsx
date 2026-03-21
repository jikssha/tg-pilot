"use client";

import Link from "next/link";
import { CheckSquare, CheckSquareOffset, Gear, ListChecks, Plus, Square, Spinner } from "@phosphor-icons/react";
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
  const totalAccountsLabel = isZh ? `${accounts.length} 个账号` : `${accounts.length} accounts`;
  const selectedAccountsLabel = isZh ? `已选 ${selectedAccounts.size} 个` : `${selectedAccounts.size} selected`;

  return (
    <aside className="w-[320px] bg-[#080808] border-r border-[var(--border-color)] flex flex-col shrink-0 flex-shrink-0 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-[#EDEDED] text-[#0A0A0A] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <CheckSquareOffset weight="fill" className="text-[15px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text-main)] leading-none">
                <span className="truncate">TG-Pilot</span>
                <span
                  data-testid="app-version-badge"
                  className="h-5 px-2 rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-mono text-white/45 inline-flex items-center justify-center"
                >
                  {formatAppVersion(appVersion)}
                </span>
              </div>
              <div className="mt-1.5 text-[10px] font-semibold tracking-[0.22em] uppercase text-white/35">
                {isZh ? "账号工作区" : "Account Workspace"}
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            title={t("sidebar_settings")}
            className="w-9 h-9 rounded-[12px] border border-white/[0.06] bg-white/[0.03] text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-white/[0.05] flex items-center justify-center transition-colors"
          >
            <Gear weight="bold" size={18} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 p-1 rounded-2xl border border-white/[0.05] bg-white/[0.03]">
          <button
            onClick={() => {
              if (isSelectionMode) onToggleSelectionMode();
            }}
            className={`h-10 rounded-xl text-[12px] font-bold tracking-[0.08em] uppercase transition-all ${
              !isSelectionMode
                ? "bg-white/[0.08] text-[var(--text-main)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-[var(--text-sub)] hover:text-[var(--text-main)]"
            }`}
          >
            {isZh ? "普通模式" : "Normal"}
          </button>
          <button
            onClick={() => {
              if (!isSelectionMode) onToggleSelectionMode();
            }}
            className={`h-10 rounded-xl text-[12px] font-bold tracking-[0.08em] uppercase transition-all ${
              isSelectionMode
                ? "bg-white/[0.08] text-[var(--text-main)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-[var(--text-sub)] hover:text-[var(--text-main)]"
            }`}
          >
            {isZh ? "多选模式" : "Multi Select"}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-white/45">
            {isSelectionMode ? (isZh ? "多选模式" : "Selection") : (isZh ? "账号列表" : "Accounts")}
          </div>
          <div className="mt-2 flex items-center gap-2 min-w-0 flex-wrap">
            <span className="h-6 px-2.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-semibold text-white/70 inline-flex items-center justify-center whitespace-nowrap">
              {totalAccountsLabel}
            </span>
            {isSelectionMode ? (
              <span className="h-6 px-2.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] text-[11px] font-semibold text-cyan-200 inline-flex items-center justify-center whitespace-nowrap">
                {selectedAccountsLabel}
              </span>
            ) : null}
          </div>
        </div>

        {!isSelectionMode ? (
          <button
            onClick={onOpenAddDialog}
            className="w-9 h-9 rounded-[12px] border border-white/[0.06] bg-white/[0.03] text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-white/[0.05] flex items-center justify-center transition-colors shrink-0"
            title={t("add_account")}
          >
            <Plus weight="bold" size={18} />
          </button>
        ) : (
          <div className="w-9 h-9 rounded-[12px] border border-white/[0.06] bg-white/[0.02] text-white/25 flex items-center justify-center shrink-0">
            <ListChecks weight="bold" size={18} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 sidebar-scrollbar">
        {loading && accounts.length === 0 ? (
          <div className="flex flex-col gap-2 py-12 text-white/30 items-center">
            <Spinner className="animate-spin mb-2" size={20} />
            <span className="text-[10px] font-bold uppercase tracking-[0.24em]">{t("loading")}</span>
          </div>
        ) : (
          accounts.map((account) => {
            const statusInfo = accountStatusMap[account.name];
            const presentation = normalizeAccountStatus(statusInfo);
            const isActive = selectedAccountName === account.name;
            const isSelected = selectedAccounts.has(account.name);
            const taskCount = getAccountTaskCount(account.name);
            const statusLabel = t(presentation.labelKey);

            const rowClass = isSelected && isSelectionMode
              ? "bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.04))] border-cyan-400/20"
              : isActive && !isSelectionMode
                ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_24px_rgba(0,0,0,0.16)]"
                : "bg-white/[0.025] border-transparent hover:bg-white/[0.045] hover:border-white/[0.08] hover:-translate-y-px";

            const statusChipClass =
              presentation.tone === "online"
                ? "text-emerald-200 border-emerald-400/20 bg-emerald-400/[0.08]"
                : presentation.tone === "checking"
                  ? "text-amber-100 border-amber-400/20 bg-amber-400/[0.08]"
                  : presentation.tone === "invalid"
                    ? "text-rose-200 border-rose-400/20 bg-rose-400/[0.08]"
                    : presentation.tone === "error"
                      ? "text-orange-200 border-orange-400/20 bg-orange-400/[0.08]"
                      : "text-white/55 border-white/10 bg-white/[0.04]";

            return (
              <div
                key={account.name}
                onClick={() => (isSelectionMode ? onToggleAccountSelection(account.name) : onSelectAccount(account))}
                className={`group/item relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 min-h-[78px] px-4 py-3.5 mb-2 rounded-[18px] border cursor-pointer transition-all duration-200 ${rowClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isSelectionMode ? (
                    <span
                      className={`w-[18px] h-[18px] rounded-[6px] border flex items-center justify-center text-[12px] transition-colors ${
                        isSelected
                          ? "border-cyan-400/40 bg-cyan-400 text-[#0a0a0a]"
                          : "border-white/25 bg-white/[0.02] text-transparent"
                      }`}
                    >
                      {isSelected ? <CheckSquare weight="fill" size={14} /> : <Square weight="bold" size={14} />}
                    </span>
                  ) : null}

                  <div className="min-w-0 flex items-center gap-3">
                    <AccountStatusLamp
                      status={statusInfo}
                      t={t}
                      size="sm"
                      testId={`account-status-lamp-${account.name}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="truncate text-[14px] font-bold text-[var(--text-main)]">
                          {account.name}
                        </div>
                        <span className={`h-[22px] px-2 rounded-full border text-[10px] font-extrabold tracking-[0.1em] uppercase inline-flex items-center justify-center whitespace-nowrap ${statusChipClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-sub)] min-w-0">
                        <span className="truncate">
                          {isZh ? `任务 ${taskCount}` : `${taskCount} task${taskCount === 1 ? "" : "s"}`}
                        </span>
                        {isActive && !isSelectionMode ? (
                          <span className="h-5 px-2 rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-semibold text-white/55 inline-flex items-center justify-center whitespace-nowrap">
                            {isZh ? "当前工作区" : "Current"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`min-w-[42px] h-8 px-3 rounded-full border shrink-0 flex items-center justify-center font-mono text-[12px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                  taskCount > 0
                    ? "bg-white/[0.04] border-white/10 text-white/80"
                    : "bg-white/[0.025] border-white/[0.08] text-white/35"
                }`}>
                  {taskCount}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
