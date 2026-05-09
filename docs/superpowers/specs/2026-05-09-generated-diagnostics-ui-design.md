# Generated Diagnostics UI Design

## Context

The prior ingestion sprint added official/public candidate diagnostics as generated static JSON:

- `sloos_lending_standards`
- `sloos_small_firm_standards`
- `sloos_large_firm_demand`
- `ci_loans_weekly`
- `term_premium_kw_10y`
- `bond_volatility_proxy`

These rows are useful because they come from official/public source paths, but they remain candidate diagnostics. They must not affect active scores, regime labels, checklist states, or confidence.

## Product Goal

Expose these generated candidate diagnostics in the UI where they help users understand what is now visible:

- Long-Term Macro / Allocation Climate should show SLOOS, weekly C&I loans, and Kim-Wright term premium as generated official/public diagnostics.
- Fragility / Shock Risk should show the public realized 10-year yield volatility proxy as a generated diagnostic.
- MOVE, SKEW, Cboe options/futures, valuation, and earnings sources remain visibly gated.

## Display Rules

Generated diagnostics must be labeled with both:

- `Generated candidate diagnostic`
- `Not scored`

The panel copy must state:

> Does not affect active scores, labels, checklist states, or confidence.

The UI should use catalog names and status freshness metadata when available. If a configured diagnostic is missing catalog or status metadata, it can appear as unavailable metadata rather than being silently omitted.

## Scope

In scope:

- Add a reusable diagnostics panel component.
- Render official/public diagnostics on Long-Term and Fragility routes.
- Update long-term source-gap copy so generated SLOOS and Kim-Wright diagnostics are not described as completely absent.
- Add tests for component rendering and route rendering.

Out of scope:

- No ingestion changes.
- No score changes.
- No candidate promotion into active scoring.
- No browser-side API keys.
- No Cboe, ICE, valuation, or earnings data activation.

## Acceptance Criteria

- Long-Term route shows generated SLOOS, weekly C&I loans, and Kim-Wright term premium diagnostics.
- Fragility route shows the realized 10-year yield volatility proxy and explicitly distinguishes it from ICE MOVE.
- Diagnostics are labeled `Generated candidate diagnostic` and `Not scored`.
- The non-scoring caveat is visible on both routes.
- Strategic gated sources still show terms-review status.
- MOVE and SKEW still show terms-review status.
- `npm test` and `GITHUB_PAGES=true npm run build` pass.
