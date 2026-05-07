import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";

const vxItems: CandidateSourceItem[] = Array.from({ length: 8 }, (_, index) => {
  const month = index + 1;
  return {
    id: `vx${month}`,
    label: `VX${month}`,
    note: "VIX futures candidate month pending source and terms readiness review.",
    status: "terms_review_needed"
  };
});

export default function VixFuturesReadinessPanel() {
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
      items={vxItems}
      summary="VX candidate rows remain gated until active futures data is approved for publication."
      title="VIX futures readiness"
    />
  );
}
