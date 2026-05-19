import { statusLabel } from "../lib/formatters";
import { sanitizeShockRiskSnapshot } from "../lib/shockRisk";
import type {
  DataStatus,
  ShockRiskSignal,
  ShockRiskSnapshotFile,
  ShockRiskMismatchWarning,
  ShockRiskSourceGap
} from "../lib/types";
import { useT } from "../lib/i18n";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function gatedRows(sourceGaps: ShockRiskSourceGap[]) {
  const rows: GatedStressRow[] = [];
  const seenIds = new Set<string>();

  for (const gap of sourceGaps) {
    if (!isRecord(gap) || !isNonEmptyString(gap.id) || !isNonEmptyString(gap.label) || !isNonEmptyString(gap.message)) {
      continue;
    }
    if (seenIds.has(gap.id)) continue;
    rows.push({
      id: gap.id,
      label: gap.label,
      message: gap.message,
      status: gap.status
    });
    seenIds.add(gap.id);
  }

  for (const row of defaultGatedRows) {
    if (!seenIds.has(row.id)) {
      rows.push(row);
      seenIds.add(row.id);
    }
  }

  return rows;
}

function mismatchSeverityKey(message: string): "High" | "Medium" | "Low" {
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
  const { t, tCategorical } = useT();
  const sanitizedSnapshot = sanitizeShockRiskSnapshot(shockSnapshot);
  const visibleRows = safeArray<ShockRiskSignal>(sanitizedSnapshot.active_signals);
  const sourceGaps = safeArray<ShockRiskSourceGap>(sanitizedSnapshot.source_gaps);
  const warnings = safeArray<ShockRiskMismatchWarning>(sanitizedSnapshot.mismatch_warnings);
  const gatedStressRows = gatedRows(sourceGaps);
  const severityLabel: Record<"High" | "Medium" | "Low", string> = {
    High: t("panels.severityHigh"),
    Medium: t("panels.severityMedium"),
    Low: t("panels.severityLow"),
  };

  return (
    <section className="panel hidden-stress-summary">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.stressChannels")}</p>
          <h3>{t("sections.visibleVsGatedStress")}</h3>
          <p>{t("panels.visibleVsGatedDesc")}</p>
        </div>
      </div>

      <div className="metric-grid" aria-label="Visible and gated stress summary">
        <article className="candidate-source-row">
          <div>
            <h4>{t("sections.visibleStress")}</h4>
            {visibleRows.length > 0 ? (
              <ul>
                {visibleRows.map((row) => (
                  <li key={row.id}>
                    <strong>{row.label}</strong>: {row.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="score-note">{t("panels.noVisibleSignals")}</p>
            )}
          </div>
        </article>
        <article className="candidate-source-row">
          <div>
            <h4>{t("sections.gatedStress")}</h4>
            <ul>
              {gatedStressRows.map((row) => (
                <li key={row.id}>
                  <strong>{row.label}</strong>: {row.message} ({tCategorical("status", statusLabel(row.status))})
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <div className="section-heading">
        <h3>{t("sections.mismatchSeverity")}</h3>
      </div>
      {warnings.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {warnings.map((warning) => (
            <article className="candidate-source-row" key={warning.id} role="listitem">
              <div>
                <h4>{warning.label}</h4>
                <p>{warning.message}</p>
              </div>
              <span className="status-pill status-partial">{severityLabel[mismatchSeverityKey(warning.message)]}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">{t("panels.mismatchWarningsEmpty")}</p>
      )}
    </section>
  );
}
