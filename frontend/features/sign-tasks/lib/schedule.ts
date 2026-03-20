"use client";

const DEFAULT_FIXED_TIME = "06:00";

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

export function normalizeFixedTime(value?: string | null, fallback: string = DEFAULT_FIXED_TIME) {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!match) return fallback;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

export function cronToFixedTime(signAt?: string | null, fallback: string = DEFAULT_FIXED_TIME) {
  if (!signAt) return fallback;
  const parts = signAt.trim().split(/\s+/);
  if (parts.length !== 5) return fallback;

  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

export function fixedTimeToCron(value?: string | null, fallback: string = "0 6 * * *") {
  const normalized = normalizeFixedTime(value, "");
  if (!normalized) return fallback;
  const [hour, minute] = normalized.split(":").map(Number);
  return `${minute} ${hour} * * *`;
}

export function formatTaskScheduleDisplay(
  executionMode: "fixed" | "range" | undefined,
  signAt?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
) {
  if (executionMode === "range" && rangeStart && rangeEnd) {
    return `${normalizeFixedTime(rangeStart, rangeStart)} - ${normalizeFixedTime(rangeEnd, rangeEnd)}`;
  }
  return cronToFixedTime(signAt);
}
