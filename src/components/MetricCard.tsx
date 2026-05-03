import { formatDate, formatNumber, formatPercentile, formatSigned } from "../lib/formatters";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

interface MetricCardProps {
  series: TimeSeriesFile;
  catalogEntry?: SeriesCatalogEntry;
}

export default function MetricCard({ series, catalogEntry }: MetricCardProps) {
  const summary = series.summary;
  const latestObservation = series.observations[series.observations.length - 1];
  const latestValue = summary?.latest_value ?? latestObservation?.value;
  const latestDate = summary?.latest_date ?? latestObservation?.date;
  const percentile = summary?.percentile_252d ?? latestObservation?.percentile_252d;
  const source = catalogEntry?.source ?? series.source;
  const units = catalogEntry?.units ?? series.units;

  return (
    <article className="metric-card">
      <div className="metric-card__header">
        <p className="metric-source">{source}</p>
        <h3>{catalogEntry?.name ?? series.series_id}</h3>
      </div>
      <div className="metric-value">
        <strong>{formatNumber(latestValue)} </strong>
        <span>{units}</span>
      </div>
      <dl className="metric-stats">
        <div>
          <dt>1D</dt>
          <dd>{formatSigned(summary?.change_1d)}</dd>
        </div>
        <div>
          <dt>1W</dt>
          <dd>{formatSigned(summary?.change_1w)}</dd>
        </div>
        <div>
          <dt>1M</dt>
          <dd>{formatSigned(summary?.change_1m)}</dd>
        </div>
        <div>
          <dt>Percentile</dt>
          <dd>{formatPercentile(percentile)}</dd>
        </div>
      </dl>
      <p className="metric-date">Last observation {formatDate(latestDate)}</p>
    </article>
  );
}
