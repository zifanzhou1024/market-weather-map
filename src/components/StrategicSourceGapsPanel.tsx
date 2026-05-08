import CandidateSourcePanel from "./CandidateSourcePanel";

const strategicRows = [
  {
    label: "PMIs",
    status: "terms_review_needed",
    note: "Helps track business-cycle breadth before slower hard data updates; not active because source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "SLOOS",
    status: "terms_review_needed",
    note: "Helps track bank-lending standards and credit availability; not active because survey transformation and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "10Y term premium",
    status: "terms_review_needed",
    note: "Helps separate duration risk premium from expected-rate moves; not active because source access and redistribution need review, so it cannot affect scores until source review promotes it."
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
