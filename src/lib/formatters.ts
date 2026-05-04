import type { DataStatus } from "./types";

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatPercentile(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${Math.round(value)}%`;
}

export function formatSigned(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  return value;
}

export function statusLabel(status: DataStatus): string {
  const labels: Record<DataStatus, string> = {
    ok: "OK",
    stale: "Stale",
    partial: "Partial",
    failed: "Failed",
    terms_review_needed: "Terms Review Needed",
    unavailable: "Unavailable"
  };
  return labels[status];
}
