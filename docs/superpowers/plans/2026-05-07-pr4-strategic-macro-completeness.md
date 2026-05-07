# PR 4 Strategic Macro Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen Long-Term Macro Climate with active public housing and consumer-cycle data while documenting source gates for valuation, term premium, Treasury supply, PMIs, and SLOOS.

**Architecture:** Add only no-secret FRED graph CSV series as active PR 4 data. Keep PMIs, SLOOS, term premium, valuation, earnings, and Treasury supply as candidate rows unless a source-governance PR promotes a specific endpoint to `free_public`.

**Tech Stack:** Existing FRED ingestion path, Python scoring, React routes/components, pytest, Vitest/jsdom.

---

## Active PR 4 Series

Add these FRED series as active public inputs:

| Series id | FRED id | Role |
| --- | --- | --- |
| `housing_starts` | `HOUST` | Housing cycle |
| `building_permits` | `PERMIT` | Housing leading indicator |
| `mortgage_rate_30y` | `MORTGAGE30US` | Housing/rates channel |
| `household_debt_service_ratio` | `TDSP` | Consumer balance sheet |
| `consumer_debt_service_ratio` | `CDSP` | Consumer balance sheet |
| `credit_card_delinquency_rate` | `DRCCLACBS` | Consumer credit stress |

Candidate-only PR 4 rows:

- `ism_manufacturing_pmi`
- `ism_services_pmi`
- `sloos_lending_standards`
- `term_premium_acm_10y`
- `treasury_net_issuance`
- `treasury_auction_tail`
- `treasury_bid_to_cover`
- `cape_ratio`
- `forward_pe`
- `equity_risk_premium`
- `earnings_revision_breadth`

---

## Task 1: Add Active Housing and Consumer Catalog Rows

**Files:**

- Modify: `scripts/shared/catalog.py`
- Modify: `tests/python/test_catalog.py`
- Regenerate: `public/data/catalog/series_catalog.json`

- [ ] **Step 1: Write tests**

Add to `tests/python/test_catalog.py`:

```python
def test_catalog_entries_include_phase4_active_macro_series():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}
    expected = {
        "housing_starts": "HOUST",
        "building_permits": "PERMIT",
        "mortgage_rate_30y": "MORTGAGE30US",
        "household_debt_service_ratio": "TDSP",
        "consumer_debt_service_ratio": "CDSP",
        "credit_card_delinquency_rate": "DRCCLACBS",
    }

    for series_id, fred_id in expected.items():
        entry = entries[series_id]
        assert entry["provider_id"] == "fred"
        assert entry["score_status"] == "active"
        assert entry["endpoint_url"].endswith(fred_id)
        assert entry["horizon"] == "strategic"
```

- [ ] **Step 2: Run failing test**

Run:

```bash
python -m pytest tests/python/test_catalog.py::test_catalog_entries_include_phase4_active_macro_series -v
```

Expected: FAIL because rows do not exist.

- [ ] **Step 3: Add FRED rows**

In `scripts/shared/catalog.py`, add rows to `FRED_SERIES`:

```python
{
    "id": "housing_starts",
    "fred_id": "HOUST",
    "name": "Housing Starts",
    "category": "housing",
    "frequency": "monthly",
    "units": "thousands",
    "higher_is": "supportive",
    "max_stale_days": 45,
    "notes": "Monthly privately owned housing starts from FRED graph CSV.",
},
{
    "id": "building_permits",
    "fred_id": "PERMIT",
    "name": "Building Permits",
    "category": "housing",
    "frequency": "monthly",
    "units": "thousands",
    "higher_is": "supportive",
    "max_stale_days": 45,
    "notes": "Monthly new private housing units authorized by building permits from FRED graph CSV.",
},
{
    "id": "mortgage_rate_30y",
    "fred_id": "MORTGAGE30US",
    "name": "30-Year Fixed Rate Mortgage Average",
    "category": "rates",
    "frequency": "weekly",
    "units": "percent",
    "higher_is": "riskier",
    "max_stale_days": 14,
    "notes": "Weekly 30-year fixed mortgage rate from FRED graph CSV.",
},
{
    "id": "household_debt_service_ratio",
    "fred_id": "TDSP",
    "name": "Household Debt Service Payments as Percent of Disposable Personal Income",
    "category": "credit",
    "frequency": "quarterly",
    "units": "percent",
    "higher_is": "riskier",
    "max_stale_days": 120,
    "notes": "Quarterly household debt service ratio from FRED graph CSV.",
},
{
    "id": "consumer_debt_service_ratio",
    "fred_id": "CDSP",
    "name": "Consumer Debt Service Payments as Percent of Disposable Personal Income",
    "category": "credit",
    "frequency": "quarterly",
    "units": "percent",
    "higher_is": "riskier",
    "max_stale_days": 120,
    "notes": "Quarterly consumer debt service ratio from FRED graph CSV.",
},
{
    "id": "credit_card_delinquency_rate",
    "fred_id": "DRCCLACBS",
    "name": "Delinquency Rate on Credit Card Loans",
    "category": "credit",
    "frequency": "quarterly",
    "units": "percent",
    "higher_is": "riskier",
    "max_stale_days": 120,
    "notes": "Quarterly credit-card delinquency rate at all commercial banks from FRED graph CSV.",
},
```

Also add `"housing"` to TypeScript `SeriesCategory` in Task 3.

- [ ] **Step 4: Verify**

Run:

```bash
python -m scripts.update_data
python -m pytest tests/python/test_catalog.py tests/python/test_fetchers.py -v
python -m scripts.validate.validate_schema
```

Expected: PASS and series JSON files exist.

Commit:

```bash
git add scripts/shared/catalog.py tests/python/test_catalog.py public/data/catalog/series_catalog.json public/data/series/housing_starts.json public/data/series/building_permits.json public/data/series/mortgage_rate_30y.json public/data/series/household_debt_service_ratio.json public/data/series/consumer_debt_service_ratio.json public/data/series/credit_card_delinquency_rate.json public/data/status/data_status.json
git commit -m "feat: add strategic housing and consumer data"
```

---

## Task 2: Add Macro Completeness Scoring

**Files:**

- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `tests/python/test_scoring.py`
- Generate: `public/data/derived/score_summary.json`

- [ ] **Step 1: Write scoring tests**

Add tests:

```python
def test_macro_climate_scores_include_housing_and_consumer_balance_sheet():
    series = {
        "housing_starts": {"summary": {"percentile_252d": 70}},
        "building_permits": {"summary": {"percentile_252d": 65}},
        "mortgage_rate_30y": {"summary": {"percentile_252d": 80}},
        "household_debt_service_ratio": {"summary": {"percentile_252d": 70}},
        "consumer_debt_service_ratio": {"summary": {"percentile_252d": 65}},
        "credit_card_delinquency_rate": {"summary": {"percentile_252d": 75}},
    }

    housing = compute_regime_score._score_housing(series)
    consumer = compute_regime_score._score_consumer_balance_sheet(series)

    assert housing < 40
    assert consumer < 0
```

- [ ] **Step 2: Implement helpers**

Add:

```python
def _score_housing(series_by_id: dict[str, dict[str, Any]]) -> float:
    activity = _score_percentile_average(series_by_id, ["housing_starts", "building_permits"], inverse=False)
    mortgage_pressure = _score_percentile_average(series_by_id, ["mortgage_rate_30y"], inverse=True)
    return _score_average([activity, mortgage_pressure]) or 0.0


def _score_consumer_balance_sheet(series_by_id: dict[str, dict[str, Any]]) -> float:
    return _score_percentile_average(
        series_by_id,
        ["household_debt_service_ratio", "consumer_debt_service_ratio", "credit_card_delinquency_rate"],
        inverse=True,
    ) or 0.0
```

Add `housing` and `consumer_balance_sheet` to `MACRO_WEIGHTS`, `MACRO_COVERAGE_GROUPS`, `_macro_climate_scores`, and `_macro_climate_drivers`. Rebalance macro weights:

```python
MACRO_WEIGHTS = {
    "growth": 0.18,
    "labor": 0.18,
    "inflation": 0.16,
    "consumer_production": 0.16,
    "real_yields": 0.10,
    "housing": 0.12,
    "consumer_balance_sheet": 0.10,
}
```

- [ ] **Step 3: Verify**

Run:

```bash
python -m pytest tests/python/test_scoring.py -v
python -m scripts.update_data
python -m scripts.validate.validate_schema
```

Expected: PASS.

Commit:

```bash
git add scripts/transform/compute_regime_score.py tests/python/test_scoring.py public/data/derived/score_summary.json public/data/derived/bucket_scores.json public/data/derived/regime_score.json
git commit -m "feat: add macro housing and consumer scoring"
```

---

## Task 3: Add Strategic Macro UI

**Files:**

- Create: `src/routes/Housing.tsx`
- Create: `src/components/MacroCyclePanel.tsx`
- Modify: `src/routes/LongTermMacroClimate.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/lib/types.ts`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add TypeScript category**

In `src/lib/types.ts`, add `"housing"` to `SeriesCategory`.

- [ ] **Step 2: Write tests**

Route tests:

- `/macro-climate` contains "Housing cycle" and "Consumer balance sheet".
- `/housing` contains "Housing", "Housing Starts", "Building Permits", and "30-Year Fixed Rate Mortgage".

Component test:

- `MacroCyclePanel` renders a score, support list, risk list, and source caveat text.

- [ ] **Step 3: Implement UI**

`Housing.tsx` loads:

- `housing_starts`
- `building_permits`
- `mortgage_rate_30y`
- `DataStatusTable`
- `TimeSeriesChart` for `housing_starts`

`LongTermMacroClimate.tsx` adds panels:

- Growth cycle
- Labor cycle
- Inflation trend
- Housing cycle
- Consumer balance sheet
- Credit cycle
- Liquidity cycle
- Real-rate valuation pressure

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- src/components/data-components.test.tsx src/routes/data-routes.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/routes/Housing.tsx src/components/MacroCyclePanel.tsx src/routes/LongTermMacroClimate.tsx src/App.tsx src/components/AppLayout.tsx src/lib/types.ts src/routes/data-routes.test.tsx src/components/data-components.test.tsx src/styles.css
git commit -m "feat: expand long-term macro climate UI"
```

---

## Task 4: Add Candidate Strategic Source Gates

**Files:**

- Modify: `scripts/shared/catalog.py`
- Modify: `tests/python/test_tactical_candidate_sources.py`
- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/LIMITATIONS.md`

- [ ] **Step 1: Add candidate tests**

Assert candidate rows exist for:

- `ism_services_pmi`
- `sloos_lending_standards`
- `term_premium_acm_10y`
- `treasury_net_issuance`
- `treasury_auction_tail`
- `treasury_bid_to_cover`
- `cape_ratio`
- `forward_pe`
- `equity_risk_premium`
- `earnings_revision_breadth`

Each must have `score_status == "candidate"`.

- [ ] **Step 2: Add rows**

Use `candidate_row()` from PR 2. Set:

- PMIs and SLOOS: `category: "growth"` or `"credit"`, `horizon: "strategic"`.
- Term premium/Treasury supply: `category: "rates"`, `horizon: "strategic"`.
- Valuation/earnings: `category: "sentiment"` or a new `"valuation"` category if added to TypeScript and tests.

- [ ] **Step 3: Verify**

Run:

```bash
python -m pytest tests/python/test_tactical_candidate_sources.py tests/python/test_catalog.py -v
python -m scripts.update_data
python -m scripts.validate.validate_schema
```

Expected: PASS.

Commit:

```bash
git add scripts/shared/catalog.py tests/python/test_tactical_candidate_sources.py docs/DATA_SOURCES.md docs/METHODOLOGY.md docs/LIMITATIONS.md public/data/catalog/series_catalog.json public/data/status/data_status.json
git commit -m "feat: add strategic candidate source gates"
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

Expected: all tests pass; active FRED housing/consumer data appear; candidate strategic rows are visible but inactive.
