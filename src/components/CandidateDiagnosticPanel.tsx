import { formatDate, formatNumber, statusLabel } from "../lib/formatters";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, SeriesStatus, TimeSeriesFile } from "../lib/types";
import { useT } from "../lib/i18n";

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

function catalogById(catalog: SeriesCatalogEntry[]) {
  return new Map(catalog.map((entry) => [entry.id, entry]));
}

function seriesById(series: DiagnosticSeriesFile[] | undefined) {
  return new Map((series ?? []).map((item) => [item.series_id, item]));
}

function diagnosticNote(entry: SeriesCatalogEntry | undefined, row: SeriesStatus | undefined, fallback: string) {
  const notes = [entry?.notes, row?.message].filter((note): note is string => Boolean(note));
  return notes.length > 0 ? notes.join(" ") : fallback;
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
  eyebrow,
  summary,
  emptyText
}: CandidateDiagnosticPanelProps) {
  const { t, tCategorical } = useT();
  const resolvedEyebrow = eyebrow ?? t("panels.candidateDiagGenerated");
  const resolvedSummary = summary ?? t("panels.candidateDiagSummary");
  const resolvedEmpty = emptyText ?? t("panels.candidateSourceEmpty");
  const fallbackNote = t("panels.candidateDiagGovernance");
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
          <p className="eyebrow">{resolvedEyebrow}</p>
          <h3>{title}</h3>
          <p>{resolvedSummary}</p>
        </div>
      </div>
      <p className="score-note">{t("panels.candidateDiagGovernance")}</p>
      {rows.length > 0 ? (
        <div className="candidate-diagnostic-list" role="list">
          {rows.map(({ entry, id, series: trendSeries, status: row }) => {
            const observationText = !row
              ? t("panels.observationNa")
              : `${t("panels.colObservation")} ${row.observation_period ?? formatDate(row.last_observation)}`;
            const statusText = row
              ? tCategorical("status", statusLabel(row.status))
              : t("chrome.unavailable");
            return (
              <article className="candidate-diagnostic-row" key={id} role="listitem">
                <div>
                  <div className="candidate-diagnostic-row__heading">
                    <h4>{entry?.name ?? id}</h4>
                    <span className={`status-pill ${rowStatusClass(row)}`}>{statusText}</span>
                  </div>
                  <p>{diagnosticNote(entry, row, fallbackNote)}</p>
                  <div className="candidate-diagnostic-meta" aria-label={`${entry?.name ?? id} metadata`}>
                    <span>{entry?.source ?? row?.source ?? t("panels.unknownSource")}</span>
                    <span>{observationText}</span>
                    <span>{entry?.frequency ?? row?.expected_frequency ?? t("panels.unknownFrequency")}</span>
                  </div>
                  <CandidateDiagnosticTrend label={entry?.name ?? id} series={trendSeries} />
                </div>
                <div className="candidate-diagnostic-badges" aria-label={`${entry?.name ?? id} governance badges`}>
                  <span className="status-pill status-candidate">{t("panels.candidateDiagGenerated")}</span>
                  <span className="status-pill status-not_scored">{t("sections.notScored")}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="score-note">{resolvedEmpty}</p>
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
  const { t } = useT();
  const points = (series?.observations ?? [])
    .filter((observation) => Number.isFinite(observation.value))
    .slice(-52);

  if (points.length === 0 || !series) {
    return (
      <div className="candidate-diagnostic-trend candidate-diagnostic-trend--empty">
        <strong>{t("panels.candidateDiagTrendUnavailable")}</strong>
        <p>{t("panels.candidateDiagTrendEmpty")}</p>
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
        <p>{t("panels.candidateDiagTrendWindowPrefix")} {points.length} {t("panels.candidateDiagTrendObservations")}</p>
        <p>
          {t("panels.candidateDiagLatestPrefix")} {formatNumber(latest.value)} {series.units} on {latest.date}
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
