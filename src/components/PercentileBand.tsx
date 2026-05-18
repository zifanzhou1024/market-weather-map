import type { CockpitDirection } from "../lib/types";

interface PercentileBandProps {
  percentile: number | null;
  direction: CockpitDirection;
  /** Window the percentile was computed against (default 5y, ~1260 trading days). */
  windowDays?: number;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Inline-SVG percentile band used by cockpit cells.
 *
 * Design notes:
 * - Anchors every cockpit number with "is this high or low?" context.
 * - Stable 8px default height — enough to read, not enough to dominate the cell.
 * - Direction-aware coloring: `risk` cells tint hot at high pctile,
 *   `support` cells tint hot at low pctile, `neutral` stays gray. The actual
 *   tint lives in CSS (Task 2.10); this component just emits the class hooks.
 * - `null` percentile renders a muted "pct n/a" placeholder so the cell height
 *   stays stable across rows where the window hasn't built up yet.
 * - aria-label combines the percentile value and the window context so the
 *   number is announced with its baseline.
 */
function windowLabel(days?: number): string {
  if (!days || days >= 1200) return "5y";
  if (days >= 240) return "1y";
  if (days >= 60) return "3m";
  return `${days}d`;
}

export default function PercentileBand({
  percentile,
  direction,
  windowDays,
  width = 100,
  height = 8,
  className,
}: PercentileBandProps) {
  if (percentile === null) {
    return (
      <span
        className={`percentile-band percentile-band--na ${className ?? ""}`.trim()}
        aria-label="percentile not available"
      >
        pct n/a
      </span>
    );
  }
  const clamped = Math.max(0, Math.min(100, percentile));
  const x = (clamped / 100) * width;
  const label = windowLabel(windowDays);
  return (
    <span
      className={`percentile-band percentile-band--${direction} ${className ?? ""}`.trim()}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${Math.round(clamped)}th percentile (${label})`}
      >
        <rect x={0} y={0} width={width} height={height} className="percentile-band__track" />
        <line
          x1={x}
          x2={x}
          y1={0}
          y2={height}
          className="percentile-band__tick"
          strokeWidth={2}
          stroke="currentColor"
        />
      </svg>
    </span>
  );
}
