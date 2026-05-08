# Market Weather Map vNext Current-State Design

## Purpose

This spec turns the vNext brief into a current-state design for the local `market-weather-map` repo. It preserves the older `2026-05-07` horizon/regime plans as historical implementation context, but does not assume those plans are still accurate as work queues. The local code already contains several pieces from that earlier program, so this design focuses on the remaining product-clarity work.

The product goal remains a horizon-based market decision system:

1. Short-Term Market Reaction: what can markets react to over the next 1 day to 4 weeks.
2. Long-Term Macro / Allocation Climate: what matters over the next 3 months to several years.
3. Fragility / Shock Risk: what hidden stress can amplify moves.
4. TIPS x Dollar Regime Map: what real yields, dollar, nominal yields, and confirmations say together.
5. Data Library: where users can inspect raw factor pages.

## Non-Negotiable Constraints

The redesign must preserve the static GitHub Pages architecture:

- No backend service.
- No database.
- No browser-side provider credentials or API keys.
- No live market feed or real-time trading data.
- No paid or authenticated provider calls from the frontend.
- No trade recommendations, financial advice, forecasts, entries, targets, or stop language.

The frontend must keep reading static JSON through the existing loader pattern:

- `/data/series/*.json`
- `/data/derived/*.json`
- `/data/catalog/*.json`
- `/data/status/*.json`
- `/data/events/*.json`

Candidate and source-gated inputs can be displayed as gaps or readiness rows, but must not affect active scores, regime labels, checklist states, or confidence until a source review promotes them.

## Current Local State

The repo already has these foundational pieces:

- `src/lib/types.ts` includes `Horizon`, `RegimeRole`, `PreferredChart`, `RegimeSnapshotFile`, `ShockRiskSnapshotFile`, and score-summary types.
- `src/lib/data.ts` includes static loaders for score summary, score history, regime snapshot, shock-risk snapshot, data status, catalog, source registry, series, derived series, and macro calendar.
- `src/App.tsx` has routes for `/tactical`, `/macro-climate`, `/fragility`, `/regime-map`, `/replay`, and the data-library pages.
- `src/components/AppLayout.tsx` still uses a single flat `navItems` array.
- `src/routes/Overview.tsx` shows score cards, attribution, current regime read, data quality, data gaps, metrics, and status.
- `src/routes/TacticalTradingWeather.tsx` loads active tactical series, derived tactical series, regime snapshot, shock-risk snapshot, score summary, score history, status, and catalog. It already renders checklist, confirmations, options sentiment readiness, event risk, VIX futures readiness, VIX proxy chart, data gaps, and status.
- `src/routes/LongTermMacroClimate.tsx` already renders macro cycle panels, yield decomposition, macro group metric sections, data gaps, and status.
- `src/routes/RegimeMap.tsx` already renders the current quadrant, direction cards, quadrant trail, yield decomposition, and confirmation matrix.
- `src/routes/FragilityShockRisk.tsx` already renders fragility context, score card, shock-risk dashboard, tail-risk panel, mismatch warnings, data gaps, and status.
- `docs/source_reviews/` does not exist locally.

The older `docs/superpowers/plans/2026-05-07-*` docs should remain as history. The new implementation plan should start from the current code instead of replaying the full prior program.

## Remaining Product Gaps

### Navigation and Routes

Current gap:

- Top navigation is still flat.
- `/short-term` and `/long-term` do not exist.
- `/tactical` and `/macro-climate` are still canonical routes instead of backward-compatible aliases.

Target:

- Primary Views: Overview, Short-Term, Long-Term, Fragility, Regime Map, Replay.
- Data Library: Volatility, Rates, Liquidity, Credit, Dollar, Commodities, Growth, Housing, Inflation, Positioning.
- Reference: Calendar, Methodology.
- `/short-term` becomes canonical for the tactical page.
- `/long-term` becomes canonical for the macro/allocation page.
- `/tactical` redirects or aliases to `/short-term`.
- `/macro-climate` redirects or aliases to `/long-term`.

### Overview Decision Hub

Current gap:

- Overview is still score-first and metric-first.
- It does not immediately route users by horizon.
- It does not show a short-term versus long-term impact matrix.
- It does not elevate source gaps as first-screen product context.

Target:

- Four decision cards: Short-Term Market Reaction, Long-Term Macro / Allocation Climate, Fragility / Shock Risk, Regime Map.
- Each card shows horizon, current label, score or regime detail, one support, one risk, and source-gap count when relevant.
- A horizon impact matrix explains which indicators matter quickly and which matter slowly.
- Source gaps and data quality remain visible without requiring users to visit Methodology.

### Short-Term Market Reaction

Current gap:

- Page title still says `Tactical Trading Weather`.
- The page has useful sections, but the top read is not structured as a tactical decision read.
- VIX proxy is visualized as a multi-series chart, but there is no dedicated classification panel.
- Credit, dollar/real-yield, and liquidity are mostly metric cards rather than named tactical modules.

Target:

- Display heading: `Short-Term Market Reaction`.
- Secondary label: `Tactical Trading Weather`.
- Top block: Current Tactical Read with regime, Market Weather score, Fragility overlay, main driver, confirmation quality, and source readiness.
- Dedicated modules in this order: quick checklist, volatility term-structure panel, credit pulse, dollar + real-yield pressure, liquidity pulse, options sentiment readiness, event risk.
- VIX proxy classification remains based on active VIX9D, VIX, VIX3M, `vix9d_vix_ratio`, and `vix_vix3m_ratio`.

### Long-Term Macro / Allocation Climate

Current gap:

- Page title does not include allocation framing.
- Macro cycle panels exist, but the top read does not summarize strategic conditions by bucket.
- Strategic source gaps are not separated into a durable panel.

Target:

- Display heading: `Long-Term Macro / Allocation Climate`.
- Top block: Current Long-Term Read with Macro Climate score, growth, labor, inflation, real yields, credit cycle, liquidity cycle, and missing strategic sources.
- Macro bucket grid keeps existing bucket logic but improves scan order and horizon-specific language.
- Strategic source-gaps panel lists PMIs, SLOOS, term premium, Treasury supply, valuation, earnings revisions, equity risk premium, and fiscal/interest-expense gaps as source-governed candidates.

### Regime Map

Current gap:

- Core charts are present, but the page does not fully explain what confirms, conflicts with, or weakens the regime.
- Source gaps are not prominent on the regime page.

Target:

- Keep the current quadrant, direction cards, quadrant trail, yield decomposition, and confirmation matrix.
- Add a regime interpretation panel: what this regime means, what confirms it, what conflicts with it, and which source gaps weaken confidence.
- Add a regime conflict panel using score-summary conflicts and unavailable/candidate confirmation rows.

### Fragility / Shock Risk

Current gap:

- Shock-risk components exist, but the page lacks a clear top read separating active and candidate stress channels.

Target:

- Add Current Shock-Risk Read with fragility score, label, active stress channels, candidate stress channels, mismatch warning count, and source-gap count.
- Keep MOVE and SKEW source-gated unless source reviews explicitly promote them.
- Make mismatch warnings readable as "hidden stress even when headline VIX is calm."

### Source Review Documents

Current gap:

- `docs/source_reviews/` does not exist.
- Candidate sources are documented in methodology/data-source docs but not reviewed in auditable per-source files.

Target:

- Add per-source review files for Cboe put/call, Cboe SKEW, ICE MOVE, VIX futures curve, and NY Fed ACM term premium.
- Each review concludes with a status of `terms_review_needed`, `restricted`, `unavailable`, or `free_public`.
- Initial vNext docs must not promote any candidate source to active scoring.

## Component Boundaries

Use small components that sit beside existing patterns instead of rewriting the app:

- `src/components/OverviewDecisionCard.tsx`: one decision card for a primary horizon or diagnostic page.
- `src/components/HorizonImpactMatrix.tsx`: static explanatory matrix rendered from local constants.
- `src/components/HorizonScoreHeader.tsx`: reusable top read for Short-Term and Long-Term pages.
- `src/components/VolatilityTermStructurePanel.tsx`: VIX9D/VIX/VIX3M proxy classification and chart wrapper.
- `src/components/CreditPulsePanel.tsx`: latest and change metrics for credit rows already loaded by the short-term route.
- `src/components/DollarRealYieldPressurePanel.tsx`: dollar, real-yield, nominal-yield, and breakeven pressure summary.
- `src/components/LiquidityPulsePanel.tsx`: net liquidity, Fed assets, RRP, TGA, SOFR, and reserves summary where available.
- `src/components/StrategicSourceGapsPanel.tsx`: source-governed long-term gap rows.
- `src/components/RegimeInterpretationPanel.tsx`: regime explanation, confirmations, conflicts, source gaps.
- `src/components/ShockRiskReadHeader.tsx`: top fragility read that separates active and candidate stress channels.
- `src/lib/horizon.ts`: frontend-safe classification helpers for VIX proxy, event-vol proxy, source-gap counting, latest-series extraction, and bucket labels.

Do not move existing data generation or scoring code unless implementation discovers a failing test that proves a data contract is missing.

## Data Flow

Overview should load:

- `loadScoreSummary()`
- `loadRegimeSnapshot()`
- `loadShockRiskSnapshot()`
- `loadDataStatus()`
- `loadScoreHistory().catch(() => null)`
- existing overview metric series and derived series

Short-Term should continue loading:

- active series: `vix`, `vix9d`, `vix3m`, `vvix`, `high_yield_oas`, `broad_dollar`, `real_yield_10y`
- derived: `vix9d_vix_ratio`, `vix_vix3m_ratio`, `hy_minus_ig_oas`, `net_liquidity`
- candidate/readiness ids already configured for options, events, and VX futures
- score summary, score history, regime snapshot, shock-risk snapshot, status, catalog

Long-Term should continue loading:

- the existing macro group series
- `net_liquidity`
- score summary, regime snapshot, status, catalog

Regime and Fragility should continue using generated snapshots and score summary instead of recomputing active labels in React.

## Error and Missing-Data Behavior

- Missing `score_history` must not break Overview or Short-Term.
- Missing candidate source JSON must not be fetched by the frontend.
- Missing optional active rows should render empty states or unavailable labels, not crash.
- Candidate rows must render readiness/source-gap states, not active score contributions.
- Data errors should use existing `data-error` role alerts.

## Testing Requirements

Add or update tests for:

- `/short-term` and `/long-term` route rendering.
- `/tactical` and `/macro-climate` backward compatibility.
- grouped navigation section labels and link order.
- Overview decision cards and horizon impact matrix.
- Overview rendering when `score_history` is unavailable.
- VIX proxy and near-term event-vol classification helpers.
- Short-Term top read and tactical module headings.
- Long-Term top read and strategic source-gaps panel.
- Regime interpretation and conflict/source-gap panels.
- Fragility active versus candidate stress-channel top read.
- Candidate sources are shown as readiness/source-gap rows and are not fetched as active series.

Final verification commands:

```bash
npm run test
npm run build
python -m pytest tests/python -v
python -m scripts.update_data
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
rg -n "buy|sell|short|entry|target|stop loss|recommendation" src docs README.md
git status --short
```

If Python dependencies are unavailable in a local environment, record the exact failure and still run the frontend tests and build.

## Out of Scope

- New source ingestion.
- Candidate-source promotion.
- Browser-side provider calls.
- Historical outcome or forward-return summaries.
- Watchlist or threshold notifications.
- Broad style-system rewrite.

## Self-Review

- Completeness scan: no unfinished markers are intentionally left in this spec.
- Scope check: the spec is split into subagent-sized implementation areas and does not ask one worker to rewrite the full app.
- Consistency check: this spec preserves the existing static JSON architecture and treats older `2026-05-07` docs as history rather than active ground truth.
