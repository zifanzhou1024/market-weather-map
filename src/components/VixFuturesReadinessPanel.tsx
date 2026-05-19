import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";
import { applyCandidateDisplayOverride } from "../lib/candidateDisplay";
import { useT } from "../lib/i18n";

const vxItems: CandidateSourceItem[] = Array.from({ length: 8 }, (_, index) => {
  const month = index + 1;
  return applyCandidateDisplayOverride({
    id: `vx${month}`,
    label: `VX${month}`,
    note: "VIX futures candidate month pending source and terms readiness review.",
    status: "terms_review_needed"
  });
});

interface VixFuturesReadinessPanelProps {
  items?: CandidateSourceItem[];
  title?: string;
}

export default function VixFuturesReadinessPanel({
  items = vxItems,
  title
}: VixFuturesReadinessPanelProps) {
  const { t } = useT();
  const displayItems = items.map(applyCandidateDisplayOverride);
  const resolvedTitle = title ?? t("sections.vxFuturesCurve");

  return (
    <CandidateSourcePanel
      eyebrow={t("sections.candidateSources")}
      footer={
        <div className="fallback-proxy-note">
          <span className="status-pill status-partial">{t("sections.fallbackProxy")}</span>
          <p>{t("panels.vxFuturesFooter")}</p>
        </div>
      }
      items={displayItems}
      summary={t("panels.vxFuturesSummary")}
      title={resolvedTitle}
    />
  );
}
