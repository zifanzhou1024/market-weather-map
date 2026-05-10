interface StrategicGapRow {
  id: string;
  label: string;
  category: "Activity breadth" | "Banking" | "Fiscal / supply" | "Valuation" | "Earnings";
  importance: 1 | 2 | 3 | 4 | 5;
  status: "terms_review_needed";
  unlocks: string;
}

const STRATEGIC_GAPS: ReadonlyArray<StrategicGapRow> = [
  {
    id: "pmis",
    label: "PMIs",
    category: "Activity breadth",
    importance: 5,
    status: "terms_review_needed",
    unlocks: "Business-cycle breadth ahead of slower hard data."
  },
  {
    id: "sloos_promotion",
    label: "SLOOS scoring promotion",
    category: "Banking",
    importance: 4,
    status: "terms_review_needed",
    unlocks:
      "Lending-standards signal in active scoring (currently diagnostic-only)."
  },
  {
    id: "term_premium_acm",
    label: "NY Fed ACM term premium",
    category: "Valuation",
    importance: 4,
    status: "terms_review_needed",
    unlocks: "Decompose long yields into rate expectations vs risk premium."
  },
  {
    id: "treasury_net_issuance",
    label: "Treasury net issuance",
    category: "Fiscal / supply",
    importance: 4,
    status: "terms_review_needed",
    unlocks: "Duration-supply pressure on long rates."
  },
  {
    id: "auction_tail",
    label: "Auction tail",
    category: "Fiscal / supply",
    importance: 3,
    status: "terms_review_needed",
    unlocks: "Auction demand weakness signal."
  },
  {
    id: "bid_to_cover",
    label: "Bid-to-cover",
    category: "Fiscal / supply",
    importance: 3,
    status: "terms_review_needed",
    unlocks: "Auction demand depth signal."
  },
  {
    id: "cape",
    label: "CAPE",
    category: "Valuation",
    importance: 3,
    status: "terms_review_needed",
    unlocks: "Long-horizon equity valuation pressure."
  },
  {
    id: "forward_pe",
    label: "Forward P/E",
    category: "Valuation",
    importance: 3,
    status: "terms_review_needed",
    unlocks: "Earnings-adjusted equity valuation pressure."
  },
  {
    id: "equity_risk_premium",
    label: "Equity risk premium",
    category: "Valuation",
    importance: 4,
    status: "terms_review_needed",
    unlocks: "Equity compensation vs the rates path."
  },
  {
    id: "earnings_revision_breadth",
    label: "Earnings revision breadth",
    category: "Earnings",
    importance: 4,
    status: "terms_review_needed",
    unlocks: "Analyst estimate momentum."
  },
  {
    id: "fiscal_deficit_interest_expense",
    label: "Fiscal deficit / interest expense",
    category: "Fiscal / supply",
    importance: 4,
    status: "terms_review_needed",
    unlocks: "Fiscal pressure and debt-service load."
  }
];

function uniqueCategoriesInDeclarationOrder(
  rows: ReadonlyArray<StrategicGapRow>
): StrategicGapRow["category"][] {
  const seen = new Set<string>();
  const out: StrategicGapRow["category"][] = [];
  for (const row of rows) {
    if (!seen.has(row.category)) {
      seen.add(row.category);
      out.push(row.category);
    }
  }
  return out;
}

function importanceDots(importance: number): string {
  const filled = "●".repeat(importance);
  const empty = "○".repeat(5 - importance);
  return `${filled}${empty}`;
}

export default function StrategicSourceGapMatrix() {
  const categories = uniqueCategoriesInDeclarationOrder(STRATEGIC_GAPS);

  return (
    <section
      className="strategic-source-gap-matrix"
      aria-label="Strategic source-gap matrix"
    >
      <header>
        <h3>Strategic source-gap matrix</h3>
        <p>
          Strategic candidate sources grouped by category. Importance indicates likely scoring
          weight if promoted; all rows remain candidate-only and do not affect active scores.
        </p>
      </header>
      {categories.map((category) => {
        const rows = STRATEGIC_GAPS.filter((row) => row.category === category)
          .slice()
          .sort((a, b) => b.importance - a.importance);
        return (
          <div key={category} className="strategic-source-gap-group">
            <h4 className="strategic-source-gap-group-heading">{category}</h4>
            {rows.map((row) => (
              <div key={row.id} className="strategic-source-gap-row-wrapper">
                <div className="strategic-source-gap-row">
                  <span className="strategic-source-gap-label">{row.label}</span>
                  <span
                    className="strategic-source-gap-importance"
                    aria-label={`Importance ${row.importance} of 5`}
                  >
                    {importanceDots(row.importance)}
                  </span>
                  <span className="strategic-source-gap-badge strategic-source-gap-badge--gated">
                    {row.status}
                  </span>
                </div>
                <p className="strategic-source-gap-unlock">{`Unlocks: ${row.unlocks}`}</p>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
