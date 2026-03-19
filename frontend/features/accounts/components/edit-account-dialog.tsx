"use client";

import { PencilSimple, Spinner, X } from "@phosphor-icons/react";

interface EditAccountDialogProps {
  open: boolean;
  title: string;
  accountName: string;
  remark: string;
  proxy: string;
  isSaving: boolean;
  proxyTesting: boolean;
  t: (key: string) => string;
  onClose: () => void;
  onSave: () => void;
  onRemarkChange: (value: string) => void;
  onProxyChange: (value: string) => void;
  onClearProxy: () => void;
  onTestProxy: (proxyValue: string) => void;
}

export function EditAccountDialog({
  open,
  title,
  accountName,
  remark,
  proxy,
  isSaving,
  proxyTesting,
  t,
  onClose,
  onSave,
  onRemarkChange,
  onProxyChange,
  onClearProxy,
  onTestProxy,
}: EditAccountDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="glass-panel modal-content !max-w-[440px] !p-0 overflow-hidden animate-zoom-in border-white/5" onClick={(event) => event.stopPropagation()}>
        <header className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <PencilSimple weight="bold" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">{title}</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5 font-bold">Account Preferences</p>
            </div>
          </div>
          <button className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]" onClick={onClose}>
            <X weight="bold" size={18} />
          </button>
        </header>

        <div className="p-6 space-y-6">
          <div>
            <label className="text-[11px] mb-1">{t("session_name")}</label>
            <input type="text" className="!py-2.5 !px-4 !mb-4" value={accountName} disabled />

            <label className="text-[11px] mb-1">{t("remark")}</label>
            <input
              type="text"
              className="!py-2.5 !px-4 !mb-4"
              placeholder={t("remark_placeholder")}
              value={remark}
              onChange={(event) => onRemarkChange(event.target.value)}
            />

            <label className="text-[11px] mb-1">{t("proxy")}</label>
            <div className="flex gap-2 !mb-4 items-center relative">
              <input
                type="text"
                className="!py-2.5 !px-4 flex-1"
                placeholder={t("proxy_placeholder")}
                style={{ marginBottom: 0 }}
                value={proxy}
                onChange={(event) => onProxyChange(event.target.value)}
              />
              {proxy ? (
                <button className="absolute right-16 text-xs text-rose-400 opacity-60 hover:opacity-100" onClick={onClearProxy} title={t("clear_proxy")}>
                  <X weight="bold" />
                </button>
              ) : null}
              <button className="btn-secondary !h-[42px] px-3 text-xs flex-shrink-0" onClick={() => onTestProxy(proxy)} disabled={proxyTesting || !proxy}>
                {proxyTesting ? <Spinner className="animate-spin" size={16} /> : t("proxy_test")}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="linear-btn-secondary flex-1 h-11" onClick={onClose}>
              {t("cancel")}
            </button>
            <button className="linear-btn-primary flex-1 h-11 !font-bold" onClick={onSave} disabled={isSaving}>
              {isSaving ? <Spinner className="animate-spin" /> : t("save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
