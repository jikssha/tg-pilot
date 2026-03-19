"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-panel p-20 flex flex-col items-center text-center justify-center border-dashed border-2 group transition-all",
        className
      )}
    >
      <div className="w-20 h-20 rounded-3xl bg-main/5 flex items-center justify-center text-main/20 mb-6 group-hover:scale-110 transition-transform group-hover:bg-[var(--accent-glow)]/10 group-hover:text-[var(--accent-glow)]">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-[#9496a1] max-w-xl">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
