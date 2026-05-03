import { formatNumber } from "../lib/formatters";
import { scoreTone } from "../lib/scoring";

interface RegimeBadgeProps {
  label: string;
  score?: number;
}

export default function RegimeBadge({ label, score }: RegimeBadgeProps) {
  const tone = score === undefined ? "neutral" : scoreTone(score);

  return (
    <span className={`regime-badge tone-${tone}`}>
      <span>{label}</span>
      {score !== undefined ? <strong>{formatNumber(score)}</strong> : null}
    </span>
  );
}
