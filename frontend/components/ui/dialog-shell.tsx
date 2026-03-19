"use client";

import { PropsWithChildren, ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface DialogShellProps extends PropsWithChildren {
  title: string;
  description?: string;
  icon?: ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  closeDisabled?: boolean;
  className?: string;
}

export function DialogShell({
  title,
  description,
  icon,
  onClose,
  maxWidthClassName = "!max-w-3xl",
  bodyClassName,
  footer,
  closeDisabled,
  className,
  children,
}: DialogShellProps) {
  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className={cn(
          "glass-panel modal-content !p-0 overflow-hidden animate-zoom-in border-white/5 flex flex-col bg-[#050505]",
          maxWidthClassName,
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div className="flex items-center gap-5">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <div>
              <h3 className="text-sm font-black tracking-tight uppercase italic">{title}</h3>
              {description ? (
                <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all flex items-center justify-center"
            disabled={closeDisabled}
          >
            <X weight="bold" size={18} />
          </button>
        </header>

        <div className={cn("p-8", bodyClassName)}>{children}</div>
        {footer ? <footer className="p-8 border-t border-white/5 flex gap-4 bg-white/[0.01]">{footer}</footer> : null}
      </div>
    </div>
  );
}
