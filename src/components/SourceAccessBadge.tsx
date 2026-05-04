import type { SourceAccessStatus, SourceTermsStatus } from "../lib/types";

interface SourceAccessBadgeProps {
  accessStatus?: SourceAccessStatus | string | undefined;
  termsStatus?: SourceTermsStatus | string | undefined;
}

const accessLabels: Record<SourceAccessStatus, string> = {
  free_public: "Free public",
  restricted: "Restricted",
  terms_review_needed: "Terms review needed",
  unavailable: "Unavailable"
};

const termsLabels: Record<SourceTermsStatus, string> = {
  ok: "Terms ok",
  restricted: "Restricted",
  review_each_series: "Review each series",
  review_needed: "Review needed",
  unknown: "Terms unknown"
};

function formatFallback(value: string | undefined) {
  if (!value) return "Unknown";
  const normalized = value.trim().replace(/[_-]+/g, " ");
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export default function SourceAccessBadge({ accessStatus, termsStatus }: SourceAccessBadgeProps) {
  if (!accessStatus && !termsStatus) return null;

  return (
    <p className="source-access">
      {accessStatus ? (
        <span>{accessLabels[accessStatus as SourceAccessStatus] ?? formatFallback(accessStatus)}</span>
      ) : null}
      {termsStatus ? (
        <span>{termsLabels[termsStatus as SourceTermsStatus] ?? formatFallback(termsStatus)}</span>
      ) : null}
    </p>
  );
}
