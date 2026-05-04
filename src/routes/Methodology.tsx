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
          <p>
            Active bucket keys include <code>credit_spreads</code>, <code>liquidity_funding</code>,
            <code>rates_real_yields</code>, <code>volatility_tail_risk</code>, <code>dollar_global</code>,
            <code>commodities_inflation_impulse</code>, and <code>sentiment_positioning</code>.
          </p>
        </section>
        <section className="panel">
          <h3>Macro Climate Score</h3>
          <p>
            The macro climate score separates slower economic inputs from the market tape. Growth, labor,
            inflation, consumer and production activity, and 10Y real yield are read as context for whether the
            backdrop is improving, mixed, overheating, or slowing.
          </p>
          <p>
            The emitted macro buckets are growth, labor, inflation, consumer_production, and real_yields.
          </p>
        </section>
        <section className="panel">
          <h3>Fragility Score</h3>
          <p>
            The fragility score focuses on stress channels that can amplify market moves, including credit
            spreads, financial conditions, dollar pressure, banking data, liquidity, volatility, and candidate
            flow or survey inputs when access has been reviewed.
          </p>
          <p>
            Active drivers include <code>credit_spread_widening</code>, <code>volatility_term_structure</code>,
            <code>dollar_spike</code>, <code>liquidity_drain</code>, <code>positioning_crowding</code>, and
            candidate <code>treasury_bond_volatility</code>.
          </p>
        </section>
        <section className="panel">
          <h3>Transformations and caveats</h3>
          <p>
            Net liquidity is transformed as Fed assets minus Treasury General Account minus Reverse Repo.
            Commodity pressure is summarized through <code>commodity_inflation_impulse</code>, and CFTC
            positioning is transformed into net exposure as a share of open interest.
          </p>
          <p>
            Missing or stale inputs lower confidence and can enter the weighted model as 0.0 neutral fallbacks.
            Scores are descriptive context, not forecasts, signals, or financial advice.
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
            {" "}marks sources that cannot currently be fetched or redistributed by the static no-secret workflow.
            Restricted and unavailable sources are documented but excluded from production scoring.
          </p>
        </section>
      </div>
    </main>
  );
}
