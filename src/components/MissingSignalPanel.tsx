import type { SignalCategory, SignalHorizon, SignalMissingEntry } from "../lib/types";
import ExternalResearchLinks from "./ExternalResearchLinks";

interface MissingSignalPanelProps {
  signals: ReadonlyArray<SignalMissingEntry>;
}

function categoryLabel(category: SignalCategory): string {
  switch (category) {
    case "volatility":
      return "Volatility";
    case "rates":
      return "Rates";
    case "credit":
      return "Credit";
    case "liquidity":
      return "Liquidity";
    case "dollar":
      return "Dollar";
    case "positioning":
      return "Positioning";
    case "macro":
      return "Macro";
    case "event":
      return "Event";
    default:
      return category;
  }
}

function horizonLabel(horizon: SignalHorizon): string {
  switch (horizon) {
    case "short_term":
      return "Short-term";
    case "long_term":
      return "Long-term";
    case "fragility":
      return "Fragility";
    case "both":
    default:
      return "Both";
  }
}

export default function MissingSignalPanel({ signals }: MissingSignalPanelProps) {
  return (
    <section className="missing-signal-panel" aria-label="Missing high-value signals">
      <header className="missing-signal-panel-header">
        <h3 className="missing-signal-panel-title">Missing High-Value Signals</h3>
        <p className="missing-signal-panel-summary">
          High-importance signals whose source is not yet active. Surfaced so users know what the
          read is currently blind to.
        </p>
      </header>
      {signals.length === 0 ? (
        <p className="missing-signal-panel-empty">
          All high-value signals have an active source in the current snapshot.
        </p>
      ) : (
        <ol className="missing-signal-panel-table">
          {signals.map((signal) => (
            <li key={signal.id} className="missing-signal-panel-row">
              <div className="missing-signal-panel-row-header">
                <span className="missing-signal-panel-label">{signal.label}</span>
                <div className="missing-signal-panel-badges">
                  <span className="missing-signal-panel-badge missing-signal-panel-badge--category">
                    {categoryLabel(signal.category)}
                  </span>
                  <span className="missing-signal-panel-badge missing-signal-panel-badge--horizon">
                    {horizonLabel(signal.horizon)}
                  </span>
                </div>
              </div>
              <p className="missing-signal-panel-message">{signal.message}</p>
              <p className="missing-signal-panel-why">{signal.why_it_matters}</p>
              <ExternalResearchLinks
                className="missing-signal-panel-links"
                id={signal.id}
                label={signal.label}
              />
              <div className="missing-signal-panel-meta">
                <span>Importance {signal.importance}/5</span>
                <span className="missing-signal-panel-source">Source: {signal.source_status}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
