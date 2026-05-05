# Phase 4 PR 2 Macro Completeness Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first missing macro pillar with active Housing data, add a static macro event calendar, and scaffold Consumer/Fiscal/Treasury supply as candidate-only follow-up work without expanding the PR into the full Phase 4 wishlist.

**Architecture:** Keep the GitHub Pages static-data architecture. Python scripts continue to generate JSON under `public/data`; React routes consume static JSON via `src/lib/data.ts`. PR 2 adds one active data family (`housing`) and one generated descriptive event file, while candidate Consumer/Fiscal/Treasury rows remain non-scoring governance metadata.

**Tech Stack:** Python data scripts and pytest; React 19, TypeScript, React Router, Recharts, Vitest/jsdom; static JSON under `public/data`.

---

## Scope Guardrails

Implement exactly this PR scope:

- Active Housing inputs from existing FRED graph CSV ingestion:
  - `housing_starts` from FRED `HOUST`
  - `building_permits` from FRED `PERMIT`
  - `mortgage_rate_30y` from FRED `MORTGAGE30US`
- Housing bucket in Macro Climate scoring.
- `/housing` route with existing route UI patterns.
- Static event calendar generated to `public/data/events/macro_calendar.json`.
- `/calendar` route with descriptive event-risk context.
- Candidate-only catalog/docs scaffolding for Consumer Balance Sheet and Fiscal/Treasury Supply.

Approved PR 2 scope adjustment: the Phase 4 design originally staged Event Calendar work for PR 3, but the user explicitly approved moving a narrow static, source-linked calendar into PR 2. Keep that calendar descriptive and source-linked only; do not add live date scraping, alerting, notifications, or trading signals.

Do not implement in PR 2:

- Full Consumer route.
- Full Fiscal/Treasury route.
- SLOOS, PMIs, valuation, internals, survey sentiment, Treasury volatility, term premium.
- Macro Regime Matrix, conflicting-signal detector, driver waterfall, Data Health route.
- Backend, database, browser-side provider calls, API keys, or live feeds.
- Any changes to `.idea/` or unrelated local files.

Official source context for implementation and docs:

- FRED housing series: `https://fred.stlouisfed.org/series/HOUST`, `https://fred.stlouisfed.org/series/PERMIT`, `https://fred.stlouisfed.org/series/MORTGAGE30US`
- Census New Residential Construction: `https://www.census.gov/construction/nrc/`
- Census API time series docs: `https://api.census.gov/data/timeseries/eits.html`
- BLS release schedule: `https://www.bls.gov/schedule/news_release/current_year.asp`
- BEA release schedule: `https://www.bea.gov/news/schedule/`
- Federal Reserve FOMC calendars: `https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm`
- Treasury auction timing: `https://www.treasuryauctions.gov/auctions/when-auctions-happen/`
- Treasury receipts/outlays: `https://home.treasury.gov/data/receipts-outlays`
- FiscalData Monthly Treasury Statement: `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/`
- Federal Reserve G.19 Consumer Credit: `https://www.federalreserve.gov/releases/g19/current/`

---

## File Structure And Ownership

Create:

- `src/routes/Housing.tsx`: Housing route.
- `src/routes/Calendar.tsx`: Macro calendar route.
- `scripts/generate_macro_calendar.py`: writes static event calendar JSON.
- `public/data/events/macro_calendar.json`: generated descriptive calendar data.

Modify:

- `scripts/shared/catalog.py`: active housing FRED series and candidate Consumer/Fiscal/Treasury rows.
- `scripts/transform/compute_regime_score.py`: Housing macro bucket, weights, coverage, drivers, PR 2 method/version notes.
- `scripts/update_data.py`: run the calendar generator in the local/GitHub Actions update workflow.
- `scripts/validate/validate_schema.py`: require and validate `public/data/events/macro_calendar.json`.
- `tests/python/test_catalog.py`: active housing and candidate scaffolding tests.
- `tests/python/test_scoring.py`: Housing scoring/confidence/schema/calendar validation tests.
- `tests/python/test_safe_update.py`: update runner module list includes calendar generation before schema validation.
- `src/lib/types.ts`: add `housing` category and event calendar types.
- `src/lib/data.ts`: add `loadMacroCalendar`.
- `src/App.tsx`: add `/housing` and `/calendar`.
- `src/components/AppLayout.tsx`: add nav items.
- `src/routes/data-routes.test.tsx`: Housing and Calendar route tests/fixtures.
- `src/styles.css`: minimal route/calendar styles following existing panels.
- `README.md`, `docs/DATA_SOURCES.md`, `docs/METHODOLOGY.md`, `docs/LIMITATIONS.md`: document PR 2 behavior and boundaries.

Regenerate:

- `public/data/catalog/series_catalog.json`
- `public/data/catalog/source_registry.json`
- `public/data/series/housing_starts.json`
- `public/data/series/building_permits.json`
- `public/data/series/mortgage_rate_30y.json`
- `public/data/derived/bucket_scores.json`
- `public/data/derived/regime_score.json`
- `public/data/derived/score_summary.json`
- `public/data/status/data_status.json`
- `public/data/events/macro_calendar.json`

Recommended branch:

```bash
git checkout main
git pull --ff-only
git switch -c codex/phase-4-pr2-macro-completeness-foundation
```

---

## Chunk 1: Housing Catalog And Generated Series

### Task 1: Add Active Housing FRED Series

**Files:**
- Modify: `scripts/shared/catalog.py`
- Modify: `tests/python/test_catalog.py`

- [ ] **Step 1: Write failing catalog tests**

Add tests similar to existing Phase 3 catalog tests:

```python
def test_phase4_catalog_contains_active_housing_sources():
    entries = {entry["id"]: entry for entry in catalog.catalog_entries()}
    expected_sources = {
        "housing_starts": "HOUST",
        "building_permits": "PERMIT",
        "mortgage_rate_30y": "MORTGAGE30US",
    }

    for series_id, fred_id in expected_sources.items():
        entry = entries[series_id]
        assert entry["category"] == "housing"
        assert entry["source"] == "FRED"
        assert entry["source_url"] == f"https://fred.stlouisfed.org/series/{fred_id}"
        assert entry["endpoint_url"] == f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}"
        assert entry["public"] is True
        assert entry["score_status"] == "active"
        assert entry["access_status"] == "free_public"
        assert entry["terms_status"] == "review_each_series"
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
. .venv/bin/activate && python -m pytest tests/python/test_catalog.py::test_phase4_catalog_contains_active_housing_sources -v
```

Expected: FAIL because the housing entries do not exist.

- [ ] **Step 3: Add housing entries to `FRED_SERIES`**

Add entries near the growth/labor macro data in `scripts/shared/catalog.py`:

```python
{
    "id": "housing_starts",
    "fred_id": "HOUST",
    "name": "Housing Starts",
    "category": "housing",
    "frequency": "monthly",
    "units": "thousands_saar",
    "higher_is": "supportive",
    "max_stale_days": 45,
    "notes": "Monthly privately-owned housing starts from FRED graph CSV; Census New Residential Construction is the primary source context.",
},
{
    "id": "building_permits",
    "fred_id": "PERMIT",
    "name": "Building Permits",
    "category": "housing",
    "frequency": "monthly",
    "units": "thousands_saar",
    "higher_is": "supportive",
    "max_stale_days": 45,
    "notes": "Monthly privately-owned housing units authorized by building permits from FRED graph CSV; Census New Residential Construction is the primary source context.",
},
{
    "id": "mortgage_rate_30y",
    "fred_id": "MORTGAGE30US",
    "name": "30-Year Fixed Mortgage Rate",
    "category": "housing",
    "frequency": "weekly",
    "units": "percent",
    "higher_is": "riskier",
    "max_stale_days": 14,
    "notes": "Weekly 30-year fixed mortgage rate from FRED graph CSV.",
},
```

- [ ] **Step 4: Update frontend category type**

Modify `src/lib/types.ts` so `SeriesCategory` includes:

```ts
| "housing"
```

- [ ] **Step 5: Run catalog/type-focused tests**

Run:

```bash
. .venv/bin/activate && python -m pytest tests/python/test_catalog.py -v
npm test -- src/routes/data-routes.test.tsx
```

Expected: Python tests pass after catalog change. TypeScript route tests may still fail until route fixtures include housing; note failures and continue to the UI task.

- [ ] **Step 6: Commit**

```bash
git add scripts/shared/catalog.py src/lib/types.ts tests/python/test_catalog.py
git commit -m "feat: add active housing catalog inputs"
```

### Task 2: Generate Housing Series Data

**Files:**
- Generated: `public/data/series/housing_starts.json`
- Generated: `public/data/series/building_permits.json`
- Generated: `public/data/series/mortgage_rate_30y.json`
- Generated: `public/data/catalog/series_catalog.json`
- Generated: `public/data/catalog/source_registry.json`

- [ ] **Step 1: Run housing source generation**

Run the source/normalization/enrichment steps only. Do not run `scripts.update_data` in this task, because Macro Climate scoring does not include Housing until Task 3.

```bash
. .venv/bin/activate && python -m scripts.ingest.fetch_fred_csv
. .venv/bin/activate && python -m scripts.transform.normalize_series
. .venv/bin/activate && python -m scripts.transform.compute_percentiles
```

Expected: each command exits 0 and writes/enriches the three housing series files.

- [ ] **Step 2: Inspect generated files**

Run:

```bash
jq '{id: .series_id, source, frequency, latest: .summary.latest_date, value: .summary.latest_value}' public/data/series/housing_starts.json
jq '{id: .series_id, source, frequency, latest: .summary.latest_date, value: .summary.latest_value}' public/data/series/building_permits.json
jq '{id: .series_id, source, frequency, latest: .summary.latest_date, value: .summary.latest_value}' public/data/series/mortgage_rate_30y.json
```

Expected: each file has observations, a summary, and matching `series_id`.

- [ ] **Step 3: Run schema validation**

```bash
. .venv/bin/activate && python -m scripts.validate.validate_schema
```

Expected: exits 0. Freshness validation is run after Task 3 regenerates `data_status.json` with Housing status rows.

- [ ] **Step 4: Commit generated data**

```bash
git add public/data/catalog public/data/series/housing_starts.json public/data/series/building_permits.json public/data/series/mortgage_rate_30y.json
git commit -m "data: generate housing macro inputs"
```

---

## Chunk 2: Housing Macro Climate Scoring

### Task 3: Add Housing Bucket To Macro Climate

**Files:**
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `tests/python/test_scoring.py`
- Generated later: `public/data/derived/score_summary.json`, `public/data/derived/bucket_scores.json`, `public/data/status/data_status.json`

- [ ] **Step 1: Write failing scoring tests**

Add tests for bucket presence, driver text, and the removal of the old Housing-not-active confidence penalty:

```python
def test_macro_climate_includes_active_housing_bucket():
    series = {
        "housing_starts": _summary(percentile_252d=80.0),
        "building_permits": _summary(percentile_252d=70.0),
        "mortgage_rate_30y": _summary(percentile_252d=20.0),
        "cfnai": _summary(percentile_252d=50.0),
        "cfnai_3m_avg": _summary(percentile_252d=50.0),
        "nonfarm_payrolls": _summary(percentile_252d=50.0),
        "unemployment_rate": _summary(percentile_252d=50.0),
        "initial_claims": _summary(percentile_252d=50.0),
        "sahm_rule": _summary(percentile_252d=50.0),
        "headline_cpi": _summary(percentile_252d=50.0),
        "core_cpi": _summary(percentile_252d=50.0),
        "core_pce": _summary(percentile_252d=50.0),
        "ppi_final_demand": _summary(percentile_252d=50.0),
        "real_retail_sales": _summary(percentile_252d=50.0),
        "industrial_production": _summary(percentile_252d=50.0),
        "durable_goods_orders": _summary(percentile_252d=50.0),
        "real_yield_10y": _summary(percentile_252d=50.0),
    }

    summary = compute_regime_score.build_score_summary(series, "2026-05-05T00:00:00Z")
    macro = summary["scores"]["macro_climate"]

    assert "housing" in macro["bucket_scores"]
    assert macro["bucket_weights"]["housing"] == 0.15
    assert macro["bucket_scores"]["housing"] > 0
    assert "Housing activity and rate sensitivity are supportive." in macro["top_supports"]
    assert "Housing is not active" not in " ".join(macro["missing_or_stale_notes"])
```

Add a second test for missing housing:

```python
def test_missing_housing_lowers_macro_confidence_with_pr2_note():
    series = {
        "cfnai": _summary(percentile_252d=50.0),
        "cfnai_3m_avg": _summary(percentile_252d=50.0),
    }

    summary = compute_regime_score.build_score_summary(series, "2026-05-05T00:00:00Z")
    macro = summary["scores"]["macro_climate"]

    assert any("housing" in note.lower() for note in macro["missing_or_stale_notes"])
    assert macro["confidence_breakdown"]["coverage_confidence"] < 1.0
```

- [ ] **Step 2: Run tests to verify failure**

```bash
. .venv/bin/activate && python -m pytest tests/python/test_scoring.py -k "housing or macro_climate" -v
```

Expected: FAIL because the housing bucket is not implemented.

Also update existing scoring assertions that still expect:

- `method_version == "phase3-three-score-v1"`
- `"Housing is not active in Phase 4 PR 1."`

Those assertions should now expect `phase4-pr2-macro-completeness-v1` and should not require the old PR 1 Housing penalty.

- [ ] **Step 3: Update scoring constants**

In `scripts/transform/compute_regime_score.py`:

```python
METHOD_VERSION = "phase4-pr2-macro-completeness-v1"
MACRO_WEIGHTS = {
    "growth": 0.20,
    "labor": 0.20,
    "inflation": 0.18,
    "consumer_production": 0.17,
    "housing": 0.15,
    "real_yields": 0.10,
}
MACRO_COVERAGE_GROUPS = {
    "growth": ["cfnai", "cfnai_3m_avg"],
    "labor": ["nonfarm_payrolls", "unemployment_rate", "initial_claims", "sahm_rule"],
    "inflation": ["headline_cpi", "core_cpi", "core_pce", "ppi_final_demand"],
    "consumer/production": ["real_retail_sales", "industrial_production", "durable_goods_orders"],
    "housing": ["housing_starts", "building_permits", "mortgage_rate_30y"],
    "real_yields": ["real_yield_10y"],
}
```

- [ ] **Step 4: Add housing score helper**

Add a helper near `_macro_climate_scores`:

```python
def _score_housing(series_by_id: dict[str, dict[str, Any]]) -> float:
    return _score_average([
        _score_percentile_average(series_by_id, ["housing_starts", "building_permits"], inverse=False),
        _score_percentile_average(series_by_id, ["mortgage_rate_30y"], inverse=True),
    ]) or 0.0
```

Then add `"housing": _score_housing(series_by_id)` to `_macro_climate_scores`.

- [ ] **Step 5: Add housing driver**

Do not add Housing to the existing tuple loop, because that loop cannot represent mixed-direction inputs cleanly. Add an explicit Housing block before or after the loop:

```python
housing_series_id, housing_summary = _summary_for_first(
    series_by_id,
    ["housing_starts", "building_permits", "mortgage_rate_30y"],
)
_append_driver_for_score(
    drivers,
    "housing",
    _score_housing(series_by_id),
    housing_series_id,
    housing_summary,
    "Housing activity and rate sensitivity are supportive.",
    "Housing activity or mortgage-rate pressure is restrictive.",
)
```

- [ ] **Step 6: Remove PR 1 hard-coded housing penalty**

Delete this line from `build_score_summary`:

```python
macro_notes.append("Housing is not active in Phase 4 PR 1.")
```

Rely on `MACRO_COVERAGE_GROUPS` to report missing Housing when the active series are absent.

- [ ] **Step 7: Run scoring tests**

```bash
. .venv/bin/activate && python -m pytest tests/python/test_scoring.py -k "housing or macro_climate or score_summary" -v
```

Expected: pass.

- [ ] **Step 8: Regenerate derived data**

```bash
. .venv/bin/activate && python -m scripts.transform.compute_regime_score
```

Inspect:

```bash
jq '.scores.macro_climate.bucket_scores.housing, .scores.macro_climate.bucket_weights.housing, .data_quality.reasons' public/data/derived/score_summary.json
```

Expected: housing bucket/weight exists and `Housing is not active in Phase 4 PR 1` is absent.

- [ ] **Step 9: Commit**

```bash
git add scripts/transform/compute_regime_score.py tests/python/test_scoring.py public/data/derived public/data/status
git commit -m "feat: add housing to macro climate scoring"
```

---

## Chunk 3: Housing Route

### Task 4: Add `/housing` Route

**Files:**
- Create: `src/routes/Housing.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css` only if existing panel styles are insufficient.

- [ ] **Step 1: Write failing route test**

In `src/routes/data-routes.test.tsx`, add the Housing IDs to the existing `seriesFiles([...])` fixture list inside `routeFetchFiles()`:

```ts
"housing_starts",
"building_permits",
"mortgage_rate_30y",
```

Add catalog entries:

```ts
catalogEntry("housing_starts", "housing", "Housing Starts", "thousands_saar", "monthly"),
catalogEntry("building_permits", "housing", "Building Permits", "thousands_saar", "monthly"),
catalogEntry("mortgage_rate_30y", "housing", "30-Year Fixed Mortgage Rate", "percent", "weekly"),
```

Add a route test:

```ts
it("renders housing route with active housing data", async () => {
  mockStaticFetch(routeFetchFiles());
  const container = render(
    <MemoryRouter initialEntries={["/housing"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Housing");

  expect(container.textContent).toContain("Housing Starts");
  expect(container.textContent).toContain("Building Permits");
  expect(container.textContent).toContain("30-Year Fixed Mortgage Rate");
  expect(container.textContent).toContain("mortgage-rate sensitivity");
});
```

Ensure the route fixture `status` object includes rows for `housing_starts`, `building_permits`, and `mortgage_rate_30y`, so `DataGapPanel` and `DataStatusTable` render the same status path as production.

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- src/routes/data-routes.test.tsx -t "housing route"
```

Expected: FAIL because `/housing` route does not exist.

- [ ] **Step 3: Create `src/routes/Housing.tsx`**

Follow the existing route pattern from `Growth.tsx`:

```tsx
import { useEffect, useState } from "react";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { hasObservations, loadRouteSeries } from "./routeSeries";

const housingSeriesIds = ["housing_starts", "building_permits", "mortgage_rate_30y"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  housingSeries: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Housing() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadHousing() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const housingSeries = await loadRouteSeries(housingSeriesIds, catalog, status);
        if (active) setData({ catalog, housingSeries, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load housing data.");
      }
    }

    void loadHousing();

    return () => {
      active = false;
    };
  }, []);

  const starts = data?.housingSeries.find((series) => series.series_id === "housing_starts");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Housing</p>
        <h2>Housing</h2>
        <p>Construction activity, permits, and mortgage-rate sensitivity.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <InterpretationPanel
            label="Housing read"
            notes={["Housing starts and permits are monthly and can lag release schedules; mortgage rates update weekly."]}
            risks={["Falling starts or permits, or elevated mortgage rates, can signal rate-constrained housing."]}
            summary="Housing adds a rate-sensitive macro pillar to the Macro Climate score."
            supports={["Firm starts and permits, especially with easing mortgage rates, support the macro climate backdrop."]}
          />
          <DataGapPanel status={data.status} seriesIds={housingSeriesIds} />
          <section className="metric-grid" aria-label="Housing metrics">
            {data.housingSeries.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {hasObservations(starts) ? (
            <TimeSeriesChart catalogEntry={data.catalog.find((entry) => entry.id === "housing_starts")} series={starts} />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "housing_starts")?.name ?? "housing_starts"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "housing_starts")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <DataStatusTable seriesIds={housingSeriesIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Wire route and nav**

In `src/App.tsx`, import and route:

```tsx
import Housing from "./routes/Housing";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/growth" element={<Growth />} />
        <Route path="/housing" element={<Housing />} />
      </Route>
    </Routes>
  );
}
```

Keep the existing routes in place; the snippet shows only where the new Housing import and route belong.

In `src/components/AppLayout.tsx`, insert after Growth:

```ts
{ to: "/housing", label: "Housing" },
```

- [ ] **Step 5: Run route tests**

```bash
npm test -- src/routes/data-routes.test.tsx -t "housing route"
npm test -- src/routes/data-routes.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/Housing.tsx src/App.tsx src/components/AppLayout.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: add housing route"
```

---

## Chunk 4: Static Macro Calendar Data Contract

### Task 5: Add Calendar Generator And Schema Validation

**Files:**
- Create: `scripts/generate_macro_calendar.py`
- Create: `public/data/events/macro_calendar.json`
- Modify: `scripts/update_data.py`
- Modify: `scripts/validate/validate_schema.py`
- Modify: `tests/python/test_scoring.py`
- Modify: `tests/python/test_safe_update.py`

- [ ] **Step 1: Write failing schema/generator tests**

In `tests/python/test_scoring.py`, add a schema validator test:

```python
def _valid_macro_calendar_payload():
    return {
        "generated_at_utc": "2026-05-05T00:00:00Z",
        "method_version": "phase4-pr2-static-event-calendar-v1",
        "events": [
            {
                "id": "cpi-2026-05",
                "title": "Consumer Price Index",
                "category": "inflation",
                "importance": "high",
                "date": "2026-05-12",
                "time": "08:30",
                "timezone": "America/New_York",
                "source": "BLS",
                "source_url": "https://www.bls.gov/schedule/news_release/cpi.htm",
                "notes": "Official release schedule.",
                "status": "scheduled",
            }
        ],
    }


def test_validate_macro_calendar_file_requires_events(tmp_path, monkeypatch):
    events_dir = tmp_path / "events"
    events_dir.mkdir()
    (events_dir / "macro_calendar.json").write_text(
        json.dumps(_valid_macro_calendar_payload()),
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    validate_schema.validate_macro_calendar_file()


def test_validate_macro_calendar_file_rejects_missing_method_version(tmp_path, monkeypatch):
    events_dir = tmp_path / "events"
    events_dir.mkdir()
    payload = _valid_macro_calendar_payload()
    payload.pop("method_version")
    (events_dir / "macro_calendar.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="method_version must be a string"):
        validate_schema.validate_macro_calendar_file()


def test_validate_macro_calendar_file_rejects_invalid_importance(tmp_path, monkeypatch):
    events_dir = tmp_path / "events"
    events_dir.mkdir()
    payload = _valid_macro_calendar_payload()
    payload["events"][0]["importance"] = "urgent"
    (events_dir / "macro_calendar.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="importance is invalid"):
        validate_schema.validate_macro_calendar_file()


def test_validate_macro_calendar_file_rejects_duplicate_ids(tmp_path, monkeypatch):
    events_dir = tmp_path / "events"
    events_dir.mkdir()
    payload = _valid_macro_calendar_payload()
    payload["events"].append(dict(payload["events"][0]))
    (events_dir / "macro_calendar.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="duplicate event id"):
        validate_schema.validate_macro_calendar_file()
```

In `tests/python/test_safe_update.py`, add a generator-order test:

```python
def test_update_runner_generates_macro_calendar_before_schema_validation():
    assert "scripts.generate_macro_calendar" in update_data.MODULES
    assert update_data.MODULES.index("scripts.generate_macro_calendar") < update_data.MODULES.index(
        "scripts.validate.validate_schema"
    )
```

In a new focused test file or `tests/python/test_scoring.py`, add a generator shape test:

```python
def test_generate_macro_calendar_emits_source_link_events():
    from scripts.generate_macro_calendar import generate_macro_calendar

    payload = generate_macro_calendar()

    assert payload["method_version"] == "phase4-pr2-static-event-calendar-v1"
    assert payload["events"]
    assert all(event["source_url"].startswith("https://") for event in payload["events"])
    assert {event["status"] for event in payload["events"]} <= {"scheduled", "source_link", "estimated"}
```

- [ ] **Step 2: Run test to verify failure**

```bash
. .venv/bin/activate && python -m pytest tests/python/test_scoring.py -k "macro_calendar" -v
```

Expected: FAIL because `validate_macro_calendar_file` does not exist.

- [ ] **Step 3: Implement calendar generator**

Create `scripts/generate_macro_calendar.py` with a deterministic curated static generator. Keep it simple in PR 2; do not scrape live calendars yet.

```python
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from scripts.shared.io import data_dir, write_json

EVENTS: list[dict[str, Any]] = [
    {
        "id": "cpi-monthly",
        "title": "Consumer Price Index",
        "category": "inflation",
        "importance": "high",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "source": "BLS",
        "source_url": "https://www.bls.gov/schedule/news_release/cpi.htm",
        "notes": "Use BLS schedule for exact dates; PR 2 records source and event-risk context.",
        "status": "source_link",
    },
    {
        "id": "ppi-monthly",
        "title": "Producer Price Index",
        "category": "inflation",
        "importance": "medium",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "source": "BLS",
        "source_url": "https://www.bls.gov/schedule/news_release/ppi.htm",
        "notes": "Use BLS schedule for exact dates.",
        "status": "source_link",
    },
    {
        "id": "payrolls-monthly",
        "title": "Employment Situation",
        "category": "growth",
        "importance": "high",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "source": "BLS",
        "source_url": "https://www.bls.gov/schedule/news_release/empsit.htm",
        "notes": "Payrolls, unemployment, and labor-force details.",
        "status": "source_link",
    },
    {
        "id": "pce-monthly",
        "title": "Personal Income and Outlays",
        "category": "inflation",
        "importance": "high",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "source": "BEA",
        "source_url": "https://www.bea.gov/news/schedule/",
        "notes": "Includes PCE inflation and income/spending data.",
        "status": "source_link",
    },
    {
        "id": "fomc-calendar",
        "title": "FOMC Meeting",
        "category": "rates",
        "importance": "high",
        "date": None,
        "time": "14:00",
        "timezone": "America/New_York",
        "source": "Federal Reserve",
        "source_url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
        "notes": "Use Federal Reserve calendar for exact meeting dates and statement times.",
        "status": "source_link",
    },
    {
        "id": "treasury-auctions",
        "title": "Treasury Auctions",
        "category": "rates",
        "importance": "medium",
        "date": None,
        "time": None,
        "timezone": "America/New_York",
        "source": "TreasuryDirect",
        "source_url": "https://www.treasuryauctions.gov/auctions/when-auctions-happen/",
        "notes": "Auction timing varies by bill, note, bond, FRN, and TIPS schedule.",
        "status": "source_link",
    },
    {
        "id": "housing-starts-monthly",
        "title": "New Residential Construction",
        "category": "housing",
        "importance": "medium",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "source": "Census",
        "source_url": "https://www.census.gov/construction/nrc/",
        "notes": "Housing starts, permits, under construction, completions.",
        "status": "source_link",
    },
    {
        "id": "cot-weekly",
        "title": "Commitments of Traders",
        "category": "sentiment",
        "importance": "medium",
        "date": None,
        "time": "15:30",
        "timezone": "America/New_York",
        "source": "CFTC",
        "source_url": "https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm",
        "notes": "Weekly positioning context.",
        "status": "source_link",
    },
]


def generate_macro_calendar() -> dict[str, Any]:
    return {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method_version": "phase4-pr2-static-event-calendar-v1",
        "events": EVENTS,
    }


def main() -> None:
    output_dir = data_dir() / "events"
    output_dir.mkdir(parents=True, exist_ok=True)
    write_json(output_dir / "macro_calendar.json", generate_macro_calendar())


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Add schema validation**

In `scripts/validate/validate_schema.py`:

```python
EVENT_IMPORTANCE = {"high", "medium", "low"}
EVENT_STATUSES = {"scheduled", "source_link", "estimated"}
EVENT_CATEGORIES = {
    "growth", "inflation", "rates", "liquidity", "credit", "housing",
    "sentiment", "commodities", "fiscal", "earnings",
}
```

Add:

```python
def validate_macro_calendar_file() -> None:
    path = data_dir() / "events" / "macro_calendar.json"
    payload = _load_json(path)
    if not isinstance(payload.get("generated_at_utc"), str):
        raise ValueError(f"{path} generated_at_utc must be a string")
    if not isinstance(payload.get("method_version"), str):
        raise ValueError(f"{path} method_version must be a string")
    events = payload.get("events")
    if not isinstance(events, list) or not events:
        raise ValueError(f"{path} events must be a non-empty list")
    seen_ids: set[str] = set()
    for event in events:
        if not isinstance(event, dict):
            raise ValueError(f"{path} event must be an object")
        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id:
            raise ValueError(f"{path} event id must be a non-empty string")
        if event_id in seen_ids:
            raise ValueError(f"{path} duplicate event id: {event_id}")
        seen_ids.add(event_id)
        for field in ["title", "category", "importance", "source", "source_url", "notes", "status"]:
            if not isinstance(event.get(field), str) or not event[field]:
                raise ValueError(f"{path} {event_id}.{field} must be a non-empty string")
        if event["category"] not in EVENT_CATEGORIES:
            raise ValueError(f"{path} {event_id}.category is invalid")
        if event["importance"] not in EVENT_IMPORTANCE:
            raise ValueError(f"{path} {event_id}.importance is invalid")
        if event["status"] not in EVENT_STATUSES:
            raise ValueError(f"{path} {event_id}.status is invalid")
        if event.get("date") is not None and not isinstance(event.get("date"), str):
            raise ValueError(f"{path} {event_id}.date must be a string or null")
        if event.get("time") is not None and not isinstance(event.get("time"), str):
            raise ValueError(f"{path} {event_id}.time must be a string or null")
        if event.get("timezone") is not None and not isinstance(event.get("timezone"), str):
            raise ValueError(f"{path} {event_id}.timezone must be a string or null")
```

Call it from `main()` and add `data_dir() / "events" / "macro_calendar.json"` to `REQUIRED_GENERATED_FILES`.

- [ ] **Step 5: Wire update workflow**

In `scripts/update_data.py`, add `"scripts.generate_macro_calendar"` to `MODULES` before schema validation:

```python
MODULES = [
    "scripts.ingest.fetch_cboe",
    "scripts.ingest.fetch_fred_csv",
    "scripts.ingest.fetch_cftc",
    "scripts.transform.normalize_series",
    "scripts.transform.compute_percentiles",
    "scripts.transform.compute_regime_score",
    "scripts.generate_macro_calendar",
    "scripts.validate.validate_schema",
    "scripts.validate.validate_freshness",
]
```

Update `tests/python/test_safe_update.py` to assert `scripts.generate_macro_calendar` is present in `update_data.MODULES` before `scripts.validate.validate_schema`.

- [ ] **Step 6: Generate and validate event data**

```bash
. .venv/bin/activate && python -m scripts.generate_macro_calendar
. .venv/bin/activate && python -m scripts.validate.validate_schema
```

Expected: both exit 0 and `public/data/events/macro_calendar.json` exists.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate_macro_calendar.py scripts/update_data.py scripts/validate/validate_schema.py tests/python/test_scoring.py tests/python/test_safe_update.py public/data/events/macro_calendar.json
git commit -m "feat: add static macro event calendar data"
```

---

## Chunk 5: Calendar Route

### Task 6: Add `/calendar` Route

**Files:**
- Create: `src/routes/Calendar.tsx`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add TypeScript event types and loader**

In `src/lib/types.ts`:

```ts
export type MacroEventImportance = "high" | "medium" | "low";
export type MacroEventStatus = "scheduled" | "source_link" | "estimated";

export interface MacroCalendarEvent {
  id: string;
  title: string;
  category: string;
  importance: MacroEventImportance;
  date: string | null;
  time: string | null;
  timezone: string | null;
  source: string;
  source_url: string;
  notes: string;
  status: MacroEventStatus;
}

export interface MacroCalendarFile {
  generated_at_utc: string;
  method_version: string;
  events: MacroCalendarEvent[];
}
```

In `src/lib/data.ts`:

```ts
import type { MacroCalendarFile } from "./types";

export function loadMacroCalendar(): Promise<MacroCalendarFile> {
  return loadJson<MacroCalendarFile>("/data/events/macro_calendar.json");
}
```

- [ ] **Step 2: Write failing route test**

In `src/routes/data-routes.test.tsx`, add a fixture:

```ts
const macroCalendar = {
  generated_at_utc: "2026-05-05T00:00:00Z",
  method_version: "phase4-pr2-static-event-calendar-v1",
  events: [
    {
      id: "cpi-monthly",
      title: "Consumer Price Index",
      category: "inflation",
      importance: "high",
      date: null,
      time: "08:30",
      timezone: "America/New_York",
      source: "BLS",
      source_url: "https://www.bls.gov/schedule/news_release/cpi.htm",
      notes: "Use BLS schedule for exact dates.",
      status: "source_link",
    },
  ],
};
```

Add `"/data/events/macro_calendar.json": macroCalendar` to route fixtures.

Add test:

```ts
it("renders macro calendar route", async () => {
  mockStaticFetch(routeFetchFiles({ "/data/events/macro_calendar.json": macroCalendar }));
  const container = render(
    <MemoryRouter initialEntries={["/calendar"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Macro Calendar");

  expect(container.textContent).toContain("Consumer Price Index");
  expect(container.textContent).toContain("BLS");
  expect(container.textContent).toContain("High");
  expect(container.textContent).toContain("Source link");
  expect(container.textContent).toContain("America/New_York");
});
```

- [ ] **Step 3: Run test to verify failure**

```bash
npm test -- src/routes/data-routes.test.tsx -t "macro calendar route"
```

Expected: FAIL because route does not exist.

- [ ] **Step 4: Create `src/routes/Calendar.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { loadMacroCalendar } from "../lib/data";
import type { MacroCalendarFile } from "../lib/types";

const importanceLabel = {
  high: "High",
  medium: "Medium",
  low: "Low"
} as const;

const statusLabel = {
  scheduled: "Scheduled",
  source_link: "Source link",
  estimated: "Estimated"
} as const;

export default function Calendar() {
  const [calendar, setCalendar] = useState<MacroCalendarFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      try {
        const data = await loadMacroCalendar();
        if (active) setCalendar(data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load macro calendar.");
      }
    }

    void loadCalendar();

    return () => {
      active = false;
    };
  }, []);

  const groupedEvents = useMemo(() => {
    const events = calendar?.events ?? [];
    return {
      high: events.filter((event) => event.importance === "high"),
      medium: events.filter((event) => event.importance === "medium"),
      low: events.filter((event) => event.importance === "low")
    };
  }, [calendar]);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Event risk</p>
        <h2>Macro Calendar</h2>
        <p>Descriptive release and policy-event context from official public source pages.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {calendar ? (
        <div className="route-stack">
          {(["high", "medium", "low"] as const).map((importance) => (
            <section className="panel" key={importance}>
              <div className="section-heading">
                <p className="eyebrow">{importanceLabel[importance]} importance</p>
                <h3>{importanceLabel[importance]} event risk</h3>
              </div>
              <div className="calendar-list">
                {groupedEvents[importance].map((event) => (
                  <article className="calendar-event" key={event.id}>
                    <div>
                      <h4>{event.title}</h4>
                      <p>{event.notes}</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Category</dt>
                        <dd>{event.category}</dd>
                      </div>
                      <div>
                        <dt>When</dt>
                        <dd>
                          {event.date ?? "See source"}
                          {event.time ? `, ${event.time}` : ""}
                          {event.timezone ? ` ${event.timezone}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{statusLabel[event.status]}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd><a href={event.source_url}>{event.source}</a></dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 5: Wire route and nav**

In `src/App.tsx`, import and route:

```tsx
import Calendar from "./routes/Calendar";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/calendar" element={<Calendar />} />
      </Route>
    </Routes>
  );
}
```

Keep the existing routes in place; the snippet shows only where the new Calendar import and route belong.

In `src/components/AppLayout.tsx`, insert near Overview or Methodology:

```ts
{ to: "/calendar", label: "Calendar" },
```

- [ ] **Step 6: Add styles**

Add compact styles in `src/styles.css` using existing palette and panel conventions:

```css
.calendar-list {
  display: grid;
  gap: 0.75rem;
}

.calendar-event {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
}

.calendar-event dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.75rem;
  margin: 0;
}
```

Adjust variable names to match existing CSS if `--border` is not defined.

- [ ] **Step 7: Run frontend tests**

```bash
npm test -- src/routes/data-routes.test.tsx -t "macro calendar route"
npm test -- src/routes/data-routes.test.tsx
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/routes/Calendar.tsx src/lib/types.ts src/lib/data.ts src/App.tsx src/components/AppLayout.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: add macro calendar route"
```

---

## Chunk 6: Candidate Consumer And Fiscal/Treasury Scaffolding

### Task 7: Add Candidate-Only Catalog Rows

**Files:**
- Modify: `scripts/shared/catalog.py`
- Modify: `tests/python/test_catalog.py`
- Generated: `public/data/catalog/series_catalog.json`
- Generated: `public/data/status/data_status.json`

- [ ] **Step 1: Write failing candidate tests**

Add tests:

```python
def test_phase4_catalog_contains_consumer_and_fiscal_candidates_only():
    entries = {entry["id"]: entry for entry in catalog.catalog_entries()}
    expected = {
        "real_disposable_personal_income": ("FRED", "https://fred.stlouisfed.org/series/DSPIC96"),
        "personal_saving_rate": ("FRED", "https://fred.stlouisfed.org/series/PSAVERT"),
        "total_consumer_credit": ("FRED", "https://fred.stlouisfed.org/series/TOTALSL"),
        "revolving_consumer_credit": ("FRED", "https://fred.stlouisfed.org/series/REVOLSL"),
        "household_debt_service_ratio": ("FRED", "https://fred.stlouisfed.org/series/DSR"),
        "monthly_treasury_receipts": ("FiscalData", "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/"),
        "monthly_treasury_outlays": ("FiscalData", "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/"),
        "monthly_treasury_deficit_surplus": ("FiscalData", "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/"),
        "treasury_interest_expense": ("FiscalData", "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/"),
        "treasury_auction_supply": ("TreasuryDirect", "https://www.treasuryauctions.gov/auctions/when-auctions-happen/"),
    }

    active_ids = {entry["id"] for entry in catalog.available_catalog_entries()}
    for series_id, (source, source_url) in expected.items():
        entry = entries[series_id]
        assert entry["source"] == source
        assert entry["source_url"] == source_url
        assert entry["score_status"] == "candidate"
        assert entry["public"] is False
        assert entry["access_status"] == "terms_review_needed"
        assert entry["terms_status"] == "review_needed"
        assert series_id not in active_ids
```

In `tests/python/test_scoring.py`, add a focused regression proving candidate IDs cannot affect scores:

```python
def test_candidate_scaffolding_does_not_change_score_summary():
    active_series = {
        "housing_starts": _summary(percentile_252d=50.0),
        "building_permits": _summary(percentile_252d=50.0),
        "mortgage_rate_30y": _summary(percentile_252d=50.0),
        "cfnai": _summary(percentile_252d=50.0),
        "cfnai_3m_avg": _summary(percentile_252d=50.0),
        "nonfarm_payrolls": _summary(percentile_252d=50.0),
        "unemployment_rate": _summary(percentile_252d=50.0),
        "initial_claims": _summary(percentile_252d=50.0),
        "sahm_rule": _summary(percentile_252d=50.0),
        "headline_cpi": _summary(percentile_252d=50.0),
        "core_cpi": _summary(percentile_252d=50.0),
        "core_pce": _summary(percentile_252d=50.0),
        "ppi_final_demand": _summary(percentile_252d=50.0),
        "real_retail_sales": _summary(percentile_252d=50.0),
        "industrial_production": _summary(percentile_252d=50.0),
        "durable_goods_orders": _summary(percentile_252d=50.0),
        "real_yield_10y": _summary(percentile_252d=50.0),
    }
    candidate_extremes = {
        "real_disposable_personal_income": _summary(percentile_252d=100.0),
        "personal_saving_rate": _summary(percentile_252d=100.0),
        "total_consumer_credit": _summary(percentile_252d=100.0),
        "revolving_consumer_credit": _summary(percentile_252d=100.0),
        "household_debt_service_ratio": _summary(percentile_252d=100.0),
        "monthly_treasury_receipts": _summary(percentile_252d=100.0),
        "monthly_treasury_outlays": _summary(percentile_252d=100.0),
        "monthly_treasury_deficit_surplus": _summary(percentile_252d=100.0),
        "treasury_interest_expense": _summary(percentile_252d=100.0),
        "treasury_auction_supply": _summary(percentile_252d=100.0),
    }

    baseline = compute_regime_score.build_score_summary(active_series, "2026-05-05T00:00:00Z")
    with_candidates = compute_regime_score.build_score_summary(
        {**active_series, **candidate_extremes},
        "2026-05-05T00:00:00Z",
    )

    assert with_candidates["scores"] == baseline["scores"]
    assert with_candidates["data_quality"] == baseline["data_quality"]
```

- [ ] **Step 2: Run test to verify failure**

```bash
. .venv/bin/activate && python -m pytest tests/python/test_catalog.py -k "consumer_and_fiscal_candidates" -v
```

Expected: FAIL.

- [ ] **Step 3: Add candidate rows**

In `CANDIDATE_SERIES`, add exactly these entries using literal FRED endpoint URLs. Do not call `fred_endpoint(...)` here because `CANDIDATE_SERIES` is declared before that helper.

```python
{
    "id": "real_disposable_personal_income",
    "name": "Real Disposable Personal Income",
    "category": "growth",
    "source": "FRED",
    "source_url": "https://fred.stlouisfed.org/series/DSPIC96",
    "endpoint_url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DSPIC96",
    "frequency": "monthly",
    "units": "billions_chained_2017_usd",
    "higher_is": "supportive",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate consumer balance-sheet input; source treatment and scoring design deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "personal_saving_rate",
    "name": "Personal Saving Rate",
    "category": "growth",
    "source": "FRED",
    "source_url": "https://fred.stlouisfed.org/series/PSAVERT",
    "endpoint_url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSAVERT",
    "frequency": "monthly",
    "units": "percent",
    "higher_is": "supportive",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate consumer balance-sheet input; source treatment and scoring design deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "total_consumer_credit",
    "name": "Total Consumer Credit",
    "category": "credit",
    "source": "FRED",
    "source_url": "https://fred.stlouisfed.org/series/TOTALSL",
    "endpoint_url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=TOTALSL",
    "frequency": "monthly",
    "units": "millions_usd",
    "higher_is": "contextual",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate consumer credit input; source treatment and scoring design deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "revolving_consumer_credit",
    "name": "Revolving Consumer Credit",
    "category": "credit",
    "source": "FRED",
    "source_url": "https://fred.stlouisfed.org/series/REVOLSL",
    "endpoint_url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=REVOLSL",
    "frequency": "monthly",
    "units": "millions_usd",
    "higher_is": "riskier",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate revolving-credit input; source treatment and scoring design deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "household_debt_service_ratio",
    "name": "Household Debt Service Ratio",
    "category": "credit",
    "source": "FRED",
    "source_url": "https://fred.stlouisfed.org/series/DSR",
    "endpoint_url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DSR",
    "frequency": "quarterly",
    "units": "percent",
    "higher_is": "riskier",
    "public": False,
    "max_stale_days": 75,
    "notes": "Candidate household balance-sheet stress input; source treatment and scoring design deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "monthly_treasury_receipts",
    "name": "Monthly Treasury Receipts",
    "category": "liquidity",
    "source": "FiscalData",
    "source_url": "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/",
    "endpoint_url": None,
    "frequency": "monthly",
    "units": "millions_usd",
    "higher_is": "contextual",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate fiscal/Treasury supply input; direct FiscalData ingestion deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "monthly_treasury_outlays",
    "name": "Monthly Treasury Outlays",
    "category": "liquidity",
    "source": "FiscalData",
    "source_url": "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/",
    "endpoint_url": None,
    "frequency": "monthly",
    "units": "millions_usd",
    "higher_is": "contextual",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate fiscal/Treasury supply input; direct FiscalData ingestion deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "monthly_treasury_deficit_surplus",
    "name": "Monthly Treasury Deficit or Surplus",
    "category": "liquidity",
    "source": "FiscalData",
    "source_url": "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/",
    "endpoint_url": None,
    "frequency": "monthly",
    "units": "millions_usd",
    "higher_is": "contextual",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate fiscal/Treasury supply input; direct FiscalData ingestion deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "treasury_interest_expense",
    "name": "Treasury Interest Expense",
    "category": "rates",
    "source": "FiscalData",
    "source_url": "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/",
    "endpoint_url": None,
    "frequency": "monthly",
    "units": "millions_usd",
    "higher_is": "riskier",
    "public": False,
    "max_stale_days": 45,
    "notes": "Candidate fiscal/Treasury supply input; direct FiscalData ingestion deferred.",
    **governance("terms_review", score_status="candidate"),
},
{
    "id": "treasury_auction_supply",
    "name": "Treasury Auction Supply",
    "category": "rates",
    "source": "TreasuryDirect",
    "source_url": "https://www.treasuryauctions.gov/auctions/when-auctions-happen/",
    "endpoint_url": None,
    "frequency": "weekly",
    "units": "millions_usd",
    "higher_is": "riskier",
    "public": False,
    "max_stale_days": 14,
    "notes": "Candidate Treasury auction supply input; static event-calendar context exists in PR 2 but numeric ingestion is deferred.",
    **governance("terms_review", score_status="candidate"),
},
```

- [ ] **Step 4: Regenerate catalog/status**

```bash
. .venv/bin/activate && python -m scripts.transform.compute_regime_score
```

This should update candidate rows in `public/data/status/data_status.json` as `terms_review_needed`.

- [ ] **Step 5: Verify candidates do not affect active scoring**

```bash
jq '.series.real_disposable_personal_income.status, .series.monthly_treasury_deficit_surplus.status' public/data/status/data_status.json
jq '.scores.macro_climate.bucket_scores, .scores.market_weather.bucket_scores, .scores.fragility.bucket_scores, .data_quality.reasons' public/data/derived/score_summary.json
```

Expected: candidate statuses are `terms_review_needed`; no Consumer, Fiscal, Treasury supply, or auction supply bucket exists in PR 2; candidate IDs do not appear in `bucket_scores`, score labels, or `data_quality.reasons`.

- [ ] **Step 6: Run tests**

```bash
. .venv/bin/activate && python -m pytest tests/python/test_catalog.py tests/python/test_scoring.py -v
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/shared/catalog.py tests/python/test_catalog.py public/data/catalog public/data/status public/data/derived
git commit -m "docs: scaffold consumer and fiscal candidates"
```

---

## Chunk 7: Documentation And Methodology

### Task 8: Document PR 2 Boundaries

**Files:**
- Modify: `README.md`
- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/LIMITATIONS.md`
- Optional Modify: `src/routes/Methodology.tsx`

- [ ] **Step 1: Update README**

Add or update a Phase 4 PR 2 note with this exact content, adjusted only for surrounding heading level:

```markdown
### Phase 4 PR 2: Macro Completeness Foundation

Phase 4 PR 2 adds the first missing macro pillar and a descriptive event-risk surface without changing the static GitHub Pages architecture.

Active additions:

- Housing is active through FRED-hosted `HOUST`, `PERMIT`, and `MORTGAGE30US` inputs.
- Macro Climate now includes a Housing bucket that combines housing starts, building permits, and 30-year mortgage-rate pressure.
- The Housing route shows construction activity, permits, mortgage-rate sensitivity, freshness notes, and source caveats.
- The Calendar route reads `public/data/events/macro_calendar.json` and links to official public source calendars for major macro releases and policy events.

Candidate-only additions:

- Consumer balance sheet and Fiscal/Treasury supply rows are catalog/status roadmap entries only.
- Candidate-only rows remain `terms_review_needed`, do not generate active series files in PR 2, and do not enter scoring.

Still out of scope:

- No live alerts, notifications, trading signals, backend service, browser-side provider calls, or paid/licensed source ingestion.
- No full Consumer route, Fiscal/Treasury route, SLOOS, PMIs, valuation, market internals, or regime-matrix implementation in PR 2.
```

- [ ] **Step 2: Update `docs/DATA_SOURCES.md`**

Add active Housing table rows:

```markdown
| Housing | HOUST | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=HOUST` | Monthly | Housing starts; Census New Residential Construction is primary source context. |
| Housing | PERMIT | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PERMIT` | Monthly | Building permits; Census New Residential Construction is primary source context. |
| Housing | MORTGAGE30US | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US` | Weekly | 30-year fixed mortgage rate. |
```

Add this event calendar source section:

```markdown
## Static Macro Calendar Sources

The calendar at `public/data/events/macro_calendar.json` is descriptive event-risk context. PR 2 uses source-linked rows rather than scraped exact-date alerts.

| Event Area | Source | Source URL | Treatment |
| --- | --- | --- | --- |
| CPI, PPI, payrolls | BLS | `https://www.bls.gov/schedule/news_release/current_year.asp` | Source-linked calendar context. |
| PCE and GDP | BEA | `https://www.bea.gov/news/schedule/` | Source-linked calendar context. |
| FOMC meetings | Federal Reserve | `https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm` | Source-linked calendar context. |
| Treasury auctions | TreasuryDirect | `https://www.treasuryauctions.gov/auctions/when-auctions-happen/` | Source-linked calendar context. |
| Housing releases | Census | `https://www.census.gov/construction/nrc/` | Source-linked calendar context. |
| COT positioning | CFTC | `https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm` | Source-linked calendar context. |
```

Add this candidate-only Consumer/Fiscal/Treasury section:

```markdown
## Candidate-Only Macro Completeness Sources

These rows are in the catalog/status files for roadmap transparency only. They are `terms_review_needed`, do not generate active series files in PR 2, and do not enter scoring.

| Domain | Series ID | Source | Source URL | Reason Not Active |
| --- | --- | --- | --- | --- |
| Consumer balance sheet | `real_disposable_personal_income` | FRED `DSPIC96` | `https://fred.stlouisfed.org/series/DSPIC96` | Scoring design deferred. |
| Consumer balance sheet | `personal_saving_rate` | FRED `PSAVERT` | `https://fred.stlouisfed.org/series/PSAVERT` | Scoring design deferred. |
| Consumer credit | `total_consumer_credit` | FRED `TOTALSL` | `https://fred.stlouisfed.org/series/TOTALSL` | Scoring design deferred. |
| Consumer credit | `revolving_consumer_credit` | FRED `REVOLSL` | `https://fred.stlouisfed.org/series/REVOLSL` | Scoring design deferred. |
| Consumer stress | `household_debt_service_ratio` | FRED `DSR` | `https://fred.stlouisfed.org/series/DSR` | Scoring design deferred. |
| Fiscal/Treasury supply | `monthly_treasury_receipts` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Fiscal/Treasury supply | `monthly_treasury_outlays` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Fiscal/Treasury supply | `monthly_treasury_deficit_surplus` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Fiscal/Treasury supply | `treasury_interest_expense` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Treasury auction supply | `treasury_auction_supply` | TreasuryDirect | `https://www.treasuryauctions.gov/auctions/when-auctions-happen/` | Numeric auction ingestion deferred. |
```

- [ ] **Step 3: Update `docs/METHODOLOGY.md`**

Document new Macro Climate weights:

```markdown
| Housing (`housing`) | 15% | Housing starts, building permits, and 30Y mortgage-rate pressure |
```

Explain that:

- Starts and permits are supportive when stronger.
- Mortgage rates are riskier/restrictive when higher.
- Housing is rate-sensitive and should be read with release-aware freshness.

- [ ] **Step 4: Update `docs/LIMITATIONS.md`**

Add limitations:

- Event Calendar rows are descriptive source links in PR 2, not guaranteed exact alert dates for every release.
- Consumer/Fiscal/Treasury candidate rows do not affect scores.
- Housing excludes home prices, existing home sales, affordability, and mortgage applications until source handling is reviewed.

- [ ] **Step 5: Optional Methodology route text**

If `src/routes/Methodology.tsx` still lists macro buckets, update it to include `housing`.

- [ ] **Step 6: Run docs-adjacent tests**

```bash
npm test -- src/routes/data-routes.test.tsx -t "methodology panels"
. .venv/bin/activate && python -m pytest tests/python/test_catalog.py -v
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/DATA_SOURCES.md docs/METHODOLOGY.md docs/LIMITATIONS.md src/routes/Methodology.tsx
git commit -m "docs: document phase 4 macro completeness foundation"
```

---

## Chunk 8: Final Regeneration, Verification, And Review

### Task 9: Regenerate All Data And Run Full Verification

**Files:**
- Generated public data files as needed.

- [ ] **Step 1: Run full data workflow**

```bash
. .venv/bin/activate && python -m scripts.update_data
```

Expected: exit 0.

- [ ] **Step 2: Inspect key generated contracts**

```bash
jq '.scores.macro_climate.bucket_scores.housing, .scores.macro_climate.bucket_weights.housing, .data_quality' public/data/derived/score_summary.json
jq '.events | length' public/data/events/macro_calendar.json
jq '{overall_status, housing: .series.housing_starts.status, mortgage: .series.mortgage_rate_30y.status}' public/data/status/data_status.json
jq '.series.real_disposable_personal_income.status, .series.treasury_auction_supply.status' public/data/status/data_status.json
jq '[.scores[].bucket_scores | keys[]] | any(. == "consumer_balance_sheet" or . == "fiscal_treasury_supply" or . == "treasury_auction_supply")' public/data/derived/score_summary.json
```

Expected:

- Housing score and weight exist.
- Calendar has non-zero event rows.
- Housing statuses are `ok` or release-window-aware expected lag, unless live source data is genuinely stale.
- Candidate Consumer/Fiscal/Treasury statuses are `terms_review_needed`.
- The candidate bucket check returns `false`.

- [ ] **Step 3: Run full test and build suite**

```bash
. .venv/bin/activate && python -m pytest tests/python -v
npm test
npm run build
. .venv/bin/activate && python -m scripts.validate.validate_schema
. .venv/bin/activate && python -m scripts.validate.validate_freshness
test -f dist/404.html && echo 'dist/404.html exists'
git diff --check
```

Expected: all pass.

- [ ] **Step 4: Commit final regenerated artifacts if changed**

```bash
git status --short
git add public/data
git commit -m "data: refresh phase 4 macro completeness artifacts"
```

If no generated files changed, skip the commit and note that in the task report.

### Task 10: Final Subagent Review

**Files:**
- No file edits unless reviewer finds issues.

- [ ] **Step 1: Dispatch final reviewer**

Use a fresh reviewer subagent with this scope:

```text
Review Phase 4 PR 2 Macro Completeness Foundation.
Focus on:
- Housing series are active, generated, validated, surfaced in UI, and included in Macro Climate.
- Consumer/Fiscal/Treasury rows are candidate-only and cannot enter active scores.
- Event calendar JSON is generated, schema-validated, loaded by UI, and descriptive rather than alerting.
- Source/docs claims match implementation.
- Full test/build/validation commands passed.
Do not modify files. Return findings first with file/line references.
```

- [ ] **Step 2: Fix any findings**

If issues are found:

1. Apply targeted fix.
2. Add or update regression test.
3. Rerun relevant focused tests.
4. Commit fix.
5. Re-dispatch final reviewer.

- [ ] **Step 3: Final verification before PR**

Run:

```bash
. .venv/bin/activate && python -m pytest tests/python -v
npm test
npm run build
. .venv/bin/activate && python -m scripts.validate.validate_schema
. .venv/bin/activate && python -m scripts.validate.validate_freshness
git status --short
```

Expected: all pass and worktree is clean.

- [ ] **Step 4: Prepare PR summary**

Use:

```markdown
## Summary
- Add active Housing inputs and a Housing route, with Housing included in Macro Climate scoring.
- Add generated static macro event calendar data and a Calendar route.
- Scaffold Consumer Balance Sheet and Fiscal/Treasury Supply as candidate-only sources for later PRs.

## Test Plan
- [ ] `. .venv/bin/activate && python -m pytest tests/python -v`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `. .venv/bin/activate && python -m scripts.validate.validate_schema`
- [ ] `. .venv/bin/activate && python -m scripts.validate.validate_freshness`
```

---

## Expected PR 2 Acceptance Criteria

- `public/data/series/housing_starts.json`, `building_permits.json`, and `mortgage_rate_30y.json` exist and validate.
- `score_summary.json` Macro Climate includes a `housing` bucket and weight.
- The old “Housing is not active in Phase 4 PR 1” confidence reason is gone.
- `/housing` renders active housing metrics, interpretation, data gaps, chart, and status table.
- `public/data/events/macro_calendar.json` exists, validates, and has source-linked events.
- `/calendar` renders event rows grouped or organized by importance/category.
- Candidate Consumer/Fiscal/Treasury rows appear in catalog/status as `terms_review_needed` and do not affect scores.
- Full Python tests, Vitest tests, production build, schema validation, and freshness validation pass.
