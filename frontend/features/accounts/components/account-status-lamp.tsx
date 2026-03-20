"use client";

import { AccountStatusItem } from "@/lib/api";
import { normalizeAccountStatus } from "@/features/accounts/lib/account-status";

interface AccountStatusLampProps {
  status?: AccountStatusItem | null;
  t: (key: string) => string;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
  labelClassName?: string;
  testId?: string;
}

const SIZE_CLASS = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
} as const;

export function AccountStatusLamp({
  status,
  t,
  size = "sm",
  showLabel = false,
  className = "",
  labelClassName = "",
  testId,
}: AccountStatusLampProps) {
  const presentation = normalizeAccountStatus(status);
  const label = t(presentation.labelKey);

  const lampClass =
    presentation.tone === "online"
      ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
      : presentation.tone === "checking"
        ? "bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.2)]"
        : presentation.tone === "invalid"
          ? "bg-rose-500 ring-2 ring-rose-500/20"
          : presentation.tone === "error"
            ? "bg-orange-400 ring-2 ring-orange-400/15"
            : "bg-slate-500/60";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <span
        data-testid={testId}
        data-status-tone={presentation.tone}
        aria-label={label}
        title={label}
        className={`${SIZE_CLASS[size]} rounded-full shrink-0 ${lampClass}`}
      />
      {showLabel ? <span className={labelClassName}>{label}</span> : null}
    </span>
  );
}

