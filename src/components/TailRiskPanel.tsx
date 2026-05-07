import { statusLabel } from "../lib/formatters";
import type {
  DataStatus,
  DataStatusFile,
  SeriesCatalogEntry,
  ShockRiskSnapshotFile,
  ShockRiskSourceGap
} from "../lib/types";

interface TailRiskPanelProps {
  snapshot: ShockRiskSnapshotFile;
  catalog: SeriesCatalogEntry[];
  status: DataStatusFile;
}

const tailRiskIds = ["move_index", "skew_index"] as const;

function fallbackLabel(id: (typeof tailRiskIds)[number]) {
  return id === "move_index" ? "MOVE Index" : "SKEW Index";
}

function fallbackNote(id: (typeof tailRiskIds)[number]) {
  if (id === "move_index") {
    return "Bond volatility readiness is tracked as source availability, not as an active score until the source is available.";
  }

  return "SKEW is distinct from VIX: it describes equity tail-risk pricing readiness rather than spot implied volatility.";
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function sourceGapById(sourceGaps: ShockRiskSourceGap[], id: string) {
  return sourceGaps.find((gap) => gap.id === id);
}

export default function TailRiskPanel({ snapshot, catalog, status }: TailRiskPanelProps) {
  const sourceGaps = safeArray<ShockRiskSourceGap>(snapshot.source_gaps);
  const rows = tailRiskIds.map((id) => {
    const gap = sourceGapById(sourceGaps, id);
    const catalogEntry = catalog.find((entry) => entry.id === id);
    const statusRow = status.series[id];
    const rowStatus: DataStatus = gap?.status ?? statusRow?.status ?? "terms_review_needed";

    return {
      id,
      label: gap?.label ?? catalogEntry?.name ?? fallbackLabel(id),
      message: gap?.message ?? statusRow?.message ?? catalogEntry?.notes ?? fallbackNote(id),
      status: rowStatus
    };
  });

  return (
    <section className="panel candidate-source-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Tail risk readiness</p>
          <h3>MOVE and SKEW source readiness</h3>
          <p>
            Bond volatility and equity tail-risk rows stay gated until source access and terms review are complete.
          </p>
        </div>
      </div>
      <div className="candidate-source-list" role="list">
        {rows.map((row) => (
          <article className="candidate-source-row" key={row.id} role="listitem">
            <div>
              <h4>{row.label}</h4>
              <p>{row.message}</p>
              <p>{fallbackNote(row.id)}</p>
            </div>
            <span className={`status-pill status-${row.status}`}>{statusLabel(row.status)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
