/**
 * Pure formatters used by ECharts options (axis labels, tooltips). Defined as
 * plain functions so they can be tested without React or the ECharts runtime.
 */

const EM_DASH = "—";

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatSignedScore(value: number, fractionDigits = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  });
}

export function formatIsoDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

export function formatShortDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
