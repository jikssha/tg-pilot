"use client";

import { Clock, Gear, ShieldCheck, TerminalWindow, Trash } from "@phosphor-icons/react";
import { PropsWithChildren } from "react";
import { AccountInfo, AccountStatusItem } from "@/lib/api";

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
  return (
    <>
      <div className="mb-8 group">
        <h1 className="text-2xl font-semibold mb-1 flex items-center gap-3 text-[var(--text-main)]">
          {selectedAccount.name}
          {selectedStatus?.status === "valid" ? (
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.3)] inline-block" />
          ) : selectedStatus?.status === "checking" ? (
            <span className="w-2.5 h-2.5 bg-amber-400/50 rounded-full animate-pulse inline-block" />
          ) : (
            <span className="w-2.5 h-2.5 border border-rose-500 rounded-full inline-block" />
          )}

          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onShowLogs(selectedAccount.name);
              }}
              className="p-1.5 rounded-md text-sky-400 hover:text-sky-500 hover:bg-sky-500/10 transition-colors"
              title={isZh ? "运行日志" : "Running Logs"}
            >
              <TerminalWindow weight="bold" size={18} />
            </button>
            <button
              className="p-1.5 rounded-md text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              onClick={(event) => {
                event.stopPropagation();
                onShowDelete(selectedAccount.name);
              }}
              title={t("remove")}
            >
              <Trash weight="bold" size={18} />
            </button>
          </div>
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="flex items-center gap-1.5 bg-white/5 py-1.5 px-3 rounded-md border border-white/5">
            <Clock weight="bold" />
            {selectedStatus?.checked_at ? new Date(selectedStatus.checked_at).toLocaleTimeString() : t("account_status_checking")}{" "}
            {selectedStatus?.status === "valid" ? ` (${t("connected")})` : ` (${t("account_status_invalid")})`}
          </div>
          <span className="bg-white/5 border border-[var(--border-color)] px-2.5 py-1 rounded-md text-xs text-[var(--text-sub)] inline-flex items-center gap-1.5">
            <ShieldCheck weight="bold" /> 安全监控中
          </span>
        </div>
      </div>

      {selectedStatus?.needs_relogin ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="text-sm text-red-400 font-medium flex items-center gap-2">
            <span className="text-lg">!</span> {t("account_relogin_required")}
          </div>
          <button
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded text-xs font-medium transition-colors"
            onClick={() => onRelogin(selectedAccount)}
          >
            重新登录
          </button>
        </div>
      ) : null}

      <div className="mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        {children}
      </div>

      <div className="border border-[var(--border-color)] rounded-lg bg-[rgba(255,255,255,0.01)] mb-8 overflow-hidden animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="px-4 py-3 border-b border-[var(--border-color)] text-[12px] font-semibold flex items-center justify-between bg-[rgba(255,255,255,0.02)] text-[var(--text-main)]">
          <div className="flex items-center gap-2">
            <Gear weight="bold" /> 代理设置
          </div>
          <button className="text-[var(--accent-glow)] hover:underline text-xs font-mono" onClick={() => onEditAccount(selectedAccount)}>
            Edit
          </button>
        </div>
        <div className="flex px-4 py-3 border-b border-white/5 text-[12px]">
          <div className="w-[120px] text-[var(--text-sub)]">SOCKS5 代理</div>
          <div className="flex-1 text-[var(--text-main)] font-mono">{selectedAccount.proxy || "not_set"}</div>
        </div>
        <div className="flex px-4 py-3 text-[12px]">
          <div className="w-[120px] text-[var(--text-sub)]">备注说明</div>
          <div className="flex-1 text-[var(--text-sub)] italic">{selectedAccount.remark || "not_set"}</div>
        </div>
      </div>
    </>
  );
}
