import type { SignalPriorityFile } from "../lib/types";
import { formatSignedScore } from "../charts/chartFormatters";

interface MarketBriefHeaderProps {
  overallRead: SignalPriorityFile["overall_read"];
  date: string;
}

interface ReadCard {
  key: "short_term" | "long_term" | "fragility" | "regime";
  heading: string;
  label: string;
  score?: number;
  confidence?: number;
}

function buildCards(overallRead: SignalPriorityFile["overall_read"]): ReadCard[] {
  return [
    {
      key: "short_term",
      heading: "Short-term",
      label: overallRead.short_term.label,
      score: overallRead.short_term.score,
      confidence: overallRead.short_term.confidence
    },
    {
      key: "long_term",
      heading: "Long-term",
      label: overallRead.long_term.label,
      score: overallRead.long_term.score,
      confidence: overallRead.long_term.confidence
    },
    {
      key: "fragility",
      heading: "Fragility",
      label: overallRead.fragility.label,
      score: overallRead.fragility.score,
      confidence: overallRead.fragility.confidence
    },
    {
      key: "regime",
      heading: "Regime",
      label: overallRead.regime.label
    }
  ];
}

function formatConfidencePercent(confidence: number): string {
  if (!Number.isFinite(confidence)) return "—";
  return `${Math.round(confidence * 100)}%`;
}

export default function MarketBriefHeader({ overallRead, date }: MarketBriefHeaderProps) {
  const cards = buildCards(overallRead);
  return (
    <section className="market-brief-header" aria-label="Market brief — short-term, long-term, fragility, and regime read">
      <div className="market-brief-header-eyebrow">
        <span>Market brief</span>
        <span className="market-brief-header-date">As of {date}</span>
      </div>
      <div className="market-brief-header-grid">
        {cards.map((card) => (
          <article key={card.key} className={`market-brief-card market-brief-card--${card.key}`}>
            <p className="market-brief-card__heading">{card.heading}</p>
            <p className="market-brief-card__label">{card.label}</p>
            {typeof card.score === "number" ? (
              <p className="market-brief-card__score">{formatSignedScore(card.score)}</p>
            ) : null}
            {typeof card.confidence === "number" ? (
              <p className="market-brief-card__confidence">
                Confidence {formatConfidencePercent(card.confidence)}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
