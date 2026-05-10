import { formatDate, formatNumber, statusLabel } from "../lib/formatters";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, SeriesStatus, TimeSeriesFile } from "../lib/types";

type DiagnosticSeriesFile = TimeSeriesFile | DerivedSeriesFile;

interface CandidateDiagnosticPanelProps {
  catalog: SeriesCatalogEntry[];
  diagnosticIds: string[];
  status: DataStatusFile;
  title: string;
  series?: DiagnosticSeriesFile[];
  eyebrow?: string;
  summary?: string;
  emptyText?: string;
}

const governanceNote = "Does not affect active scores, labels, checklist states, or confidence.";

function catalogById(catalog: SeriesCatalogEntry[]) {
  return new Map(catalog.map((entry) => [entry.id, entry]));
}

function seriesById(series: DiagnosticSeriesFile[] | undefined) {
  return new Map((series ?? []).map((item) => [item.series_id, item]));
}

function observationLabel(row: SeriesStatus | undefined) {
  if (!row) return "Observation N/A";
  return `Observation ${row.observation_period ?? formatDate(row.last_observation)}`;
}

function diagnosticNote(entry: SeriesCatalogEntry | undefined, row: SeriesStatus | undefined) {
  const notes = [entry?.notes, row?.message].filter((note): note is string => Boolean(note));
  return notes.length > 0 ? notes.join(" ") : "Diagnostic metadata is not available in the current static status file.";
}

function rowStatusLabel(row: SeriesStatus | undefined) {
  return row ? statusLabel(row.status) : "Unavailable";
}

function rowStatusClass(row: SeriesStatus | undefined) {
  return row ? `status-${row.status}` : "status-unavailable";
}

export default function CandidateDiagnosticPanel({
  catalog,
  diagnosticIds,
  status,
  title,
  series,
  eyebrow = "Generated diagnostics",
  summary = "Official/public static diagnostics are visible for context, but they remain candidate-only until governance promotes them.",
  emptyText = "No generated candidate diagnostics are configured for this view."
}: CandidateDiagnosticPanelProps) {
  const entries = catalogById(catalog);
  const diagnosticSeries = seriesById(series);
  const rows = diagnosticIds.map((id) => ({
    entry: entries.get(id),
    id,
    series: diagnosticSeries.get(id),
    status: status.series[id]
  }));

  return (
    <section className="panel candidate-diagnostic-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{summary}</p>
        </div>
      </div>
      <p className="score-note">{governanceNote}</p>
      {rows.length > 0 ? (
        <div className="candidate-diagnostic-list" role="list">
          {rows.map(({ entry, id, series: trendSeries, status: row }) => (
            <article className="candidate-diagnostic-row" key={id} role="listitem">
              <div>
                <div className="candidate-diagnostic-row__heading">
                  <h4>{entry?.name ?? id}</h4>
                  <span className={`status-pill ${rowStatusClass(row)}`}>{rowStatusLabel(row)}</span>
                </div>
                <p>{diagnosticNote(entry, row)}</p>
                <div className="candidate-diagnostic-meta" aria-label={`${entry?.name ?? id} metadata`}>
                  <span>{entry?.source ?? row?.source ?? "Unknown source"}</span>
                  <span>{observationLabel(row)}</span>
                  <span>{entry?.frequency ?? row?.expected_frequency ?? "unknown frequency"}</span>
                </div>
                <CandidateDiagnosticTrend label={entry?.name ?? id} series={trendSeries} />
              </div>
              <div className="candidate-diagnostic-badges" aria-label={`${entry?.name ?? id} governance badges`}>
                <span className="status-pill status-candidate">Generated candidate diagnostic</span>
                <span className="status-pill status-not_scored">Not scored</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">{emptyText}</p>
      )}
    </section>
  );
}

function CandidateDiagnosticTrend({
  label,
  series
}: {
  label: string;
  series: DiagnosticSeriesFile | undefined;
}) {
  const points = (series?.observations ?? [])
    .filter((observation) => Number.isFinite(observation.value))
    .slice(-52);

  if (points.length === 0 || !series) {
    return (
      <div className="candidate-diagnostic-trend candidate-diagnostic-trend--empty">
        <strong>Trend unavailable</strong>
        <p>No generated observations are available for this diagnostic.</p>
      </div>
    );
  }

  const latest = series.summary
    ? { date: series.summary.latest_date, value: series.summary.latest_value }
    : points[points.length - 1];

  return (
    <div className="candidate-diagnostic-trend">
      <Sparkline label={label} points={points} />
      <div>
        <p>Trend window {points.length} observations</p>
        <p>
          Latest {formatNumber(latest.value)} {series.units} on {latest.date}
        </p>
      </div>
    </div>
  );
}

function Sparkline({ label, points }: { label: string; points: Array<{ date: string; value: number }> }) {
  const width = 160;
  const height = 52;
  const padding = 6;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const coordinates = points
    .map((point, index) => {
      const x = points.length > 1 ? padding + index * xStep : width / 2;
      const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-label={`${label} trend sparkline`}
      className="candidate-diagnostic-sparkline"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline fill="none" points={coordinates} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
