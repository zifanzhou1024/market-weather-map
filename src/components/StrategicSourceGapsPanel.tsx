import CandidateSourcePanel from "./CandidateSourcePanel";

const strategicRows = [
  {
    label: "PMIs",
    status: "terms_review_needed",
    note: "Helps track business-cycle breadth before slower hard data updates; not active because source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "SLOOS scoring promotion",
    status: "terms_review_needed",
    note: "Generated official SLOOS diagnostics are visible separately, but scoring promotion still needs transformation and governance review before it can affect active scores."
  },
  {
    label: "NY Fed ACM term premium",
    status: "terms_review_needed",
    note: "Kim-Wright term-premium diagnostics are visible separately; NY Fed ACM term premium remains gated until source access and redistribution review is complete."
  },
  {
    label: "Treasury net issuance",
    status: "terms_review_needed",
    note: "Helps track supply pressure on duration markets; not active because fiscal-source automation and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Auction tail",
    status: "terms_review_needed",
    note: "Helps track demand weakness at Treasury auctions; not active because auction-data publication rules need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Bid-to-cover",
    status: "terms_review_needed",
    note: "Helps track auction demand depth; not active because auction-data publication rules need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "CAPE",
    status: "terms_review_needed",
    note: "Helps frame long-horizon valuation pressure; not active because valuation source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Forward P/E",
    status: "terms_review_needed",
    note: "Helps frame earnings-adjusted valuation pressure; not active because forward-estimate source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Equity risk premium",
    status: "terms_review_needed",
    note: "Helps compare equity compensation against rates; not active because calculation inputs and source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Earnings revision breadth",
    status: "terms_review_needed",
    note: "Helps track analyst estimate momentum; not active because revision data source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Fiscal deficit / interest expense",
    status: "terms_review_needed",
    note: "Helps frame fiscal pressure and debt-service load over strategic horizons; not active because source timing and redistribution need review, so it cannot affect scores until source review promotes it."
  }
].map((row) => ({
  id: row.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  ...row
}));

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
