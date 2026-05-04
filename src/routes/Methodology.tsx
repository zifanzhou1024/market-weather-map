export default function Methodology() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Methodology</p>
        <h2>How the map works</h2>
        <p>This static site explains market regimes. It does not provide financial advice.</p>
      </section>
      <div className="methodology-grid">
        <section className="panel">
          <h3>Market Weather Score</h3>
          <p>
            The market weather score summarizes observable market conditions: volatility, rates, liquidity,
            credit, commodities, and positioning. Positive readings describe more supportive current conditions;
            negative readings describe more stressed or fragile current conditions.
          </p>
        </section>
        <section className="panel">
          <h3>Macro Climate Score</h3>
          <p>
            The macro climate score separates slower economic inputs from the market tape. Growth, labor,
            inflation, real yields, and breakevens are read as descriptive context for whether the backdrop is
            improving, mixed, overheating, or slowing.
          </p>
        </section>
        <section className="panel">
          <h3>Fragility Score</h3>
          <p>
            The fragility score focuses on stress channels that can amplify market moves, including credit
            spreads, financial conditions, dollar pressure, banking data, liquidity, volatility, and candidate
            flow or survey inputs when access has been reviewed.
          </p>
        </section>
        <section className="panel">
          <h3>Source access status</h3>
          <p>
            <code>free_public</code> marks active no-secret public feeds that GitHub Actions can fetch and
            publish as static JSON. <code>terms_review_needed</code> marks candidates that stay inactive until
            access, automation, attribution, and redistribution terms are reviewed.
          </p>
          <p>
            <code>restricted</code> marks paid, gated, or license-restricted sources. <code>unavailable</code>
            marks sources that cannot currently be fetched or redistributed by the static no-secret workflow.
            Restricted and unavailable sources are documented but excluded from production scoring.
          </p>
        </section>
      </div>
    </main>
  );
}
