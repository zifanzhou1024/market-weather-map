import type { ShockRiskMismatchWarning } from "../lib/types";

interface MismatchWarningPanelProps {
  warnings: ShockRiskMismatchWarning[];
}

export default function MismatchWarningPanel({ warnings }: MismatchWarningPanelProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Confirmation</p>
          <h3>Mismatch warnings</h3>
          <p>Rows describe where shock-risk inputs and cross-asset confirmation do not line up.</p>
        </div>
      </div>
      {warnings.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {warnings.map((warning) => (
            <article className="candidate-source-row" key={warning.id} role="listitem">
              <div>
                <h4>{warning.label}</h4>
                <p>ID {warning.id}</p>
                <p>{warning.message}</p>
              </div>
              <span className="status-pill status-partial">Mismatch</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">No mismatch warnings in the current shock-risk snapshot.</p>
      )}
    </section>
  );
}
