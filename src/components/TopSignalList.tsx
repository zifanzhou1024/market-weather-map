import type {
  SignalActiveEntry,
  SignalHorizon,
  SignalMissingEntry
} from "../lib/types";
import ExternalResearchLinks from "./ExternalResearchLinks";
import { useT } from "../lib/i18n";

type SignalEntry = SignalActiveEntry | SignalMissingEntry;

interface TopSignalListProps {
  /**
   * Caller-supplied title — used directly for rendering. Callers should pass
   * the already-translated string (via `t("sections.topActiveWarnings")` etc.)
   * so this component stays render-only and tests can keep passing literal
   * English titles.
   */
  title: string;
  emptyText: string;
  variant: "warning" | "support" | "missing";
  signals: ReadonlyArray<SignalEntry>;
}

const HORIZON_KEY: Record<SignalHorizon, string> = {
  short_term: "Short-term",
  long_term: "Long-term",
  fragility: "Fragility",
  both: "Both",
};

function isActive(entry: SignalEntry): entry is SignalActiveEntry {
  return entry.source_status === "active";
}

export default function TopSignalList({
  title,
  emptyText,
  variant,
  signals
}: TopSignalListProps) {
  const { t, tCategorical } = useT();
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
                  {tCategorical("horizon", HORIZON_KEY[signal.horizon] ?? "Both")}
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
                  {t("narrative.importanceOfFive", { vars: { value: signal.importance } })}
                </span>
                {isActive(signal) ? (
                  <>
                    <span className="top-signal-list-item-severity">
                      {t("narrative.severityValue", { vars: { value: signal.severity.toFixed(0) } })}
                    </span>
                    {signal.freshness_status !== "ok" ? (
                      <span className="top-signal-list-item-freshness">
                        {t("narrative.freshnessValue", { vars: { value: signal.freshness_status } })}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="top-signal-list-item-source">
                    {t("narrative.sourceValue", { vars: { value: signal.source_status } })}
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
