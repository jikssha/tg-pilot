"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogShell } from "@/components/ui/dialog-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SignTaskHistoryItem } from "@/lib/api";
import { ClipboardText, Files, Info, Lightning, ListDashes, Spinner, Trash, Warning } from "@phosphor-icons/react";

interface CopyTaskDialogState {
  taskName: string;
  config: string;
}

interface SignTaskDialogsProps {
  copyTaskDialog: CopyTaskDialogState | null;
  copyTaskDialogTitle: string;
  copyTaskDialogDesc: string;
  copyConfigAction: string;
  copyingConfig: boolean;
  pasteTaskTitle: string;
  pasteTaskDescription: string;
  pasteTaskPlaceholder: string;
  showPasteDialog: boolean;
  pasteTaskConfigInput: string;
  importingPastedConfig: boolean;
  historyTaskName: string | null;
  historyLogs: SignTaskHistoryItem[];
  historyLoading: boolean;
  showFailedOnly: boolean;
  showDeleteTaskDialog: boolean;
  deleteTaskName: string | null;
  loading: boolean;
  isZh: boolean;
  t: (key: string) => string;
  onCloseCopyDialog: () => void;
  onCopyTaskConfig: () => void;
  onClosePasteDialog: () => void;
  onPasteTaskConfigChange: (value: string) => void;
  onImportPastedTask: () => void;
  onCloseHistory: () => void;
  onToggleFailedOnly: () => void;
  onCloseDeleteDialog: () => void;
  onConfirmDeleteTask: () => void;
}

export function SignTaskDialogs({
  copyTaskDialog,
  copyTaskDialogTitle,
  copyTaskDialogDesc,
  copyConfigAction,
  copyingConfig,
  pasteTaskTitle,
  pasteTaskDescription,
  pasteTaskPlaceholder,
  showPasteDialog,
  pasteTaskConfigInput,
  importingPastedConfig,
  historyTaskName,
  historyLogs,
  historyLoading,
  showFailedOnly,
  showDeleteTaskDialog,
  deleteTaskName,
  loading,
  isZh,
  t,
  onCloseCopyDialog,
  onCopyTaskConfig,
  onClosePasteDialog,
  onPasteTaskConfigChange,
  onImportPastedTask,
  onCloseHistory,
  onToggleFailedOnly,
  onCloseDeleteDialog,
  onConfirmDeleteTask,
}: SignTaskDialogsProps) {
  return (
    <>
      {copyTaskDialog ? (
        <DialogShell
          title={copyTaskDialogTitle}
          description="Configuration Export Protocol"
          icon={
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
              <Files weight="bold" size={24} />
            </div>
          }
          onClose={onCloseCopyDialog}
          closeDisabled={copyingConfig}
          bodyClassName="p-10 space-y-6"
          footer={
            <>
              <button
                className="h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-black uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex-1"
                onClick={onCloseCopyDialog}
                disabled={copyingConfig}
              >
                {t("close")}
              </button>
              <button
                className="bg-sky-500 hover:bg-sky-600 active:scale-95 text-white flex-[2] h-12 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(14,165,233,0.3)]"
                onClick={onCopyTaskConfig}
                disabled={copyingConfig}
              >
                {copyingConfig ? <Spinner className="animate-spin text-white" /> : <ClipboardText weight="bold" size={18} />}
                {copyConfigAction}
              </button>
            </>
          }
        >
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-black flex items-center gap-2">
            <Info size={14} weight="bold" />
            {copyTaskDialogDesc}
          </p>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-b from-sky-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur" />
            <textarea
              className="relative w-full h-80 !mb-0 font-mono text-[11px] bg-black/60 border-white/5 rounded-2xl p-6 custom-scrollbar shadow-inner text-sky-100/60 focus:text-sky-300 focus:border-sky-500/30 transition-all outline-none"
              value={copyTaskDialog.config}
              readOnly
            />
          </div>
        </DialogShell>
      ) : null}

      {showPasteDialog ? (
        <DialogShell
          title={pasteTaskTitle}
          description="Configuration Import Protocol"
          icon={
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <ClipboardText weight="bold" size={24} />
            </div>
          }
          onClose={onClosePasteDialog}
          closeDisabled={importingPastedConfig || loading}
          bodyClassName="p-10 space-y-6"
          footer={
            <>
              <button
                className="h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-black uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex-1"
                onClick={onClosePasteDialog}
                disabled={importingPastedConfig || loading}
              >
                {t("cancel")}
              </button>
              <button
                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex-[2] h-12 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
                onClick={onImportPastedTask}
                disabled={importingPastedConfig || loading}
              >
                {importingPastedConfig ? <Spinner className="animate-spin text-white" /> : <Lightning weight="bold" size={18} />}
                {t("execute_import")}
              </button>
            </>
          }
        >
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-black flex items-center gap-2">
            <Info size={14} weight="bold" />
            {pasteTaskDescription}
          </p>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur" />
            <textarea
              className="relative w-full h-80 !mb-0 font-mono text-[11px] bg-black/60 border-white/5 rounded-2xl p-6 custom-scrollbar shadow-inner text-emerald-100/60 focus:text-emerald-300 focus:border-emerald-500/30 transition-all outline-none"
              placeholder={pasteTaskPlaceholder}
              value={pasteTaskConfigInput}
              onChange={(event) => onPasteTaskConfigChange(event.target.value)}
            />
          </div>
        </DialogShell>
      ) : null}

      {historyTaskName ? (
        <DialogShell
          title={t("task_history_logs_title").replace("{name}", historyTaskName)}
          description="Protocol Execution Archives"
          icon={
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <ListDashes weight="bold" size={24} />
            </div>
          }
          onClose={onCloseHistory}
          maxWidthClassName="!max-w-5xl !h-[85vh]"
          bodyClassName="flex-1 overflow-y-auto p-8 bg-black/20 custom-scrollbar-premium"
          footer={
            <div className="w-full flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 text-[10px] font-black text-white/10 uppercase tracking-widest">
                <Info size={14} weight="bold" />
                {isZh ? "所有执行记录均采用异步加密存储" : "Asynchronous encrypted storage enabled"}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Vault Synchronized</span>
              </div>
            </div>
          }
        >
          <div className="flex justify-end mb-6">
            <label className="flex items-center gap-3 cursor-pointer group px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-rose-500/20 transition-all">
              <input type="checkbox" className="!w-4 !h-4 accent-rose-500" checked={showFailedOnly} onChange={onToggleFailedOnly} />
              <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${showFailedOnly ? "text-rose-400" : "text-white/20 group-hover:text-white/40"}`}>
                {isZh ? "异常检测" : "Anomaly Only"}
              </span>
            </label>
          </div>

          {historyLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 text-white/5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-white/[0.02] border-t-indigo-500/40 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Synchronizing Data...</span>
            </div>
          ) : historyLogs.filter((log) => !showFailedOnly || !log.success).length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={<ListDashes size={64} weight="thin" />}
                title={t("task_history_empty")}
                description={isZh ? "当前没有符合筛选条件的任务历史记录。" : "There are no task history records that match the current filters."}
                className="opacity-30 border-white/5 bg-transparent"
              />
            </div>
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto pb-12">
              {historyLogs
                .filter((log) => !showFailedOnly || !log.success)
                .map((log, index) => (
                  <div key={`${log.time}-${index}`} className="rounded-3xl border border-white/5 bg-white/[0.015] overflow-hidden hover:bg-white/[0.03] hover:border-white/10 transition-all group shadow-inner">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-white/[0.03] bg-white/[0.01]">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2.5 px-3 py-1 rounded-full border ${log.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse"}`}>
                          <div className={`w-1 h-1 rounded-full ${log.success ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-rose-500"}`} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {log.success ? t("success") : "Protocol Failure"}
                          </span>
                        </div>
                        <span className="text-[11px] font-black text-white/20 uppercase tracking-widest font-mono">
                          [{new Date(log.time).toLocaleString(isZh ? "zh-CN" : "en-US", { hour12: false })}]
                        </span>
                      </div>
                      <div className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em]">
                        Record ID: {log.time.split("T")[0].replace(/-/g, "")}
                        {index}
                      </div>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-start justify-between gap-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Target Object</p>
                          <p className="text-[13px] font-bold text-white group-hover:text-[#8a3ffc] transition-colors">{historyTaskName}</p>
                        </div>
                        {log.message ? (
                          <div className="flex-1 max-w-md text-right">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Gateway Message</p>
                            <p className="text-[11px] text-white/40 leading-relaxed font-medium line-clamp-2">{log.message}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-white/5" />
                          <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em]">Runtime Intelligence</span>
                          <div className="h-px flex-1 bg-white/5" />
                        </div>

                        {log.flow_logs && log.flow_logs.length > 0 ? (
                          <div className="relative group/logs">
                            <div className="absolute -inset-0.5 bg-gradient-to-b from-white/5 to-transparent rounded-2xl opacity-0 group-hover/logs:opacity-100 transition-opacity" />
                            <div className="relative space-y-1.5 bg-black/60 p-6 rounded-2xl border border-white/5 font-mono shadow-inner overflow-hidden">
                              {log.flow_logs.map((line, lineIndex) => (
                                <div key={lineIndex} className="text-white/60 flex gap-4 text-[10px] hover:text-white transition-colors">
                                  <span className="text-white/5 select-none w-5 text-right font-black tracking-tighter shrink-0 italic border-r border-white/[0.03] pr-2">
                                    {(lineIndex + 1).toString().padStart(2, "0")}
                                  </span>
                                  <span className="break-all font-medium">{line}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="py-10 rounded-2xl border border-dashed border-white/5 flex items-center justify-center">
                            <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">{t("task_history_no_flow")}</span>
                          </div>
                        )}
                      </div>

                      {log.flow_truncated ? (
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-500/[0.03] border border-amber-500/10">
                          <Warning size={14} weight="bold" className="text-amber-500" />
                          <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">
                            {t("task_history_truncated").replace("{count}", String(log.flow_line_count || 0))}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </DialogShell>
      ) : null}

      <ConfirmDialog
        open={showDeleteTaskDialog}
        title={isZh ? "确认删除任务" : "Terminate Task"}
        description={isZh ? `确定要删除任务 “${deleteTaskName || ""}” 吗？` : `Confirm termination of task "${deleteTaskName || ""}"?`}
        hint="This action is irreversible / Session will be purged"
        icon={
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
            <Trash weight="bold" size={20} />
          </div>
        }
        cancelLabel={t("cancel")}
        confirmLabel={isZh ? "立即终止" : "Terminate"}
        onCancel={onCloseDeleteDialog}
        onConfirm={onConfirmDeleteTask}
        confirmDisabled={loading}
        cancelDisabled={loading}
        confirmClassName="flex-1 h-11 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-[0_4px_20px_rgba(244,63,94,0.3)] transition-all flex items-center justify-center gap-2"
        confirmIcon={loading ? <Spinner className="animate-spin text-white" /> : <Trash weight="bold" size={16} />}
      />
    </>
  );
}
