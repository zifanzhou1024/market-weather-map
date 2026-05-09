# Generated Diagnostics UI Implementation Plan

## Objective

Surface generated official/public diagnostics in the Long-Term and Fragility pages while preserving candidate-source governance.

## Steps

1. Add failing tests.
   - Component test for a reusable generated diagnostic panel.
   - Long-Term route test for generated SLOOS, weekly C&I loans, and Kim-Wright term premium.
   - Fragility route test for the public realized bond-volatility proxy while MOVE/SKEW stay gated.

2. Build the reusable component.
   - Create `src/components/CandidateDiagnosticPanel.tsx`.
   - Inputs: catalog, data status, configured diagnostic IDs, title/summary/eyebrow.
   - Output: rows with catalog name, source, observation period, freshness/status message, `Generated candidate diagnostic`, and `Not scored`.

3. Wire Long-Term.
   - Render generated official/public diagnostics before strategic source gaps.
   - Use IDs:
     - `sloos_lending_standards`
     - `sloos_small_firm_standards`
     - `sloos_large_firm_demand`
     - `ci_loans_weekly`
     - `term_premium_kw_10y`
   - Keep unresolved strategic source gaps visible.

4. Wire Fragility.
   - Render public bond-volatility diagnostic near the shock-risk diagnostic area.
   - Use ID:
     - `bond_volatility_proxy`
   - Keep TailRisk/MOVE/SKEW candidate source gates unchanged.

5. Adjust source-gap copy.
   - Replace generic SLOOS and generic 10Y term-premium gap rows with clearer gated gaps:
     - ISM/S&P Global PMIs
     - NY Fed ACM term premium
     - scoring promotion for generated official diagnostics where relevant
   - Keep valuation, ERP, earnings revisions, Treasury supply, and auction metrics gated.

6. Add styles.
   - Reuse existing panel/list patterns.
   - Add compact metadata/badge layout for diagnostic rows.

7. Verify.
   - Run targeted tests for component and routes.
   - Run full `npm test`.
   - Run `GITHUB_PAGES=true npm run build`.

## Non-Goals

- Do not update scoring.
- Do not fetch new external sources.
- Do not promote any candidate rows to active.
- Do not expose API keys in the browser.
