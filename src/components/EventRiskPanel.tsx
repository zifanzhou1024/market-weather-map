import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";

const eventRiskItems: CandidateSourceItem[] = [
  {
    id: "event_cpi",
    label: "CPI",
    note: "Release-calendar candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_fomc",
    label: "FOMC",
    note: "Meeting-calendar candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_payrolls",
    label: "payrolls",
    note: "Labor-release candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_treasury_auction",
    label: "Treasury auctions",
    note: "Auction-calendar candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_opex",
    label: "OPEX",
    note: "Options-expiration calendar candidate pending source readiness review.",
    status: "source_review_required"
  }
];

export default function EventRiskPanel() {
  return (
    <CandidateSourcePanel
      eyebrow="Candidate sources"
      items={eventRiskItems}
      summary="Source-gated calendar rows only; this panel does not publish event predictions."
      title="Event risk"
    />
  );
}
