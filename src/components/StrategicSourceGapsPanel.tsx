import CandidateSourcePanel from "./CandidateSourcePanel";

const strategicRows = [
  { label: "PMIs", status: "terms_review_needed", note: "Strategic breadth input remains source-gated." },
  {
    label: "SLOOS",
    status: "terms_review_needed",
    note: "Bank lending survey transformation and redistribution remain under review."
  },
  {
    label: "Term premium",
    status: "terms_review_needed",
    note: "NY Fed ACM or equivalent source requires access review before scoring."
  },
  {
    label: "Treasury supply",
    status: "terms_review_needed",
    note: "Issuance and auction data require source-governed static publication rules."
  },
  {
    label: "Valuation",
    status: "terms_review_needed",
    note: "CAPE, forward P/E, ERP, and related valuation inputs remain candidate-only."
  },
  {
    label: "Earnings revisions",
    status: "terms_review_needed",
    note: "Analyst revision data remains candidate-only until a compliant source is approved."
  }
].map((row) => ({
  id: row.label.toLowerCase().replace(/\s+/g, "_"),
  ...row
}));

export default function StrategicSourceGapsPanel() {
  return (
    <CandidateSourcePanel
      eyebrow="Candidate sources"
      items={strategicRows}
      summary="PMIs, SLOOS, term premium, Treasury supply, valuation, and earnings revisions remain candidate-only strategic inputs and do not affect active scores."
      title="Strategic source gaps"
    />
  );
}
