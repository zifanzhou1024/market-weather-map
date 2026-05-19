import { formatNumber } from "../lib/formatters";
import { scoreTone } from "../lib/scoring";
import { useT } from "../lib/i18n";

interface RegimeBadgeProps {
  label: string;
  score?: number;
}

export default function RegimeBadge({ label, score }: RegimeBadgeProps) {
  const { tCategorical } = useT();
  const tone = score === undefined ? "neutral" : scoreTone(score);
  // Try composite-reading first (covers "Mixed", "Pressure", "Supportive"
  // bucket labels), then regime, falling back to the raw label.
  const compositeOut = tCategorical("compositeReading", label);
  const display = compositeOut !== label ? compositeOut : tCategorical("regime", label);

  return (
    <span className={`regime-badge tone-${tone}`}>
      <span>{display}</span>
      {score !== undefined ? <strong>{formatNumber(score)}</strong> : null}
    </span>
  );
}
