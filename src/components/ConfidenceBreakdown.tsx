import type { ConfidenceBreakdownData } from "../lib/types";

interface ConfidenceBreakdownProps {
  confidence: ConfidenceBreakdownData;
}

function formatConfidence(value: number) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return `${Math.round(clamped * 100)}%`;
}

export default function ConfidenceBreakdown({ confidence }: ConfidenceBreakdownProps) {
  const rows = [
    ["Coverage", confidence.coverage_confidence],
    ["Freshness", confidence.freshness_confidence],
    ["Model breadth", confidence.model_confidence],
    ["Source readiness", confidence.source_confidence]
  ] as const;

  return (
    <section className="panel confidence-panel">
      <p className="eyebrow">Data confidence</p>
      <h3>{formatConfidence(confidence.overall_confidence)} overall</h3>
      <dl className="confidence-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatConfidence(value)}</dd>
          </div>
        ))}
      </dl>
      {confidence.reasons.length > 0 ? (
        <ul className="score-list">
          {confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">No confidence notes in the current score summary.</p>
      )}
    </section>
  );
}
