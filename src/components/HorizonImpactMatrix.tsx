const rows = [
  {
    driver: "VIX / VIX curve",
    shortTerm: "Directly frames short-term stress and option premium.",
    longTerm: "Acts as context for fragility, not a stand-alone macro climate signal."
  },
  {
    driver: "Put/call",
    shortTerm: "Shows positioning pressure and demand for downside protection.",
    longTerm: "Useful as a sentiment input when crowding persists."
  },
  {
    driver: "Credit spreads",
    shortTerm: "Widening can confirm equity stress and risk-off reactions.",
    longTerm: "Persistent widening points to tighter financial conditions."
  },
  {
    driver: "Real yields",
    shortTerm: "Rapid moves can reprice equity duration and growth-sensitive groups.",
    longTerm: "Level and trend help define discount-rate pressure."
  },
  {
    driver: "Breakevens",
    shortTerm: "Sharp changes can shift the inflation-growth read-through.",
    longTerm: "Trend helps separate disinflation, reflation, and stagflation pressure."
  },
  {
    driver: "Dollar",
    shortTerm: "Dollar spikes can pressure global risk appetite and commodities.",
    longTerm: "Sustained strength can tighten global liquidity conditions."
  },
  {
    driver: "Net liquidity",
    shortTerm: "Abrupt liquidity shifts can amplify market reactions.",
    longTerm: "Trend informs the macro liquidity backdrop."
  },
  {
    driver: "CPI / FOMC / payrolls",
    shortTerm: "Scheduled events can dominate near-term volatility.",
    longTerm: "Repeated surprises can reset policy and growth expectations."
  },
  {
    driver: "Labor trend",
    shortTerm: "Payroll and claims surprises can move rate expectations.",
    longTerm: "Trend helps distinguish resilient growth from slowing demand."
  },
  {
    driver: "Housing",
    shortTerm: "Usually a secondary input unless rate-sensitive data surprises.",
    longTerm: "Cycle direction helps frame growth and credit sensitivity."
  },
  {
    driver: "Consumer debt service",
    shortTerm: "Rarely drives a single session without a related credit catalyst.",
    longTerm: "Rising burden can flag household balance-sheet pressure."
  },
  {
    driver: "Valuation / ERP",
    shortTerm: "Can affect reaction size when positioning is extended.",
    longTerm: "Anchors expected compensation for equity risk."
  },
  {
    driver: "Treasury supply / term premium",
    shortTerm: "Auction or issuance pressure can move rates quickly.",
    longTerm: "Persistent supply pressure can lift required term compensation."
  }
];

export default function HorizonImpactMatrix() {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Horizon map</p>
          <h3>Signal Impact Matrix</h3>
          <p>Shared context for how each signal family maps into short-term reactions and longer-term climate.</p>
        </div>
      </div>
      <div className="horizon-impact-grid">
        {rows.map((row) => (
          <article className="metric-card" key={row.driver}>
            <p className="metric-source">{row.driver}</p>
            <dl className="detail-list">
              <div>
                <dt>Short-term</dt>
                <dd>{row.shortTerm}</dd>
              </div>
              <div>
                <dt>Long-term</dt>
                <dd>{row.longTerm}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
