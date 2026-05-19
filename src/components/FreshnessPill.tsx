import type { CockpitFreshnessStatus } from "../lib/types";
import { useT } from "../lib/i18n";

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

// English label per status. Under zh these are translated through the
// `categoricals.status` lookup (Fresh → 新鲜, Stale → 陈旧, Unavailable → 不可用).
const STATUS_LABEL: Record<CockpitFreshnessStatus, string> = {
  ok: "Fresh",
  stale: "Stale",
  unavailable: "Unavailable",
};

export default function FreshnessPill({ status, asOf, className }: Props) {
  const { tCategorical, locale } = useT();
  const tone = STATUS_TONE[status];
  const rawLabel = STATUS_LABEL[status];
  const label = tCategorical("status", rawLabel);
  // Visual treatment in en kept lowercase ("fresh") via CSS text-transform;
  // under zh the Chinese characters render at their natural casing.
  const visibleLabel = locale === "en" ? rawLabel.toLowerCase() : label;
  return (
    <span
      className={`freshness-pill freshness-pill--${status} ${tone} ${className ?? ""}`.trim()}
      title={`${asOf}`}
      aria-label={`${label} — ${asOf}`}
    >
      {visibleLabel}
    </span>
  );
}
