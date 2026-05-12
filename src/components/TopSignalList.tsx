import type {
  SignalActiveEntry,
  SignalHorizon,
  SignalMissingEntry
} from "../lib/types";
import ExternalResearchLinks from "./ExternalResearchLinks";

type SignalEntry = SignalActiveEntry | SignalMissingEntry;

interface TopSignalListProps {
  title: string;
  emptyText: string;
  variant: "warning" | "support" | "missing";
  signals: ReadonlyArray<SignalEntry>;
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

function isActive(entry: SignalEntry): entry is SignalActiveEntry {
  return entry.source_status === "active";
}

export default function TopSignalList({
  title,
  emptyText,
  variant,
  signals
}: TopSignalListProps) {
  const sectionClassName = `top-signal-list top-signal-list--${variant}`;

  return (
    <section className={sectionClassName}>
      <h3 className="top-signal-list-title">{title}</h3>
      {signals.length === 0 ? (
        <p className="top-signal-list-empty">{emptyText}</p>
      ) : (
        <ol className="top-signal-list-items">
          {signals.map((signal) => (
            <li key={signal.id} className="top-signal-list-item">
              <div className="top-signal-list-item-header">
                <span className="top-signal-list-item-label">{signal.label}</span>
                <span className="top-signal-list-item-horizon">
                  {horizonLabel(signal.horizon)}
                </span>
              </div>
              <p className="top-signal-list-item-message">{signal.message}</p>
              <p className="top-signal-list-item-why">{signal.why_it_matters}</p>
              <ExternalResearchLinks
                className="top-signal-list-item-links"
                id={signal.id}
                label={signal.label}
              />
              <div className="top-signal-list-item-meta">
                <span className="top-signal-list-item-importance">
                  Importance {signal.importance}/5
                </span>
                {isActive(signal) ? (
                  <>
                    <span className="top-signal-list-item-severity">
                      Severity {signal.severity.toFixed(0)}
                    </span>
                    {signal.freshness_status !== "ok" ? (
                      <span className="top-signal-list-item-freshness">
                        Freshness: {signal.freshness_status}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="top-signal-list-item-source">
                    Source: {signal.source_status}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
