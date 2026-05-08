import ScoreCard from "./ScoreCard";
import SignalList from "./SignalList";
import type { ScoreBlock } from "../lib/types";

interface HorizonScoreHeaderProps {
  eyebrow: string;
  title: string;
  summary: string;
  score?: ScoreBlock;
  secondaryScore?: ScoreBlock;
  facts: Array<{ label: string; value: string }>;
  supports?: string[];
  risks?: string[];
}

export default function HorizonScoreHeader({
  eyebrow,
  facts,
  risks = [],
  score,
  secondaryScore,
  summary,
  supports = [],
  title
}: HorizonScoreHeaderProps) {
  return (
    <section className="panel horizon-header">
      <div className="section-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{summary}</p>
        </div>
      </div>
      <div className="horizon-header__facts">
        {facts.map((fact) => (
          <article className="metric-card" key={fact.label}>
            <p className="metric-source">{fact.label}</p>
            <strong>{fact.value}</strong>
          </article>
        ))}
      </div>
      {score || secondaryScore ? (
        <section className="score-grid" aria-label={`${title} score cards`}>
          {score ? <ScoreCard score={score} title={score.label.includes("Fragility") ? "Fragility" : "Primary score"} /> : null}
          {secondaryScore ? <ScoreCard score={secondaryScore} title="Fragility overlay" /> : null}
        </section>
      ) : null}
      <section className="detail-grid">
        <SignalList emptyText="No supports in the current score summary." items={supports.slice(0, 4)} title="Supports" />
        <SignalList emptyText="No risks in the current score summary." items={risks.slice(0, 4)} title="Risks" />
      </section>
    </section>
  );
}
