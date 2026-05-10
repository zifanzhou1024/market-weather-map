/**
 * Single source of truth for the chart-state union and the visual pill that
 * renders it.
 *
 * Each state has a distinct CSS modifier so the badge remains accessible by
 * text and by class even if the palette shifts. The visible label text is
 * sentence case for descriptive tone (matches docs/LIMITATIONS.md — no
 * advice language, just descriptive state).
 *
 * Re-exported by InsightCallout and InteractiveChartShell so consumers can
 * import the union once.
 */

export type ChartState =
  | "risk"
  | "support"
  | "mixed"
  | "calm"
  | "watch"
  | "stale-data";

const STATE_LABEL: Record<ChartState, string> = {
  risk: "Risk",
  support: "Support",
  mixed: "Mixed",
  calm: "Calm",
  watch: "Watch",
  "stale-data": "Stale data"
};

export interface ChartStateBadgeProps {
  state: ChartState;
  /**
   * Optional override for the visible label. Defaults to the canonical label
   * from STATE_LABEL. Useful when a caller wants to surface the same state
   * with a context-specific phrasing (e.g. "Stale freshness" instead of
   * "Stale data") without losing the underlying class hook.
   */
  label?: string;
}

export default function ChartStateBadge({ state, label }: ChartStateBadgeProps) {
  const text = label ?? STATE_LABEL[state];
  return (
    <span
      className={`chart-state-badge chart-state-badge--${state}`}
      aria-label={text}
    >
      {text}
    </span>
  );
}
