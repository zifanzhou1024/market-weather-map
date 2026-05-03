import { formatPercentile } from "../lib/formatters";

interface PercentileBandChartProps {
  percentile: number | null | undefined;
}

function clampPercentile(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export default function PercentileBandChart({ percentile }: PercentileBandChartProps) {
  const width = clampPercentile(percentile);
  const hasPercentile = percentile !== null && percentile !== undefined && !Number.isNaN(percentile);
  const meterProps = hasPercentile ? { "aria-valuenow": width } : {};

  return (
    <section className="panel percentile-panel" aria-label="252-day percentile">
      <div className="section-header">
        <p className="eyebrow">Percentile</p>
        <h3>252-day rank</h3>
      </div>
      <div
        className="percentile-band"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={formatPercentile(percentile)}
        {...meterProps}
      >
        <span className="percentile-fill" style={{ width: `${width}%` }} />
      </div>
      <p className="percentile-label">{formatPercentile(percentile)}</p>
    </section>
  );
}
