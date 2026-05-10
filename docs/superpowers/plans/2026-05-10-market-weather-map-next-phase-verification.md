# market-weather-map next-phase verification report

Branch: `feat/next-phase-implementation`
Date: 2026-05-10
Owner: `qa-agent` (Wave 5)
Scope: Verification gate, consistency checks, and accessibility audit for Waves 1–4 of the next-phase implementation.

Status: **DONE** — all verification commands pass, all consistency checks pass, no defects requiring scope changes were found. Two minor observations recorded as follow-ups (echarts `resize()` not wired to a `ResizeObserver`; build chunk warning above 500 kB) — neither is in scope for this wave.

---

## Task W5-1: Verification gate

All commands run from `/Users/sakura/WebstormProjects/market-weather-map` using the local `.venv/bin/python` interpreter per `CLAUDE.md`.

| Command | Result | Counts |
|---|---|---|
| `npm test` | PASS | 191 test files / 2405 tests passed |
| `npm run build` | PASS | `tsc -b` clean, vite built `dist/` in ~400 ms |
| `.venv/bin/python -m pytest tests/python -v` | PASS | 295 tests passed |
| `.venv/bin/python -m scripts.validate.validate_schema` | PASS | Exit 0, no diagnostics |
| `.venv/bin/python -m scripts.validate.validate_freshness` | PASS | Exit 0, no diagnostics |
| `.venv/bin/python -m scripts.update_data` (smoke) | PASS | Exit 0; `data_status.json` overall = `partial` with expected `terms_review_needed` (gated sources) and a small number of `stale` rows. Safe-update path preserved prior good JSON. |

Build emits a single warning that "Some chunks are larger than 500 kB after minification" — informational only, not a failure, and consistent with the pre-W1 baseline. Tracked as a known follow-up (bundle splitting) but not in this wave's scope.

The `update_data` smoke ran online and exited 0. The "partial" overall status reflects: (a) gated `terms_review_needed` sources that intentionally do not score, and (b) a handful of `stale` weekly / quarterly series within expected release windows. No active series was demoted or corrupted, so the safe-update contract is intact.

---

## Task W5-2: Static-site sanity grep

All greps were run with `set -o pipefail` semantics. Empty results are stated explicitly as `NO MATCHES`.

### Browser-side provider calls — must be empty

```bash
$ grep -rn "fetch(['\"]http" src/
NO MATCHES

$ grep -rn "process.env\." src/
NO MATCHES

$ grep -rn "import.meta.env\." src/
NO MATCHES
```

Frontend reads only static JSON under relative `/data/...` paths. No browser-side provider calls, no `process.env` references, no `import.meta.env` references — Vite's `BASE_URL` is read once inside `src/lib/data.ts` via the bracketed `(import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL` expression, which is intentional and does not match the grep pattern. Confirmed compliant with the `CLAUDE.md` no-browser-side-providers constraint.

### Secrets in committed files

```bash
$ grep -rn "API_KEY\|SECRET\|TOKEN" src/ scripts/ public/
NO MATCHES
```

Matches in `docs/` are all references to GitHub Actions secret *names* (`FRED_API_KEY`, `BLS_API_KEY`, `BEA_API_KEY`, `CENSUS_API_KEY`, `EIA_API_KEY`) inside source-review and sprint-plan documents. No literal secret values appear anywhere. Compliant.

### Slot consistency — every slot is filled

```bash
$ grep -rn "SLOT:" src/
```

Found 19 SLOT markers across 14 route files (plus paired close markers for `tactical_vol_curve_slot` and `tactical_vol_complex_slot`). Each marker is immediately followed by JSX that consumes the corresponding data — spot-checked the following and confirmed all are filled with a real component (no orphaned markers):

- `Liquidity.tsx:84` → `<LiquidityDecompositionHero />`
- `Inflation.tsx:85` → `<InflationSpreadHero />`
- `Rates.tsx:139` → `<YieldChangeWaterfallChart />`; `Rates.tsx:147` → `<YieldCurveComparisonChart />` + `<YieldDecompositionStackChart />`
- `TacticalTradingWeather.tsx:252/261` → `<VixCurveTermStructureChart compact />` and `<VolatilityHiddenStressChart compact />`
- `FragilityShockRisk.tsx:124/131` → `<ShockRiskContributionChart />` and `<VixVvixHiddenStressPanel />`
- `Volatility.tsx:180/191` → `<VixCurveTermStructureChart />` and `<VixRatioHistoryChart />` + `<VolatilityHiddenStressChart />`
- All single-domain Hero routes (Growth, Housing, Commodities, Credit, DollarGlobal, Sentiment, RegimeMap, LongTermMacroClimate) — one Hero JSX immediately following the slot comment.

Cross-route slot inventory test in `src/routes/data-routes.test.tsx` (`W2-13: cross-route IA consistency`) asserts this is structural, not just spot-checked: total 19 slot markers across the 14 specified route files.

### Regime label consistency

```bash
$ grep -rn "20-observation" src/
src/components/HistoricalRegimeReplayPanel.tsx:79:                    <dd>20-observation changes</dd>
# Other matches are test files asserting the literal stays / disappears.
```

Only one production match: `HistoricalRegimeReplayPanel.tsx:79` uses the **plural** "20-observation changes", which is correct per `docs/METHODOLOGY.md`. The methodology says the regime replay computes 20-observation *changes*, plural.

```bash
$ grep -rn "20-observation change\b" src/
# Matches only in test files (RegimeQuadrantChart.test.tsx, data-routes.test.tsx)
# that assert the SINGULAR misleading literal is NOT present.
```

The singular form `20-observation change` is intentionally absent from production code; test files only contain it inside `expect(...).not.toContain("20-observation change")` style assertions. Compliant — W3 successfully removed the misleading singular label from `RegimeQuadrantChart` while keeping the methodology-correct plural elsewhere.

### Tone audit — descriptive only

```bash
$ grep -rEni "\b(buy|sell|short|target|stop|recommend)\b" src/components/ src/routes/ \
    | grep -vi "test\|short_term\|short-term\|short-dated\|short-end\|target=\|adviceterms\|no trade recommendations\|long-term"
```

Filtered results categorized:

| Match | Category | Compliance |
|---|---|---|
| `GrowthLaborInflationMatrix.tsx:24-26` `const target = bucket.toLowerCase();` | Local variable name for string matching | OK — code identifier, not user copy |
| `ChartRangeControls.tsx:54,55,78,79,80` `const target = ...HTMLButtonElement` | Local variable name for DOM element | OK — code identifier |
| `InsightCallout.tsx:12` `* targets, or buy/sell/short language ...` | Comment listing what NOT to write | OK — anti-pattern guard documentation |
| `DollarPressureHero.tsx:30` `* Tone: descriptive only. No buy/sell/short/forecast language.` | Comment | OK |
| `YieldChangeWaterfallChart.tsx:35` `* Tone is descriptive only. No advice, no forecast, no buy/sell language.` | Comment | OK |
| `VolatilityHiddenStressChart.tsx:35` `* no advice or buy/sell language anywhere.` | Comment | OK |
| `CreditSpreadMatrixHero.tsx:27` `* Tone: descriptive only. No buy/sell/short/target/stop language.` | Comment | OK |
| `CommodityImpulseHero.tsx:27` `* impulse series is short-lived at present` | Adjective for data series length | OK — "short-lived" is duration, not direction |
| `InflationSpreadHero.tsx:26,32` `* a reference line, not a target or recommendation` ; `* Tone: descriptive only. No buy/sell/short/target/stop/forecast language.` | Comments | OK |
| `SentimentPositioningHero.tsx:22` `* descriptive only, not a target or recommendation` | Comment | OK |
| `GrowthLaborMatrixHero.tsx:30` `* Tone: descriptive only. No buy/sell/short/target/stop/recommend/forecast.` | Comment | OK |
| `HousingActivityHero.tsx:33` `* Tone: descriptive only. No buy/sell/short/target/stop/forecast language.` | Comment | OK |

Every remaining match is either a code identifier (`target` as an HTML element or string variable) or a descriptive comment explicitly documenting compliance with `docs/LIMITATIONS.md`. No advice/forecast/buy/sell/target/stop content reaches the rendered UI. Compliant.

---

## Task W5-3: Routes degrade gracefully when optional JSON is absent

Added new cross-route Vitest suite at `src/routes/__tests__/missing-derived-json.test.tsx`:

- 19 tests total (15 routes × "all four optional JSONs missing" + 4 × "only this JSON missing × 15 routes" matrix + sanity).
- For each scenario the suite mounts every content route under a `MemoryRouter`, flushes async effects, and asserts:
  1. The container DOM remains connected (no React render unmount on exception).
  2. At least one child element is mounted (so the layout shell rendered).
  3. `console.error` was not called with a "The above error" / "uncaught error" / "Consider adding an error boundary" string (React's signal of a render-time thrown exception).

The `PageInsightHero` "Current read unavailable" fallback string is already unit-tested in `src/components/PageInsightHero.test.tsx:132` (`falls back to a minimal heading-only stub when loadPageInsights resolves null`); `MacroRegimeQuadrant` and `RegimeQuadrantChart` have their own state-machine tests covering `dashboard === undefined` → loading and `dashboard === null` → empty. We do not duplicate those assertions in the cross-route suite.

Result: **19 / 19 pass**. The four `loadJsonOrNull`-backed loaders (`page_insights`, `volatility_dashboard`, `rates_dashboard`, `regime_dashboard`) all correctly return `null` on 404, and the consuming components render their loading / empty / fallback chrome without crashing.

Commit: `2291f8f test(qa): assert routes degrade gracefully when next-phase derived JSON is absent`.

---

## Task W5-4: Responsive layout

The repo runs in a CI / static-build environment without a headless browser harness wired into the verification gate. Responsive behavior verified via CSS inspection and the existing route Vitest suite:

- **Page shell width** — `src/styles.css:36-39` `.page-shell` uses `width: min(1180px, calc(100vw - 32px))`. At 320 px the content column is `320 - 32 = 288 px` (with 16 px margins), no horizontal overflow. At 768 / 1280 px it scales fluidly under the 1180 px cap.
- **Body minimum** — `src/styles.css:21` `body { min-width: 320px }` ensures the 320 px lower bound is respected without horizontal scroll.
- **Site header** — `.site-header` mirrors the same width pattern and uses `grid-template-columns: minmax(240px, 1fr) auto`, which wraps at narrow widths.
- **Chart shells** — `InteractiveChartShell` uses `display: grid; gap: 12px;` and `flex-wrap: wrap` on the title row. Charts inside use `<div style="height: 100%; width: 100%">` for the echarts canvas, so they fill the grid cell at any width.
- **Existing breakpoints** — `@media (max-width: 720px / 760px / 1080px)` blocks already adjust panels and nav for mobile / tablet. Verified by inspecting `src/styles.css:974, 1302, 1340, 1458, 1600, 1606, 1616, 1710, 2136, 2229, 2337`.
- **Route data footer** — every route in `src/routes/__routesDir` imports `RouteDataFooter` and renders it at the end of the route stack. The cross-route test `W2-13: cross-route IA consistency` (`data-routes.test.tsx:3439-3475`) asserts (a) every route imports `RouteDataFooter`, (b) `RouteDataFooter` is the last data-transparency wrapper, (c) every `DataGapPanel` / `DataStatusTable` / `CandidateDiagnosticPanel` usage appears after the footer's opening tag (i.e., inside the footer). This is structural and runs in CI.

**Known observation, not a defect:** `src/charts/EChartPanel.tsx` initializes echarts inside a `<div style="height: 100%; width: 100%">` but does NOT subscribe to `window.resize` or a `ResizeObserver`. The chart will fit its parent on mount but does not re-fit when the viewport changes after first paint. This matches the pre-W1 baseline. Filed as a future polish item rather than this wave's responsibility (no spec requirement, no user-facing complaint).

Verified responsive contract via CSS inspection and existing route tests. No regressions.

---

## Task W5-5: Accessibility audit

| Check | Result |
|---|---|
| Every chart panel has an `ariaLabel` | PASS — verified across all 14 next-phase chart components in `src/components/charts/*` and the 5 next-phase ECharts panels in `src/components/` (HousingActivityHero, VixVvixHiddenStressPanel, MacroRegimeQuadrant, RegimeQuadrantChart, etc.). `EChartPanel` defaults the canvas `aria-label` to the panel title when no override is provided, so even the few panels that omit `ariaLabel=` still emit a usable label. |
| `ChartRangeControls` has `role="radiogroup"` | PASS — `src/components/ChartRangeControls.tsx:125`. Each button inside has `role="radio"` and `aria-checked` (`ChartRangeControls.tsx:142, 144`). |
| `MacroRegimeQuadrant` window controls have `role="radiogroup"` | PASS — `src/components/MacroRegimeQuadrant.tsx:313`. Each button has `role="radio"` + `aria-checked` (`MacroRegimeQuadrant.tsx:327, 328`). |
| `RegimeQuadrantChart` window controls have `role="radiogroup"` | PASS — `src/components/RegimeQuadrantChart.tsx:337`. Each button has `role="radio"` + `aria-checked`. |
| `PageInsightHero` heading levels | PASS — uses `<h3 className="page-insight-hero__title">` (`PageInsightHero.tsx:89, 144`) under each route's `<h2>` (every route file has exactly one `<h2>` for the route title). Hierarchy `<h1>` site title → `<h2>` route title → `<h3>` panel/hero/chart title — confirmed across all 18 route files via grep. |
| `InteractiveChartShell` accessibility chrome | PASS — has `role="region"` and `aria-label={ariaLabel}` (`InteractiveChartShell.tsx:81-82`). |
| Nav links | PASS — `<nav aria-label="Primary navigation">` (`AppLayout.tsx:47`); ambiguous short labels (Short-Term, Long-Term, Replay) carry explicit `aria-label` overrides (`AppLayout.tsx:8-12`). |

No accessibility defects found in this wave's scope.

---

## Verification report file path

`/Users/sakura/WebstormProjects/market-weather-map/docs/superpowers/plans/2026-05-10-market-weather-map-next-phase-verification.md`

---

## Follow-ups (not in this wave's scope)

1. **EChartPanel resize observer** — `src/charts/EChartPanel.tsx` does not call `instance.resize()` on `window.resize` or via a `ResizeObserver`. Charts mount at the correct size but don't reflow after a viewport change. Pre-W1 baseline. Low priority polish.
2. **Bundle size warning** — `dist/assets/index-*.js` is ~1.45 MB (~441 kB gzipped), above Vite's 500 kB warning threshold. Pre-W1 baseline. Candidate for route-level code splitting (`React.lazy()` on the route components) in a future performance pass.
3. **`update_data` overall status = "partial"** — expected as long as gated `terms_review_needed` sources are listed in `data_status.json`. The status reflects governance state, not a data integrity issue. Will remain "partial" until those sources move to `free_public` per `docs/source_reviews/`.

None of the above blocks this PR or shipping the next-phase work.

---

## Acceptance criteria

- [x] All verification commands pass (`npm test`, `npm run build`, `pytest`, `validate_schema`, `validate_freshness`, `update_data` smoke).
- [x] Grep checks documented; all matches in tone / secret / SLOT / regime-label audits are either code identifiers, anti-pattern documentation comments, or methodology-correct literals.
- [x] Routes render gracefully when any of the 4 new derived JSONs is absent — new Vitest suite at `src/routes/__tests__/missing-derived-json.test.tsx` (19 tests).
- [x] Responsive layout confirmed via CSS inspection (page shell, body min-width, breakpoints) and existing route tests (`W2-13: cross-route IA consistency`).
- [x] ARIA labels present on every chart panel; `ChartRangeControls`, `MacroRegimeQuadrant`, `RegimeQuadrantChart` window controls all carry `role="radiogroup"`. `PageInsightHero` heading levels are h3 under each route's h2.
- [x] Verification report committed.
