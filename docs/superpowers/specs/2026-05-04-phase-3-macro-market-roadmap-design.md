# Phase 3 Macro-Market Roadmap Design

Date: 2026-05-04

## Summary

`market-weather-map` already has a solid static dashboard foundation: Vite, React, TypeScript, Python ingestion, GitHub Actions updates, static JSON under `public/data`, and Phase 2 public commodities, liquidity, and CFTC positioning. The next product step is to turn it from a market-risk and liquidity dashboard into a fuller macro-market map.

This design sets a multi-phase roadmap. Phase 3 is detailed as the next implementation phase. Later phases are intentionally sketched so each can become its own design and implementation plan later.

Phase 3 should be foundation-led: install the new scoring and source-governance contract first, while adding enough active macro data and UI changes that the dashboard visibly improves. The core change is to separate one broad weather number into three descriptive scores:

- Market Weather Score: short-term cross-asset risk conditions.
- Macro Climate Score: growth, labor, inflation, and policy regime.
- Fragility Score: vulnerability to tail-risk, liquidity stress, credit stress, dollar pressure, and crowding.

The app remains static and no-secret. The browser continues reading only generated JSON. No backend, API keys, live feeds, paid data, financial advice, forecasts, or trade recommendations are added.

## Current Project Context

The local repo contains:

- React/Vite/TypeScript frontend routes for Overview, Volatility, Rates, Liquidity, Credit, Commodities, Sentiment, and Methodology.
- Python ingestion for Cboe VIX, FRED graph CSV endpoints, and CFTC public compressed reports.
- Central catalog metadata in `scripts/shared/catalog.py`.
- Static JSON under `public/data/catalog`, `public/data/series`, `public/data/derived`, and `public/data/status`.
- A safe update runner that preserves prior good public data when an update fails.
- Existing score logic in `scripts/transform/compute_regime_score.py`.
- Existing tests for scoring, catalog behavior, data contracts, routes, and UI components.

The current product is functional, but conceptually incomplete. It measures volatility, nominal rates, liquidity, broad stress indexes, commodities, and CFTC positioning. It does not yet represent growth, labor, inflation, real rates, direct credit spreads, dollar pressure, bank-credit impulse, source access governance, or confidence.

## Roadmap

### Phase 3: Scoring Foundation And Core Macro Pillars

Phase 3 is the next PR. It changes the data model and scoring model, adds active no-secret macro inputs, updates the core UI, and documents source access status.

Phase 3 deliverables:

- New three-score output contract.
- Score-level confidence.
- Driver-specific supports, risks, and recent changes.
- Source registry with access and terms classifications.
- Expanded data status states.
- Active FRED additions for direct credit, real rates, breakevens, growth, labor, inflation, dollar, and bank credit.
- Conditional Cboe volatility additions if public CSV endpoints validate cleanly.
- New macro routes and updated existing routes.
- README and docs that distinguish freely available no-secret sources from reviewed, restricted, or unavailable sources.
- Package version pinning and schema tests for the new JSON contracts.

### Phase 4: Product Interpretation And Regime Intelligence

Phase 4 deepens interpretation after the score foundation is stable.

Scope:

- Stronger macro-market regime labels.
- Better "what changed this week" narratives.
- More explicit conflicting-signal detection.
- Page-level explanations and comparison sections.
- Sharper interpretation of commodity inflation impulse versus commodity level.
- More nuanced support/risk ranking.

### Phase 5: Terms-Reviewed Sources And Event Risk

Phase 5 adds sources that are valuable but need access, terms, licensing, citation, or redistribution review.

Candidate areas:

- ISM manufacturing and services PMI.
- AAII sentiment.
- NAAIM Exposure Index.
- SLOOS lending standards.
- MOVE index.
- Put/call ratio.
- NY Fed ACM term premium.
- Event calendar data.
- Trimmed mean inflation series if source treatment needs review.

These sources must not be treated as active inputs until the repo documents that their access and redistribution status is acceptable for automated static publication.

### Phase 6: Data Quality And Maintainability Hardening

Phase 6 focuses on long-term maintainability.

Scope:

- Pretty-print generated JSON and compressed docs where reviewability is poor.
- Split scoring modules if Phase 3 makes `compute_regime_score.py` too broad.
- Add deeper schema validation.
- Expand partial-update handling.
- Improve generated data diff hygiene.
- Add documentation checks for source access statuses.

## Phase 3 Goals

- Make the dashboard describe market weather, macro climate, and fragility separately.
- Add the highest-value no-secret macro pillars without changing the static architecture.
- Avoid treating all missing sources as active or implied.
- Mark every source by access and terms status.
- Replace bucket-name-only risks with specific, driver-level explanations.
- Make score confidence visible and mechanically explainable.
- Keep routes and components close to existing patterns.
- Preserve previous-good-data behavior when a source fails.

## Phase 3 Non-Goals

- No backend service.
- No database.
- No browser-side provider calls.
- No browser-side API keys.
- No paid or authenticated data.
- No live market feed.
- No trade advice or predictive recommendations.
- No automated ingestion of terms-reviewed sources until reviewed.
- No event calendar in Phase 3.
- No full visual redesign.

## Approach Considered

Three approaches were considered.

Recommended approach: foundation-led Phase 3 with visible dashboard upgrade.

This installs the scoring and data contracts first, adds the most useful no-secret macro series, and updates the UI enough to show the product direction. It avoids forcing dozens of new inputs into the old single-score model.

Data breadth first:

This would add many FRED and Cboe series before changing scoring architecture. It would make the data catalog look richer quickly, but it would deepen conceptual debt because the single score cannot honestly represent all macro dimensions.

Product shell first:

This would restructure navigation and overview around the final vision before most analytical substance exists. It would improve framing, but risks making the product feel more complete than its active data supports.

The selected approach is the first one.

## Source Governance

Phase 3 adds explicit source governance to the generated data and docs.

### Source Registry

Create `public/data/catalog/source_registry.json`.

Each provider entry should include:

- provider id
- display name
- base URL
- requires secret
- source-level access status
- source-level terms status
- citation notes
- update cadence notes
- source caveats

Example:

```json
{
  "fred": {
    "name": "Federal Reserve Economic Data",
    "base_url": "https://fred.stlouisfed.org",
    "requires_secret": false,
    "access_status": "free_public",
    "terms_status": "review_each_series",
    "notes": "FRED graph CSV endpoints do not require a secret, but hosted series can carry source-specific citation or redistribution requirements."
  }
}
```

### Series-Level Metadata

Extend `series_catalog.json` entries with:

- `access_status`: `free_public`, `terms_review_needed`, `restricted`, or `unavailable`
- `terms_status`: `ok`, `review_each_series`, `review_needed`, `restricted`, or `unknown`
- `score_status`: `active`, `candidate`, or `unavailable`
- `provider_id`: for joining to `source_registry.json`
- `citation_notes`: concise source-specific notes

Active scored series must have `score_status: "active"` and must be fetchable without secrets. Candidate and unavailable series may appear in docs and catalog context, but the frontend must not present them as active metrics or include them in scores.

### README Data Access Table

Update `README.md` with a "Data access status" section. It must distinguish:

- Active no-secret public inputs.
- Terms-reviewed candidates.
- Restricted or unavailable inputs.

The table must make it clear when a useful data source is not freely automatable online or is not appropriate for automated redistribution without review.

## Phase 3 Active Data Slice

The active Phase 3 input set should favor series that fit the existing FRED graph CSV ingestion loop.

### Credit

- `BAMLH0A0HYM2`: ICE BofA US High Yield Index OAS.
- `BAMLC0A0CM`: ICE BofA US Corporate Index OAS.
- `BAMLC0A4CBBB`: ICE BofA BBB US Corporate Index OAS.

These become the primary credit spread inputs. STLFSI4 and NFCI remain useful broad conditions inputs, but direct spreads should drive credit stress more than broad indexes.

### Rates And Policy

- `DFII10`: 10-year real yield.
- `DFII5`: 5-year real yield.
- `T10YIE`: 10-year breakeven inflation rate.
- `T5YIE`: 5-year breakeven inflation rate.
- `T5YIFR`: 5-year, 5-year forward inflation expectation rate.

Existing nominal Treasury yields remain active. The rates route becomes `Rates & Policy` in navigation while keeping `/rates` as the route path unless a redirect is added.

### Growth, Consumer Demand, Production, And Labor

- `CFNAI`: Chicago Fed National Activity Index.
- `CFNAIMA3`: CFNAI 3-month moving average.
- `RRSFS`: real retail and food services sales.
- `INDPRO`: industrial production index.
- `DGORDER`: manufacturers' new orders for durable goods.
- `UNRATE`: unemployment rate.
- `PAYEMS`: nonfarm payrolls.
- `ICSA`: initial jobless claims.
- `SAHMREALTIME`: real-time Sahm Rule Recession Indicator.

Phase 3 should create `/growth` and include a clearly labeled labor/recession section on that route. A separate `/labor-recession` route is deferred so navigation does not become overcrowded in the foundation PR.

### Inflation

- `CPIAUCSL`: headline CPI.
- `CPILFESL`: core CPI.
- `PCEPILFE`: core PCE price index.
- `PPIFIS`: PPI final demand if the FRED graph CSV endpoint validates cleanly.

Inflation scoring should use momentum and recent change, not raw price-index level alone.

### Dollar And Global

- `DTWEXBGS`: nominal broad U.S. dollar index.
- `DEXJPUS`: Japanese yen to U.S. dollar exchange rate.
- `DEXUSEU`: U.S. dollar to euro exchange rate.

Derived dollar pressure can start with broad dollar momentum and percentiles. U.S.-Japan 10-year differential should remain a candidate until a clean no-secret Japan 10-year source is selected.

### Banking And Credit Impulse

- `WRESBAL`: reserve balances with Federal Reserve Banks.
- `TOTBKCR`: bank credit at all commercial banks.
- `TOTLL`: loans and leases in bank credit.
- `BUSLOANS`: commercial and industrial loans.
- `DPSACBW027SBOG`: deposits at all commercial banks, active only after endpoint validation.

These belong in `/credit`, which should be labeled `Credit & Banking` and include direct credit spread and bank-credit impulse sections. A separate `/banking-credit` route is deferred.

### Volatility Expansion

Try to validate public Cboe CSV access for:

- VVIX.
- VIX9D.
- VIX3M.

If these endpoints do not behave like the current VIX endpoint, mark them as candidate entries with `terms_review_needed` and do not score them in Phase 3.

### Candidate And Reviewed Later

Do not score these in Phase 3:

- ISM PMI.
- AAII sentiment.
- NAAIM Exposure Index.
- SLOOS lending standards.
- MOVE index.
- Put/call ratio.
- NY Fed ACM term premium.
- Event calendar data.
- Any source that requires a key, paid access, authenticated access, manual download terms, or unresolved redistribution review.

## Derived Metrics

Phase 3 should add derived series where the logic is simple and testable.

Derived metrics:

- HY minus IG spread gap.
- 10Y minus 2Y curve, preserving current behavior.
- Real-yield pressure summary from `DFII10` and `DFII5`.
- Breakeven pressure summary from `T10YIE`, `T5YIE`, and `T5YIFR`.
- Dollar pressure from broad dollar 1-month and 3-month momentum.
- Commodity inflation impulse replacing raw commodity percentile dominance.
- VIX9D/VIX and VIX/VIX3M ratios only if the required Cboe series are active.

Commodity inflation impulse should reduce over-penalization:

```text
40% oil 3-month percent change
20% oil 12-month percent change
20% crop basket 3-month and 12-month change
20% breakeven confirmation
```

If breakevens are missing, reweight available components and lower confidence rather than fabricating confirmation.

## Score Output Contract

Add `public/data/derived/score_summary.json`.

The existing `bucket_scores.json` and `regime_score.json` should remain during Phase 3 as compatibility outputs. They should map to the Market Weather Score and use a Phase 3 method version so older UI or tests can keep loading them while the new overview moves to `score_summary.json`.

`score_summary.json` should contain:

```json
{
  "generated_at_utc": "2026-05-04T00:00:00Z",
  "date": "2026-05-01",
  "method_version": "phase3-three-score-v1",
  "scores": {
    "market_weather": {
      "score": -8.4,
      "label": "Mixed",
      "confidence": 0.78,
      "bucket_scores": {},
      "bucket_weights": {},
      "top_supports": [],
      "top_risks": [],
      "recent_changes": [],
      "missing_or_stale_notes": []
    },
    "macro_climate": {
      "score": 0,
      "label": "Mixed",
      "confidence": 0.65,
      "bucket_scores": {},
      "bucket_weights": {},
      "top_supports": [],
      "top_risks": [],
      "recent_changes": [],
      "missing_or_stale_notes": []
    },
    "fragility": {
      "score": 0,
      "label": "Moderate",
      "confidence": 0.7,
      "bucket_scores": {},
      "bucket_weights": {},
      "top_supports": [],
      "top_risks": [],
      "recent_changes": [],
      "missing_or_stale_notes": []
    }
  },
  "conflicting_signals": [],
  "data_quality": {
    "overall_confidence": 0.72,
    "reasons": []
  }
}
```

For all score values, positive means more supportive and negative means more risky or fragile. Fragility uses the same direction: a positive Fragility Score means lower observed fragility, and a negative Fragility Score means higher observed fragility.

## Scoring Model

### Market Weather Score

Weights:

- Credit spreads: 20%.
- Liquidity and funding: 20%.
- Rates and real yields: 15%.
- Volatility and tail risk: 15%.
- Dollar and global tightening: 10%.
- Commodities and inflation impulse: 10%.
- Sentiment and positioning: 10%.

Interpretation:

- Positive values indicate more supportive observed market weather.
- Negative values indicate more fragile or stressed observed market weather.
- Missing active buckets are reweighted only when defensible and should lower confidence.

### Macro Climate Score

Weights:

- Growth: 25%.
- Labor and recession risk: 20%.
- Inflation: 25%.
- Policy and real rates: 15%.
- Consumer, production, and housing: 15%.

Phase 3 implementation:

- Growth uses CFNAI and CFNAI MA3.
- Labor uses unemployment, payrolls, claims, and Sahm Rule.
- Inflation uses CPI, core CPI, core PCE, PPI if active, and breakevens for confirmation.
- Policy and real rates use DFII10, DFII5, SOFR, and nominal yield context.
- Consumer and production use RRSFS, INDPRO, and DGORDER.
- Housing remains candidate in Phase 3 and lowers Macro Climate confidence because it is part of the target model but not yet active.

### Fragility Score

Weights:

- Credit spread widening: 25%.
- Volatility term-structure stress: 20%.
- Dollar spike: 15%.
- Liquidity drain: 15%.
- Positioning crowding: 15%.
- Treasury or bond volatility: 10%.

Phase 3 implementation:

- Credit spread widening uses HY, IG, BBB, and HY minus IG gap.
- Volatility term structure uses VIX9D/VIX and VIX/VIX3M only if Cboe series are active. Otherwise use VIX percentile with lower confidence.
- Dollar spike uses broad dollar momentum.
- Liquidity drain uses net liquidity, reserves, RRP, TGA, and SOFR.
- Positioning crowding uses existing CFTC positioning.
- Treasury/bond volatility remains candidate unless a reviewed public source is active.

## Driver-Specific Explanations

Top supports and risks must be generated from driver objects, not only bucket names.

Examples:

- "High-yield spreads widened over the past month."
- "10Y real yield is in the upper historical percentile."
- "Core inflation momentum remains elevated."
- "Broad dollar strength is tightening global conditions."
- "Leveraged-money S&P 500 positioning is crowded."
- "Reserve balances improved over the past month."

Each driver should have:

- direction: support or risk
- score impact
- series id or derived id
- bucket
- human-readable text
- latest value
- recent change used

The UI should show the text. Tests should assert that the outputs are specific strings and not just title-cased bucket names.

## Confidence Model

Confidence should be mechanical and visible.

Start each score at `1.0`, then apply bounded penalties:

- Missing active bucket coverage.
- Important series stale.
- Source failed during the latest attempt.
- Bucket depends on only one active metric.
- Candidate-only component is unavailable.
- Mixed data cadences affect interpretation.
- New source status is `terms_review_needed`, `restricted`, or `unavailable`.

The confidence object should include reasons so the UI can display them:

```json
{
  "confidence": 0.78,
  "reasons": [
    "Treasury/bond volatility source is not active.",
    "Sentiment is limited to CFTC positioning.",
    "Crop data is monthly and can lag daily market moves."
  ]
}
```

Confidence must not make scores look more precise than the data supports.

## Data Status

Extend status values to:

- `ok`
- `stale`
- `failed`
- `partial`
- `terms_review_needed`
- `unavailable`

`terms_review_needed` and `unavailable` should apply to candidate sources or inactive catalog entries, not failed active data. Active source failures should remain `failed` or `partial`.

The status file should continue to preserve last-good-data behavior. If one new active source fails, the update should mark the relevant source failed or partial without breaking the entire site when prior good data exists.

## Frontend Navigation And Routes

Update navigation labels:

- Overview
- Growth
- Inflation
- Rates & Policy
- Liquidity
- Credit & Banking
- Volatility
- Dollar & Global
- Commodities
- Sentiment & Positioning
- Methodology

Route behavior:

- Add `/growth`.
- Add `/inflation`.
- Add `/dollar-global`.
- Keep `/rates` but label it `Rates & Policy`.
- Keep `/credit` but label it `Credit & Banking`.
- Keep `/sentiment` but label it `Sentiment & Positioning`.
- Defer `Event Calendar`.

New pages should reuse the existing route pattern:

- Load catalog.
- Load relevant series and derived files.
- Render a page heading.
- Render a "How to read this" panel.
- Render metric cards.
- Render one or two charts where useful.
- Render focused data status rows.

## Overview UI

The overview should show:

- Three score cards: Market Weather, Macro Climate, Fragility.
- Score value, label, and confidence for each.
- Specific top supports.
- Specific top risks.
- What changed this week.
- Conflicting signals.
- Data confidence section.
- Focused metric cards for the most important current drivers.

This is a product framing change, not a full redesign. The existing visual language can remain.

## Metric Card And Route UI

Existing `MetricCard` already shows latest value, 1D change, 1W change, 1M change, percentile, source, and last observation date.

Phase 3 changes:

- Add source access or terms status where useful.
- Add 3M change if summaries are extended.
- Make stale or terms-reviewed status visible without making inactive candidate inputs look active.
- Keep metric card text concise and non-advisory.

Every route should include a short "How to read this" panel explaining interpretation and caveats.

## Documentation

Update:

- `README.md`
- `docs/DATA_SOURCES.md`
- `docs/METHODOLOGY.md`
- `docs/LIMITATIONS.md`

README requirements:

- Explain the new product direction.
- List active Phase 3 categories.
- Add the data access status table.
- Clarify no backend, no browser keys, delayed static data, and no financial advice.

DATA_SOURCES requirements:

- Separate active no-secret inputs from candidate and restricted sources.
- Include provider, endpoint pattern, cadence, access status, terms status, and caveats.

METHODOLOGY requirements:

- Explain the three scores.
- Explain bucket weights.
- Explain transformations.
- Explain confidence.
- Explain driver-specific supports and risks.
- Explain caveats around commodities, CFTC positioning, monthly data, and terms-reviewed sources.

LIMITATIONS requirements:

- State that scores are descriptive, not predictive.
- State that source endpoints can change.
- State that public data can be delayed, revised, stale, or unavailable.
- State that candidate sources are not active until terms/access review is complete.

## Package Version Pinning

Phase 3 should replace `"latest"` package versions with exact versions based on the current resolved `package-lock.json`.

Pin:

- `@vitejs/plugin-react`
- `vite`
- `typescript`
- `react`
- `react-dom`
- `react-router-dom`
- `recharts`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `vitest`
- `jsdom`

This reduces future breakage in scheduled GitHub Actions and Pages builds.

## Testing Strategy

### Python Tests

Add or update tests for:

- Source registry generation.
- Series catalog active/candidate/unavailable metadata.
- FRED active macro series metadata.
- Cboe volatility candidate behavior when endpoints are unavailable.
- Score summary contract.
- Market Weather Score assembly.
- Macro Climate Score assembly.
- Fragility Score assembly.
- Confidence penalties.
- Driver-specific supports and risks.
- Derived HY minus IG spread gap.
- Commodity inflation impulse.
- Partial update behavior for failed new sources.
- Schema validation for new status values and source access fields.

### TypeScript Tests

Add or update tests for:

- Updated type contracts.
- Loading `score_summary.json`.
- Overview renders three score cards.
- Overview renders confidence reasons.
- New routes render expected active series.
- Sentiment navigation label becomes `Sentiment & Positioning`.
- Methodology reflects the three-score model.
- Metric cards can display source access status without breaking old data.

### Verification Commands

Expected final verification:

```bash
npm test
npm run build
python -m pytest
python -m scripts.update_data
```

The implementation plan may split these commands across task boundaries, but final verification should run all relevant checks.

## Implementation Slices For Later Planning

This section is not the final implementation plan. It is the expected task breakdown for the next planning step.

1. Data contracts and source governance.
2. Active Phase 3 catalog entries and candidate source metadata.
3. Source registry generation and validation.
4. Score summary data contract and compatibility outputs.
5. New score helpers and confidence model.
6. Derived metric additions.
7. Overview update.
8. New and renamed routes.
9. Docs update.
10. Package pinning.
11. End-to-end data refresh and verification.

Each slice should start with focused tests where practical, then implementation, then local verification.

## Acceptance Criteria

Phase 3 is complete when:

- The app publishes `score_summary.json` with Market Weather, Macro Climate, and Fragility scores.
- Each score includes value, label, confidence, bucket scores, weights, specific supports, specific risks, recent changes, and missing/stale notes.
- The overview renders the three score cards and data confidence.
- New active FRED macro series are generated and cataloged where endpoints validate.
- Candidate and unavailable sources are marked clearly and are not scored.
- README and docs identify freely available no-secret inputs versus terms-reviewed, restricted, or unavailable inputs.
- Credit scoring includes direct OAS spreads.
- Rates include real yields and breakevens.
- Growth, inflation, dollar/global, and credit/banking coverage is visible in the UI.
- Sentiment is labeled as `Sentiment & Positioning`.
- Commodity scoring reduces raw percentile over-penalization by using inflation impulse.
- Package versions are exact rather than `latest`.
- Tests cover new scoring, status, source metadata, routes, and score rendering.
- The build passes.
- The update runner preserves previous-good-data behavior.

## Risks And Mitigations

Risk: Too many new series make the Phase 3 PR large.

Mitigation: Active Phase 3 additions are limited to sources that fit the existing FRED graph CSV loop or validate cleanly for Cboe. Terms-reviewed sources remain candidates.

Risk: New scoring appears overly precise.

Mitigation: Confidence is visible, mechanical, and includes reasons.

Risk: Candidate data is mistaken for active data.

Mitigation: `score_status` controls scoring, and UI route metric grids should only show active inputs.

Risk: `compute_regime_score.py` grows too large.

Mitigation: The implementation plan can split bucket scoring into a `scripts/transform/scoring/` package if edits become hard to reason about.

Risk: Source terms are ambiguous.

Mitigation: Default ambiguous sources to `terms_review_needed` or `unavailable`, document them, and do not score them.

Risk: New data source failures break scheduled updates.

Mitigation: Preserve previous-good-data behavior and mark failed or partial sources clearly.

## Implementation Defaults For Planning

The implementation plan should use these defaults:

- `regime_score.json` maps to the Phase 3 Market Weather Score for compatibility.
- Labor and recession risk are included within `/growth` in Phase 3.
- `/credit` becomes `Credit & Banking` and includes bank-credit impulse sections.
- Cboe VVIX/VIX9D/VIX3M become active only after endpoint validation; otherwise they are candidate sources with `terms_review_needed`.
- `DPSACBW027SBOG` is the default deposits series, active only after endpoint validation.
- RRSFS, INDPRO, and DGORDER fill the Macro Climate consumer and production bucket.
