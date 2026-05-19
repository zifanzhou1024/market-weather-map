import RouteDataFooter from "../components/RouteDataFooter";
import { useT } from "../lib/i18n";

/**
 * The Methodology route renders five long-form panels describing how the
 * dashboard works. The narrative text is wired through i18n so zh users see
 * idiomatic Chinese paragraphs; the inline `<code>` bucket-key identifiers
 * stay English (they are machine-readable keys, not prose).
 *
 * Variable substitution lets us interpolate `<code>` JSX nodes via vars —
 * each `t()` paragraph that contains `<code>` keys passes those code spans
 * as React children and the en/zh prose carries `{{name}}` placeholders.
 *
 * Because vars must be strings, we render the variable-bearing paragraphs by
 * splitting the translated text around the placeholders and interleaving
 * the code spans. The simplest readable approach: precompute substring
 * templates and stitch them.
 */
function withCodes(
  template: string,
  codes: Record<string, string>
): React.ReactNode[] {
  // Replace each {{name}} with a marker, split, and re-interleave with
  // `<code>{name}</code>` spans so we preserve the JSX semantics.
  const parts: React.ReactNode[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index));
    }
    const name = match[1];
    const code = codes[name];
    parts.push(
      code !== undefined ? (
        <code key={`code-${i}`}>{code}</code>
      ) : (
        `{{${name}}}`
      )
    );
    lastIndex = match.index + match[0].length;
    i += 1;
  }
  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex));
  }
  return parts;
}

export default function Methodology() {
  const { t } = useT();
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{t("routes.methodologyEyebrow")}</p>
        <h2>{t("routes.methodologyHeading")}</h2>
        <p>{t("routes.methodologyIntro")}</p>
      </section>
      <div className="methodology-grid">
        <section className="panel">
          <h3>{t("methodology.marketWeather")}</h3>
          <p>{t("methodology.marketWeatherBody1")}</p>
          <p>
            {withCodes(t("methodology.marketWeatherBody2"), {
              credit: "credit_spreads",
              liquidity: "liquidity_funding",
              rates: "rates_real_yields",
              volatility: "volatility_tail_risk",
              dollar: "dollar_global",
              commodities: "commodities_inflation_impulse",
              sentiment: "sentiment_positioning",
            })}
          </p>
        </section>
        <section className="panel">
          <h3>{t("methodology.macroClimate")}</h3>
          <p>{t("methodology.macroClimateBody1")}</p>
          <p>{t("methodology.macroClimateBody2")}</p>
        </section>
        <section className="panel">
          <h3>{t("methodology.fragility")}</h3>
          <p>{t("methodology.fragilityBody1")}</p>
          <p>
            {withCodes(t("methodology.fragilityBody2"), {
              creditWidening: "credit_spread_widening",
              volTerm: "volatility_term_structure",
              dollarSpike: "dollar_spike",
              liquidityDrain: "liquidity_drain",
              positioning: "positioning_crowding",
              treasuryVol: "treasury_bond_volatility",
            })}
          </p>
        </section>
        <section className="panel">
          <h3>{t("methodology.transformations")}</h3>
          <p>
            {withCodes(t("methodology.transformsBody1"), {
              commodityImpulse: "commodity_inflation_impulse",
              breakeven: "breakeven_10y",
            })}
          </p>
          <p>{t("methodology.transformsBody2")}</p>
        </section>
        <section className="panel">
          <h3>{t("methodology.sourceAccess")}</h3>
          <p>
            {withCodes(t("methodology.sourceAccessBody1"), {
              freePublic: "free_public",
              termsReview: "terms_review_needed",
            })}
          </p>
          <p>
            {withCodes(t("methodology.sourceAccessBody2"), {
              restricted: "restricted",
              unavailable: "unavailable",
            })}
          </p>
        </section>
      </div>
      <RouteDataFooter />
    </main>
  );
}
