# Market Weather Map vNext Follow-Up Polish Design

## Purpose

This spec defines the follow-up branch after PR #14, `[codex] horizon-based market weather vNext`. PR #14 already adds the structural horizon split: grouped navigation, canonical `/short-term` and `/long-term` routes, Overview decision cards, the VIX proxy panel, strategic source gaps, source-review documents, and the `score_summary.conflicting_signals` generated-data contract.

The follow-up branch should not replay that foundation. Its job is to finish the product polish still called out by the audit: make data quality visible on primary views, make source-gated inputs clearer, strengthen Regime Map confirmations, and make Fragility’s hidden-stress read easier to scan.

## Branch Strategy

Create the implementation branch only after PR #14 is merged into `main`, then branch from updated `main`.

Recommended branch:

```text
codex/vnext-polish-followup
```

If PR #14 is not merged but work must start immediately, the branch may be stacked on `codex/post-merge-ui-cleanup`; in that case the PR body must state that it depends on PR #14. The preferred path remains a non-stacked branch from `main` after PR #14 lands.

## Non-Negotiable Constraints

Preserve the project’s static GitHub Pages model:

- No backend service.
- No database.
- No browser-side API keys or provider credentials.
- No live market feed or real-time trading data.
- No paid or authenticated provider calls from the frontend.
- No trade recommendations, financial advice, forecasts, entries, targets, or stop language.

Candidate and source-gated inputs can be displayed as missing, inactive, or readiness rows, but they must not affect active scores, regime labels, checklist states, or confidence until source review promotes them. This includes Cboe put/call ratios, VX futures, MOVE, SKEW, valuation, term premium, Treasury supply, PMIs, SLOOS, and earnings revisions.

## Current Baseline After PR #14

The follow-up assumes these PR #14 features exist:

- `src/App.tsx` has `/short-term` and `/long-term`, with legacy redirects from `/tactical` and `/macro-climate`.
- `src/components/AppLayout.tsx` has grouped Primary Views, Data Library, and Reference navigation.
- `src/routes/Overview.tsx` renders `OverviewDecisionCard` and `HorizonImpactMatrix`.
- `src/routes/TacticalTradingWeather.tsx` displays `Short-Term Market Reaction` and renders `VolatilityTermStructurePanel`.
- `src/routes/LongTermMacroClimate.tsx` displays `Long-Term Macro / Allocation Climate` and renders `StrategicSourceGapsPanel`.
- `src/routes/RegimeMap.tsx` renders current quadrant, direction cards, quadrant trail, yield decomposition, and confirmation matrix.
- `src/routes/FragilityShockRisk.tsx` renders shock-risk header, dashboard, tail-risk, mismatch warnings, data gaps, and status.
- `docs/source_reviews/` exists and keeps the reviewed candidate sources at `terms_review_needed`.
- `public/data/derived/score_summary.json` emits `conflicting_signals`.

## Design Scope

### 1. Primary-View Data Quality Banner

Add a reusable `DataQualityBanner` component and render it near the top of each primary view:

- Overview
- Short-Term Market Reaction
- Long-Term Macro / Allocation Climate
- Fragility / Shock Risk
- TIPS x Dollar Regime Map
- Historical Replay, if it already loads `score_summary`; otherwise keep Replay unchanged to avoid adding data dependencies only for the banner.

The banner should show:

- Overall confidence as a decimal or percentage, using `scoreSummary.data_quality.overall_confidence`.
- A compact status label such as `High data quality`, `Mixed data quality`, or `Low data quality`.
- Up to four reasons from `scoreSummary.data_quality.reasons`, prioritizing stale, inactive, unavailable, failed, and source-gated language.
- A fallback state when reasons are absent.

The banner is descriptive only. It must not recompute scores or freshness in React.

Suggested thresholds:

```text
>= 0.9: High data quality
>= 0.7 and < 0.9: Mixed data quality
< 0.7: Low data quality
missing/non-finite: Data quality unavailable
```

### 2. Options Sentiment Candidate Clarity

Upgrade `OptionsSentimentPanel` so candidate-only put/call rows explain why they are useful but inactive.

The panel should communicate:

- Useful short-term sentiment context: SPX/SPXW, index, equity, VIX, ETP, and total put/call ratios.
- Current status: source review required or terms review needed.
- Why inactive: automated historical access and static JSON redistribution are not approved.
- Scoring rule: these rows cannot affect scores, regime labels, checklist states, or confidence until source review promotes them.

If active options series are ever passed in, keep the existing active-row behavior and show active rows before candidate rows. Do not add ingestion or scoring.

### 3. Strategic Source-Gap Completeness

Expand `StrategicSourceGapsPanel` to include the long-term gaps from the audit:

- PMIs
- SLOOS
- 10Y term premium
- Treasury net issuance
- Auction tail
- Bid-to-cover
- CAPE
- Forward P/E
- Equity risk premium
- Earnings revision breadth
- Fiscal deficit / interest expense

Each row should include:

- Status: `terms_review_needed`.
- Why it matters for long-term allocation climate.
- Why it is not active.
- A clear statement that it cannot affect scores until source review promotes it.

Keep this as a static explanatory candidate panel unless existing catalog/status data already provides equivalent candidate rows.

The fiscal deficit / interest expense row is required in this panel. It must be framed as a source-gated strategic candidate, not as an active coverage claim.

### 4. Regime Map Candidate Confirmation Rows

Strengthen the Regime Map confirmation matrix so users can see both active confirmations and missing candidate confirmations in one place.

Use existing snapshot confirmations as active rows. Add disabled/candidate rows for:

- Gold / XAU confirmation
- Long-duration bonds
- VIX futures curve
- Put/call ratios
- MOVE
- SKEW
- Equity breadth
- Liquidity, if not already represented by active confirmations

Each candidate row should be visibly inactive, with status text such as `Candidate-only` or `Terms review needed`. Candidate confirmation rows must not alter the snapshot, regime label, yield driver, or score confidence.

Implementation may upgrade `CrossAssetConfirmationMatrix` with an optional `candidateItems` prop, or introduce a small wrapper component that combines active snapshot rows with static candidate rows. Keep the data flow explicit and testable.

Candidate rows should be deduped against active snapshot confirmations by normalized id first and normalized label second. If an active row already represents liquidity, the static liquidity candidate row should be omitted; all other unmatched candidate rows should remain visible as inactive rows.

### 5. Fragility Hidden-Stress Summary

Add a clearer Fragility summary separating visible stress from gated stress.

Visible stress rows should come from `shockSnapshot.active_signals`. Candidate/gated stress rows should come from `shockSnapshot.source_gaps` plus the known gated stress families:

- MOVE
- SKEW
- VIX futures curve
- Options sentiment

Upgrade mismatch warning presentation with severity labels derived from existing warning content. Because the generated schema currently has no `severity` field, React should derive presentation severity without changing the generated data contract:

```text
High: warning mentions credit plus dollar or real yields.
Medium: warning mentions either credit, dollar, real yields, or liquidity.
Low: warning is present but does not match the higher-severity terms.
```

If there are no mismatch warnings, show the current empty state. Do not fabricate active warnings.

### 6. Navigation Route-Click Regression Coverage

Add a regression test that renders the full app and verifies every grouped navigation link reaches the expected route heading.

Coverage should include:

- Primary Views
- Data Library
- Reference

The test can use `MemoryRouter`, DOM clicks, and existing static fetch mocks. It should assert the page heading or stable text after each click. This complements the existing route-render and grouped-nav tests by exercising actual `NavLink` destinations.

## Component Boundaries

Preferred units:

- `src/components/DataQualityBanner.tsx`
  - Input: `dataQuality?: unknown`.
  - Output: a compact banner with status, confidence, and reason list.
  - It should internally narrow valid `ConfidenceBreakdownData` fields so malformed or missing data can use the required fallback state.
  - No data fetching.

- `src/components/OptionsSentimentPanel.tsx`
  - Keep existing props.
  - Add explanatory copy and possibly a footer explaining candidate gating.

- `src/components/StrategicSourceGapsPanel.tsx`
  - Keep static source-gap rows in a local constant.
  - Expand rows and copy.

- `src/components/CrossAssetConfirmationMatrix.tsx`
  - Either accept candidate rows or keep active-only rendering and pair it with a new candidate-confirmation component.
  - Must sanitize advisory terms as it does today.

- `src/components/HiddenStressSummary.tsx`
  - Input: `shockSnapshot: ShockRiskSnapshotFile`.
  - Output: visible stress rows, gated stress rows, and mismatch severity summary.
  - No generated-data mutation.

Do not expand route files with large inline mapping tables if a component-local constant is clearer.

## Data Flow

Use existing loaders only:

- `loadScoreSummary()`
- `loadRegimeSnapshot()`
- `loadShockRiskSnapshot()`
- `loadDataStatus()`
- `loadCatalog()`

No frontend should fetch candidate source payload files that do not exist. Candidate readiness displays should use already-loaded catalog/status rows or static display metadata in the component.

## Error Handling and Fallbacks

- If `data_quality` is missing or malformed, `DataQualityBanner` should render `Data quality unavailable`.
- If `data_quality.reasons` is absent or empty, show a concise no-notes fallback.
- If candidate rows are unavailable from status/catalog, show static candidate copy rather than crashing.
- If Regime confirmations are malformed, keep the existing defensive filtering behavior.
- If `shockSnapshot.mismatch_warnings` is empty, show the existing no-warning state.

## Tests

Add or update Vitest coverage for:

- `DataQualityBanner` status thresholds, reason filtering, and malformed data fallback.
- Primary-view rendering with the data-quality banner.
- Options sentiment candidate-only explanatory copy.
- Expanded strategic source gaps.
- Regime confirmation matrix candidate-only rows.
- Hidden-stress visible/gated separation and mismatch severity labels.
- Full grouped-nav link click regression.

Run final verification:

```bash
npm run test
npm run build
python3 -m pytest tests/python -v
python3 -m scripts.validate.validate_schema
python3 -m scripts.validate.validate_freshness
```

`python3 -m scripts.update_data` remains optional for this follow-up because this spec does not change ingestion. If run locally and provider SSL/network issues occur, do not commit failed status artifacts.

## Acceptance Criteria

- Primary views show data quality without forcing users into the status table.
- Options sentiment and strategic gaps clearly explain useful-but-inactive source-gated inputs.
- Regime Map shows missing candidate confirmations without treating them as active signals.
- Fragility makes hidden stress and gated stress channels visible without fabricating warnings.
- All grouped nav links route to real pages in tests.
- Candidate sources remain non-scoring.
- Build, frontend tests, Python tests, schema validation, and freshness validation pass.
