import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";
import { applyCandidateDisplayOverride } from "../lib/candidateDisplay";

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
  title = "VX futures curve"
}: VixFuturesReadinessPanelProps) {
  const displayItems = items.map(applyCandidateDisplayOverride);

  return (
    <CandidateSourcePanel
      eyebrow="Candidate sources"
      footer={
        <div className="fallback-proxy-note">
          <span className="status-pill status-partial">Fallback proxy</span>
          <p>
            VIX9D/VIX and VIX/VIX3M can provide fallback proxy context while VX data is inactive. This is not
            a tradable futures curve.
          </p>
        </div>
      }
      items={displayItems}
      summary="Cboe VX settlement candidate fetcher is implemented. Rows remain source-gated and non-scoring until redistribution review approves publication."
      title={title}
    />
  );
}
