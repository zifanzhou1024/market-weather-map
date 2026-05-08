import { useMemo, useState } from "react";
import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { RegimeReplayFile, RegimeReplayOccurrence, RegimeReplayScenario } from "../lib/types";

function safeScenarios(replay: RegimeReplayFile): RegimeReplayScenario[] {
  return Array.isArray(replay.scenarios) ? replay.scenarios : [];
}

function safeOccurrences(scenario: RegimeReplayScenario): RegimeReplayOccurrence[] {
  return Array.isArray(scenario.occurrences) ? scenario.occurrences : [];
}

function countLabel(count: number) {
  return `${formatNumber(count, 0)} ${count === 1 ? "occurrence" : "occurrences"}`;
}

interface HistoricalRegimeReplayPanelProps {
  replay: RegimeReplayFile;
}

export default function HistoricalRegimeReplayPanel({ replay }: HistoricalRegimeReplayPanelProps) {
  const scenarios = safeScenarios(replay);
  const initialScenarioId = scenarios.find((scenario) => scenario.occurrence_count > 0)?.id ?? scenarios[0]?.id;
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenarioId);
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0] ?? null;
  const recentOccurrences = useMemo(() => {
    if (!selectedScenario) return [];
    return [...safeOccurrences(selectedScenario)].slice(-20).reverse();
  }, [selectedScenario]);

  return (
    <section className="panel replay-panel" aria-label="Historical regime replay">
      <div className="section-header">
        <div>
          <p className="eyebrow">Research</p>
          <h3>Historical regime replay</h3>
          <p>
            Finds prior dates where the same broad real-yield, dollar, credit, and VIX-curve
            pressure pattern appeared in the active public-data history.
          </p>
        </div>
        <span className="status-pill status-ok">No trade recommendations</span>
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
                <span>{scenario.label}</span>
                <strong>{countLabel(scenario.occurrence_count)}</strong>
              </button>
            ))}
          </div>
          {selectedScenario ? (
            <div className="replay-detail">
              <div className="replay-summary">
                <article>
                  <p className="metric-source">Selected regime</p>
                  <h4>{selectedScenario.label}</h4>
                  <p>{selectedScenario.description}</p>
                </article>
                <dl>
                  <div>
                    <dt>Matches</dt>
                    <dd>{countLabel(selectedScenario.occurrence_count)}</dd>
                  </div>
                  <div>
                    <dt>Last match</dt>
                    <dd>{formatDate(selectedScenario.last_occurrence_date)}</dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>20-observation changes</dd>
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
                          <td>{occurrence.date}</td>
                          <td>{formatSigned(occurrence.real_yield_20obs_change)}</td>
                          <td>{formatSigned(occurrence.dollar_20obs_change)}</td>
                          <td>{formatSigned(occurrence.credit_20obs_change)}</td>
                          <td>{formatSigned(occurrence.vix_curve_20obs_change)}</td>
                          <td>{formatSigned(occurrence.nominal_10y_20obs_change)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="score-note">No matching observations for this scenario in the current file.</p>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <p className="score-note">No replay scenarios are available in the current file.</p>
      )}
    </section>
  );
}
