import { formatDate, statusLabel } from "../lib/formatters";
import type { DataStatusFile, SeriesCatalogEntry, SeriesStatus } from "../lib/types";

interface CandidateDiagnosticPanelProps {
  catalog: SeriesCatalogEntry[];
  diagnosticIds: string[];
  status: DataStatusFile;
  title: string;
  eyebrow?: string;
  summary?: string;
  emptyText?: string;
}

const governanceNote = "Does not affect active scores, labels, checklist states, or confidence.";

function catalogById(catalog: SeriesCatalogEntry[]) {
  return new Map(catalog.map((entry) => [entry.id, entry]));
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
  eyebrow = "Generated diagnostics",
  summary = "Official/public static diagnostics are visible for context, but they remain candidate-only until governance promotes them.",
  emptyText = "No generated candidate diagnostics are configured for this view."
}: CandidateDiagnosticPanelProps) {
  const entries = catalogById(catalog);
  const rows = diagnosticIds.map((id) => ({
    entry: entries.get(id),
    id,
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
          {rows.map(({ entry, id, status: row }) => (
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
