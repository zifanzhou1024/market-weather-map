import RouteDataFooter from "../components/RouteDataFooter";
import { useT } from "../lib/i18n";

export default function Methodology() {
  const { t } = useT();
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow" lang="en">Methodology</p>
        <h2>{t("routes.methodologyHeading")}</h2>
        <p lang="en">This static site explains market regimes. It does not provide financial advice.</p>
      </section>
      <div className="methodology-grid">
        <section className="panel">
          <h3>{t("methodology.marketWeather")}</h3>
          <p lang="en">
            The market weather score summarizes observable market conditions: volatility, rates, liquidity,
            credit, commodities, and positioning. Positive readings describe more supportive current conditions;
            negative readings describe more stressed or fragile current conditions.
          </p>
          <p lang="en">
            Active bucket keys include <code>credit_spreads</code>, <code>liquidity_funding</code>,
            <code>rates_real_yields</code>, <code>volatility_tail_risk</code>, <code>dollar_global</code>,
            <code>commodities_inflation_impulse</code>, and <code>sentiment_positioning</code>.
          </p>
        </section>
        <section className="panel">
          <h3>{t("methodology.macroClimate")}</h3>
          <p lang="en">
            The macro climate score separates slower economic inputs from the market tape. Growth, labor,
            inflation, consumer and production activity, housing, and 10Y real yield are read as context for
            whether the backdrop is improving, mixed, overheating, or slowing.
          </p>
          <p lang="en">
            The emitted macro buckets are growth, labor, inflation, consumer_production, housing, and real_yields.
          </p>
        </section>
        <section className="panel">
          <h3>{t("methodology.fragility")}</h3>
          <p lang="en">
            The fragility score focuses on stress channels that can amplify market moves, including credit
            spreads, financial conditions, dollar pressure, banking data, liquidity, volatility, and candidate
            flow or survey inputs when access has been reviewed.
          </p>
          <p lang="en">
            Active drivers include <code>credit_spread_widening</code>, <code>volatility_term_structure</code>,
            <code>dollar_spike</code>, <code>liquidity_drain</code>, <code>positioning_crowding</code>, and
            candidate <code>treasury_bond_volatility</code>.
          </p>
        </section>
        <section className="panel">
          <h3>{t("methodology.transformations")}</h3>
          <p lang="en">
            Net liquidity is transformed as Fed assets minus Treasury General Account minus Reverse Repo.
            Commodity pressure is summarized through <code>commodity_inflation_impulse</code>;
            <code>breakeven_10y</code> can confirm commodity inflation pressure when available. CFTC
            positioning is transformed into net exposure as a share of open interest.
          </p>
          <p lang="en">
            Missing or stale inputs lower confidence and can enter the weighted model as 0.0 neutral fallbacks.
            Scores are descriptive context, not forecasts, signals, or financial advice.
          </p>
        </section>
        <section className="panel">
          <h3>{t("methodology.sourceAccess")}</h3>
          <p lang="en">
            <code>free_public</code> marks active no-secret public feeds that GitHub Actions can fetch and
            publish as static JSON. <code>terms_review_needed</code> marks candidates that stay inactive until
            access, automation, attribution, and redistribution terms are reviewed.
          </p>
          <p lang="en">
            <code>restricted</code> marks paid, gated, or license-restricted sources. <code>unavailable</code>
            {" "}marks sources that cannot currently be fetched or redistributed by the static no-secret workflow.
            Restricted and unavailable sources are documented but excluded from production scoring.
          </p>
        </section>
      </div>
      <RouteDataFooter />
    </main>
  );
}
