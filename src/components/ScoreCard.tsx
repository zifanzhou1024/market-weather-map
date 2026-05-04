import { formatNumber } from "../lib/formatters";
import type { ScoreBlock } from "../lib/types";
import RegimeBadge from "./RegimeBadge";

interface ScoreCardProps {
  title: string;
  score: ScoreBlock;
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ScoreList({ items, title }: { items: string[]; title: string }) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length ? (
        <ul className="score-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">N/A</p>
      )}
    </section>
  );
}

export default function ScoreCard({ title, score }: ScoreCardProps) {
  return (
    <article className="score-card">
      <div className="score-card__header">
        <div>
          <p className="eyebrow">{title}</p>
          <strong className="score-card__value">{formatNumber(score.score)}</strong>
        </div>
        <RegimeBadge label={score.label} score={score.score} />
      </div>

      <p className="score-confidence">Confidence {formatConfidence(score.confidence)}</p>

      <div className="score-card__lists">
        <ScoreList items={score.top_supports} title="Supports" />
        <ScoreList items={score.top_risks} title="Risks" />
      </div>

      {score.confidence_reasons.length ? (
        <section className="score-notes">
          <h4>Confidence notes</h4>
          <ul className="score-list">
            {score.confidence_reasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
