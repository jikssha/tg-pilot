"use client";

import { ClipboardText, Spinner, X } from "@phosphor-icons/react";

interface BulkImportDialogProps {
  open: boolean;
  isZh: boolean;
  selectedCount: number;
  value: string;
  loading: boolean;
  t: (key: string) => string;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function BulkImportDialog({
  open,
  isZh,
  selectedCount,
  value,
  loading,
  t,
  onClose,
  onChange,
  onSubmit,
}: BulkImportDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="glass-panel modal-content !max-w-3xl !p-0 overflow-hidden animate-zoom-in border-white/5 flex flex-col" onClick={(event) => event.stopPropagation()}>
        <header className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ClipboardText weight="bold" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">{isZh ? "批量导入任务配置" : "Bulk Import Config"}</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5 font-bold">Fast Configuration Migration</p>
            </div>
          </div>
          <button className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]" onClick={onClose} disabled={loading}>
            <X weight="bold" size={18} />
          </button>
        </header>

        <div className="p-8 space-y-6">
          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/10 text-[11px] text-sky-400/80 leading-relaxed font-bold">
            {isZh
              ? "支持粘贴单个任务对象，或多个任务组成的数组。系统会把包内所有任务批量分发到当前选中的账号。"
              : "Paste a single task object or an array of tasks. Every task in the payload will be distributed to the selected accounts."}
          </div>
          <textarea
            className="w-full h-80 !mb-0 font-mono text-[11px] bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl p-5 custom-scrollbar"
            placeholder={isZh ? '[{"task_name":"任务1", ...}]' : '[{"task_name":"Task 1", ...}]'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>

        <footer className="p-5 border-t border-white/5 flex gap-3 bg-white/[0.01]">
          <button className="linear-btn-secondary flex-1 h-11" onClick={onClose} disabled={loading}>
            {t("cancel")}
          </button>
          <button
            className="bg-sky-500 hover:bg-sky-600 active:scale-95 text-white flex-[2] rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(14,165,233,0.15)]"
            onClick={onSubmit}
            disabled={loading || !value.trim()}
          >
            {loading ? <Spinner className="animate-spin" /> : <ClipboardText weight="bold" size={18} />}
            {isZh ? `立即分发至 ${selectedCount} 个账号` : `Distribute to ${selectedCount} accounts`}
          </button>
        </footer>
      </div>
    </div>
  );
}
