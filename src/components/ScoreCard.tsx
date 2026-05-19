import { formatNumber } from "../lib/formatters";
import type { ScoreBlock } from "../lib/types";
import RegimeBadge from "./RegimeBadge";
import { useT } from "../lib/i18n";

interface ScoreCardProps {
  title: string;
  score: ScoreBlock;
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function formatConfidence(value: unknown) {
  const confidence = Math.min(1, Math.max(0, finiteNumber(value)));
  return `${Math.round(confidence * 100)}%`;
}

function ScoreList({ items, title, emptyText }: { items: string[]; title: string; emptyText: string }) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length ? (
        <ul className="score-list">
          {items.map((item, index) => (
            <li key={`${title}-${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">{emptyText}</p>
      )}
    </section>
  );
}

export default function ScoreCard({ title, score }: ScoreCardProps) {
  const { t } = useT();
  const numericScore = finiteNumber(score.score);
  const label = typeof score.label === "string" ? score.label : "Unknown";
  const topSupports = safeList(score.top_supports);
  const topRisks = safeList(score.top_risks);
  const confidenceReasons = safeList(score.confidence_reasons);
  const recentChanges = safeList(score.recent_changes);
  const missingOrStaleNotes = safeList(score.missing_or_stale_notes);

  return (
    <article className="score-card">
      <div className="score-card__header">
        <div>
          <h3 className="eyebrow score-card__title">{title}</h3>
          <strong className="score-card__value">{formatNumber(numericScore)}</strong>
        </div>
        <RegimeBadge label={label} score={numericScore} />
      </div>

      <p className="score-confidence">
        {t("narrative.confidenceWithValue", { vars: { value: formatConfidence(score.confidence) } })}
      </p>

      <div className="score-card__lists">
        <ScoreList items={topSupports} title={t("narrative.supports")} emptyText={t("chrome.notAvailable")} />
        <ScoreList items={topRisks} title={t("narrative.risks")} emptyText={t("chrome.notAvailable")} />
      </div>

      {recentChanges.length ? (
        <section className="score-notes">
          <h4>{t("narrative.recentChanges")}</h4>
          <ul className="score-list">
            {recentChanges.map((item, index) => (
              <li key={`recent-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {confidenceReasons.length ? (
        <section className="score-notes">
          <h4>{t("narrative.confidenceNotes")}</h4>
          <ul className="score-list">
            {confidenceReasons.map((item, index) => (
              <li key={`confidence-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {missingOrStaleNotes.length ? (
        <section className="score-notes">
          <h4>{t("narrative.dataNotes")}</h4>
          <ul className="score-list">
            {missingOrStaleNotes.map((item, index) => (
              <li key={`data-note-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
