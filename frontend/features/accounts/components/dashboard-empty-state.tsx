"use client";

import { ListDashes, Plus } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";

interface DashboardEmptyStateProps {
  t: (key: string) => string;
  onAddAccount: () => void;
}

export function DashboardEmptyState({ t, onAddAccount }: DashboardEmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-[var(--text-sub)] mt-20">
      <EmptyState
        icon={<ListDashes size={40} />}
        title="Select an account"
        description="Choose an account from the sidebar to inspect tasks, status, logs, and proxy settings."
        action={
          <button onClick={onAddAccount} className="linear-btn-secondary">
            <Plus weight="bold" /> {t("add_account")}
          </button>
        }
        className="border-white/5 bg-transparent"
      />
    </div>
  );
}
