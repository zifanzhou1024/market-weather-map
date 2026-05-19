import { useMemo, useState } from "react";
import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { RegimeReplayFile, RegimeReplayOccurrence, RegimeReplayScenario } from "../lib/types";
import { useT } from "../lib/i18n";

function safeScenarios(replay: RegimeReplayFile): RegimeReplayScenario[] {
  return Array.isArray(replay.scenarios) ? replay.scenarios : [];
}

function safeOccurrences(scenario: RegimeReplayScenario): RegimeReplayOccurrence[] {
  return Array.isArray(scenario.occurrences) ? scenario.occurrences : [];
}

interface HistoricalRegimeReplayPanelProps {
  replay: RegimeReplayFile;
}

export default function HistoricalRegimeReplayPanel({ replay }: HistoricalRegimeReplayPanelProps) {
  const { t, tCategorical } = useT();
  const scenarios = safeScenarios(replay);
  const initialScenarioId = scenarios.find((scenario) => scenario.occurrence_count > 0)?.id ?? scenarios[0]?.id;
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenarioId);
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0] ?? null;
  const recentOccurrences = useMemo(() => {
    if (!selectedScenario) return [];
    return [...safeOccurrences(selectedScenario)].slice(-20).reverse();
  }, [selectedScenario]);

  function countLabel(count: number) {
    // Singular/plural picked from i18n keys so zh stays grammatical.
    return `${formatNumber(count, 0)} ${count === 1 ? t("panels.occurrenceSingular") : t("panels.occurrencePlural")}`;
  }

  return (
    <section className="panel replay-panel" aria-label="Historical regime replay">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.research")}</p>
          <h3>{t("sections.historicalRegimeReplay")}</h3>
          <p>{t("panels.replayDesc")}</p>
        </div>
        <span className="status-pill status-ok">{t("panels.replayNoTradeRecs")}</span>
      </div>
      {scenarios.length ? (
        <>
          <div className="replay-scenario-tabs" aria-label="Regime scenarios">
            {scenarios.map((scenario) => (
              <button
                className={scenario.id === selectedScenario?.id ? "replay-tab active" : "replay-tab"}
                key={scenario.id}
                onClick={() => setSelectedScenarioId(scenario.id)}
                type="button"
              >
                <span>{tCategorical("regime", scenario.label)}</span>
                <strong>{countLabel(scenario.occurrence_count)}</strong>
              </button>
            ))}
          </div>
          {selectedScenario ? (
            <div className="replay-detail">
              <div className="replay-summary">
                <article>
                  <p className="metric-source">{t("sections.selectedRegime")}</p>
                  <h4>{tCategorical("regime", selectedScenario.label)}</h4>
                  <p>{selectedScenario.description}</p>
                </article>
                <dl>
                  <div>
                    <dt>{t("sections.matches")}</dt>
                    <dd>{countLabel(selectedScenario.occurrence_count)}</dd>
                  </div>
                  <div>
                    <dt>{t("sections.lastMatch")}</dt>
                    <dd>{formatDate(selectedScenario.last_occurrence_date)}</dd>
                  </div>
                  <div>
                    <dt>{t("sections.method")}</dt>
                    {/* Load-bearing literal — data-routes pins "20-observation changes" at line 79. */}
                    <dd>{t("sections.twentyObsMethod")}</dd>
                  </div>
                </dl>
              </div>
              <p className="score-note">{selectedScenario.caveat}</p>
              {recentOccurrences.length ? (
                <div className="status-table-wrap replay-table-wrap">
                  <table className="status-table replay-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Real yield 20 obs</th>
                        <th>Dollar 20 obs</th>
                        <th>Credit 20 obs</th>
                        <th>VIX curve 20 obs</th>
                        <th>10Y nominal 20 obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOccurrences.map((occurrence) => (
                        <tr key={`${selectedScenario.id}-${occurrence.date}`}>
                          <td data-label="Date">{occurrence.date}</td>
                          <td data-label="Real yield 20 obs">
                            {formatSigned(occurrence.real_yield_20obs_change)}
                          </td>
                          <td data-label="Dollar 20 obs">{formatSigned(occurrence.dollar_20obs_change)}</td>
                          <td data-label="Credit 20 obs">{formatSigned(occurrence.credit_20obs_change)}</td>
                          <td data-label="VIX curve 20 obs">
                            {formatSigned(occurrence.vix_curve_20obs_change)}
                          </td>
                          <td data-label="10Y nominal 20 obs">
                            {formatSigned(occurrence.nominal_10y_20obs_change)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="score-note">{t("panels.replayNoOccurrences")}</p>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <p className="score-note">{t("panels.replayNoScenarios")}</p>
      )}
    </section>
  );
}
