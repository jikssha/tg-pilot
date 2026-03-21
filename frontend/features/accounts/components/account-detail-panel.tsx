"use client";

import { Clock, Gear, ShieldCheck, TerminalWindow, Trash } from "@phosphor-icons/react";
import { PropsWithChildren } from "react";
import { AccountInfo, AccountStatusItem } from "@/lib/api";
import { AccountStatusLamp } from "@/features/accounts/components/account-status-lamp";
import { normalizeAccountStatus } from "@/features/accounts/lib/account-status";

interface AccountDetailPanelProps extends PropsWithChildren {
  selectedAccount: AccountInfo;
  selectedStatus: AccountStatusItem | null;
  isZh: boolean;
  t: (key: string) => string;
  onShowLogs: (accountName: string) => void;
  onShowDelete: (accountName: string) => void;
  onRelogin: (account: AccountInfo) => void;
  onEditAccount: (account: AccountInfo) => void;
}

export function AccountDetailPanel({
  selectedAccount,
  selectedStatus,
  isZh,
  t,
  onShowLogs,
  onShowDelete,
  onRelogin,
  onEditAccount,
  children,
}: AccountDetailPanelProps) {
  const presentation = normalizeAccountStatus(selectedStatus);
  const checkedAtLabel = selectedStatus?.checked_at
    ? new Date(selectedStatus.checked_at).toLocaleTimeString()
    : t("account_status_unknown");
  const statusBadgeClass =
    presentation.tone === "online"
      ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
      : presentation.tone === "checking"
        ? "bg-amber-500/10 border-amber-400/20 text-amber-100"
        : presentation.tone === "invalid"
          ? "bg-rose-500/10 border-rose-400/20 text-rose-200"
          : presentation.tone === "error"
            ? "bg-orange-500/10 border-orange-400/20 text-orange-200"
            : "bg-white/5 border-white/10 text-[var(--text-sub)]";

  return (
    <>
      <div className="mb-10 group">
        <div className="border border-white/[0.07] rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-white/[0.05]">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-white/40 mb-3">
                  {isZh ? "当前账号工作区" : "Current Account Workspace"}
                </div>
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <h1 className="text-[38px] leading-none tracking-[-0.03em] font-semibold text-[var(--text-main)] min-w-0 truncate">
                    {selectedAccount.name}
                  </h1>
                  <span className="h-7 px-3 rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-semibold text-white/55 inline-flex items-center justify-center whitespace-nowrap">
                    {isZh ? "当前工作区" : "Current"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onShowLogs(selectedAccount.name);
                  }}
                  className="w-10 h-10 rounded-[12px] border border-sky-400/15 bg-sky-400/[0.06] text-sky-300 hover:text-sky-200 hover:bg-sky-400/[0.1] flex items-center justify-center transition-colors"
                  title={isZh ? "运行日志" : "Running Logs"}
                >
                  <TerminalWindow weight="bold" size={18} />
                </button>
                <button
                  className="w-10 h-10 rounded-[12px] border border-rose-400/15 bg-rose-400/[0.06] text-rose-300 hover:text-rose-200 hover:bg-rose-400/[0.1] flex items-center justify-center transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShowDelete(selectedAccount.name);
                  }}
                  title={t("remove")}
                >
                  <Trash weight="bold" size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-5">
              <span
                data-testid="account-detail-status"
                className={`inline-flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-semibold ${statusBadgeClass}`}
              >
                <AccountStatusLamp
                  status={selectedStatus}
                  t={t}
                  size="md"
                  showLabel
                  labelClassName="text-sm font-semibold"
                  testId="account-detail-lamp"
                />
              </span>
              <span className="h-11 px-4 rounded-full border border-white/10 bg-white/[0.03] text-xs text-[var(--text-sub)] inline-flex items-center gap-2.5">
                <Clock weight="bold" size={15} /> {checkedAtLabel}
              </span>
              <span className="h-11 px-4 rounded-full border border-white/10 bg-white/[0.03] text-xs text-[var(--text-sub)] inline-flex items-center gap-2.5">
                <ShieldCheck weight="bold" size={15} /> {isZh ? "安全监控中" : "Security Monitoring"}
              </span>
            </div>
          </div>

          {selectedStatus?.message ? (
            <div className="px-6 py-4 bg-white/[0.02]">
              <div className="max-w-3xl rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-[var(--text-sub)]/90 leading-6">
                {selectedStatus.message}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selectedStatus?.needs_relogin ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[18px] p-4 mb-6 flex items-center justify-between gap-4">
          <div className="text-sm text-red-300 font-medium flex items-center gap-2">
            <span className="text-lg">!</span> {t("account_relogin_required")}
          </div>
          <button
            className="h-10 px-4 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold transition-colors"
            onClick={() => onRelogin(selectedAccount)}
          >
            {isZh ? "重新登录" : "Relogin"}
          </button>
        </div>
      ) : null}

      <div className="mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        {children}
      </div>

      <div className="border border-[var(--border-color)] rounded-[22px] bg-[rgba(255,255,255,0.01)] mb-8 overflow-hidden animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="px-5 py-4 border-b border-[var(--border-color)] text-[12px] font-semibold flex items-center justify-between bg-[rgba(255,255,255,0.02)] text-[var(--text-main)]">
          <div className="flex items-center gap-2">
            <Gear weight="bold" /> 代理设置
          </div>
          <button className="h-8 px-3 rounded-full border border-white/10 bg-white/[0.03] text-[var(--accent-glow)] hover:bg-white/[0.05] text-xs font-mono transition-colors" onClick={() => onEditAccount(selectedAccount)}>
            Edit
          </button>
        </div>
        <div className="flex px-5 py-4 border-b border-white/5 text-[12px]">
          <div className="w-[120px] text-[var(--text-sub)]">SOCKS5 代理</div>
          <div className="flex-1 text-[var(--text-main)] font-mono">{selectedAccount.proxy || "not_set"}</div>
        </div>
        <div className="flex px-5 py-4 text-[12px]">
          <div className="w-[120px] text-[var(--text-sub)]">备注说明</div>
          <div className="flex-1 text-[var(--text-sub)] italic">{selectedAccount.remark || "not_set"}</div>
        </div>
      </div>
    </>
  );
}
