import CandidateSourcePanel from "./CandidateSourcePanel";

const strategicRows = [
  {
    id: "pmis",
    label: "PMIs",
    status: "terms_review_needed",
    note: "Helps track business-cycle breadth before slower hard data updates; not active because source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "sloos_scoring_promotion",
    label: "SLOOS scoring promotion",
    status: "terms_review_needed",
    note: "Generated official SLOOS diagnostics are visible separately, but scoring promotion still needs transformation and governance review before it can affect active scores."
  },
  {
    id: "ny_fed_acm_term_premium",
    label: "NY Fed ACM term premium",
    status: "terms_review_needed",
    note: "Kim-Wright term-premium diagnostics are visible separately; NY Fed ACM term premium remains gated until source access and redistribution review is complete."
  },
  {
    id: "treasury_net_issuance",
    label: "Treasury net issuance",
    status: "terms_review_needed",
    note: "Helps track supply pressure on duration markets; not active because fiscal-source automation and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "auction_tail",
    label: "Auction tail",
    status: "terms_review_needed",
    note: "Helps track demand weakness at Treasury auctions; not active because auction-data publication rules need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "bid_to_cover",
    label: "Bid-to-cover",
    status: "terms_review_needed",
    note: "Helps track auction demand depth; not active because auction-data publication rules need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "cape",
    label: "CAPE",
    status: "terms_review_needed",
    note: "Helps frame long-horizon valuation pressure; not active because valuation source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "forward_pe",
    label: "Forward P/E",
    status: "terms_review_needed",
    note: "Helps frame earnings-adjusted valuation pressure; not active because forward-estimate source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "equity_risk_premium",
    label: "Equity risk premium",
    status: "terms_review_needed",
    note: "Helps compare equity compensation against rates; not active because calculation inputs and source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "earnings_revision_breadth",
    label: "Earnings revision breadth",
    status: "terms_review_needed",
    note: "Helps track analyst estimate momentum; not active because revision data source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    id: "fiscal_deficit_interest_expense",
    label: "Fiscal deficit / interest expense",
    status: "terms_review_needed",
    note: "Helps frame fiscal pressure and debt-service load over strategic horizons; not active because source timing and redistribution need review, so it cannot affect scores until source review promotes it."
  }
];

export default function StrategicSourceGapsPanel() {
  return (
    <CandidateSourcePanel
      eyebrow="Candidate sources"
      items={strategicRows}
      summary="Strategic source gaps remain candidate-only until source access, transformation, and redistribution review promotes them."
      title="Strategic source gaps"
    />
  );
}
