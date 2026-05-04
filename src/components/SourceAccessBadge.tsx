import type { SourceAccessStatus, SourceTermsStatus } from "../lib/types";

interface SourceAccessBadgeProps {
  accessStatus?: SourceAccessStatus | undefined;
  termsStatus?: SourceTermsStatus | undefined;
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

export default function SourceAccessBadge({ accessStatus, termsStatus }: SourceAccessBadgeProps) {
  if (!accessStatus && !termsStatus) return null;

  return (
    <p className="source-access">
      {accessStatus ? <span>{accessLabels[accessStatus]}</span> : null}
      {termsStatus ? <span>{termsLabels[termsStatus]}</span> : null}
    </p>
  );
}
