# PR 3 Fragility Shock Risk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Fragility / Shock Risk experience with MOVE/SKEW source gates, bond-volatility readiness, tail-risk context, and mismatch warnings.

**Architecture:** Use active PR 1 regime data and PR 2 candidate-source infrastructure. MOVE and SKEW remain candidate-only unless source registry entries are explicitly promoted to `free_public` before this PR starts.

**Tech Stack:** Python derived JSON, React TypeScript, Recharts, pytest, Vitest/jsdom.

---

## File Structure

Create:

- `src/routes/FragilityShockRisk.tsx`: dedicated fragility route.
- `src/components/ShockRiskDashboard.tsx`: MOVE/SKEW/VIX/credit/liquidity summary.
- `src/components/MismatchWarningPanel.tsx`: conflict warnings such as real yields up + dollar up + credit widening.
- `src/components/TailRiskPanel.tsx`: SKEW/VIX candidate or active view.
- `tests/python/test_shock_risk.py`: shock-risk JSON and scoring tests.

Modify:

- `scripts/shared/catalog.py`: ensure `move_index` and `skew_index` candidate rows exist.
- `scripts/shared/source_registry.py`: add `ice_indices` provider gate if not already present.
- `scripts/transform/compute_regime_score.py`: build `shock_risk_snapshot.json` from active data and candidate statuses.
- `scripts/validate/validate_schema.py`: validate `shock_risk_snapshot.json`.
- `src/lib/types.ts`: add `ShockRiskSnapshotFile`.
- `src/lib/data.ts`: add `loadShockRiskSnapshot()`.
- `src/App.tsx` and `src/components/AppLayout.tsx`: add `/fragility`.
- `src/routes/TacticalTradingWeather.tsx`: add compact fragility overlay from shock snapshot.
- `src/components/data-components.test.tsx`, `src/routes/data-routes.test.tsx`: add tests.
- `docs/METHODOLOGY.md`, `docs/DATA_SOURCES.md`, `docs/LIMITATIONS.md`, `README.md`: document shock risk and source gates.

---

## Task 1: Add Shock-Risk Source Gates

**Files:**

- Modify: `scripts/shared/source_registry.py`
- Modify: `scripts/shared/catalog.py`
- Modify: `tests/python/test_tactical_candidate_sources.py`

- [ ] **Step 1: Add tests**

Extend candidate-source tests:

```python
def test_shock_risk_candidate_sources_are_gated():
    registry = source_registry_entries()
    entries = entries_by_id()

    assert registry["ice_indices"]["access_status"] == "terms_review_needed"
    assert entries["move_index"]["score_status"] == "candidate"
    assert entries["move_index"]["access_status"] == "terms_review_needed"
    assert entries["move_index"]["regime_role"] == ["bond_volatility"]

    assert entries["skew_index"]["score_status"] == "candidate"
    assert entries["skew_index"]["access_status"] == "terms_review_needed"
    assert "tail_risk" in entries["skew_index"]["regime_role"]
```

- [ ] **Step 2: Implement registry/catalog rows**

Add `ice_indices` to `source_registry_entries()`:

```python
"ice_indices": {
    "name": "ICE Data Indices",
    "base_url": "https://developer.ice.com/fixed-income-data-services/",
    "requires_secret": False,
    "access_status": "terms_review_needed",
    "terms_status": "review_needed",
    "update_cadence": "daily_market_data",
    "notes": "MOVE Index access and static redistribution require source review before active ingestion.",
},
```

Ensure catalog rows:

- `move_index`: provider `ice_indices`, category `volatility`, role `bond_volatility`, horizon `both`.
- `skew_index`: provider `cboe_options` or `terms_review`, category `volatility`, roles `tail_risk` and `volatility`, horizon `tactical`.

- [ ] **Step 3: Verify**

Run:

```bash
python -m pytest tests/python/test_tactical_candidate_sources.py tests/python/test_catalog.py -v
python -m scripts.update_data
```

Expected: PASS.

Commit:

```bash
git add scripts/shared/source_registry.py scripts/shared/catalog.py tests/python/test_tactical_candidate_sources.py public/data/catalog/source_registry.json public/data/catalog/series_catalog.json public/data/status/data_status.json
git commit -m "feat: add shock-risk source gates"
```

---

## Task 2: Generate Shock-Risk Snapshot

**Files:**

- Create: `tests/python/test_shock_risk.py`
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `scripts/validate/validate_schema.py`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Generate: `public/data/derived/shock_risk_snapshot.json`

- [ ] **Step 1: Write tests**

Create `tests/python/test_shock_risk.py`:

```python
from scripts.transform import compute_regime_score


def s(value, change_1m=0.0, percentile=50.0):
    return {
        "frequency": "daily",
        "summary": {
            "latest_date": "2026-05-06",
            "latest_value": value,
            "change_1m": change_1m,
            "percentile_252d": percentile,
        },
        "observations": [{"date": "2026-05-06", "value": value}],
    }


def test_shock_snapshot_flags_bond_vol_gap_and_active_mismatch():
    status = {
        "move_index": {"status": "terms_review_needed", "message": "Candidate source requires access or terms review before scoring."},
        "skew_index": {"status": "terms_review_needed", "message": "Candidate source requires access or terms review before scoring."},
    }
    snapshot = compute_regime_score.build_shock_risk_snapshot(
        {
            "vix": s(22, 4, 80),
            "vix_vix3m_ratio": s(1.08, 0.15, 85),
            "real_yield_10y": s(2.3, 0.25, 80),
            "broad_dollar": s(125, 2.0, 82),
            "high_yield_oas": s(4.2, 0.35, 75),
            "hy_minus_ig_oas": s(2.7, 0.25, 78),
            "net_liquidity": s(6000, -120, 35),
        },
        status,
        "2026-05-07T00:00:00Z",
    )

    assert snapshot["label"] == "Elevated shock risk"
    assert any(item["id"] == "move_index" and item["status"] == "terms_review_needed" for item in snapshot["source_gaps"])
    assert any(warning["id"] == "tightening_confirmation" for warning in snapshot["mismatch_warnings"])
```

- [ ] **Step 2: Implement builder**

Add `build_shock_risk_snapshot(series_by_id, status_by_id, generated_at)`:

```python
def build_shock_risk_snapshot(series_by_id: dict[str, dict[str, Any]], status_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    vix_score = _score_inverse_percentile_for_first(series_by_id, ["vix"])
    vix_curve_score = _score_inverse_percentile_for_first(series_by_id, ["vix_vix3m_ratio"])
    credit_score = _score_inverse_percentile_for_first(series_by_id, ["hy_minus_ig_oas", "high_yield_oas"])
    dollar_change = _summary_change(series_by_id, "broad_dollar") or 0.0
    real_yield_change = _summary_change(series_by_id, "real_yield_10y") or 0.0
    liquidity_change = _summary_change(series_by_id, "net_liquidity") or 0.0
    active_pressure = weighted_score(
        {
            "vix": vix_score or 0.0,
            "curve": vix_curve_score or 0.0,
            "credit": credit_score or 0.0,
            "dollar": clamp(-dollar_change * 15),
            "real_yield": clamp(-real_yield_change * 120),
            "liquidity": clamp(liquidity_change / 25),
        },
        {"vix": 0.2, "curve": 0.2, "credit": 0.25, "dollar": 0.1, "real_yield": 0.15, "liquidity": 0.1},
    )
```

Labels:

- `active_pressure <= -35`: `Elevated shock risk`
- `-35 < active_pressure < 20`: `Mixed shock risk`
- `active_pressure >= 20`: `Contained shock risk`

Source gaps include `move_index` and `skew_index` when status is not `ok`.

Mismatch warning `tightening_confirmation` fires when real yields, dollar, and credit spreads all rise over one month.

- [ ] **Step 3: Add loader and validation**

Add `ShockRiskSnapshotFile` to `src/lib/types.ts` and `loadShockRiskSnapshot()` to `src/lib/data.ts`. Add `shock_risk_snapshot.json` to schema required files once generated in `main()`.

- [ ] **Step 4: Verify**

Run:

```bash
python -m pytest tests/python/test_shock_risk.py -v
python -m scripts.update_data
python -m scripts.validate.validate_schema
```

Expected: PASS.

Commit:

```bash
git add scripts/transform/compute_regime_score.py scripts/validate/validate_schema.py src/lib/types.ts src/lib/data.ts tests/python/test_shock_risk.py public/data/derived/shock_risk_snapshot.json public/data/status/data_status.json
git commit -m "feat: derive shock-risk snapshot"
```

---

## Task 3: Add Fragility Route and Components

**Files:**

- Create: `src/routes/FragilityShockRisk.tsx`
- Create: `src/components/ShockRiskDashboard.tsx`
- Create: `src/components/MismatchWarningPanel.tsx`
- Create: `src/components/TailRiskPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/routes/TacticalTradingWeather.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write tests**

Add component tests for:

- shock risk label
- MOVE source gap
- SKEW source gap
- tightening mismatch warning

Add route test:

```tsx
it("renders fragility shock risk route", async () => {
  mockStaticFetch(routeFetchFiles({
    "/data/derived/shock_risk_snapshot.json": shockRiskSnapshot
  }));

  const container = render(
    <MemoryRouter initialEntries={["/fragility"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Fragility / Shock Risk");
  expect(container.textContent).toContain("MOVE");
  expect(container.textContent).toContain("SKEW");
  expect(container.textContent).toContain("Mismatch warnings");
});
```

- [ ] **Step 2: Implement UI**

`FragilityShockRisk.tsx` loads:

- `loadScoreSummary()`
- `loadRegimeSnapshot()`
- `loadShockRiskSnapshot()`
- `loadDataStatus()`
- `loadCatalog()`

Render:

- Fragility score card.
- `ShockRiskDashboard`.
- `TailRiskPanel`.
- `MismatchWarningPanel`.
- Data gap panel filtered to `move_index`, `skew_index`, `vix`, `vix_vix3m_ratio`, `hy_minus_ig_oas`, `broad_dollar`, `real_yield_10y`, `net_liquidity`.

- [ ] **Step 3: Verify**

Run:

```bash
npm run test -- src/components/data-components.test.tsx src/routes/data-routes.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/routes/FragilityShockRisk.tsx src/components/ShockRiskDashboard.tsx src/components/MismatchWarningPanel.tsx src/components/TailRiskPanel.tsx src/App.tsx src/components/AppLayout.tsx src/routes/TacticalTradingWeather.tsx src/components/data-components.test.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: add fragility shock-risk route"
```

---

## Task 4: Document Shock Risk

**Files:**

- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `README.md`

- [ ] **Step 1: Document interpretation**

Add definitions:

- MOVE high + VIX low means bond-volatility pressure is not necessarily visible in equity volatility.
- SKEW is a tail-risk candidate, not a replacement for VIX.
- Mismatch warnings are descriptive conflicts between active inputs.
- Candidate MOVE/SKEW rows do not affect active scores before source review.

- [ ] **Step 2: Verify docs**

Run:

```bash
rg -n "buy|sell|short|entry|target|stop loss|recommendation" README.md docs src
npm run build
```

Expected: no new advice-language matches from this PR.

Commit:

```bash
git add docs/METHODOLOGY.md docs/DATA_SOURCES.md docs/LIMITATIONS.md README.md
git commit -m "docs: explain shock-risk source gates"
```

---

## Final Verification

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

Expected: all tests pass; `/fragility` renders; MOVE/SKEW are visible as gated unless reviewed active sources exist.

