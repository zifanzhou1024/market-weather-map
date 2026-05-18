import type { CockpitFreshnessStatus } from "../lib/types";

interface Props {
  status: CockpitFreshnessStatus;
  asOf: string;
  className?: string;
}

const STATUS_TONE: Record<CockpitFreshnessStatus, string> = {
  ok: "tone-positive",
  stale: "tone-warning",
  unavailable: "tone-negative",
};

const STATUS_LABEL: Record<CockpitFreshnessStatus, string> = {
  ok: "fresh",
  stale: "stale",
  unavailable: "n/a",
};

export default function FreshnessPill({ status, asOf, className }: Props) {
  const tone = STATUS_TONE[status];
  const label = STATUS_LABEL[status];
  return (
    <span
      className={`freshness-pill freshness-pill--${status} ${tone} ${className ?? ""}`.trim()}
      title={`Last updated ${asOf}`}
      aria-label={`Data is ${status}; last updated ${asOf}`}
    >
      {label}
    </span>
  );
}
