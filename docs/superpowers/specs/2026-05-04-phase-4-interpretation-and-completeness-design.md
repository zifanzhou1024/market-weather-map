# Phase 4 Interpretation And Completeness Design

Date: 2026-05-04

## Summary

Phase 3 moved `market-weather-map` from a mock-style dashboard into a real static macro-market dashboard. The project now has no-secret public data ingestion, generated static JSON, source governance, derived indicators, and a three-score model for Market Weather, Macro Climate, and Fragility.

Phase 4 should turn that foundation into a macro-market interpretation system. The main product gap is no longer raw data. The main gap is explaining what the existing data means, what changed, what is stale, what is missing, and why confidence is lower than the headline data coverage might suggest.

This design is a staged Phase 4 program. It documents the full desired scope, but the next implementation plan should cover only the first shippable PR: reliability and interpretation. Later PRs can be delegated to subagents by source domain or product layer.

## Current Project Context

The local repository currently includes:

- Vite, React, TypeScript frontend routes for Overview, Growth, Inflation, Rates & Policy, Liquidity, Credit & Banking, Volatility, Dollar & Global, Commodities, Sentiment & Positioning, and Methodology.
- Python ingestion for Cboe public volatility CSVs, FRED graph CSV endpoints, and CFTC public historical compressed reports.
- Static JSON under `public/data/catalog`, `public/data/series`, `public/data/derived`, and `public/data/status`.
- Phase 3 derived data including net liquidity, HY minus IG OAS, commodity inflation impulse, Treasury curve, VIX ratios, bucket scores, regime score, and score summary.
- A source registry and series catalog with active, candidate, restricted, and unavailable source statuses.
- Three score families in `score_summary.json`: Market Weather, Macro Climate, and Fragility.
- A data status file that can report `partial` while score confidence remains high.

Important current gaps:

- Freshness is still mostly raw observation-age based.
- Monthly macro series can look stale because many observations are dated the first day of the observation month.
- Score confidence does not decompose source coverage, freshness, model breadth, and candidate/missing-source gaps.
- Overview still renders a legacy weather score section after the three-score model.
- Volatility has active VVIX, VIX9D, VIX3M, and derived ratios, but the route surfaces only VIX.
- Liquidity has net liquidity but does not make it the clear route headline.
- Credit has direct OAS data and HY minus IG derived data, but the page does not foreground that spread structure.
- Sentiment is correctly named Sentiment & Positioning, but the active data is positioning only and the UI should say so clearly.
- Growth, Inflation, Rates, Credit, Dollar, Commodities, and Sentiment pages mostly show cards and a chart, with limited interpretation.
- Missing macro pillars include Housing, GDP/final demand, consumer balance sheet, lending standards, fiscal/Treasury supply, event risk, and earnings/valuation context.

## Goals

- Make the app explain what the current macro-market state means.
- Fix the freshness model so monthly and quarterly macro series are not misclassified by naive observation-age rules.
- Reconcile score confidence with source coverage and freshness.
- Make the three-score model the primary Overview experience.
- Surface all active Phase 3 data on the relevant pages before adding many more charts.
- Add reusable interpretation components that can be shared across routes.
- Document a full Phase 4 source roadmap with clear active/candidate/restricted treatment.
- Keep the static GitHub Pages architecture.
- Keep source governance strict.
- Prepare workstreams that can be assigned to subagents later without overlapping ownership.

## Non-Goals

- No backend service.
- No database.
- No browser-side provider calls.
- No frontend API keys.
- No live market feed.
- No paid, authenticated, or license-restricted active inputs.
- No financial advice, trade recommendations, or forecasts.
- No use of `terms_review_needed` sources in active scoring.
- No full visual redesign in the first Phase 4 PR.
- No attempt to implement the entire Phase 4 program in one PR.

## Chosen Approach

Use a staged Phase 4 program.

The design doc covers the full product direction, source annex, and eventual workstreams. The first implementation plan should cover only PR 1: reliability and interpretation. Later PRs add missing macro pillars, event calendar/data health, and deeper regime intelligence.

This approach is selected because it documents everything needed while preserving a focused first shipping step. It also gives later subagents clear boundaries: source ingestion/catalog, scoring/freshness, frontend interpretation, calendar/data health, and docs/tests.

## Alternatives Considered

### Big Bang Phase 4

Implement reliability, interpretation, Housing, Consumer, Fiscal, Event Calendar, regime matrix, source research, and scoring changes together.

This would move fastest toward the full vision, but it has too large a blast radius. It would mix source expansion with confidence changes and UI interpretation, making regressions harder to isolate.

### Data Completeness First

Add Housing, Consumer, GDP/final demand, Fiscal/Treasury supply, Event Calendar, and source candidates before improving interpretation.

This would close visible macro gaps quickly, but it delays the current main product issue: the dashboard has enough active data to explain more than it currently does.

### Regime Intelligence First

Build the Macro Regime Matrix, conflicting-signal detector, and driver contribution waterfall before adding missing macro pillars.

This would make the product feel smarter quickly, but it risks drawing more detailed conclusions from incomplete and partly stale data.

## Architecture

Phase 4 keeps the existing architecture:

- GitHub Actions fetch and transform public source data.
- Python scripts write generated JSON under `public/data`.
- React/Vite reads static JSON from the deployed GitHub Pages site.
- No browser-side secrets or provider calls.
- No backend or database.
- Safe update behavior continues to preserve prior good JSON when an update fails.

The main architecture change is not deployment. It is the data contract around freshness, confidence, and interpretation.

## Source Strategy

Use FRED graph CSV first for time series when a clean FRED-hosted series exists. This matches the current ingestion model and keeps the source footprint small.

Use original no-secret government APIs or official machine-readable pages when FRED is not enough, especially for:

- Release calendars and event metadata.
- Treasury auctions and fiscal datasets.
- Census or BEA metadata not mirrored cleanly through FRED.
- Calendar events that are schedules rather than time series.

Strict source governance remains:

- `free_public`: can be active when it is no-secret, automatable, source-referenced, and appropriate for static publication.
- `terms_review_needed`: can appear in docs and candidate panels, but not active cards or scoring.
- `restricted`: paid, gated, license-restricted, or otherwise unsuitable for public static redistribution.
- `unavailable`: cannot currently be fetched or redistributed by this no-secret static workflow.

Candidate-only sources must not silently affect scores, labels, or confidence except as explicit candidate/missing-source penalties.

## Freshness Model

The current raw-age model should be replaced with cadence-aware freshness.

### Data Status Terms

Keep existing status values and add a release-aware distinction in messages and optional fields:

- `ok`: fresh or within the expected publication lag.
- `stale`: expected release window plus buffer has passed without a new observation.
- `failed`: active fetch or generated payload failed.
- `partial`: overall status when some active series are stale, failed, or unavailable while the site remains usable.
- `terms_review_needed`: candidate only.
- `unavailable`: not available for active static ingestion.

The status row should include enough context for users:

- latest observation date
- observation period, where derivable
- expected frequency
- expected next release window, where configured
- freshness days
- max stale days or cadence buffer
- message that distinguishes `expected lag` from true stale data

### Cadence Rules

Daily series:

- Use a short calendar-day buffer.
- Tolerate weekends and market holidays enough to avoid false stale flags after normal non-trading days.
- Mark stale when observations lag beyond the configured buffer.

Weekly series:

- Use expected weekly cadence plus release buffer.
- Do not treat a weekly Thursday or Friday observation as stale before the next expected weekly release window.

Monthly series:

- Do not classify solely by days since first-of-month observation date.
- Treat the observation date as the observation period unless the series has explicit release metadata.
- Mark as `ok` or expected lag if the next release is not yet expected.
- Mark as stale only after the expected release window plus buffer.

Quarterly series:

- Use the same pattern as monthly.
- Use expected release windows and buffer days instead of raw observation-age thresholds.

Derived series:

- Derive status from dependency status and the derived observation date.
- A derived series can be generated today but still depend on lagged monthly inputs. The status message should surface dependency lag.

## Confidence Model

Confidence should be decomposed rather than a single optimistic percentage.

Add to `score_summary.json`:

```json
{
  "data_quality": {
    "coverage_confidence": 0.0,
    "freshness_confidence": 0.0,
    "model_confidence": 0.0,
    "source_confidence": 0.0,
    "overall_confidence": 0.0,
    "reasons": []
  }
}
```

Initial weighting:

- 40% coverage confidence.
- 30% freshness confidence.
- 20% model confidence.
- 10% source/candidate confidence.

Definitions:

- Coverage confidence: active expected series are present and have usable observations.
- Freshness confidence: active series are fresh or in expected lag rather than stale/failed.
- Model confidence: score buckets have enough breadth and are not overly dependent on one proxy.
- Source confidence: important domains are not blocked by candidate, unavailable, restricted, or unresolved source status.

Each score block should also carry confidence decomposition or at least score-specific reasons. A score with full source coverage but stale macro data should not look equivalent to a score with full fresh data.

## Scoring Direction

Preserve the Phase 3 direction:

- Positive scores mean more supportive observed conditions.
- Negative scores mean more stressed, riskier, or more fragile observed conditions.
- Fragility keeps the same direction: positive means lower observed fragility, negative means higher observed fragility.

Missing active buckets may keep neutral fallback values where needed for contract stability, but confidence must fall and notes must explain why.

Candidate-only sources never enter active scores.

## Interpretation Layer

Phase 4 should add reusable interpretation units.

### Overview

Overview should become three-score-first:

- Market Weather card.
- Macro Climate card.
- Fragility card.
- What changed.
- Main supports.
- Main risks.
- Conflicting signals.
- Data confidence breakdown.
- Missing, stale, expected-lag, and candidate-only notes.

The legacy `regime_score.json` section should be removed from visible Overview or demoted to compatibility-only code. The generated file can remain for compatibility, but the product should not show two competing headline score models.

### Page-Level Interpretation

Each main route should answer:

- What does this page currently say?
- What changed recently?
- What is supportive?
- What is risky?
- Which signals conflict?
- What is stale, lagged, missing, or candidate-only?

Reusable components:

- `InterpretationPanel`: route-level label, summary, supports, risks, conflicts, and caveats.
- `ConfidenceBreakdown`: coverage/freshness/model/source/overall confidence.
- `DataGapPanel`: active stale/failed rows plus candidate-only gaps.
- `SignalList`: compact support/risk/conflict list.
- Optional `RouteStatusSummary`: a small status summary before detailed data tables.

These should reuse existing visual language. This is not a hero redesign or marketing page.

### Active Data Surfacing

Priority route fixes:

- Volatility: show VIX, VVIX, VIX9D, VIX3M, VIX9D/VIX, VIX/VIX3M, term-structure state, short-dated event-risk state, and volatility-of-volatility pressure.
- Liquidity: make net liquidity the headline metric and chart. Show reserve balances visibly with Fed assets, RRP, TGA, SOFR, and deposits where appropriate.
- Credit & Banking: foreground HY OAS, IG OAS, BBB OAS, HY minus IG OAS, financial stress, NFCI, bank credit, loans, business loans, deposits, and reserve balances.
- Sentiment & Positioning: clearly state active data is CFTC positioning only. Survey sentiment, options sentiment, flows, and exposure indexes remain candidates.
- Commodities: separate price level from inflation impulse. Show WTI, Brent, Brent-WTI spread, crops, and commodity inflation impulse distinctly.
- Growth and Inflation: add route interpretation labels and stale/expected-lag context before adding more charts.

## Staged Roadmap

### PR 1: Reliability And Interpretation

This is the next implementation plan.

Deliverables:

- Release-aware freshness utilities.
- Expanded `data_status.json` status messages and optional expected-release fields.
- Confidence decomposition in `score_summary.json`.
- Overview cleanup to make the three-score model primary and remove visible legacy duplication.
- Reusable interpretation components.
- Volatility route surfaces all active volatility series and ratios.
- Liquidity route makes net liquidity the headline chart and includes reserve balances.
- Credit route surfaces HY minus IG spread and direct spread structure.
- Sentiment route explicitly labels active data as positioning-only.
- Commodities route highlights commodity inflation impulse separately from price levels.
- Methodology and data-source docs explain freshness and confidence.

Out of scope for PR 1:

- New external source families beyond existing active generated data.
- Housing route.
- Event Calendar route.
- Data Health route.
- Regime matrix.
- Driver contribution waterfall.

### PR 2: Missing Macro Pillars

Deliverables:

- Housing route and active FRED-first housing inputs where acceptable.
- GDP/final demand anchors.
- Consumer balance sheet section or route.
- Fiscal/Treasury supply active inputs where clear public sources exist.
- Source catalog expansion for active and candidate macro pillars.
- Candidate registry expansion for SLOOS, PMIs, valuation, market internals, sentiment, exposure, Treasury volatility, and term premium.

### PR 3: Event Calendar And Data Health

Deliverables:

- `/calendar` route.
- Generated event calendar from official machine-readable sources where practical.
- Curated fallback rows for hard-to-parse events like options expiration and earnings weeks.
- `/data-health` route or Overview panel.
- Release schedule metadata reused by freshness logic.
- Status counts for active, fresh, expected-lag, stale, failed, candidate, restricted, and unavailable inputs.

### PR 4: Regime Intelligence

Deliverables:

- Macro Regime Matrix.
- Driver contribution waterfall.
- Conflicting-signal detector as a first-class feature.
- Macro heat timeline if historical bucket data supports it cleanly.
- More nuanced page-level labels and narratives.

## Source Annex

This annex records recommended source treatment for Phase 4. It is not an implementation list for PR 1.

### Housing

Recommended active FRED-first series:

- Housing starts: FRED `HOUST` - [FRED HOUST](https://fred.stlouisfed.org/series/HOUST)
- Building permits: FRED `PERMIT` - [FRED PERMIT](https://fred.stlouisfed.org/series/PERMIT)
- 30-year mortgage rate: FRED `MORTGAGE30US` - [FRED MORTGAGE30US](https://fred.stlouisfed.org/series/MORTGAGE30US)

Recommended candidate or review-needed items:

- New home sales if a clean FRED series and source treatment are confirmed.
- Existing home sales, because NAR source rights need review.
- Home price indexes such as Case-Shiller, because source-specific redistribution may need review.
- Housing affordability proxy, which may be derived after component source treatment is clear.

Primary source context:

- [Census New Residential Construction](https://www.census.gov/construction/nrc/)
- [Census API](https://www.census.gov/data/developers/data-sets.html)

### GDP And Final Demand

Recommended active FRED-first series:

- Real GDP: FRED `GDPC1` - [FRED GDPC1](https://fred.stlouisfed.org/series/GDPC1)
- Real personal consumption expenditures if a clean FRED series is confirmed.
- Real private domestic investment if a clean FRED series is confirmed.

Recommended direct-source context:

- [BEA GDP information](https://www.bea.gov/data/gdp/gross-domestic-product)
- [BEA release schedule](https://www.bea.gov/news/schedule)
- [BEA API](https://apps.bea.gov/API/signup/), candidate-only if it requires registration, keys, or other non-public workflow assumptions.

### Consumer Balance Sheet

Recommended active FRED-first series:

- Real disposable personal income: FRED `DSPIC96` - [FRED DSPIC96](https://fred.stlouisfed.org/series/DSPIC96)
- Personal saving rate: FRED `PSAVERT` - [FRED PSAVERT](https://fred.stlouisfed.org/series/PSAVERT)
- Total consumer credit: FRED `TOTALSL` - [FRED TOTALSL](https://fred.stlouisfed.org/series/TOTALSL)
- Revolving consumer credit: FRED `REVOLSL` - [FRED REVOLSL](https://fred.stlouisfed.org/series/REVOLSL)
- Household debt service ratio if source treatment is acceptable: FRED `DSR` - [FRED DSR](https://fred.stlouisfed.org/series/DSR)

Recommended candidate or review-needed items:

- Credit-card delinquency.
- Auto-loan delinquency.
- Student-loan stress.
- Survey sentiment and confidence series.

Primary source context:

- [Federal Reserve G.19 Consumer Credit](https://www.federalreserve.gov/releases/g19/current/)

### Lending Standards

Recommended candidate status:

- SLOOS lending standards and demand measures should remain `terms_review_needed` until series-level access, transformation, citation, and redistribution handling are reviewed.

Primary source context:

- [Federal Reserve SLOOS](https://www.federalreserve.gov/data/sloos.htm)

### Fiscal And Treasury Supply

Recommended source handling:

- Prefer FiscalData and Treasury official datasets for fiscal/issuance metadata when FRED is not sufficient.
- Keep Treasury auction schedule handling separate from normal time-series ingestion because it is calendar/event metadata.

Potential active inputs after review:

- Monthly receipts.
- Monthly outlays.
- Monthly deficit/surplus.
- Federal debt.
- Interest expense.
- Treasury auction amount, security type, and auction date if FiscalData provides parseable records.

Primary source context:

- [FiscalData API documentation](https://fiscaldata.treasury.gov/api-documentation/)
- [Monthly Treasury Statement](https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/summary-of-receipts-and-outlays-of-the-u-s-government)
- [Treasury International Capital System](https://home.treasury.gov/data/treasury-international-capital-tic-system)
- [Treasury auction data on FiscalData](https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/treasury-securities-auctions-data)

### Treasury Volatility And Term Premium

Recommended candidate status:

- MOVE Index remains `terms_review_needed` or `restricted` until licensing and redistribution are clear.
- NY Fed ACM term premium remains `terms_review_needed` until access, attribution, and static redistribution handling are reviewed.
- Derived 10Y yield volatility or curve-volatility proxy may be built from active Treasury series if documented as a proxy.

Primary source context:

- [New York Fed Treasury term premia](https://www.newyorkfed.org/research/data_indicators/term_premia.html)

### PMIs And Business-Cycle Surveys

Recommended candidate status:

- ISM Manufacturing PMI and ISM Services PMI remain `terms_review_needed`.
- If ISM terms allow static publication later, add PMI, new orders, prices paid, and employment measures as early-cycle context.

Primary source context:

- [ISM Report On Business release calendar](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/)

### Earnings And Valuation

Recommended active FRED-first anchors:

- Corporate profits after tax if source treatment is acceptable: [FRED CPATAX](https://fred.stlouisfed.org/series/CPATAX)
- GDP-linked profit share or margins can be derived after source series are selected.

Recommended candidate or restricted items:

- Forward P/E.
- Earnings revision breadth.
- Sales growth.
- S&P 500 earnings yield if a clean redistributable source is not confirmed.
- Licensed index valuation datasets.

### Market Internals

Recommended candidate status:

- Equal-weight versus cap-weight, breadth, new highs/new lows, percent above moving averages, high beta/low volatility, and sector internals should remain candidate until clean data sources and redistribution rules are confirmed.

### Survey Sentiment And Exposure

Recommended candidate status:

- AAII sentiment remains `terms_review_needed`.
- NAAIM Exposure Index remains `terms_review_needed`.
- Put-call ratios remain `terms_review_needed` until source and redistribution treatment are clear.
- Fund flows and margin debt remain candidate until source treatment is clear.

Primary source context:

- [AAII Investor Sentiment Survey](https://www.aaii.com/sentimentsurvey)
- [NAAIM Exposure Index](https://naaim.org/programs/naaim-exposure-index/)
- [Cboe data and access terms](https://www.cboe.com/us/options/market_statistics/)

### Event Calendar

Recommended source handling:

- Generate from official machine-readable sources where practical.
- Use curated fallback rows for hard-to-parse events such as options expiration and earnings weeks.
- Treat the calendar as descriptive event-risk context, not alerts or trading signals.

Potential events:

- CPI.
- PPI.
- PCE.
- Payrolls.
- Jobless claims.
- ISM Manufacturing and Services.
- FOMC meetings.
- Treasury auctions and refunding.
- Fed H.4.1.
- CFTC COT.
- EIA petroleum inventories.
- Census housing and retail/durable goods releases.
- BEA GDP releases.
- Option expiration.
- Major earnings weeks.

Primary source context:

- [BLS release calendar](https://www.bls.gov/schedule/)
- [BEA release schedule](https://www.bea.gov/news/schedule)
- [Census economic indicators](https://www.census.gov/economic-indicators/)
- [Federal Reserve FOMC calendars](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
- [CFTC COT release schedule](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm)
- [EIA weekly petroleum status report schedule](https://www.eia.gov/petroleum/supply/weekly/schedule.php)
- [ISM release calendar](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/)

## Data Contracts

### `data_status.json`

The existing status file should remain compatible, while allowing optional fields:

```json
{
  "series": {
    "headline_cpi": {
      "status": "ok",
      "last_observation": "2026-03-01",
      "observation_period": "2026-03",
      "expected_frequency": "monthly",
      "freshness_days": 64,
      "max_stale_days": 45,
      "expected_next_release_window": {
        "start": "2026-04-10",
        "end": "2026-04-17"
      },
      "message": "Latest observation is March 2026 and the next release is still within the expected lag window."
    }
  }
}
```

This example shows the contract shape. Actual dates must come from series-level cadence metadata or release-calendar metadata.

### `score_summary.json`

The score summary should include confidence decomposition:

```json
{
  "data_quality": {
    "coverage_confidence": 0.94,
    "freshness_confidence": 0.72,
    "model_confidence": 0.82,
    "source_confidence": 0.78,
    "overall_confidence": 0.83,
    "reasons": [
      "Monthly macro series are in expected release lag.",
      "Housing is not active.",
      "Treasury/bond volatility source is not active."
    ]
  }
}
```

Score blocks should keep existing UI arrays:

- `top_supports`
- `top_risks`
- `recent_changes`
- `confidence_reasons`
- `missing_or_stale_notes`

## Error Handling

- Public source failures should not break the deployed app when previous good JSON exists.
- Failed active sources should be marked `failed` or cause overall `partial`/`failed` status as appropriate.
- Candidate sources should not be treated as failed active feeds.
- If a derived series cannot be computed because dependencies are missing, preserve last good output where safe and add dependency status notes.
- The frontend should render placeholder/candidate context only when catalog/status says the source is candidate or unavailable. It should not fail the route for inactive candidate data.

## Testing Plan

PR 1 should add or update:

- Python tests for daily, weekly, monthly, and quarterly release-aware freshness.
- Python tests for expected-lag versus stale monthly observations.
- Python tests for derived-series dependency freshness.
- Python tests for confidence decomposition and weighted overall confidence.
- Schema tests for optional status fields and required confidence fields.
- Frontend tests showing Overview renders the three-score model without visible legacy score duplication.
- Frontend tests for `ConfidenceBreakdown`, `InterpretationPanel`, and `DataGapPanel`.
- Route tests for Volatility, Liquidity, Credit, Sentiment, and Commodities surfacing the active data called out above.
- Build/test verification with `npm test`, Python tests, and `npm run build`.

## Documentation Plan

Update docs in the same PR as behavior changes:

- `README.md`: Phase 4 direction, source strategy, and staged roadmap summary.
- `docs/METHODOLOGY.md`: release-aware freshness and confidence decomposition.
- `docs/DATA_SOURCES.md`: Phase 4 source annex summary, active versus candidate treatment, and FRED-first preference.
- `docs/LIMITATIONS.md`: event-calendar, expected-lag, source-candidate, and confidence limitations.

## Implementation Boundaries For Subagents

Later subagent work should avoid overlapping file ownership.

Suggested ownership lanes:

- Freshness/confidence worker: Python scoring, status, schema, and tests.
- Overview/frontend interpretation worker: Overview and reusable interpretation components.
- Route surfacing worker: Volatility, Liquidity, Credit, Sentiment, Commodities, and route tests.
- Macro pillars worker: catalog/ingestion/docs for Housing, GDP, Consumer, Fiscal.
- Calendar/data-health worker: calendar generation, data-health route, docs/tests.
- Regime intelligence worker: regime matrix, conflicting-signal detector, waterfall, and methodology docs.

## Approval And Delivery Gates

This design must be committed before implementation planning.

After this spec is committed, the next step is user review. Only after user approval should the writing-plans skill be invoked to create the first implementation plan for PR 1.

The first implementation plan should not cover the entire Phase 4 program. It should cover only PR 1: Reliability And Interpretation.
