import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { ScoreHistoryAttributionBlock, ScoreHistoryFile } from "../lib/types";
import { useT } from "../lib/i18n";

type ScoreKey = "market_weather" | "macro_climate" | "fragility";

const SIGNAL_KEY: Record<ScoreKey, string> = {
  market_weather: "marketWeather",
  macro_climate: "macroClimate",
  fragility: "fragility",
};

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
  title
}: DriverAttributionPanelProps) {
  const { t } = useT();
  const resolvedTitle = title ?? t("sections.whyScoresChanged");
  const observations = Array.isArray(history?.observations) ? history.observations : [];
  const latest = observations.length ? observations[observations.length - 1] : null;
  const previous = observations.length > 1 ? observations[observations.length - 2] : null;
  const attribution: Partial<ScoreHistoryFile["latest_attribution"]> = history?.latest_attribution ?? {};

  const scoreRows: Array<{ key: ScoreKey; label: string }> = [
    { key: "market_weather", label: t(`signals.${SIGNAL_KEY.market_weather}`) },
    { key: "macro_climate", label: t(`signals.${SIGNAL_KEY.macro_climate}`) },
    { key: "fragility", label: t(`signals.${SIGNAL_KEY.fragility}`) },
  ];

  if (!history || !latest) {
    return (
      <section className="panel driver-attribution-panel" aria-label={resolvedTitle}>
        <div className="section-header">
          <div>
            <p className="eyebrow">{t("sections.attribution")}</p>
            <h3>{resolvedTitle}</h3>
            <p>{t("sections.noScoreHistory")}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel driver-attribution-panel" aria-label={resolvedTitle}>
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.attribution")}</p>
          <h3>{resolvedTitle}</h3>
          <p>
            {t("sections.latestSnapshotPrefix")}: {formatDate(latest.date)}. {t("sections.snapshotsCompare")}
          </p>
        </div>
        <span className="status-pill status-ok">{t("sections.descriptive")}</span>
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
                  <p>{previous ? `${t("sections.previousSnapshot")}: ${formatDate(previous.date)}` : t("sections.firstSnapshot")}</p>
                </div>
                <dl>
                  <div>
                    <dt>{t("sections.latest")}</dt>
                    <dd>{formatNumber(currentScore)}</dd>
                  </div>
                  <div>
                    <dt>{t("sections.change")}</dt>
                    <dd>{formatSigned(change)}</dd>
                  </div>
                </dl>
              </div>
              <div className="driver-attribution-card__lists">
                <div>
                  <h5>{t("narrative.recentChanges")}</h5>
                  {signalList(rowAttribution.recent_changes, t("narrative.emptyRecentChanges"))}
                </div>
                <div>
                  <h5>{t("narrative.supports")}</h5>
                  {signalList(rowAttribution.top_supports, t("narrative.emptySupportDrivers"))}
                </div>
                <div>
                  <h5>{t("narrative.risks")}</h5>
                  {signalList(rowAttribution.top_risks, t("narrative.emptyRiskDrivers"))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
