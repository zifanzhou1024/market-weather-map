/**
 * Range-preset time-window helper for chart components.
 *
 * `buildTimeWindow` filters a date-keyed series down to the most recent slice
 * defined by a preset (1M, 3M, 6M, 1Y, 3Y, All). Pure, deterministic, and
 * defensive against non-monotonic input (it sorts ascending by date before
 * applying the cutoff).
 *
 * Day-count interpretation per preset:
 *   1M  →  30 days
 *   3M  →  90 days
 *   6M  → 180 days
 *   1Y  → 365 days
 *   3Y  → 3 * 365 days
 *   All → no cutoff (returns the full series)
 *
 * The cutoff is computed from the latest date in the series (the rightmost
 * point after sorting), not from "today" — this keeps the helper deterministic
 * for backfill and snapshot data.
 */

export type RangePreset = "1M" | "3M" | "6M" | "1Y" | "3Y" | "All";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DAY_COUNT_BY_PRESET: Record<Exclude<RangePreset, "All">, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 3 * 365
};

function parseDate(value: string): number {
  // Use Date constructor; "YYYY-MM-DD" is parsed as UTC midnight in JS, which
  // is fine for window comparisons since we only need ordering and delta-days.
  return new Date(value).getTime();
}

export function buildTimeWindow<T extends { date: string }>(
  series: T[],
  preset: RangePreset
): T[] {
  if (series.length === 0) return [];

  // Defensive: sort ascending by date so the rightmost element is the latest.
  // Caller may pass arbitrary order; we never mutate the input.
  const sorted = [...series].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  if (preset === "All") return sorted;

  const days = DAY_COUNT_BY_PRESET[preset];
  const latestMs = parseDate(sorted[sorted.length - 1].date);
  const cutoffMs = latestMs - days * MS_PER_DAY;

  return sorted.filter((point) => parseDate(point.date) >= cutoffMs);
}
