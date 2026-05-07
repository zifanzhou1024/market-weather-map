# Horizon Regime Decision System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Market Weather Map from a factor-library dashboard into a horizon-based regime interpretation system for tactical trading weather, long-term macro climate, and cross-asset fragility.

**Architecture:** Keep the static GitHub Pages model: Python scripts generate source-governed JSON under `public/data`, and React reads those static artifacts. The first shippable PR should use existing active data only, add derived regime contracts, and add new horizon-based routes without adding compliance-gated data feeds.

**Tech Stack:** Python 3.11 data transforms and pytest; React 19, TypeScript, React Router 7, Recharts 3, Vitest/jsdom; static JSON under `public/data`.

---

## Program Context

This file is PR 1 of the broader horizon/regime build. The continuous multi-PR handoff is tracked in [Horizon Regime Program Execution Plan](./2026-05-07-horizon-regime-program-execution.md).

Subsequent plans:

- [PR 2: Tactical Options + Event Risk Depth](./2026-05-07-pr2-tactical-options-event-risk.md)
- [PR 3: Fragility Shock Risk](./2026-05-07-pr3-fragility-shock-risk.md)
- [PR 4: Strategic Macro Completeness](./2026-05-07-pr4-strategic-macro-completeness.md)
- [PR 5: Historical Regime Replay](./2026-05-07-pr5-regime-replay-research.md)
- [PR 6: Watchlist + Threshold System](./2026-05-07-pr6-watchlist-thresholds.md)

---

## Scope Decision

The audit describes multiple independent subsystems. Do not implement them as one large PR.

Build order:

1. **PR 1: Horizon IA + Active-Data Regime Map**  
   Add route/navigation structure, series metadata, derived active-data regime JSON, tactical checklist, TIPS x dollar quadrant, yield decomposition, and active-data VIX proxy view. No new external source families.
2. **PR 2: Tactical Trading Weather Depth**  
   Add options sentiment, put/call dashboard, SKEW, and event-risk cards only after source terms are resolved or explicitly displayed as candidate-only.
3. **PR 3: Fragility Shock Risk**  
   Add MOVE, MOVE/VIX, bond-volatility interpretation, tail-risk panels, and fragility mismatch warnings after terms review.
4. **PR 4: Long-Term Macro Climate Depth**  
   Add valuation, term premium, Treasury supply, PMIs/SLOOS, consumer balance sheet, and housing/fiscal expansion as source-governed workstreams.
5. **PR 5: Historical Regime Replay**  
   Add descriptive forward-return replay for selected historical regimes with clear non-predictive caveats.

This plan details PR 1 because it is the highest-value slice that can ship with the current repository and active no-secret data.

---

## PR 1 File Structure

Create:

- `src/lib/regime.ts`: frontend-safe helpers for direction labels, regime labels, yield-driver labels, confirmation labels, and latest-value extraction.
- `src/components/MultiSeriesChart.tsx`: reusable multi-line chart for aligned static time series.
- `src/components/YieldDecompositionChart.tsx`: nominal 10Y, real 10Y, and breakeven 10Y visualization.
- `src/components/RegimeQuadrantChart.tsx`: TIPS x dollar quadrant with trailing observations.
- `src/components/SignalChecklist.tsx`: compact checklist for tactical regime state.
- `src/components/CrossAssetConfirmationMatrix.tsx`: confirmation/divergence grid.
- `src/routes/TacticalTradingWeather.tsx`: tactical landing page using active data.
- `src/routes/LongTermMacroClimate.tsx`: strategic macro landing page using existing score/data groups.
- `src/routes/RegimeMap.tsx`: dedicated TIPS x dollar x nominal-yields page.
- `tests/python/test_regime_derivatives.py`: Python tests for derived regime payloads.

Modify:

- `scripts/shared/catalog.py`: add `horizon`, `regime_role`, and `preferred_chart` metadata to generated catalog entries.
- `public/data/catalog/series_catalog.json`: regenerate after catalog metadata changes.
- `src/lib/types.ts`: add `Horizon`, `RegimeRole`, `PreferredChart`, catalog fields, and derived regime payload types.
- `scripts/transform/compute_regime_score.py`: generate new active-data derived series and `regime_snapshot.json`.
- `scripts/validate/validate_schema.py`: validate new catalog fields and `regime_snapshot.json` shape.
- `src/lib/data.ts`: add `loadRegimeSnapshot()`.
- `src/App.tsx`: add routes for `/tactical`, `/macro-climate`, and `/regime-map`.
- `src/components/AppLayout.tsx`: reorganize top nav around decision views and put raw factor pages under a visible Data Library group.
- `src/routes/Volatility.tsx`: replace single-feature VIX chart with VIX/VIX3M proxy term-structure view using `MultiSeriesChart`.
- `src/routes/Rates.tsx`: add yield decomposition and driver label using existing active series.
- `src/routes/data-routes.test.tsx`: add route tests for new pages and nav labels.
- `src/components/data-components.test.tsx`: add component tests for checklist, quadrant, decomposition, and confirmation components.
- `tests/python/test_catalog.py`: assert catalog metadata fields for representative tactical, strategic, and both-horizon series.
- `tests/python/test_scoring.py`: assert generated regime snapshot and new derived series are written.
- `README.md`, `docs/METHODOLOGY.md`, `docs/DATA_SOURCES.md`, `docs/LIMITATIONS.md`: document horizon views, active-data-only PR 1 scope, and candidate-source gates.

Do not modify:

- `.idea/`.
- Provider credentials or backend code.
- Candidate-source ingestion for put/call, SKEW, MOVE, VIX futures, PMIs, SLOOS, valuation, or Treasury supply in PR 1.

---

## PR 1 Data Contract

Add these catalog metadata values:

```ts
export type Horizon = "tactical" | "strategic" | "both";

export type RegimeRole =
  | "real_yield"
  | "nominal_yield"
  | "inflation_expectation"
  | "dollar"
  | "credit"
  | "volatility"
  | "liquidity"
  | "growth"
  | "labor"
  | "housing"
  | "commodity"
  | "sentiment"
  | "tail_risk"
  | "bond_volatility"
  | "banking";

export type PreferredChart =
  | "line"
  | "multi_line"
  | "curve"
  | "heatmap"
  | "quadrant"
  | "decomposition";
```

Add this derived JSON file:

`public/data/derived/regime_snapshot.json`

```json
{
  "generated_at_utc": "2026-05-07T00:00:00Z",
  "date": "2026-05-06",
  "method_version": "phase5-horizon-regime-v1",
  "regime": {
    "label": "Tightening / risk-off",
    "tips_direction": "up",
    "dollar_direction": "up",
    "nominal_yield_direction": "up",
    "yield_driver": "real_yield_driven"
  },
  "checklist": [],
  "confirmations": [],
  "quadrant_trail": [],
  "yield_decomposition": []
}
```

Runtime labels must remain descriptive and must not use financial advice language such as "buy", "sell", "short", "long", "entry", "target", or "stop".

---

## Task 1: Add Catalog Horizon Metadata

**Files:**

- Modify: `scripts/shared/catalog.py`
- Modify: `src/lib/types.ts`
- Modify: `tests/python/test_catalog.py`
- Regenerate: `public/data/catalog/series_catalog.json`

- [ ] **Step 1: Write catalog tests**

Add assertions to `tests/python/test_catalog.py`:

```python
def test_catalog_entries_include_horizon_regime_metadata():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    assert entries["vix"]["horizon"] == "tactical"
    assert entries["vix"]["regime_role"] == ["volatility"]
    assert entries["vix"]["preferred_chart"] == "curve"

    assert entries["real_yield_10y"]["horizon"] == "both"
    assert entries["real_yield_10y"]["regime_role"] == ["real_yield"]
    assert entries["real_yield_10y"]["preferred_chart"] == "decomposition"

    assert entries["cfnai"]["horizon"] == "strategic"
    assert entries["cfnai"]["regime_role"] == ["growth"]
    assert entries["cfnai"]["preferred_chart"] == "line"
```

- [ ] **Step 2: Run failing test**

Run:

```bash
python -m pytest tests/python/test_catalog.py::test_catalog_entries_include_horizon_regime_metadata -v
```

Expected: FAIL because catalog entries do not yet include horizon metadata.

- [ ] **Step 3: Add metadata helpers**

In `scripts/shared/catalog.py`, add helper maps near the source definitions:

```python
TACTICAL_IDS = {
    "vix", "vvix", "vix9d", "vix3m", "high_yield_oas", "investment_grade_oas",
    "bbb_oas", "hy_minus_ig_oas", "broad_dollar", "usdjpy", "eurusd",
    "us2y", "us10y", "us30y", "real_yield_10y", "breakeven_10y",
    "net_liquidity", "reverse_repo", "treasury_general_account", "sofr",
    "cftc_sp500_asset_mgr_net", "cftc_sp500_lev_money_net",
}

STRATEGIC_IDS = {
    "real_yield_5y", "real_yield_10y", "breakeven_5y", "breakeven_10y",
    "forward_inflation_5y5y", "cfnai", "cfnai_3m_avg", "real_retail_sales",
    "industrial_production", "durable_goods_orders", "unemployment_rate",
    "nonfarm_payrolls", "initial_claims", "sahm_rule", "headline_cpi",
    "core_cpi", "core_pce", "ppi_final_demand", "bank_credit",
    "loans_and_leases", "business_loans", "bank_deposits", "fed_assets",
    "reserve_balances",
}

REGIME_ROLES_BY_ID = {
    "vix": ["volatility"],
    "vvix": ["tail_risk", "volatility"],
    "vix9d": ["volatility"],
    "vix3m": ["volatility"],
    "us2y": ["nominal_yield"],
    "us10y": ["nominal_yield"],
    "us20y": ["nominal_yield"],
    "us30y": ["nominal_yield"],
    "real_yield_5y": ["real_yield"],
    "real_yield_10y": ["real_yield"],
    "breakeven_5y": ["inflation_expectation"],
    "breakeven_10y": ["inflation_expectation"],
    "forward_inflation_5y5y": ["inflation_expectation"],
    "broad_dollar": ["dollar"],
    "usdjpy": ["dollar"],
    "eurusd": ["dollar"],
    "high_yield_oas": ["credit"],
    "investment_grade_oas": ["credit"],
    "bbb_oas": ["credit"],
    "financial_conditions": ["credit"],
    "financial_stress": ["credit"],
    "net_liquidity": ["liquidity"],
    "fed_assets": ["liquidity"],
    "reverse_repo": ["liquidity"],
    "treasury_general_account": ["liquidity"],
    "reserve_balances": ["liquidity"],
    "sofr": ["liquidity"],
    "wti_crude": ["commodity"],
    "brent_crude": ["commodity"],
    "corn_price": ["commodity"],
    "wheat_price": ["commodity"],
    "soybean_price": ["commodity"],
    "cftc_sp500_asset_mgr_net": ["sentiment"],
    "cftc_sp500_lev_money_net": ["sentiment"],
    "cfnai": ["growth"],
    "cfnai_3m_avg": ["growth"],
    "real_retail_sales": ["growth"],
    "industrial_production": ["growth"],
    "durable_goods_orders": ["growth"],
    "unemployment_rate": ["labor"],
    "nonfarm_payrolls": ["labor"],
    "initial_claims": ["labor"],
    "sahm_rule": ["labor"],
    "bank_credit": ["banking", "credit"],
    "loans_and_leases": ["banking", "credit"],
    "business_loans": ["banking", "credit"],
    "bank_deposits": ["banking", "liquidity"],
}

PREFERRED_CHART_BY_ROLE = {
    "real_yield": "decomposition",
    "nominal_yield": "decomposition",
    "inflation_expectation": "decomposition",
    "volatility": "curve",
    "dollar": "line",
    "credit": "line",
    "liquidity": "line",
    "growth": "line",
    "labor": "line",
    "commodity": "line",
    "sentiment": "line",
    "tail_risk": "line",
    "banking": "line",
}


def decision_metadata(series_id: str, category: str) -> dict[str, object]:
    tactical = series_id in TACTICAL_IDS
    strategic = series_id in STRATEGIC_IDS
    if tactical and strategic:
        horizon = "both"
    elif tactical:
        horizon = "tactical"
    elif strategic:
        horizon = "strategic"
    else:
        horizon = "strategic" if category in {"growth", "labor", "inflation", "banking"} else "tactical"
    roles = REGIME_ROLES_BY_ID.get(series_id, [category])
    return {
        "horizon": horizon,
        "regime_role": roles,
        "preferred_chart": PREFERRED_CHART_BY_ROLE.get(str(roles[0]), "line"),
    }
```

Apply `**decision_metadata(series_id, category)` to every active and candidate catalog entry as it is assembled.

- [ ] **Step 4: Update TypeScript catalog type**

In `src/lib/types.ts`, add the `Horizon`, `RegimeRole`, and `PreferredChart` types from the PR 1 Data Contract and extend `SeriesCatalogEntry`:

```ts
  horizon?: Horizon;
  regime_role?: RegimeRole[];
  preferred_chart?: PreferredChart;
```

- [ ] **Step 5: Regenerate catalog artifact**

Run:

```bash
python -m scripts.update_data
python -m scripts.validate.validate_schema
```

Expected: `public/data/catalog/series_catalog.json` contains `horizon`, `regime_role`, and `preferred_chart` for all generated entries.

- [ ] **Step 6: Verify task**

Run:

```bash
python -m pytest tests/python/test_catalog.py -v
npm run test -- src/routes/data-routes.test.tsx
```

Expected: PASS.

Commit:

```bash
git add scripts/shared/catalog.py src/lib/types.ts tests/python/test_catalog.py public/data/catalog/series_catalog.json public/data/status/data_status.json public/data/derived public/data/series
git commit -m "feat: add horizon metadata to series catalog"
```

---

## Task 2: Generate Active-Data Regime Snapshot

**Files:**

- Create: `tests/python/test_regime_derivatives.py`
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `scripts/validate/validate_schema.py`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Generate: `public/data/derived/regime_snapshot.json`

- [ ] **Step 1: Write regime derivation tests**

Create `tests/python/test_regime_derivatives.py`:

```python
from scripts.transform import compute_regime_score


def series(value, change_1m=0.0, percentile=50.0):
    return {
        "frequency": "daily",
        "summary": {
            "latest_date": "2026-05-06",
            "latest_value": value,
            "change_1m": change_1m,
            "percentile_252d": percentile,
        },
        "observations": [
            {"date": "2026-05-01", "value": value - change_1m},
            {"date": "2026-05-06", "value": value},
        ],
    }


def test_regime_snapshot_labels_tightening_risk_off():
    snapshot = compute_regime_score.build_regime_snapshot(
        {
            "real_yield_10y": series(2.25, 0.25),
            "broad_dollar": series(125.0, 2.0),
            "us10y": series(4.75, 0.30),
            "breakeven_10y": series(2.5, 0.05),
            "vix": series(22.0, 4.0, percentile=80),
            "vix3m": series(20.0, 0.5),
            "vix9d": series(24.0, 5.0),
            "high_yield_oas": series(4.2, 0.35, percentile=75),
            "hy_minus_ig_oas": series(2.8, 0.20, percentile=70),
            "net_liquidity": series(6000.0, -100.0),
        },
        "2026-05-07T00:00:00Z",
    )

    assert snapshot["regime"]["label"] == "Tightening / risk-off"
    assert snapshot["regime"]["tips_direction"] == "up"
    assert snapshot["regime"]["dollar_direction"] == "up"
    assert snapshot["regime"]["nominal_yield_direction"] == "up"
    assert snapshot["regime"]["yield_driver"] == "real_yield_driven"
    assert any(item["id"] == "vix_curve" and item["state"] == "backwardation_proxy" for item in snapshot["checklist"])


def test_regime_snapshot_labels_risk_on_easing():
    snapshot = compute_regime_score.build_regime_snapshot(
        {
            "real_yield_10y": series(1.75, -0.20),
            "broad_dollar": series(118.0, -2.0),
            "us10y": series(4.10, -0.18),
            "breakeven_10y": series(2.35, 0.02),
            "vix": series(15.0, -2.0, percentile=30),
            "vix3m": series(18.0, -0.5),
            "vix9d": series(14.0, -1.5),
            "high_yield_oas": series(3.2, -0.15, percentile=35),
            "hy_minus_ig_oas": series(2.1, -0.08, percentile=35),
            "net_liquidity": series(6200.0, 150.0),
        },
        "2026-05-07T00:00:00Z",
    )

    assert snapshot["regime"]["label"] == "Strong risk-on"
    assert snapshot["regime"]["yield_driver"] == "real_yield_easing"
    assert any(item["id"] == "credit" and item["status"] == "confirming" for item in snapshot["confirmations"])
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
python -m pytest tests/python/test_regime_derivatives.py -v
```

Expected: FAIL because `build_regime_snapshot` does not exist.

- [ ] **Step 3: Add regime helper functions**

In `scripts/transform/compute_regime_score.py`, add:

```python
def _direction_from_change(change: object, threshold: float = 0.05) -> str:
    if not _finite_number(change):
        return "flat"
    value = float(change)
    if value >= threshold:
        return "up"
    if value <= -threshold:
        return "down"
    return "flat"


def _summary_change(series_by_id: dict[str, dict[str, Any]], series_id: str, key: str = "change_1m") -> float | None:
    if series_id not in series_by_id:
        return None
    value = latest_summary(series_by_id[series_id]).get(key)
    return float(value) if _finite_number(value) else None


def _regime_label(tips_direction: str, dollar_direction: str) -> str:
    if tips_direction == "down" and dollar_direction == "down":
        return "Strong risk-on"
    if tips_direction == "up" and dollar_direction == "down":
        return "Reallocation / rotation"
    if tips_direction == "up" and dollar_direction == "up":
        return "Tightening / risk-off"
    if tips_direction == "down" and dollar_direction == "up":
        return "Bonds-first / safe haven"
    return "Mixed"


def _yield_driver(nominal_change: float | None, real_change: float | None, breakeven_change: float | None) -> str:
    if nominal_change is None or abs(nominal_change) < 0.05:
        return "mixed"
    real_abs = abs(real_change or 0.0)
    breakeven_abs = abs(breakeven_change or 0.0)
    if nominal_change > 0 and real_abs > breakeven_abs and (real_change or 0.0) > 0:
        return "real_yield_driven"
    if nominal_change > 0 and breakeven_abs >= real_abs and (breakeven_change or 0.0) > 0:
        return "breakeven_inflation_driven"
    if nominal_change < 0 and (real_change or 0.0) < 0:
        return "real_yield_easing"
    if nominal_change < 0:
        return "safe_haven_or_growth_scare"
    return "mixed"
```

Then implement `build_regime_snapshot(series_by_id, generated_at)` with this shape:

```python
{
    "generated_at_utc": generated_at,
    "date": latest_date,
    "method_version": "phase5-horizon-regime-v1",
    "regime": {
        "label": _regime_label(tips_direction, dollar_direction),
        "tips_direction": tips_direction,
        "dollar_direction": dollar_direction,
        "nominal_yield_direction": nominal_direction,
        "yield_driver": _yield_driver(nominal_change, real_change, breakeven_change),
    },
    "checklist": [...],
    "confirmations": [...],
    "quadrant_trail": [...],
    "yield_decomposition": [...],
}
```

Checklist IDs for PR 1:

- `real_yield_10y`
- `dollar`
- `nominal_10y`
- `yield_driver`
- `vix_curve`
- `credit`
- `liquidity`
- `overall_regime`

Confirmation IDs for PR 1:

- `credit`
- `vix_curve`
- `liquidity`
- `rates`

Use `status: "confirming" | "diverging" | "mixed" | "unavailable"` and a one-sentence `message`.

- [ ] **Step 4: Write generated artifact in main**

After `score_summary` generation in `main()`, add:

```python
regime_snapshot = build_regime_snapshot(series_by_id, generated_at)
write_json(data_dir() / "derived" / "regime_snapshot.json", regime_snapshot)
```

- [ ] **Step 5: Add TypeScript types and loader**

In `src/lib/types.ts`, add interfaces:

```ts
export type DirectionState = "up" | "down" | "flat" | "unavailable";
export type YieldDriver =
  | "real_yield_driven"
  | "breakeven_inflation_driven"
  | "real_yield_easing"
  | "safe_haven_or_growth_scare"
  | "mixed";

export interface RegimeSnapshotFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  regime: {
    label: string;
    tips_direction: DirectionState;
    dollar_direction: DirectionState;
    nominal_yield_direction: DirectionState;
    yield_driver: YieldDriver;
  };
  checklist: Array<{ id: string; label: string; state: string; message: string }>;
  confirmations: Array<{ id: string; label: string; status: string; message: string }>;
  quadrant_trail: Array<{
    date: string;
    dollar_change: number;
    real_yield_change: number;
    nominal_yield_change: number;
    vix_percentile?: number | null;
    credit_change?: number | null;
  }>;
  yield_decomposition: Array<{
    date: string;
    nominal_10y: number;
    real_yield_10y: number;
    breakeven_10y: number;
  }>;
}
```

In `src/lib/data.ts`, add:

```ts
export function loadRegimeSnapshot(): Promise<RegimeSnapshotFile> {
  return loadJson<RegimeSnapshotFile>("/data/derived/regime_snapshot.json");
}
```

- [ ] **Step 6: Validate and test**

Run:

```bash
python -m pytest tests/python/test_regime_derivatives.py tests/python/test_scoring.py -v
python -m scripts.update_data
python -m scripts.validate.validate_schema
npm run test -- src/routes/data-routes.test.tsx
```

Expected: PASS and `public/data/derived/regime_snapshot.json` is generated.

Commit:

```bash
git add scripts/transform/compute_regime_score.py scripts/validate/validate_schema.py src/lib/types.ts src/lib/data.ts tests/python/test_regime_derivatives.py tests/python/test_scoring.py public/data/derived/regime_snapshot.json public/data/status/data_status.json
git commit -m "feat: derive active-data regime snapshot"
```

---

## Task 3: Add Chart and Signal Components

**Files:**

- Create: `src/lib/regime.ts`
- Create: `src/components/MultiSeriesChart.tsx`
- Create: `src/components/YieldDecompositionChart.tsx`
- Create: `src/components/RegimeQuadrantChart.tsx`
- Create: `src/components/SignalChecklist.tsx`
- Create: `src/components/CrossAssetConfirmationMatrix.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add component tests**

In `src/components/data-components.test.tsx`, add tests that assert:

- `SignalChecklist` renders "Real yield", "Dollar", and "Overall regime" rows from fixture checklist items.
- `CrossAssetConfirmationMatrix` renders "Confirming", "Diverging", and "Unavailable" states without advice terms.
- `RegimeQuadrantChart` renders quadrant labels "Strong risk-on", "Reallocation / rotation", "Tightening / risk-off", and "Bonds-first / safe haven".
- `YieldDecompositionChart` renders legend labels "10Y nominal", "10Y real yield", and "10Y breakeven".
- `MultiSeriesChart` renders each configured line name.

- [ ] **Step 2: Run failing component tests**

Run:

```bash
npm run test -- src/components/data-components.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `src/lib/regime.ts`**

Add helper functions:

```ts
import type { DirectionState, YieldDriver } from "./types";

export function directionLabel(direction: DirectionState) {
  const labels: Record<DirectionState, string> = {
    up: "Up",
    down: "Down",
    flat: "Flat",
    unavailable: "Unavailable"
  };
  return labels[direction] ?? "Unavailable";
}

export function yieldDriverLabel(driver: YieldDriver) {
  const labels: Record<YieldDriver, string> = {
    real_yield_driven: "Real-yield driven",
    breakeven_inflation_driven: "Breakeven / inflation driven",
    real_yield_easing: "Real-yield easing",
    safe_haven_or_growth_scare: "Safe-haven / growth-scare",
    mixed: "Mixed"
  };
  return labels[driver] ?? "Mixed";
}
```

Also add `safeNumber(value: unknown): number | null` and `formatStateLabel(value: string): string`.

- [ ] **Step 4: Implement components using existing visual system**

Use existing `.panel`, `.section-header`, `.detail-grid`, and Recharts patterns. Keep components presentational: they receive already-loaded data and do not call fetch.

Component contracts:

```ts
// SignalChecklist.tsx
export default function SignalChecklist({ items }: { items: RegimeSnapshotFile["checklist"] }) {}

// CrossAssetConfirmationMatrix.tsx
export default function CrossAssetConfirmationMatrix({ items }: { items: RegimeSnapshotFile["confirmations"] }) {}

// RegimeQuadrantChart.tsx
export default function RegimeQuadrantChart({ trail }: { trail: RegimeSnapshotFile["quadrant_trail"] }) {}

// YieldDecompositionChart.tsx
export default function YieldDecompositionChart({ data }: { data: RegimeSnapshotFile["yield_decomposition"] }) {}

// MultiSeriesChart.tsx
export interface MultiSeriesChartSeries {
  id: string;
  name: string;
  data: Array<{ date: string; value: number }>;
  color: string;
}
export default function MultiSeriesChart({ title, units, series }: { title: string; units: string; series: MultiSeriesChartSeries[] }) {}
```

- [ ] **Step 5: Add CSS**

Add focused CSS classes:

- `.signal-checklist`
- `.signal-checklist__row`
- `.confirmation-matrix`
- `.confirmation-matrix__item`
- `.quadrant-frame`
- `.quadrant-label`
- `.chart-legend`

Use the existing palette. Do not add a new dominant color theme.

- [ ] **Step 6: Verify task**

Run:

```bash
npm run test -- src/components/data-components.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/lib/regime.ts src/components/MultiSeriesChart.tsx src/components/YieldDecompositionChart.tsx src/components/RegimeQuadrantChart.tsx src/components/SignalChecklist.tsx src/components/CrossAssetConfirmationMatrix.tsx src/components/data-components.test.tsx src/styles.css
git commit -m "feat: add regime visualization components"
```

---

## Task 4: Add Horizon Routes and Navigation

**Files:**

- Create: `src/routes/TacticalTradingWeather.tsx`
- Create: `src/routes/LongTermMacroClimate.tsx`
- Create: `src/routes/RegimeMap.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write route tests**

Add tests to `src/routes/data-routes.test.tsx`:

```ts
it("renders tactical trading weather from active regime data", async () => {
  mockStaticFetch(routeFetchFiles({
    "/data/derived/regime_snapshot.json": regimeSnapshot
  }));

  const container = render(
    <MemoryRouter initialEntries={["/tactical"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Tactical Trading Weather");
  expect(container.textContent).toContain("Daily checklist");
  expect(container.textContent).toContain("VIX term-structure proxy");
});

it("renders long-term macro climate from current score summary", async () => {
  mockStaticFetch(routeFetchFiles({
    "/data/derived/regime_snapshot.json": regimeSnapshot
  }));

  const container = render(
    <MemoryRouter initialEntries={["/macro-climate"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Long-Term Macro Climate");
  expect(container.textContent).toContain("Macro Climate");
  expect(container.textContent).toContain("Growth cycle");
});

it("renders the regime map route", async () => {
  mockStaticFetch(routeFetchFiles({
    "/data/derived/regime_snapshot.json": regimeSnapshot
  }));

  const container = render(
    <MemoryRouter initialEntries={["/regime-map"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "TIPS x Dollar Regime Map");
  expect(container.textContent).toContain("Yield driver");
  expect(container.textContent).toContain("Cross-asset confirmation");
});
```

Add a `regimeSnapshot` fixture in the same test file with realistic checklist, confirmation, trail, and decomposition data.

- [ ] **Step 2: Run failing route tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement routes**

`TacticalTradingWeather.tsx` loads:

- `loadScoreSummary()`
- `loadRegimeSnapshot()`
- `loadDataStatus()`
- `loadCatalog()`
- active series: `vix`, `vix9d`, `vix3m`, `vvix`, `high_yield_oas`, `broad_dollar`, `real_yield_10y`
- active derived series: `vix9d_vix_ratio`, `vix_vix3m_ratio`, `hy_minus_ig_oas`, `net_liquidity`

Top sections:

- Overall tactical regime from `regime_snapshot.regime.label`.
- `SignalChecklist`.
- Market Weather score and Fragility score.
- `CrossAssetConfirmationMatrix`.
- VIX term-structure proxy using `MultiSeriesChart`.

`RegimeMap.tsx` loads `regime_snapshot` and renders:

- current quadrant label
- TIPS, dollar, nominal-yield direction cards
- yield-driver label
- `RegimeQuadrantChart`
- `YieldDecompositionChart`
- `CrossAssetConfirmationMatrix`

`LongTermMacroClimate.tsx` loads:

- `score_summary`
- strategic series already active in Growth/Labor/Inflation/Rates/Liquidity/Credit
- `regime_snapshot` for yield decomposition

Top sections:

- Macro Climate score.
- strategic regime summary using growth, labor, inflation, real-yield bucket scores.
- `YieldDecompositionChart`.
- panels for Growth cycle, Labor cycle, Inflation trend, Credit cycle, Liquidity cycle.

- [ ] **Step 4: Update routing and navigation**

In `src/App.tsx`, add:

```tsx
<Route path="/tactical" element={<TacticalTradingWeather />} />
<Route path="/macro-climate" element={<LongTermMacroClimate />} />
<Route path="/regime-map" element={<RegimeMap />} />
```

In `AppLayout.tsx`, use this nav order:

```ts
const navItems = [
  { to: "/", label: "Overview" },
  { to: "/tactical", label: "Tactical Trading Weather" },
  { to: "/macro-climate", label: "Long-Term Macro Climate" },
  { to: "/regime-map", label: "Regime Map" },
  { to: "/volatility", label: "Volatility" },
  { to: "/rates", label: "Rates" },
  { to: "/liquidity", label: "Liquidity" },
  { to: "/credit", label: "Credit" },
  { to: "/dollar-global", label: "Dollar" },
  { to: "/commodities", label: "Commodities" },
  { to: "/growth", label: "Growth" },
  { to: "/inflation", label: "Inflation" },
  { to: "/sentiment", label: "Positioning" },
  { to: "/methodology", label: "Methodology" }
];
```

If this overflows, keep the flat nav for PR 1 and add a Data Library disclosure in a later UI polish task. The route labels should still communicate the new hierarchy.

- [ ] **Step 5: Verify task**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/routes/TacticalTradingWeather.tsx src/routes/LongTermMacroClimate.tsx src/routes/RegimeMap.tsx src/App.tsx src/components/AppLayout.tsx src/routes/data-routes.test.tsx
git commit -m "feat: add horizon-based regime routes"
```

---

## Task 5: Upgrade Existing Rates and Volatility Pages

**Files:**

- Modify: `src/routes/Rates.tsx`
- Modify: `src/routes/Volatility.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Add tests for upgraded page content**

Add expectations:

- Rates route contains "10Y yield decomposition" and "Yield driver".
- Volatility route contains "VIX term-structure proxy", "VIX9D", "VIX", and "VIX3M".

- [ ] **Step 2: Update Rates page**

Load `regime_snapshot` and render:

- `YieldDecompositionChart`
- current yield driver label
- real-yield, breakeven, nominal-yield direction text from snapshot

Keep existing metric cards and data status table.

- [ ] **Step 3: Update Volatility page**

Render `MultiSeriesChart` for VIX9D, VIX, VIX3M, and VVIX active data. Add a compact interpretation:

- `VIX3M > VIX`: normal / contango-like proxy.
- `VIX > VIX3M`: stress / backwardation-like proxy.
- `VIX9D > VIX`: near-term event-risk pressure.

Keep source notes and data status visible.

- [ ] **Step 4: Verify task**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/routes/Rates.tsx src/routes/Volatility.tsx src/routes/data-routes.test.tsx
git commit -m "feat: surface decomposition and vix proxy views"
```

---

## Task 6: Documentation and Source-Gate Notes

**Files:**

- Modify: `README.md`
- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/LIMITATIONS.md`

- [ ] **Step 1: Document PR 1 behavior**

Add a "Phase 5 Horizon Regime Direction" section to `README.md`:

```md
Phase 5 direction:

- Organize the primary experience by use case: Tactical Trading Weather, Long-Term Macro Climate, and Regime Map.
- Use existing active no-secret data for PR 1.
- Treat VIX futures, put/call ratios, SKEW, MOVE, valuation, PMIs/SLOOS, and Treasury supply as candidate or future inputs until source terms and redistribution rules are reviewed.
- Keep outputs descriptive and avoid trade recommendations.
```

- [ ] **Step 2: Document methodology**

In `docs/METHODOLOGY.md`, add:

- the TIPS x dollar quadrant definitions
- yield driver definitions
- checklist item definitions
- confirmation matrix definitions
- explicit caveat that labels are descriptive historical/current-state summaries

- [ ] **Step 3: Document source gates**

In `docs/DATA_SOURCES.md`, add candidate rows for:

- Cboe put/call ratios
- Cboe SKEW
- VIX futures curve
- MOVE
- gold/XAU confirmation
- equity breadth
- term premium
- valuation
- Treasury supply
- PMIs/SLOOS

Use `terms_review_needed` for exchange/licensed data and `candidate` score status until reviewed.

- [ ] **Step 4: Verify docs**

Run:

```bash
rg -n "buy|sell|short|long|entry|target|stop" README.md docs/METHODOLOGY.md docs/DATA_SOURCES.md docs/LIMITATIONS.md src
npm run build
```

Expected: no advice-language matches from new user-facing copy except legitimate words in unrelated technical contexts. Build passes.

Commit:

```bash
git add README.md docs/METHODOLOGY.md docs/DATA_SOURCES.md docs/LIMITATIONS.md
git commit -m "docs: describe horizon regime roadmap"
```

---

## PR 1 Final Verification

Run:

```bash
python -m pytest tests/python -v
npm run test
npm run build
python -m scripts.update_data
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
git status --short
```

Expected:

- Python tests pass.
- Vitest tests pass.
- TypeScript build passes.
- Static data workflow succeeds.
- `regime_snapshot.json` exists.
- No unrelated `.idea/` files are staged.

Manual browser checks after starting `npm run dev`:

- `/tactical` renders checklist, scores, VIX proxy chart, and confirmation matrix.
- `/regime-map` renders current quadrant, quadrant trail, yield decomposition, and confirmations.
- `/macro-climate` renders Macro Climate score and slow-cycle panels.
- `/rates` renders the decomposition chart.
- `/volatility` renders the VIX term-structure proxy.
- Mobile width does not overlap nav, charts, or checklist text.

---

## Later PR Acceptance Criteria

PR 2 options sentiment can start only when source terms are classified in `docs/DATA_SOURCES.md` and `source_registry.json`. If Cboe/OCC redistribution is not approved, the UI may show candidate/source-gap cards but must not fetch or score those series.

PR 3 MOVE/SKEW can start only after the same terms review. MOVE should be a Fragility input, not a Rates input only.

PR 4 long-term macro expansion should prioritize active public sources in this order: housing, SLOOS, PMIs, term premium, Treasury supply, valuation, earnings/ERP, consumer balance sheet.

PR 5 historical regime replay should be descriptive research only. It must label outputs as historical conditional summaries and must not present forecasts or trade recommendations.

---

## Self-Review

- Spec coverage: The plan covers the audit's main shift from factor pages to horizon-based decision views, including tactical weather, long-term climate, fragility overlay, TIPS x dollar quadrant, VIX proxy curve, yield decomposition, checklist, confirmation matrix, and compliance-gated source expansion.
- Scope: PR 1 is intentionally active-data-only. Put/call, SKEW, MOVE, VIX futures, valuation, PMIs/SLOOS, Treasury supply, and historical replay are later PRs.
- Source governance: Candidate and terms-review sources remain out of active scoring and fetching.
- Type consistency: `horizon`, `regime_role`, `preferred_chart`, `RegimeSnapshotFile`, direction states, and yield-driver labels are defined before route/component usage.
- Placeholder scan: No implementation step depends on unspecified inputs; later source families are explicitly gated by source review.
