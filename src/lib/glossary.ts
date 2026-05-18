/**
 * Curated plain-English definitions for cockpit jargon.
 *
 * Design notes:
 * - Keys are case-sensitive — labels in cockpit.json render verbatim, so the
 *   keys must match the visible label exactly (including capitalization and
 *   non-ASCII characters like the minus sign in "10Y−2Y").
 * - Definitions are kept short (≤ 200 chars by guard test) so the native
 *   `<abbr title>` browser tooltip stays readable. The tooltip is the only
 *   surface for now; no popover library, no custom UI.
 * - Curated, not regex-matched. We wrap explicit labels at known sites
 *   (cockpit cell labels, unit suffixes, secondary value labels) — auto-
 *   wrapping arbitrary text risks false positives ("PCE" inside "PCE-based"
 *   etc.).
 * - Gated sources (MOVE, SKEW, SLOOS) get definitions so that if/when the
 *   labels surface in candidate panels the glossary is already in place.
 */
export const GLOSSARY: Record<string, string> = {
  // Volatility complex
  VIX: "Cboe Volatility Index — 30-day implied S&P 500 volatility from option prices.",
  VIX9D: "Cboe 9-day implied S&P 500 volatility (front of the volatility curve).",
  VIX3M: "Cboe 3-month implied S&P 500 volatility (longer-dated volatility benchmark).",
  VVIX: "Volatility of VIX — how much VIX itself is fluctuating (vol-of-vol).",

  // Rates / yields
  "10Y Real Yield": "10-year TIPS yield — nominal yield minus inflation expectations.",
  "10Y Breakeven": "10Y nominal yield minus 10Y real yield — implied 10-year inflation expectation.",
  "10Y Term Premium":
    "Compensation investors demand for holding long-dated bonds vs rolling short ones (ACM model).",
  ACM: "Adrian-Crump-Moench model — NY Fed's decomposition of the yield curve into expectations + term premium.",
  "10Y−2Y": "10-year minus 2-year Treasury yield spread — a recession-signal canonical curve measure.",
  "US 10Y": "10-year US Treasury constant maturity yield (FRED DGS10).",
  "US 2Y": "2-year US Treasury constant maturity yield (FRED DGS2).",
  SOFR: "Secured Overnight Financing Rate — the post-LIBOR US short-term reference rate.",

  // Credit
  "HY OAS": "High-yield corporate bond option-adjusted spread — risk premium over Treasuries.",
  "IG OAS": "Investment-grade corporate bond option-adjusted spread.",
  OAS: "Option-adjusted spread — yield premium of a bond over the matched-tenor Treasury, adjusted for embedded options.",
  "HY−IG": "Spread between high-yield and investment-grade OAS — credit-quality dispersion gauge.",

  // Macro
  "Core CPI YoY":
    "Year-over-year change in the Consumer Price Index excluding food and energy.",
  "Core PCE":
    "Personal Consumption Expenditures price index excluding food and energy — Fed's preferred inflation gauge.",
  "Initial Claims":
    "Weekly count of new US unemployment-insurance applications — the fastest labor pulse.",
  "Nonfarm Payrolls":
    "Monthly count of US payroll jobs excluding farms — BLS Employment Situation headline.",

  // Liquidity / FX / sentiment
  "Net Liquidity":
    "Fed balance sheet minus Treasury General Account minus reverse repo — funding backdrop for risk assets.",
  "Broad USD":
    "Trade-weighted broad dollar index (FRED DTWEXBGS) — global dollar pressure measure.",
  "WTI Crude": "West Texas Intermediate crude oil price — US benchmark.",
  "SP500 Lev-Money":
    "CFTC Commitment of Traders leveraged-money net positioning in S&P 500 futures.",
  CFTC: "Commodity Futures Trading Commission — publisher of weekly Commitments of Traders positioning reports.",

  // Gated (acknowledge but mark as not-yet-shown)
  MOVE: "ICE BofA MOVE Index — implied volatility of US Treasury options. Currently gated; see source review.",
  SKEW: "Cboe SKEW Index — tail-risk pricing in S&P options beyond at-the-money implied vol. Currently gated.",
  SLOOS:
    "Fed Senior Loan Officer Opinion Survey — quarterly bank-lending standards.",

  // Units / shorthand
  bp: "Basis point — 1/100th of one percent (0.01%).",
  pp: "Percentage point — absolute difference between two percentages.",
  "% YoY": "Percent year-over-year — value compared to 12 months ago.",
  "Δ7d": "Change vs the most recent observation at least 7 calendar days ago.",
  "Δ1m": "Change vs the most recent observation at least 30 calendar days ago.",
  pct: "Percentile — rank of the current value within its historical distribution.",
  pctile: "Percentile.",
};

/**
 * Look up a glossary definition by exact key.
 *
 * Case-sensitive on purpose — labels in the cockpit JSON render verbatim, so
 * keys are written to match the visible label exactly. Returns `undefined`
 * when the term is not in the glossary so callers can fall through to
 * rendering the bare label.
 */
export function lookupGlossary(term: string): string | undefined {
  return GLOSSARY[term];
}
