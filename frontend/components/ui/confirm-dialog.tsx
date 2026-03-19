"use client";

import { ReactNode } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  hint?: string;
  icon: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  confirmClassName?: string;
  confirmIcon?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  hint,
  icon,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmDisabled,
  cancelDisabled,
  confirmClassName,
  confirmIcon,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <DialogShell
      title={title}
      icon={icon}
      onClose={onCancel}
      maxWidthClassName="!max-w-md"
      closeDisabled={cancelDisabled}
      bodyClassName="p-8 space-y-4 text-center"
      footer={
        <>
          <button
            className="linear-btn-secondary flex-1 h-11 text-[11px] font-black uppercase tracking-widest"
            onClick={onCancel}
            disabled={cancelDisabled}
          >
            {cancelLabel}
          </button>
          <button
            className={confirmClassName ?? "flex-1 h-11 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2"}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmIcon}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-white/80 leading-relaxed font-medium">{description}</p>
      {hint ? <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-black italic">{hint}</p> : null}
    </DialogShell>
  );
}
