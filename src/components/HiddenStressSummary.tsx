import { statusLabel } from "../lib/formatters";
import type { DataStatus, ShockRiskSnapshotFile, ShockRiskSourceGap } from "../lib/types";

interface HiddenStressSummaryProps {
  shockSnapshot: ShockRiskSnapshotFile;
}

interface GatedStressRow {
  id: string;
  label: string;
  message: string;
  status: DataStatus;
}

const defaultGatedRows: GatedStressRow[] = [
  {
    id: "move_index",
    label: "MOVE Index",
    message: "Bond-volatility stress remains source-gated until access and redistribution review are complete.",
    status: "terms_review_needed"
  },
  {
    id: "skew_index",
    label: "SKEW Index",
    message: "Equity tail-risk stress remains source-gated until access and redistribution review are complete.",
    status: "terms_review_needed"
  },
  {
    id: "vix_futures_curve",
    label: "VIX futures curve",
    message: "Tradable VX curve stress remains candidate-only until source review is complete.",
    status: "terms_review_needed"
  },
  {
    id: "options_sentiment",
    label: "Options sentiment",
    message: "Put/call stress remains candidate-only until source review is complete.",
    status: "terms_review_needed"
  }
];

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function gatedRows(sourceGaps: ShockRiskSourceGap[]) {
  const rows = sourceGaps.map((gap) => ({
    id: gap.id,
    label: gap.label,
    message: gap.message,
    status: gap.status
  }));
  const seenIds = new Set(rows.map((row) => row.id));

  for (const row of defaultGatedRows) {
    if (!seenIds.has(row.id)) {
      rows.push(row);
      seenIds.add(row.id);
    }
  }

  return rows;
}

function mismatchSeverity(message: string) {
  const normalized = message.toLowerCase();
  const hasCredit = /\bcredit\b/.test(normalized);
  const hasDollar = /\bdollar\b/.test(normalized);
  const hasRealYield = /\breal[-\s]?yields?\b/.test(normalized);
  const hasLiquidity = /\bliquidity\b/.test(normalized);

  if (hasCredit && (hasDollar || hasRealYield)) return "High";
  if (hasCredit || hasDollar || hasRealYield || hasLiquidity) return "Medium";
  return "Low";
}

export default function HiddenStressSummary({ shockSnapshot }: HiddenStressSummaryProps) {
  const visibleRows = safeArray<(typeof shockSnapshot.active_signals)[number]>(shockSnapshot.active_signals);
  const sourceGaps = safeArray<ShockRiskSourceGap>(shockSnapshot.source_gaps);
  const warnings = safeArray<(typeof shockSnapshot.mismatch_warnings)[number]>(shockSnapshot.mismatch_warnings);
  const gatedStressRows = gatedRows(sourceGaps);

  return (
    <section className="panel hidden-stress-summary">
      <div className="section-header">
        <div>
          <p className="eyebrow">Stress channels</p>
          <h3>Visible vs gated stress</h3>
          <p>Active rows are observed shock-risk signals. Gated rows are source-readiness gaps, not warnings.</p>
        </div>
      </div>

      <div className="metric-grid" aria-label="Visible and gated stress summary">
        <article className="candidate-source-row">
          <div>
            <h4>Visible stress</h4>
            {visibleRows.length > 0 ? (
              <ul>
                {visibleRows.map((row) => (
                  <li key={row.id}>
                    <strong>{row.label}</strong>: {row.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="score-note">No active shock-risk signals in the current snapshot.</p>
            )}
          </div>
        </article>
        <article className="candidate-source-row">
          <div>
            <h4>Gated stress</h4>
            <ul>
              {gatedStressRows.map((row) => (
                <li key={row.id}>
                  <strong>{row.label}</strong>: {row.message} ({statusLabel(row.status)})
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <div className="section-heading">
        <h3>Mismatch severity</h3>
      </div>
      {warnings.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {warnings.map((warning) => (
            <article className="candidate-source-row" key={warning.id} role="listitem">
              <div>
                <h4>{warning.label}</h4>
                <p>{warning.message}</p>
              </div>
              <span className="status-pill status-partial">{mismatchSeverity(warning.message)}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">No mismatch warnings in the current shock-risk snapshot.</p>
      )}
    </section>
  );
}
