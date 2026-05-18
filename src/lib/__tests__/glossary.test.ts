import { describe, expect, test } from "vitest";
import { GLOSSARY, lookupGlossary } from "../glossary";

describe("glossary", () => {
  test("known term returns its definition", () => {
    // The canonical cockpit headline-row term — exercises both the volatility
    // and rates families of definitions.
    expect(lookupGlossary("VIX")).toMatch(/Cboe Volatility Index/);
    expect(lookupGlossary("10Y Breakeven")).toMatch(/implied 10-year inflation/);
    expect(lookupGlossary("HY OAS")).toMatch(/option-adjusted spread/);
  });

  test("unknown term returns undefined (caller falls through to bare label)", () => {
    expect(lookupGlossary("Market Weather")).toBeUndefined();
    expect(lookupGlossary("")).toBeUndefined();
    expect(lookupGlossary("not-a-term")).toBeUndefined();
  });

  test("lookup is case-sensitive — labels render verbatim, keys match exactly", () => {
    expect(lookupGlossary("VIX")).toBeDefined();
    expect(lookupGlossary("vix")).toBeUndefined();
    expect(lookupGlossary("Vix")).toBeUndefined();
  });

  test("all definitions ≤ 200 chars so native title tooltip stays readable", () => {
    // Lenient guard against bloat. The native <abbr title> tooltip browsers
    // render starts to wrap awkwardly past ~200 chars on narrow viewports.
    for (const [term, def] of Object.entries(GLOSSARY)) {
      expect(def.length, `definition for "${term}" exceeds 200 chars`).toBeLessThanOrEqual(200);
    }
  });

  test("no empty definitions", () => {
    for (const [term, def] of Object.entries(GLOSSARY)) {
      expect(def.length, `definition for "${term}" is empty`).toBeGreaterThan(0);
    }
  });

  test("contains the high-traffic cockpit jargon families", () => {
    // Documentation test — these are the headline terms that appear on the
    // cockpit grid today. If a future refactor removes one, this test fires
    // so the glossary stays in sync with what the user sees.
    const required = [
      "VIX",
      "10Y Real Yield",
      "10Y Breakeven",
      "HY OAS",
      "IG OAS",
      "Core CPI YoY",
      "Core PCE",
      "Initial Claims",
      "Nonfarm Payrolls",
      "Net Liquidity",
      "Broad USD",
      "WTI Crude",
      "CFTC",
      "bp",
      "% YoY",
      "Δ7d",
      "Δ1m",
    ];
    for (const term of required) {
      expect(GLOSSARY[term], `required term "${term}" missing from glossary`).toBeDefined();
    }
  });
});
