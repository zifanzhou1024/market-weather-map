import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { ScoreHistoryAttributionBlock, ScoreHistoryFile } from "../lib/types";

type ScoreKey = "market_weather" | "macro_climate" | "fragility";

const scoreRows: Array<{ key: ScoreKey; label: string }> = [
  { key: "market_weather", label: "Market Weather" },
  { key: "macro_climate", label: "Macro Climate" },
  { key: "fragility", label: "Fragility" }
];

const emptyAttribution: ScoreHistoryAttributionBlock = {
  recent_changes: [],
  top_risks: [],
  top_supports: []
};

function safeStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function safeAttribution(block: unknown): ScoreHistoryAttributionBlock {
  if (!block || typeof block !== "object") return emptyAttribution;
  const attribution = block as Partial<ScoreHistoryAttributionBlock>;

  return {
    recent_changes: safeStringList(attribution.recent_changes),
    top_risks: safeStringList(attribution.top_risks),
    top_supports: safeStringList(attribution.top_supports)
  };
}

function safeScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function signalList(items: string[], emptyText: string) {
  return items.length ? (
    <ul className="score-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="score-note">{emptyText}</p>
  );
}

interface DriverAttributionPanelProps {
  history: ScoreHistoryFile | null;
  title?: string;
}

export default function DriverAttributionPanel({
  history,
  title = "Why scores changed"
}: DriverAttributionPanelProps) {
  const observations = Array.isArray(history?.observations) ? history.observations : [];
  const latest = observations.length ? observations[observations.length - 1] : null;
  const previous = observations.length > 1 ? observations[observations.length - 2] : null;
  const attribution: Partial<ScoreHistoryFile["latest_attribution"]> = history?.latest_attribution ?? {};

  if (!history || !latest) {
    return (
      <section className="panel driver-attribution-panel" aria-label={title}>
        <div className="section-header">
          <div>
            <p className="eyebrow">Attribution</p>
            <h3>{title}</h3>
            <p>No score history file is available for attribution yet.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel driver-attribution-panel" aria-label={title}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Attribution</p>
          <h3>{title}</h3>
          <p>
            Latest score snapshot: {formatDate(latest.date)}. Changes compare against the previous
            stored score snapshot when one exists.
          </p>
        </div>
        <span className="status-pill status-ok">Descriptive</span>
      </div>
      <div className="driver-attribution-grid">
        {scoreRows.map((row) => {
          const currentScore = safeScore(latest[row.key]);
          const previousScore = previous ? safeScore(previous[row.key]) : null;
          const change =
            currentScore !== null && previousScore !== null ? currentScore - previousScore : null;
          const rowAttribution = safeAttribution(attribution[row.key]);

          return (
            <article className="driver-attribution-card" key={row.key}>
              <div className="driver-attribution-card__header">
                <div>
                  <h4>{row.label}</h4>
                  <p>{previous ? `Previous snapshot: ${formatDate(previous.date)}` : "First stored snapshot"}</p>
                </div>
                <dl>
                  <div>
                    <dt>Latest</dt>
                    <dd>{formatNumber(currentScore)}</dd>
                  </div>
                  <div>
                    <dt>Change</dt>
                    <dd>{formatSigned(change)}</dd>
                  </div>
                </dl>
              </div>
              <div className="driver-attribution-card__lists">
                <div>
                  <h5>Recent changes</h5>
                  {signalList(rowAttribution.recent_changes, "No recent changes in this block.")}
                </div>
                <div>
                  <h5>Supports</h5>
                  {signalList(rowAttribution.top_supports, "No support drivers in this block.")}
                </div>
                <div>
                  <h5>Risks</h5>
                  {signalList(rowAttribution.top_risks, "No risk drivers in this block.")}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
