import type { ConfidenceBreakdownData } from "../lib/types";

interface ConfidenceBreakdownProps {
  dataQuality: ConfidenceBreakdownData;
}

function formatConfidence(value: number) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return `${Math.round(clamped * 100)}%`;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export default function ConfidenceBreakdown({ dataQuality }: ConfidenceBreakdownProps) {
  const reasons = stringList(dataQuality.reasons);
  const rows = [
    ["Coverage", dataQuality.coverage_confidence],
    ["Freshness", dataQuality.freshness_confidence],
    ["Model breadth", dataQuality.model_confidence],
    ["Source readiness", dataQuality.source_confidence]
  ] as const;

  return (
    <section className="panel confidence-panel">
      <p className="eyebrow">Data confidence</p>
      <h3>{formatConfidence(dataQuality.overall_confidence)} overall</h3>
      <dl className="confidence-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatConfidence(value)}</dd>
          </div>
        ))}
      </dl>
      {reasons.length > 0 ? (
        <ul className="score-list">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">No confidence notes in the current score summary.</p>
      )}
    </section>
  );
}
