---
name: market-weather-map-next-phase
description: Use when implementing the market-weather-map next-phase redesign — building the signal-priority engine, adding the ECharts visualization layer, upgrading the Overview, Short-Term Tactical, Fragility, or Long-Term Macro dashboards, or adding the SPX benchmark.
---

# market-weather-map next-phase playbook

The site has correct data but lacks signal hierarchy. This phase turns it from a data library into a market decision cockpit. The ranking layer is the unlock — every downstream view consumes it, so building UI before the engine just gets repainted.

## Phase order — do not skip ahead

1. **PR 1 — Signal Priority Engine.** `scripts/transform/build_signal_priority.py` → `public/data/derived/signal_priority.json` (with schema + freshness validation). TypeScript types and loader. `TopSignalList` component. Wire Top Active Warnings, Top Active Supports, and Missing High-Value Signals into the Overview route and the Tactical Trading Weather route.
2. **PR 2 — ECharts foundation.** `npm install echarts`. Build `src/charts/EChartPanel.tsx`, `chartTheme.ts`, `chartFormatters.ts` using `echarts/core` modular imports + `CanvasRenderer`. Test empty / loading / error / normal states. Do not migrate existing Recharts views in this PR.
3. **PR 3 — Overview executive dashboard.** `MarketBriefHeader`, `ScoreContributionHeatmap`, `MissingSignalPanel`. Demote `MetricCard` rows below the fold.
4. **PR 4 — Short-Term Market Reaction charts.** `VolatilityComplexChart`, `VixCurveProxyChart` (VIX9D → VIX → VIX3M), `RatesPressureChart`, `CreditStressMatrix`, `LiquidityDollarPressureChart`, `EventRiskTimeline`.
5. **PR 5 — SPX benchmark.** Write `docs/source_reviews/sp500_index.md` FIRST. Only after promotion: SPX 1D / 1W / 1M returns, drawdown from N-day high, 21-day realized vol, and the VIX-minus-realized-vol premium.
6. **PR 6 — Fragility upgrade.** `ShockRiskContributionChart`, `TailRiskReadinessMatrix`, `BondVolatilityProxyChart` (must be labeled "not MOVE"), `HiddenStressMismatchPanel`.
7. **PR 7 — Long-Term macro visual system.** `MacroClimateHeatmap`, `MacroRegimeQuadrant`, growth / labor / inflation matrix, strategic source-gap matrix.

## What NOT to do

- Do not promote MOVE, SKEW, put/call, VX futures curve, or NY Fed ACM term premium into active scoring without an updated `docs/source_reviews/<name>.md` AND a corresponding promotion PR.
- Do not start UI redesign before `signal_priority.json` exists — it would just be repainted.
- Do not add new data sources before fixing signal hierarchy.
- Do not add Plotly, Highcharts, or `echarts-for-react`. Use `echarts/core` directly via the local wrapper.
- Do not move computation from Python into the browser. The frontend renders; Python ranks, derives, and validates.

## `signal_priority.json` shape

Each entry should carry:

```text
id, label, group, horizon (short_term | long_term | both),
category (volatility | rates | credit | liquidity | dollar | positioning | macro | event),
importance (1–5 per horizon),
severity,
direction (support | risk | neutral | unknown),
urgency (immediate | near_term | slow | background),
confidence,
freshness_status, source_status,
message, why_it_matters
```

Importance is per-horizon (for example: VIX/VVIX = 5 short, 2 long; growth/labor = 2 short, 5 long; CPI/FOMC/payrolls = 5 around the event window, 3 otherwise). Priority = `importance × severity × freshness_multiplier × source_confidence`. Compute in Python; the browser only renders.

## Per-PR acceptance

- **PR 1**: Overview and Tactical pages show ranked warnings, supports, and missing high-value signals; candidate sources appear but never enter active scoring.
- **PR 2**: Wrapper renders empty / loading / error / normal states; `npm run build` passes; bundle does not regress materially.
- **PR 3**: A user lands on Overview and can answer "what is flashing? what matters? what is missing?" without scrolling past the metric cards.
- **PR 4**: Volatility, rates, credit, liquidity/dollar, and event risk each clearly labeled supportive / mixed / warning.
- **PR 5**: SPX source review is committed before any series file appears; SPX charts include freshness and source caveats.
- **PR 6**: Active stress versus missing candidate stress are visually separated; the bond-vol proxy is explicitly labeled not MOVE.
- **PR 7**: Macro buckets are ranked by `importance × severity × confidence`, not alphabetical.

## Verification gate (every PR)

```bash
npm test
npm run build
python -m pytest tests/python -v
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

For every new generated JSON file, add a schema check in `scripts/validate/validate_schema.py` and a freshness expectation in `validate_freshness.py`.

## Reference

- `README.md` — architecture and current scope.
- `docs/LIMITATIONS.md` — descriptive language and source-handling rules.
- `docs/METHODOLOGY.md` — score families and interpretation contract.
- `docs/source_reviews/` — per-source gating decisions.
- Latest spec: `docs/superpowers/specs/2026-05-08-market-weather-map-vnext-follow-up-polish-design.md`.
- Latest plan: `docs/superpowers/plans/2026-05-08-market-weather-map-vnext-current-state-implementation.md`.
