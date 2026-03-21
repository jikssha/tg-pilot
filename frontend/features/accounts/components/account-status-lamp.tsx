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
  sm: "w-[14px] h-[14px]",
  md: "w-[18px] h-[18px]",
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
      ? "bg-emerald-400 border border-emerald-100/80 ring-2 ring-emerald-500/25 shadow-[0_0_0_2px_rgba(16,185,129,0.16),0_0_18px_rgba(52,211,153,0.45)]"
      : presentation.tone === "checking"
        ? "bg-amber-400 border border-amber-100/60 animate-pulse ring-2 ring-amber-500/15 shadow-[0_0_14px_rgba(251,191,36,0.28)]"
        : presentation.tone === "invalid"
          ? "bg-rose-500 border border-rose-100/60 ring-2 ring-rose-500/25 shadow-[0_0_14px_rgba(244,63,94,0.22)]"
          : presentation.tone === "error"
            ? "bg-orange-400 border border-orange-100/60 ring-2 ring-orange-400/20 shadow-[0_0_14px_rgba(251,146,60,0.2)]"
            : "bg-slate-500/80 border border-slate-200/20 ring-2 ring-slate-400/10";

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
