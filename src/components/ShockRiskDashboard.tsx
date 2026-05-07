import { formatDate, formatNumber, formatSigned, statusLabel } from "../lib/formatters";
import type { ShockRiskSnapshotFile } from "../lib/types";

interface ShockRiskDashboardProps {
  snapshot: ShockRiskSnapshotFile;
}

export default function ShockRiskDashboard({ snapshot }: ShockRiskDashboardProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Shock risk</p>
          <h3>{snapshot.label}</h3>
          <p>
            Snapshot date {formatDate(snapshot.date)}. Generated {formatDate(snapshot.generated_at_utc)}.
          </p>
        </div>
        <strong className="score-card__value">{formatNumber(snapshot.score)}</strong>
      </div>

      <div className="metric-grid" aria-label="Shock risk summary">
        <article className="candidate-source-row">
          <div>
            <h4>Active signals</h4>
            <p>{snapshot.active_signals.length} active shock-risk signal rows.</p>
          </div>
        </article>
        <article className="candidate-source-row">
          <div>
            <h4>Source gaps</h4>
            <p>{snapshot.source_gaps.length} gated or unavailable source rows.</p>
          </div>
        </article>
      </div>

      <div className="section-heading">
        <h3>Active signal rows</h3>
      </div>
      {snapshot.active_signals.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {snapshot.active_signals.map((signal) => (
            <article className="candidate-source-row" key={signal.id} role="listitem">
              <div>
                <h4>{signal.label}</h4>
                <p>{signal.message}</p>
                <p>
                  Value {formatNumber(signal.value)}; change {formatSigned(signal.change)}.
                </p>
              </div>
              <span className="status-pill status-partial">Score {formatSigned(signal.score)}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">No active shock-risk signals in the current snapshot.</p>
      )}

      <div className="section-heading">
        <h3>Source gap rows</h3>
      </div>
      {snapshot.source_gaps.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {snapshot.source_gaps.map((gap) => (
            <article className="candidate-source-row" key={gap.id} role="listitem">
              <div>
                <h4>{gap.label}</h4>
                <p>{gap.message}</p>
              </div>
              <span className={`status-pill status-${gap.status}`}>{statusLabel(gap.status)}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">No shock-risk source gaps in the current snapshot.</p>
      )}
    </section>
  );
}
