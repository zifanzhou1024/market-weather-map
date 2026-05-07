import { formatNumber } from "../lib/formatters";
import SignalList from "./SignalList";

interface MacroCyclePanelProps {
  caveat: string;
  label: string;
  risks: readonly string[];
  score: number | null | undefined;
  supports: readonly string[];
  title: string;
}

export default function MacroCyclePanel({
  caveat,
  label,
  risks,
  score,
  supports,
  title
}: MacroCyclePanelProps) {
  return (
    <article className="macro-cycle-panel">
      <div className="macro-cycle-panel__header">
        <div>
          <p className="eyebrow">Cycle read</p>
          <h3>{title}</h3>
        </div>
        <div className="macro-cycle-panel__score" aria-label={`${title} score`}>
          <strong>{formatNumber(score)}</strong>
          <span>{label}</span>
        </div>
      </div>

      <div className="macro-cycle-panel__signals">
        <SignalList emptyText="No support signals in this view." items={[...supports]} title="Supports" />
        <SignalList emptyText="No risk signals in this view." items={[...risks]} title="Risks" />
      </div>

      <p className="macro-cycle-panel__caveat">{caveat}</p>
    </article>
  );
}
