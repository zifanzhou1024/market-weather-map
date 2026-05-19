import type { SignalCategory, SignalHorizon, SignalMissingEntry } from "../lib/types";
import ExternalResearchLinks from "./ExternalResearchLinks";
import { useT } from "../lib/i18n";

interface MissingSignalPanelProps {
  signals: ReadonlyArray<SignalMissingEntry>;
}

const CATEGORY_KEY: Record<SignalCategory, string> = {
  volatility: "Volatility",
  rates: "Rates",
  credit: "Credit",
  liquidity: "Liquidity",
  dollar: "Dollar",
  positioning: "Positioning",
  macro: "Macro",
  event: "Event",
};

const HORIZON_KEY: Record<SignalHorizon, string> = {
  short_term: "Short-term",
  long_term: "Long-term",
  fragility: "Fragility",
  both: "Both",
};

export default function MissingSignalPanel({ signals }: MissingSignalPanelProps) {
  const { t, tCategorical } = useT();
  return (
    <section className="missing-signal-panel" aria-label="Missing high-value signals">
      <header className="missing-signal-panel-header">
        <h3 className="missing-signal-panel-title">{t("sections.missingHighValueSignals")}</h3>
        <p className="missing-signal-panel-summary">
          {t("panels.missingHighValueSummary")}
        </p>
      </header>
      {signals.length === 0 ? (
        <p className="missing-signal-panel-empty">
          {t("panels.allHighValueActive")}
        </p>
      ) : (
        <ol className="missing-signal-panel-table">
          {signals.map((signal) => (
            <li key={signal.id} className="missing-signal-panel-row">
              <div className="missing-signal-panel-row-header">
                <span className="missing-signal-panel-label">{signal.label}</span>
                <div className="missing-signal-panel-badges">
                  <span className="missing-signal-panel-badge missing-signal-panel-badge--category">
                    {tCategorical("category", CATEGORY_KEY[signal.category] ?? signal.category)}
                  </span>
                  <span className="missing-signal-panel-badge missing-signal-panel-badge--horizon">
                    {tCategorical("horizon", HORIZON_KEY[signal.horizon] ?? "Both")}
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
                <span>{t("narrative.importanceOfFive", { vars: { value: signal.importance } })}</span>
                <span className="missing-signal-panel-source">
                  {t("narrative.sourceValue", { vars: { value: signal.source_status } })}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
