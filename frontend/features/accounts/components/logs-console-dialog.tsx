"use client";

import { AccountLog } from "@/lib/api";
import { DialogShell } from "@/components/ui/dialog-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ListDashes, Spinner, TerminalWindow, Trash } from "@phosphor-icons/react";

interface LogsConsoleDialogProps {
  open: boolean;
  accountName: string;
  logs: AccountLog[];
  loading: boolean;
  isZh: boolean;
  t: (key: string) => string;
  onClose: () => void;
  onClearLogs: () => void;
}

export function LogsConsoleDialog({
  open,
  accountName,
  logs,
  loading,
  isZh,
  t,
  onClose,
  onClearLogs,
}: LogsConsoleDialogProps) {
  if (!open) return null;

  return (
    <DialogShell
      title={isZh ? "运行日志控制台" : "Running Logs Console"}
      description={`${accountName} / System Event Stream`}
      icon={
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
          <TerminalWindow weight="bold" size={20} />
        </div>
      }
      onClose={onClose}
      maxWidthClassName="!max-w-5xl !h-[85vh]"
      bodyClassName="flex-1 overflow-y-auto p-8 bg-black/40 custom-scrollbar relative"
      footer={
        <div className="w-full flex justify-between items-center">
          <button
            className="h-9 px-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center gap-2"
            onClick={onClearLogs}
            disabled={loading}
          >
            <Trash weight="bold" size={14} />
            {isZh ? "清空日志" : "Clear Logs"}
          </button>
          <p className="text-[9px] text-white/10 uppercase tracking-[0.3em] font-black italic">System Event Stream Protocol v1.0</p>
        </div>
      }
    >
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <Spinner className="animate-spin text-sky-400" size={32} weight="bold" />
          <span className="text-[10px] font-black translation-all text-white/20 uppercase tracking-[0.2em]">{t("loading")}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <EmptyState
            icon={<ListDashes size={48} weight="thin" className="opacity-10" />}
            title={isZh ? "暂无运行数据" : "No Execution Logs"}
            description={isZh ? "账号最近还没有产生可展示的执行日志。" : "There are no execution logs for this account yet."}
            className="border-white/5 bg-transparent"
          />
        </div>
      ) : (
        <div className="space-y-4 font-mono">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`group p-5 rounded-2xl border transition-all hover:translate-x-1 ${
                log.success
                  ? "bg-emerald-500/[0.02] border-emerald-500/5 hover:border-emerald-500/20"
                  : "bg-rose-500/[0.02] border-rose-500/5 hover:border-rose-500/20"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${log.success ? "bg-emerald-500" : "bg-rose-500"} shadow-[0_0_10px_currentColor]`} />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{log.task_name || "System"}</span>
                </div>
                <span className="text-[10px] text-white/20 font-bold whitespace-nowrap bg-black/40 px-3 py-1 rounded-full border border-white/5">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              <div className={`text-xs leading-relaxed font-medium break-words ${log.success ? "text-white/80" : "text-rose-200/90"}`}>
                {log.message}
              </div>
              {log.bot_message ? (
                <div className="mt-4 p-4 rounded-xl bg-black/40 border border-white/5 text-[10px] text-sky-400/60 break-all border-dashed">
                  <span className="text-white/20 mr-2 uppercase font-black tracking-tighter">Bot Notification:</span>
                  {log.bot_message}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </DialogShell>
  );
}
