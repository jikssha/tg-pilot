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

  const outerClass =
    presentation.tone === "online"
      ? "bg-emerald-500/20 border border-emerald-300/50 shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_14px_rgba(16,185,129,0.26)]"
      : presentation.tone === "checking"
        ? "bg-amber-400/15 border border-amber-200/40 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.18)]"
        : presentation.tone === "invalid"
          ? "bg-rose-500/18 border border-rose-200/45 shadow-[0_0_12px_rgba(244,63,94,0.18)]"
          : presentation.tone === "error"
            ? "bg-orange-400/18 border border-orange-200/45 shadow-[0_0_12px_rgba(251,146,60,0.16)]"
            : "bg-slate-500/12 border border-slate-300/15";

  const innerClass =
    presentation.tone === "online"
      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
      : presentation.tone === "checking"
        ? "bg-amber-300"
        : presentation.tone === "invalid"
          ? "bg-rose-400"
          : presentation.tone === "error"
            ? "bg-orange-300"
            : "bg-slate-400/70";

  return (
    <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`.trim()}>
      <span
        data-testid={testId}
        data-status-tone={presentation.tone}
        aria-label={label}
        title={label}
        className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${SIZE_CLASS[size]} ${outerClass}`}
      >
        <span className={`absolute inset-[2.5px] rounded-full ${innerClass}`} />
      </span>
      {showLabel ? <span className={labelClassName}>{label}</span> : null}
    </span>
  );
}
