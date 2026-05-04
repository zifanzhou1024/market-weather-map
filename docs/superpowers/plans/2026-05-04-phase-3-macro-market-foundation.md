# Phase 3 Macro-Market Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `market-weather-map` from one market weather score into a static macro-market dashboard with three scores, source governance, active macro pillars, confidence, and visible route updates.

**Architecture:** Keep the GitHub-only model: Python fetches public no-secret sources, writes static JSON under `public/data`, and the Vite app reads those JSON files. Phase 3 adds provider/source metadata, active FRED macro series, expanded Cboe volatility parsing, derived macro drivers, `score_summary.json`, compatibility score outputs, and React views for the new model.

**Tech Stack:** Vite, React, TypeScript, React Router, Recharts, Vitest, Python 3.11 standard library, pytest, GitHub Actions, GitHub Pages.

---

## Scope Check

This plan implements only Phase 3 from `docs/superpowers/specs/2026-05-04-phase-3-macro-market-roadmap-design.md`. Phases 4-6 remain roadmap scope and are not implemented here.

Phase 3 is large but cohesive because the new data/source contract, scoring contract, generated JSON, and UI all need to change together. The tasks below keep commits reviewable by moving from contracts to catalog, ingestion, transforms, scoring, UI, docs, and verification.

## File Responsibility Map

### Source Governance And Catalog

- Modify `scripts/shared/catalog.py`: declare active and candidate series metadata, include `provider_id`, `access_status`, `terms_status`, `score_status`, and `citation_notes` in catalog entries.
- Create `scripts/shared/source_registry.py`: provider-level registry for FRED, Cboe, CFTC, Derived, and reviewed-later sources.
- Modify `scripts/transform/normalize_series.py`: write `public/data/catalog/source_registry.json` alongside `series_catalog.json`.
- Modify `scripts/validate/validate_schema.py`: validate source registry, catalog governance fields, score summary, and expanded statuses.
- Modify `scripts/validate/validate_freshness.py`: ignore candidate/unavailable series for freshness failures while preserving active-series checks.

### Ingestion And Series Normalization

- Modify `scripts/ingest/fetch_fred_csv.py`: fetch only active FRED catalog entries.
- Modify `scripts/ingest/fetch_cboe.py`: loop active Cboe entries and parse either `CLOSE` or the series-specific value column.
- Modify `scripts/transform/compute_percentiles.py`: add `change_3m` and `change_12m` summaries for daily, weekly, and monthly data.

### Derived Metrics And Scores

- Create `scripts/transform/score_models.py`: shared scoring types, weighted scoring, driver construction, confidence penalties, label helpers, and score assembly helpers.
- Modify `scripts/transform/compute_regime_score.py`: build new derived metrics, emit `score_summary.json`, keep compatibility `bucket_scores.json` and `regime_score.json`, and build richer status.
- Modify `tests/python/test_scoring.py`: cover derived metrics, three scores, confidence, and driver-specific risk/support text.

### Frontend Data Contracts And UI

- Modify `src/lib/types.ts`: add source governance fields, expanded statuses, score summary types, `change_3m`, and `change_12m`.
- Modify `src/lib/data.ts`: add `loadScoreSummary()` and `loadSourceRegistry()`.
- Create `src/components/ScoreCard.tsx`: render score value, label, confidence, supports, risks, and confidence reasons.
- Create `src/components/HowToReadPanel.tsx`: shared route explanation panel.
- Create `src/components/SourceAccessBadge.tsx`: compact access/terms display for metric cards and source notes.
- Modify `src/components/MetricCard.tsx`: render optional 3M/12M changes and source access metadata.
- Modify `src/components/SourceNote.tsx`: render citation/access notes.
- Modify `src/routes/Overview.tsx`: load `score_summary.json` and render three score cards, changed signals, conflicts, confidence, and priority metric cards.
- Modify `src/routes/Rates.tsx`: label as Rates & Policy and show nominal, real-yield, breakeven, and curve sections.
- Modify `src/routes/Credit.tsx`: label as Credit & Banking and show spreads, broad conditions, and bank-credit impulse.
- Modify `src/routes/Sentiment.tsx`: label as Sentiment & Positioning.
- Create `src/routes/Growth.tsx`: growth, consumer/production, and labor/recession sections.
- Create `src/routes/Inflation.tsx`: CPI, core CPI, core PCE, PPI, and breakeven context.
- Create `src/routes/DollarGlobal.tsx`: broad dollar and FX pressure.
- Modify `src/components/AppLayout.tsx`: update navigation labels and new routes.
- Modify `src/App.tsx`: register new routes.
- Modify `src/routes/Methodology.tsx`: explain the three-score model and source governance.

### Documentation And Dependency Pinning

- Modify `README.md`: update current scope, active Phase 3 inputs, and data access status table.
- Modify `docs/DATA_SOURCES.md`: separate active, candidate, restricted, and unavailable sources.
- Modify `docs/METHODOLOGY.md`: document three scores, transformations, confidence, and caveats.
- Modify `docs/LIMITATIONS.md`: document candidate source review and static delayed data limitations.
- Modify `package.json`: pin exact versions from `package-lock.json`.
- Modify `package-lock.json`: refresh lockfile after package pinning.

## Task 1: Add TypeScript Contracts And Loaders

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Modify: `src/lib/data.test.ts`

- [ ] **Step 1: Add failing TypeScript contract tests**

Append this to `src/lib/data.test.ts`:

```ts
import type { ScoreSummaryFile, SourceRegistryFile } from "./types";
import { loadScoreSummary, loadSourceRegistry } from "./data";

test("type contracts support phase 3 source governance and score summary", () => {
  const catalogEntry: SeriesCatalogEntry = {
    access_status: "free_public",
    category: "growth",
    citation_notes: "FRED graph CSV, review source-specific citation fields.",
    endpoint_url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CFNAI",
    frequency: "monthly",
    higher_is: "contextual",
    id: "cfnai",
    max_stale_days: 75,
    name: "Chicago Fed National Activity Index",
    notes: "Broad monthly activity gauge.",
    provider_id: "fred",
    public: true,
    score_status: "active",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/series/CFNAI",
    terms_status: "review_each_series",
    units: "index"
  };

  const registry: SourceRegistryFile = {
    fred: {
      access_status: "free_public",
      base_url: "https://fred.stlouisfed.org",
      name: "Federal Reserve Economic Data",
      notes: "No-secret graph CSV endpoints; review each hosted series.",
      requires_secret: false,
      terms_status: "review_each_series",
      update_cadence: "varies_by_series"
    }
  };

  const scoreSummary: ScoreSummaryFile = {
    date: "2026-05-01",
    generated_at_utc: "2026-05-04T00:00:00Z",
    method_version: "phase3-three-score-v1",
    scores: {
      market_weather: {
        bucket_scores: { credit_spreads: -20 },
        bucket_weights: { credit_spreads: 0.2 },
        confidence: 0.82,
        confidence_reasons: ["All primary credit spread data is fresh."],
        label: "Mixed",
        missing_or_stale_notes: [],
        recent_changes: ["High-yield spreads widened over the past month."],
        score: -8.4,
        top_risks: ["High-yield spreads widened over the past month."],
        top_supports: ["Reserve balances improved over the past month."]
      },
      macro_climate: {
        bucket_scores: { growth: 5 },
        bucket_weights: { growth: 0.25 },
        confidence: 0.7,
        confidence_reasons: ["Housing is a candidate input, not active."],
        label: "Mixed",
        missing_or_stale_notes: ["Housing is not active in Phase 3."],
        recent_changes: [],
        score: 2,
        top_risks: [],
        top_supports: []
      },
      fragility: {
        bucket_scores: { dollar_spike: -10 },
        bucket_weights: { dollar_spike: 0.15 },
        confidence: 0.68,
        confidence_reasons: ["Treasury bond volatility source is not active."],
        label: "Moderate",
        missing_or_stale_notes: ["MOVE is a candidate input."],
        recent_changes: [],
        score: -12,
        top_risks: ["Broad dollar strength is tightening global conditions."],
        top_supports: []
      }
    },
    conflicting_signals: ["Credit is calm while inflation momentum is elevated."],
    data_quality: {
      overall_confidence: 0.73,
      reasons: ["Sentiment is limited to CFTC positioning."]
    }
  };

  expect(catalogEntry.score_status).toBe("active");
  expect(registry.fred.terms_status).toBe("review_each_series");
  expect(scoreSummary.scores.market_weather.confidence).toBe(0.82);
});

test("loads phase 3 static JSON contracts from safe data paths", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ generated_at_utc: "2026-05-04T00:00:00Z" })
  });
  vi.stubGlobal("fetch", fetchMock);

  await loadScoreSummary();
  await loadSourceRegistry();

  expect(fetchMock).toHaveBeenCalledWith("/data/derived/score_summary.json");
  expect(fetchMock).toHaveBeenCalledWith("/data/catalog/source_registry.json");
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```bash
npm test -- src/lib/data.test.ts
```

Expected: FAIL because `ScoreSummaryFile`, source governance fields, `loadScoreSummary`, and `loadSourceRegistry` do not exist.

- [ ] **Step 3: Update `src/lib/types.ts`**

Add these unions and interfaces:

```ts
export type DataStatus =
  | "ok"
  | "stale"
  | "partial"
  | "failed"
  | "terms_review_needed"
  | "unavailable";

export type SeriesCategory =
  | "volatility"
  | "rates"
  | "liquidity"
  | "credit"
  | "commodities"
  | "sentiment"
  | "growth"
  | "labor"
  | "inflation"
  | "dollar"
  | "banking";

export type SourceAccessStatus =
  | "free_public"
  | "terms_review_needed"
  | "restricted"
  | "unavailable";

export type SourceTermsStatus =
  | "ok"
  | "review_each_series"
  | "review_needed"
  | "restricted"
  | "unknown";

export type ScoreStatus = "active" | "candidate" | "unavailable";

export interface SourceRegistryEntry {
  name: string;
  base_url: string;
  requires_secret: boolean;
  access_status: SourceAccessStatus;
  terms_status: SourceTermsStatus;
  update_cadence: string;
  notes: string;
}

export type SourceRegistryFile = Record<string, SourceRegistryEntry>;

export interface ScoreBlock {
  score: number;
  label:
    | WeatherLabel
    | "Goldilocks"
    | "Reflation"
    | "Disinflationary Slowdown"
    | "Stagflation Pressure"
    | "Credit Stress"
    | "Liquidity Stress"
    | "Crowded Calm"
    | "Risk-Off"
    | "Moderate"
    | "Low Fragility"
    | "Elevated Fragility"
    | "High Fragility";
  confidence: number;
  confidence_reasons: string[];
  bucket_scores: Record<string, number>;
  bucket_weights: Record<string, number>;
  top_supports: string[];
  top_risks: string[];
  recent_changes: string[];
  missing_or_stale_notes: string[];
}

export interface ScoreSummaryFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  scores: {
    market_weather: ScoreBlock;
    macro_climate: ScoreBlock;
    fragility: ScoreBlock;
  };
  conflicting_signals: string[];
  data_quality: {
    overall_confidence: number;
    reasons: string[];
  };
}
```

Update existing interfaces:

```ts
export interface SeriesCatalogEntry {
  id: string;
  name: string;
  category: SeriesCategory;
  source: string;
  provider_id?: string;
  source_url: string;
  endpoint_url?: string;
  frequency: SeriesFrequency;
  units: string;
  higher_is: "supportive" | "riskier" | "contextual";
  public: boolean;
  max_stale_days: number;
  notes: string;
  citation_notes?: string;
  access_status?: SourceAccessStatus;
  terms_status?: SourceTermsStatus;
  score_status?: ScoreStatus;
}

export interface SeriesSummary {
  latest_date: string;
  latest_value: number;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  change_3m?: number | null;
  change_12m?: number | null;
  percentile_252d: number | null;
}
```

- [ ] **Step 4: Add loaders in `src/lib/data.ts`**

Add imports for `ScoreSummaryFile` and `SourceRegistryFile`, then add:

```ts
export function loadSourceRegistry(): Promise<SourceRegistryFile> {
  return loadJson<SourceRegistryFile>("/data/catalog/source_registry.json");
}

export function loadScoreSummary(): Promise<ScoreSummaryFile> {
  return loadJson<ScoreSummaryFile>("/data/derived/score_summary.json");
}
```

- [ ] **Step 5: Run the contract test and verify it passes**

Run:

```bash
npm test -- src/lib/data.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/data.ts src/lib/data.test.ts
git commit -m "feat: add phase 3 data contracts"
```

## Task 2: Add Source Registry And Catalog Governance

**Files:**
- Create: `scripts/shared/source_registry.py`
- Modify: `scripts/shared/catalog.py`
- Modify: `scripts/transform/normalize_series.py`
- Modify: `tests/python/test_catalog.py`
- Create: `tests/python/test_source_registry.py`

- [ ] **Step 1: Add failing source registry tests**

Create `tests/python/test_source_registry.py`:

```python
from scripts.shared.source_registry import source_registry_entries


def test_source_registry_describes_provider_access_and_terms():
    registry = source_registry_entries()

    assert registry["fred"] == {
        "name": "Federal Reserve Economic Data",
        "base_url": "https://fred.stlouisfed.org",
        "requires_secret": False,
        "access_status": "free_public",
        "terms_status": "review_each_series",
        "update_cadence": "varies_by_series",
        "notes": "FRED graph CSV endpoints do not require secrets; hosted series can carry source-specific citation or redistribution requirements.",
    }
    assert registry["cboe"]["access_status"] == "free_public"
    assert registry["cftc"]["requires_secret"] is False
    assert registry["terms_review"]["access_status"] == "terms_review_needed"
    assert registry["unavailable"]["access_status"] == "unavailable"
```

Append this to `tests/python/test_catalog.py`:

```python
def test_catalog_entries_include_phase3_governance_fields():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    vix = entries["vix"]
    assert vix["provider_id"] == "cboe"
    assert vix["access_status"] == "free_public"
    assert vix["terms_status"] == "ok"
    assert vix["score_status"] == "active"
    assert isinstance(vix["citation_notes"], str)


def test_catalog_can_include_candidate_sources_without_making_them_available(tmp_path, monkeypatch):
    series_dir = tmp_path / "series"
    series_dir.mkdir()
    monkeypatch.setattr(catalog_module, "data_dir", lambda: tmp_path, raising=False)

    entries = {str(entry["id"]): entry for entry in catalog_entries()}
    assert entries["ism_manufacturing_pmi"]["score_status"] == "candidate"
    assert entries["ism_manufacturing_pmi"]["access_status"] == "terms_review_needed"
    assert "ism_manufacturing_pmi" not in {
        str(entry["id"]) for entry in catalog_module.available_catalog_entries()
    }
```

- [ ] **Step 2: Run registry and catalog tests and verify they fail**

Run:

```bash
python3 -m pytest tests/python/test_source_registry.py tests/python/test_catalog.py -v
```

Expected: FAIL because `scripts.shared.source_registry` does not exist and catalog entries lack Phase 3 governance fields.

- [ ] **Step 3: Create `scripts/shared/source_registry.py`**

Create:

```python
from __future__ import annotations


def source_registry_entries() -> dict[str, dict[str, object]]:
    return {
        "fred": {
            "name": "Federal Reserve Economic Data",
            "base_url": "https://fred.stlouisfed.org",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "review_each_series",
            "update_cadence": "varies_by_series",
            "notes": "FRED graph CSV endpoints do not require secrets; hosted series can carry source-specific citation or redistribution requirements.",
        },
        "cboe": {
            "name": "Cboe Global Markets",
            "base_url": "https://www.cboe.com",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "ok",
            "update_cadence": "daily_market_data",
            "notes": "Cboe historical index CSV files are public and delayed; source caveats should be shown with the data.",
        },
        "cftc": {
            "name": "U.S. Commodity Futures Trading Commission",
            "base_url": "https://www.cftc.gov",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "ok",
            "update_cadence": "weekly",
            "notes": "Public historical compressed Commitments of Traders reports.",
        },
        "derived": {
            "name": "Derived",
            "base_url": "/data",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "ok",
            "update_cadence": "after_source_updates",
            "notes": "Computed from active public inputs in this repository.",
        },
        "terms_review": {
            "name": "Terms-reviewed candidate sources",
            "base_url": "",
            "requires_secret": False,
            "access_status": "terms_review_needed",
            "terms_status": "review_needed",
            "update_cadence": "not_active",
            "notes": "Useful sources that require access, terms, licensing, citation, or redistribution review before automated publication.",
        },
        "unavailable": {
            "name": "Unavailable or restricted sources",
            "base_url": "",
            "requires_secret": True,
            "access_status": "unavailable",
            "terms_status": "restricted",
            "update_cadence": "not_active",
            "notes": "Sources that are not freely automatable for this static no-secret project.",
        },
    }
```

- [ ] **Step 4: Add governance defaults in `scripts/shared/catalog.py`**

Import `source_registry_entries` and add helper functions:

```python
from scripts.shared.source_registry import source_registry_entries


def governance(
    provider_id: str,
    score_status: str = "active",
    access_status: str | None = None,
    terms_status: str | None = None,
    citation_notes: str | None = None,
) -> dict[str, object]:
    registry = source_registry_entries()[provider_id]
    return {
        "provider_id": provider_id,
        "access_status": access_status or str(registry["access_status"]),
        "terms_status": terms_status or str(registry["terms_status"]),
        "score_status": score_status,
        "citation_notes": citation_notes or str(registry["notes"]),
    }
```

Update `CBOE_VIX` with:

```python
**governance("cboe", citation_notes="Cboe public historical index data; displayed with source caveats."),
```

When building FRED entries in `catalog_entries()`, include:

```python
**governance(
    "fred",
    score_status=str(series.get("score_status", "active")),
    access_status=str(series.get("access_status", "free_public")),
    terms_status=str(series.get("terms_status", "review_each_series")),
    citation_notes=str(series.get("citation_notes", "FRED graph CSV endpoint; review source-specific citation and copyright fields.")),
),
```

When building CFTC entries, include:

```python
**governance("cftc", citation_notes="Public CFTC historical compressed report transformed into derived positioning context."),
```

Add candidate entries:

```python
CANDIDATE_SERIES = [
    {
        "id": "ism_manufacturing_pmi",
        "name": "ISM Manufacturing PMI",
        "category": "growth",
        "source": "ISM",
        "source_url": "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/",
        "endpoint_url": None,
        "frequency": "monthly",
        "units": "index",
        "higher_is": "contextual",
        "public": False,
        "max_stale_days": 45,
        "notes": "Candidate fast growth input; requires terms and redistribution review before automated ingestion.",
        **governance("terms_review", score_status="candidate"),
    },
    {
        "id": "move_index",
        "name": "MOVE Index",
        "category": "volatility",
        "source": "ICE",
        "source_url": "https://developer.ice.com/fixed-income-data-services/catalog/ice-data-indices-move-index",
        "endpoint_url": None,
        "frequency": "daily",
        "units": "index",
        "higher_is": "riskier",
        "public": False,
        "max_stale_days": 7,
        "notes": "Candidate Treasury volatility input; not active because automated access and redistribution need review.",
        **governance("terms_review", score_status="candidate"),
    },
]
```

Append `CANDIDATE_SERIES` at the end of `catalog_entries()`.

- [ ] **Step 5: Write source registry artifact in `normalize_series.py`**

Import `source_registry_entries` and write the registry before the series loop:

```python
from scripts.shared.source_registry import source_registry_entries


write_json(data_dir() / "catalog" / "source_registry.json", source_registry_entries())
```

Keep `series_catalog.json` generated from all `catalog_entries()`, including candidates.

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
python3 -m pytest tests/python/test_source_registry.py tests/python/test_catalog.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/shared/source_registry.py scripts/shared/catalog.py scripts/transform/normalize_series.py tests/python/test_source_registry.py tests/python/test_catalog.py
git commit -m "feat: add source governance metadata"
```

## Task 3: Add Phase 3 Active Series And Expanded Cboe Ingestion

**Files:**
- Modify: `scripts/shared/catalog.py`
- Modify: `scripts/ingest/fetch_fred_csv.py`
- Modify: `scripts/ingest/fetch_cboe.py`
- Modify: `tests/python/test_catalog.py`
- Modify: `tests/python/test_fetchers.py`

- [ ] **Step 1: Add failing catalog tests for active Phase 3 inputs**

Append to `tests/python/test_catalog.py`:

```python
def test_phase3_catalog_contains_active_macro_fred_series():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    expected = {
        "high_yield_oas": "BAMLH0A0HYM2",
        "investment_grade_oas": "BAMLC0A0CM",
        "bbb_oas": "BAMLC0A4CBBB",
        "real_yield_10y": "DFII10",
        "real_yield_5y": "DFII5",
        "breakeven_10y": "T10YIE",
        "breakeven_5y": "T5YIE",
        "forward_inflation_5y5y": "T5YIFR",
        "cfnai": "CFNAI",
        "cfnai_3m_avg": "CFNAIMA3",
        "real_retail_sales": "RRSFS",
        "industrial_production": "INDPRO",
        "durable_goods_orders": "DGORDER",
        "unemployment_rate": "UNRATE",
        "nonfarm_payrolls": "PAYEMS",
        "initial_claims": "ICSA",
        "sahm_rule": "SAHMREALTIME",
        "headline_cpi": "CPIAUCSL",
        "core_cpi": "CPILFESL",
        "core_pce": "PCEPILFE",
        "ppi_final_demand": "PPIFIS",
        "broad_dollar": "DTWEXBGS",
        "usdjpy": "DEXJPUS",
        "eurusd": "DEXUSEU",
        "reserve_balances": "WRESBAL",
        "bank_credit": "TOTBKCR",
        "loans_and_leases": "TOTLL",
        "business_loans": "BUSLOANS",
        "bank_deposits": "DPSACBW027SBOG",
    }

    for series_id, fred_id in expected.items():
        entry = entries[series_id]
        assert entry["endpoint_url"].endswith(fred_id)
        assert entry["provider_id"] == "fred"
        assert entry["access_status"] == "free_public"
        assert entry["score_status"] == "active"


def test_phase3_catalog_contains_active_expanded_cboe_volatility_series():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    assert entries["vvix"]["endpoint_url"].endswith("VVIX_History.csv")
    assert entries["vix9d"]["endpoint_url"].endswith("VIX9D_History.csv")
    assert entries["vix3m"]["endpoint_url"].endswith("VIX3M_History.csv")
    assert entries["vvix"]["score_status"] == "active"
    assert entries["vix9d"]["provider_id"] == "cboe"
```

- [ ] **Step 2: Add failing Cboe parser tests**

Append to `tests/python/test_fetchers.py`:

```python
from scripts.ingest.fetch_cboe import normalize_cboe_rows


def test_normalize_cboe_rows_supports_close_column():
    rows = [
        {"DATE": "05/01/2026", "OPEN": "20", "HIGH": "21", "LOW": "19", "CLOSE": "20.5"}
    ]

    assert normalize_cboe_rows(rows, "vix9d", ("CLOSE", "VIX9D")) == [
        {"date": "2026-05-01", "value": 20.5}
    ]


def test_normalize_cboe_rows_supports_series_value_column():
    rows = [{"DATE": "2026-05-01", "VVIX": "88.25"}]

    assert normalize_cboe_rows(rows, "vvix", ("CLOSE", "VVIX")) == [
        {"date": "2026-05-01", "value": 88.25}
    ]
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
python3 -m pytest tests/python/test_catalog.py tests/python/test_fetchers.py -v
```

Expected: FAIL because the new series and `normalize_cboe_rows` do not exist.

- [ ] **Step 4: Add active FRED series metadata**

In `scripts/shared/catalog.py`, append these entries to `FRED_SERIES`:

```python
PHASE3_FRED_SERIES = [
    {"id": "high_yield_oas", "fred_id": "BAMLH0A0HYM2", "name": "ICE BofA US High Yield OAS", "category": "credit", "frequency": "daily", "units": "percentage_points", "higher_is": "riskier", "max_stale_days": 10, "notes": "Direct high-yield corporate credit spread from FRED."},
    {"id": "investment_grade_oas", "fred_id": "BAMLC0A0CM", "name": "ICE BofA US Corporate OAS", "category": "credit", "frequency": "daily", "units": "percentage_points", "higher_is": "riskier", "max_stale_days": 10, "notes": "Direct investment-grade corporate credit spread from FRED."},
    {"id": "bbb_oas", "fred_id": "BAMLC0A4CBBB", "name": "ICE BofA BBB US Corporate OAS", "category": "credit", "frequency": "daily", "units": "percentage_points", "higher_is": "riskier", "max_stale_days": 10, "notes": "BBB corporate credit spread from FRED."},
    {"id": "real_yield_10y", "fred_id": "DFII10", "name": "10-Year Treasury Real Yield", "category": "rates", "frequency": "daily", "units": "percent", "higher_is": "riskier", "max_stale_days": 10, "notes": "10-year inflation-indexed Treasury yield from FRED."},
    {"id": "real_yield_5y", "fred_id": "DFII5", "name": "5-Year Treasury Real Yield", "category": "rates", "frequency": "daily", "units": "percent", "higher_is": "riskier", "max_stale_days": 10, "notes": "5-year inflation-indexed Treasury yield from FRED."},
    {"id": "breakeven_10y", "fred_id": "T10YIE", "name": "10-Year Breakeven Inflation Rate", "category": "inflation", "frequency": "daily", "units": "percent", "higher_is": "contextual", "max_stale_days": 10, "notes": "Market-implied 10-year inflation compensation from FRED."},
    {"id": "breakeven_5y", "fred_id": "T5YIE", "name": "5-Year Breakeven Inflation Rate", "category": "inflation", "frequency": "daily", "units": "percent", "higher_is": "contextual", "max_stale_days": 10, "notes": "Market-implied 5-year inflation compensation from FRED."},
    {"id": "forward_inflation_5y5y", "fred_id": "T5YIFR", "name": "5Y5Y Forward Inflation Expectation Rate", "category": "inflation", "frequency": "daily", "units": "percent", "higher_is": "contextual", "max_stale_days": 10, "notes": "Longer-run market inflation expectation proxy from FRED."},
    {"id": "cfnai", "fred_id": "CFNAI", "name": "Chicago Fed National Activity Index", "category": "growth", "frequency": "monthly", "units": "index", "higher_is": "supportive", "max_stale_days": 75, "notes": "Broad monthly U.S. activity gauge from FRED."},
    {"id": "cfnai_3m_avg", "fred_id": "CFNAIMA3", "name": "CFNAI 3-Month Moving Average", "category": "growth", "frequency": "monthly", "units": "index", "higher_is": "supportive", "max_stale_days": 75, "notes": "Smoothed CFNAI regime input from FRED."},
    {"id": "real_retail_sales", "fred_id": "RRSFS", "name": "Real Retail and Food Services Sales", "category": "growth", "frequency": "monthly", "units": "millions_chained_2017_usd", "higher_is": "supportive", "max_stale_days": 75, "notes": "Inflation-adjusted consumer demand from FRED."},
    {"id": "industrial_production", "fred_id": "INDPRO", "name": "Industrial Production Index", "category": "growth", "frequency": "monthly", "units": "index", "higher_is": "supportive", "max_stale_days": 75, "notes": "Cyclical production pulse from FRED."},
    {"id": "durable_goods_orders", "fred_id": "DGORDER", "name": "Manufacturers' New Orders: Durable Goods", "category": "growth", "frequency": "monthly", "units": "millions_usd", "higher_is": "supportive", "max_stale_days": 75, "notes": "Manufacturing demand and capex proxy from FRED."},
    {"id": "unemployment_rate", "fred_id": "UNRATE", "name": "Unemployment Rate", "category": "labor", "frequency": "monthly", "units": "percent", "higher_is": "riskier", "max_stale_days": 45, "notes": "U-3 unemployment rate from FRED."},
    {"id": "nonfarm_payrolls", "fred_id": "PAYEMS", "name": "All Employees, Total Nonfarm", "category": "labor", "frequency": "monthly", "units": "thousands", "higher_is": "supportive", "max_stale_days": 45, "notes": "Employment growth momentum from FRED."},
    {"id": "initial_claims", "fred_id": "ICSA", "name": "Initial Jobless Claims", "category": "labor", "frequency": "weekly", "units": "persons", "higher_is": "riskier", "max_stale_days": 14, "notes": "Higher-frequency labor weakening signal from FRED."},
    {"id": "sahm_rule", "fred_id": "SAHMREALTIME", "name": "Real-Time Sahm Rule Recession Indicator", "category": "labor", "frequency": "monthly", "units": "percentage_points", "higher_is": "riskier", "max_stale_days": 45, "notes": "Recession-onset labor rule from FRED."},
    {"id": "headline_cpi", "fred_id": "CPIAUCSL", "name": "Headline CPI", "category": "inflation", "frequency": "monthly", "units": "index", "higher_is": "contextual", "max_stale_days": 45, "notes": "Consumer price index from FRED."},
    {"id": "core_cpi", "fred_id": "CPILFESL", "name": "Core CPI", "category": "inflation", "frequency": "monthly", "units": "index", "higher_is": "contextual", "max_stale_days": 45, "notes": "CPI excluding food and energy from FRED."},
    {"id": "core_pce", "fred_id": "PCEPILFE", "name": "Core PCE Price Index", "category": "inflation", "frequency": "monthly", "units": "index", "higher_is": "contextual", "max_stale_days": 45, "notes": "PCE excluding food and energy from FRED."},
    {"id": "ppi_final_demand", "fred_id": "PPIFIS", "name": "PPI Final Demand", "category": "inflation", "frequency": "monthly", "units": "index", "higher_is": "contextual", "max_stale_days": 45, "notes": "Producer-price pipeline pressure from FRED."},
    {"id": "broad_dollar", "fred_id": "DTWEXBGS", "name": "Nominal Broad U.S. Dollar Index", "category": "dollar", "frequency": "daily", "units": "index", "higher_is": "riskier", "max_stale_days": 10, "notes": "Broad dollar index from FRED."},
    {"id": "usdjpy", "fred_id": "DEXJPUS", "name": "Japanese Yen to U.S. Dollar Exchange Rate", "category": "dollar", "frequency": "daily", "units": "yen_per_usd", "higher_is": "contextual", "max_stale_days": 10, "notes": "USDJPY exchange-rate context from FRED."},
    {"id": "eurusd", "fred_id": "DEXUSEU", "name": "U.S. Dollar to Euro Exchange Rate", "category": "dollar", "frequency": "daily", "units": "usd_per_eur", "higher_is": "contextual", "max_stale_days": 10, "notes": "EURUSD exchange-rate context from FRED."},
    {"id": "reserve_balances", "fred_id": "WRESBAL", "name": "Reserve Balances with Federal Reserve Banks", "category": "banking", "frequency": "weekly", "units": "millions_usd", "higher_is": "supportive", "max_stale_days": 14, "notes": "Bank reserve balances from FRED."},
    {"id": "bank_credit", "fred_id": "TOTBKCR", "name": "Bank Credit, All Commercial Banks", "category": "banking", "frequency": "weekly", "units": "billions_usd", "higher_is": "supportive", "max_stale_days": 14, "notes": "Commercial bank credit from FRED."},
    {"id": "loans_and_leases", "fred_id": "TOTLL", "name": "Loans and Leases in Bank Credit", "category": "banking", "frequency": "weekly", "units": "billions_usd", "higher_is": "supportive", "max_stale_days": 14, "notes": "Private credit creation proxy from FRED."},
    {"id": "business_loans", "fred_id": "BUSLOANS", "name": "Commercial and Industrial Loans", "category": "banking", "frequency": "weekly", "units": "billions_usd", "higher_is": "supportive", "max_stale_days": 14, "notes": "Business-credit impulse from FRED."},
    {"id": "bank_deposits", "fred_id": "DPSACBW027SBOG", "name": "Deposits at All Commercial Banks", "category": "banking", "frequency": "weekly", "units": "billions_usd", "higher_is": "supportive", "max_stale_days": 14, "notes": "Deposit liquidity context from FRED."},
]

FRED_SERIES.extend(PHASE3_FRED_SERIES)
```

- [ ] **Step 5: Add active Cboe volatility catalog entries**

Replace `CBOE_VIX` with a list:

```python
CBOE_INDEX_SERIES = [
    {
        "id": "vix",
        "name": "CBOE Volatility Index",
        "endpoint_url": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
        "value_columns": ("CLOSE", "VIX"),
    },
    {
        "id": "vvix",
        "name": "Cboe VVIX Index",
        "endpoint_url": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VVIX_History.csv",
        "value_columns": ("CLOSE", "VVIX"),
    },
    {
        "id": "vix9d",
        "name": "Cboe 9-Day Volatility Index",
        "endpoint_url": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX9D_History.csv",
        "value_columns": ("CLOSE", "VIX9D"),
    },
    {
        "id": "vix3m",
        "name": "Cboe 3-Month Volatility Index",
        "endpoint_url": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX3M_History.csv",
        "value_columns": ("CLOSE", "VIX3M"),
    },
]
```

In `catalog_entries()`, build each Cboe entry with category `volatility`, source `Cboe`, frequency `daily`, units `index`, `higher_is` `riskier`, `max_stale_days` `7`, and `governance("cboe")`.

- [ ] **Step 6: Update FRED ingestion to fetch active FRED entries only**

In `scripts/ingest/fetch_fred_csv.py`, add:

```python
def active_fred_series() -> list[dict[str, object]]:
    return [
        series
        for series in FRED_SERIES
        if str(series.get("score_status", "active")) == "active"
    ]
```

Change the main loop to:

```python
for series in active_fred_series():
```

- [ ] **Step 7: Update Cboe ingestion**

Replace VIX-specific parsing with a generic function:

```python
def normalize_cboe_rows(
    rows: list[dict[str, str]],
    series_id: str,
    value_columns: tuple[str, ...],
) -> list[dict[str, float | str]]:
    if not rows:
        raise ValueError(f"no rows returned for {series_id}")

    columns = set(rows[0])
    has_date = any(column in columns for column in DATE_COLUMNS)
    has_value = any(column in columns for column in value_columns)
    if not has_date or not has_value:
        raise ValueError(f"missing required Cboe columns for {series_id}")

    observations = []
    for row in rows:
        raw_date = first_value(row, DATE_COLUMNS)
        raw_value = first_value(row, value_columns)
        try:
            value = parse_float(raw_value)
        except ValueError as error:
            raise ValueError(f"invalid numeric value for {series_id}: {raw_value}") from error
        if value is None:
            continue
        if not raw_date:
            raise ValueError(f"missing date for {series_id}")
        date = require_iso_date(normalize_date(raw_date))
        observations.append({"date": date, "value": value})

    if not observations:
        raise ValueError(f"no observations parsed for {series_id}")

    observations.sort(key=lambda item: str(item["date"]))
    return observations
```

In `main()`, loop through `CBOE_INDEX_SERIES`, download each endpoint, call `normalize_cboe_rows`, and write each `series_path(id)` with the same JSON shape currently used for VIX.

- [ ] **Step 8: Run tests and verify they pass**

Run:

```bash
python3 -m pytest tests/python/test_catalog.py tests/python/test_fetchers.py -v
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add scripts/shared/catalog.py scripts/ingest/fetch_fred_csv.py scripts/ingest/fetch_cboe.py tests/python/test_catalog.py tests/python/test_fetchers.py
git commit -m "feat: add phase 3 public data catalog"
```

## Task 4: Add 3M And 12M Change Summaries

**Files:**
- Modify: `scripts/transform/compute_percentiles.py`
- Modify: `tests/python/test_scoring.py`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add failing summary tests**

Append to `tests/python/test_scoring.py`:

```python
def test_series_summary_daily_includes_three_and_twelve_month_changes():
    observations = [
        {"date": f"2025-01-{day:02d}", "value": float(day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-02-{day:02d}", "value": float(28 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-03-{day:02d}", "value": float(56 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-04-{day:02d}", "value": float(84 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-05-{day:02d}", "value": float(112 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-06-{day:02d}", "value": float(140 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-07-{day:02d}", "value": float(168 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-08-{day:02d}", "value": float(196 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-09-{day:02d}", "value": float(224 + day)}
        for day in range(1, 29)
    ] + [
        {"date": f"2025-10-{day:02d}", "value": float(252 + day)}
        for day in range(1, 29)
    ]

    summary = series_summary(observations, frequency="daily")

    assert summary["change_3m"] == 63.0
    assert summary["change_12m"] is None


def test_series_summary_monthly_includes_three_and_twelve_month_changes():
    observations = [
        {"date": f"2025-{month:02d}-01", "value": float(month)}
        for month in range(1, 13)
    ] + [{"date": "2026-01-01", "value": 20.0}]

    summary = series_summary(observations, frequency="monthly")

    assert summary["change_3m"] == 10.0
    assert summary["change_12m"] == 19.0
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py::test_series_summary_daily_includes_three_and_twelve_month_changes tests/python/test_scoring.py::test_series_summary_monthly_includes_three_and_twelve_month_changes -v
```

Expected: FAIL because summaries do not include `change_3m` or `change_12m`.

- [ ] **Step 3: Update change offsets**

Change `change_offsets()` to return:

```python
def change_offsets(frequency: str = "daily") -> dict[str, int]:
    if frequency == "weekly":
        return {"change_1d": 1, "change_1w": 1, "change_1m": 4, "change_3m": 13, "change_12m": 52}
    if frequency == "monthly":
        return {"change_1d": 1, "change_1w": 1, "change_1m": 1, "change_3m": 3, "change_12m": 12}
    return {"change_1d": 1, "change_1w": 5, "change_1m": 21, "change_3m": 63, "change_12m": 252}
```

Update the empty summary and normal summary returns to include:

```python
"change_3m": change_from_index(observations, offsets["change_3m"]),
"change_12m": change_from_index(observations, offsets["change_12m"]),
```

- [ ] **Step 4: Ensure TypeScript summary accepts the fields**

In `src/lib/types.ts`, confirm `SeriesSummary` includes:

```ts
change_3m?: number | null;
change_12m?: number | null;
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py -v
npm test -- src/lib/data.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/transform/compute_percentiles.py tests/python/test_scoring.py src/lib/types.ts
git commit -m "feat: add longer horizon series changes"
```

## Task 5: Add Derived Macro Drivers

**Files:**
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `tests/python/test_scoring.py`

- [ ] **Step 1: Add failing derived metric tests**

Append to `tests/python/test_scoring.py`:

```python
from scripts.transform.compute_regime_score import (
    build_commodity_inflation_impulse,
    build_ratio_series,
)


def test_build_ratio_series_matches_observations_by_date(monkeypatch):
    source_series = {
        "vix9d": {
            "frequency": "daily",
            "observations": [
                {"date": "2026-05-01", "value": 24.0},
                {"date": "2026-05-04", "value": 30.0},
            ],
        },
        "vix": {
            "frequency": "daily",
            "observations": [
                {"date": "2026-05-01", "value": 20.0},
                {"date": "2026-05-04", "value": 15.0},
            ],
        },
    }
    monkeypatch.setattr(compute_regime_score, "load_series", source_series.__getitem__)

    ratio = build_ratio_series(
        "vix9d",
        "vix",
        "vix9d_vix_ratio",
        "2026-05-04T00:00:00Z",
        "ratio",
        "VIX9D divided by VIX by matched observation date.",
    )

    assert ratio["observations"][-1]["value"] == 2.0
    assert ratio["summary"]["latest_value"] == 2.0


def test_build_commodity_inflation_impulse_uses_momentum_not_raw_percentile():
    series = {
        "wti_crude": {"summary": {"latest_value": 80.0, "change_3m": 20.0, "change_12m": 10.0}},
        "brent_crude": {"summary": {"latest_value": 84.0, "change_3m": 21.0, "change_12m": 12.0}},
        "corn_price": {"summary": {"latest_value": 200.0, "change_3m": 10.0, "change_12m": 0.0}},
        "wheat_price": {"summary": {"latest_value": 220.0, "change_3m": -5.0, "change_12m": 5.0}},
        "soybean_price": {"summary": {"latest_value": 300.0, "change_3m": 15.0, "change_12m": 30.0}},
        "breakeven_10y": {"summary": {"change_3m": 0.25, "change_12m": 0.5}},
    }

    impulse = build_commodity_inflation_impulse(series, "2026-05-04T00:00:00Z")

    assert impulse["series_id"] == "commodity_inflation_impulse"
    assert impulse["summary"]["latest_value"] < 0
    assert "oil 3-month" in impulse["method"]
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py::test_build_ratio_series_matches_observations_by_date tests/python/test_scoring.py::test_build_commodity_inflation_impulse_uses_momentum_not_raw_percentile -v
```

Expected: FAIL because `build_ratio_series` and `build_commodity_inflation_impulse` do not exist.

- [ ] **Step 3: Implement `build_ratio_series()`**

In `scripts/transform/compute_regime_score.py`, add:

```python
def build_ratio_series(
    numerator_series_id: str,
    denominator_series_id: str,
    ratio_series_id: str,
    generated_at: str,
    units: str,
    method: str,
) -> dict[str, Any]:
    numerator = load_series(numerator_series_id)
    denominator = load_series(denominator_series_id)
    denominator_by_date = {
        observation["date"]: observation["value"]
        for observation in denominator.get("observations", [])
    }
    observations = []
    for observation in numerator.get("observations", []):
        date = observation.get("date")
        numerator_value = observation.get("value")
        denominator_value = denominator_by_date.get(date)
        if (
            isinstance(numerator_value, int | float)
            and isinstance(denominator_value, int | float)
            and float(denominator_value) != 0
        ):
            observations.append({"date": date, "value": round(float(numerator_value) / float(denominator_value), 4)})

    frequency = str(numerator.get("frequency", "daily"))
    observations = enrich_observations(observations, frequency)
    return {
        "series_id": ratio_series_id,
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": f"/data/series/{numerator_series_id}.json",
        "frequency": frequency,
        "units": units,
        "depends_on": [numerator_series_id, denominator_series_id],
        "method": method,
        "summary": series_summary(observations, frequency),
        "observations": observations,
    }
```

- [ ] **Step 4: Implement commodity impulse helper**

Add:

```python
def _change_pct(summary: dict[str, Any], key: str) -> float | None:
    latest = summary.get("latest_value")
    change = summary.get(key)
    if not isinstance(latest, int | float) or not isinstance(change, int | float):
        return None
    previous = float(latest) - float(change)
    if previous == 0:
        return None
    return float(change) / abs(previous) * 100


def _mean_available(values: list[float | None]) -> float | None:
    available = [value for value in values if isinstance(value, int | float)]
    if not available:
        return None
    return sum(available) / len(available)


def build_commodity_inflation_impulse(
    series_by_id: dict[str, dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    oil_3m = _mean_available([
        _change_pct(latest_summary(series_by_id[series_id]), "change_3m")
        for series_id in ["wti_crude", "brent_crude"]
        if series_id in series_by_id
    ])
    oil_12m = _mean_available([
        _change_pct(latest_summary(series_by_id[series_id]), "change_12m")
        for series_id in ["wti_crude", "brent_crude"]
        if series_id in series_by_id
    ])
    crop_3m = _mean_available([
        _change_pct(latest_summary(series_by_id[series_id]), "change_3m")
        for series_id in ["corn_price", "wheat_price", "soybean_price"]
        if series_id in series_by_id
    ])
    crop_12m = _mean_available([
        _change_pct(latest_summary(series_by_id[series_id]), "change_12m")
        for series_id in ["corn_price", "wheat_price", "soybean_price"]
        if series_id in series_by_id
    ])
    breakeven_confirmation = latest_summary(series_by_id["breakeven_10y"]).get("change_3m") if "breakeven_10y" in series_by_id else None

    components = {
        "oil_3m": clamp(-(oil_3m or 0.0) * 4),
        "oil_12m": clamp(-(oil_12m or 0.0) * 2),
        "crop": clamp(-(_mean_available([crop_3m, crop_12m]) or 0.0) * 2),
        "breakeven": clamp(-(float(breakeven_confirmation) * 80) if isinstance(breakeven_confirmation, int | float) else 0.0),
    }
    value = weighted_score(components, {"oil_3m": 0.40, "oil_12m": 0.20, "crop": 0.20, "breakeven": 0.20})
    latest_dates = [
        latest_summary(series).get("latest_date")
        for series in series_by_id.values()
        if isinstance(latest_summary(series).get("latest_date"), str)
    ]
    latest_date = max(latest_dates) if latest_dates else generated_at[:10]
    observations = enrich_observations([{"date": latest_date, "value": value}], "daily")
    return {
        "series_id": "commodity_inflation_impulse",
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": "/data/series/wti_crude.json",
        "frequency": "daily",
        "units": "score",
        "depends_on": ["wti_crude", "brent_crude", "corn_price", "wheat_price", "soybean_price", "breakeven_10y"],
        "method": "Commodity inflation impulse from oil 3-month change, oil 12-month change, crop basket momentum, and breakeven confirmation.",
        "summary": series_summary(observations, "daily"),
        "observations": observations,
    }
```

- [ ] **Step 5: Emit derived files in `main()`**

After existing spread and liquidity derived files, add:

```python
derived_specs = [
    ("high_yield_oas", "investment_grade_oas", "hy_minus_ig_oas", "percentage_points", "High-yield OAS minus investment-grade OAS by matched observation date."),
    ("vix9d", "vix", "vix9d_vix_ratio", "ratio", "VIX9D divided by VIX by matched observation date."),
    ("vix", "vix3m", "vix_vix3m_ratio", "ratio", "VIX divided by VIX3M by matched observation date."),
]
for left_id, right_id, derived_id, units, method in derived_specs:
    if left_id in series_by_id and right_id in series_by_id:
        if derived_id.endswith("_ratio"):
            derived = build_ratio_series(left_id, right_id, derived_id, generated_at, units, method)
        else:
            derived = build_matched_spread(left_id, right_id, derived_id, generated_at, units, method)
        write_json(data_dir() / "derived" / f"{derived_id}.json", derived)
        series_by_id[derived_id] = derived

commodity_impulse = build_commodity_inflation_impulse(series_by_id, generated_at)
write_json(data_dir() / "derived" / "commodity_inflation_impulse.json", commodity_impulse)
series_by_id["commodity_inflation_impulse"] = commodity_impulse
```

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/transform/compute_regime_score.py tests/python/test_scoring.py
git commit -m "feat: derive phase 3 macro drivers"
```

## Task 6: Add Score Model Helpers

**Files:**
- Create: `scripts/transform/score_models.py`
- Create: `tests/python/test_score_models.py`

- [ ] **Step 1: Add failing score model tests**

Create `tests/python/test_score_models.py`:

```python
from scripts.transform.score_models import (
    ScoreDriver,
    confidence_from_reasons,
    driver_texts,
    label_for_three_score,
    score_block,
    weighted_score,
)


def test_score_block_includes_specific_driver_text_and_confidence():
    drivers = [
        ScoreDriver(
            bucket="credit_spreads",
            direction="risk",
            impact=-35.0,
            text="High-yield spreads widened over the past month.",
            series_id="high_yield_oas",
            latest_value=4.2,
            recent_change=0.4,
        ),
        ScoreDriver(
            bucket="liquidity",
            direction="support",
            impact=18.0,
            text="Reserve balances improved over the past month.",
            series_id="reserve_balances",
            latest_value=3300000.0,
            recent_change=120000.0,
        ),
    ]

    block = score_block(
        score=-12.0,
        label="Mixed",
        bucket_scores={"credit_spreads": -35.0, "liquidity": 18.0},
        bucket_weights={"credit_spreads": 0.2, "liquidity": 0.2},
        drivers=drivers,
        confidence_reasons=["Treasury/bond volatility source is not active."],
        missing_or_stale_notes=["MOVE is a candidate input."],
    )

    assert block["top_risks"] == ["High-yield spreads widened over the past month."]
    assert block["top_supports"] == ["Reserve balances improved over the past month."]
    assert block["confidence"] == 0.9
    assert block["confidence_reasons"] == ["Treasury/bond volatility source is not active."]


def test_confidence_from_reasons_has_floor_and_penalty_per_reason():
    assert confidence_from_reasons([]) == 1.0
    assert confidence_from_reasons(["a", "b", "c", "d", "e", "f"]) == 0.4


def test_three_score_labeling_is_conservative():
    assert label_for_three_score(-55.0, "market_weather") == "Stressed"
    assert label_for_three_score(-30.0, "fragility") == "Elevated Fragility"
    assert label_for_three_score(25.0, "macro_climate") == "Supportive"


def test_driver_texts_returns_ordered_unique_strings():
    drivers = [
        ScoreDriver("credit", "risk", -20, "Credit spreads widened.", "high_yield_oas", 4.0, 0.2),
        ScoreDriver("credit", "risk", -10, "Credit spreads widened.", "bbb_oas", 2.0, 0.1),
        ScoreDriver("rates", "risk", -15, "10Y real yield is elevated.", "real_yield_10y", 2.1, 0.3),
    ]

    assert driver_texts(drivers, "risk") == [
        "Credit spreads widened.",
        "10Y real yield is elevated.",
    ]
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
python3 -m pytest tests/python/test_score_models.py -v
```

Expected: FAIL because `scripts/transform/score_models.py` does not exist.

- [ ] **Step 3: Create `scripts/transform/score_models.py`**

Create:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ScoreDriver:
    bucket: str
    direction: Literal["support", "risk"]
    impact: float
    text: str
    series_id: str
    latest_value: float | None
    recent_change: float | None


def clamp(value: float) -> float:
    return round(max(-100.0, min(100.0, float(value))), 2)


def weighted_score(scores: dict[str, float], weights: dict[str, float]) -> float:
    total_weight = sum(weight for key, weight in weights.items() if key in scores)
    if total_weight == 0:
        return 0.0
    score = sum(scores[key] * weights[key] for key in scores if key in weights) / total_weight
    return clamp(score)


def confidence_from_reasons(reasons: list[str]) -> float:
    return round(max(0.4, 1.0 - (len(reasons) * 0.1)), 2)


def driver_texts(drivers: list[ScoreDriver], direction: Literal["support", "risk"], limit: int = 3) -> list[str]:
    ordered = sorted(
        [driver for driver in drivers if driver.direction == direction],
        key=lambda driver: abs(driver.impact),
        reverse=True,
    )
    texts: list[str] = []
    for driver in ordered:
        if driver.text not in texts:
            texts.append(driver.text)
        if len(texts) == limit:
            break
    return texts


def label_for_three_score(score: float, score_key: str) -> str:
    if score_key == "fragility":
        if score <= -50:
            return "High Fragility"
        if score <= -20:
            return "Elevated Fragility"
        if score < 20:
            return "Moderate"
        return "Low Fragility"
    if score <= -50:
        return "Stressed"
    if score <= -20:
        return "Fragile"
    if score < 20:
        return "Mixed"
    return "Supportive"


def score_block(
    score: float,
    label: str,
    bucket_scores: dict[str, float],
    bucket_weights: dict[str, float],
    drivers: list[ScoreDriver],
    confidence_reasons: list[str],
    missing_or_stale_notes: list[str],
) -> dict[str, object]:
    recent_changes = driver_texts(drivers, "risk", limit=2) + driver_texts(drivers, "support", limit=2)
    return {
        "score": clamp(score),
        "label": label,
        "confidence": confidence_from_reasons(confidence_reasons + missing_or_stale_notes),
        "confidence_reasons": confidence_reasons,
        "bucket_scores": bucket_scores,
        "bucket_weights": bucket_weights,
        "top_supports": driver_texts(drivers, "support"),
        "top_risks": driver_texts(drivers, "risk"),
        "recent_changes": recent_changes[:4],
        "missing_or_stale_notes": missing_or_stale_notes,
    }
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
python3 -m pytest tests/python/test_score_models.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/transform/score_models.py tests/python/test_score_models.py
git commit -m "feat: add score model helpers"
```

## Task 7: Assemble Three Scores And Emit `score_summary.json`

**Files:**
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `scripts/validate/validate_schema.py`
- Modify: `tests/python/test_scoring.py`

- [ ] **Step 1: Add failing score summary tests**

Append to `tests/python/test_scoring.py`:

```python
from scripts.transform.compute_regime_score import build_score_summary


def test_build_score_summary_returns_three_scores_with_specific_drivers():
    series = {
        "high_yield_oas": {"summary": {"latest_date": "2026-05-01", "latest_value": 4.5, "change_1m": 0.5, "percentile_252d": 80}},
        "investment_grade_oas": {"summary": {"latest_date": "2026-05-01", "latest_value": 1.2, "change_1m": 0.1, "percentile_252d": 50}},
        "bbb_oas": {"summary": {"latest_date": "2026-05-01", "latest_value": 1.8, "change_1m": 0.2, "percentile_252d": 65}},
        "net_liquidity": {"summary": {"latest_date": "2026-04-30", "latest_value": 5700000, "change_1m": 100000}},
        "real_yield_10y": {"summary": {"latest_date": "2026-05-01", "latest_value": 2.0, "change_1m": 0.2, "percentile_252d": 85}},
        "vix": {"summary": {"latest_date": "2026-05-01", "latest_value": 18.0, "change_1m": 1.0, "percentile_252d": 55}},
        "broad_dollar": {"summary": {"latest_date": "2026-05-01", "latest_value": 124.0, "change_1m": 2.0, "change_3m": 5.0, "percentile_252d": 90}},
        "commodity_inflation_impulse": {"summary": {"latest_date": "2026-05-01", "latest_value": -30.0, "percentile_252d": 20}},
        "cftc_sp500_lev_money_net": {"summary": {"latest_date": "2026-04-28", "latest_value": 20.0, "percentile_252d": 95}},
        "cftc_sp500_asset_mgr_net": {"summary": {"latest_date": "2026-04-28", "latest_value": 40.0, "percentile_252d": 60}},
        "cfnai": {"summary": {"latest_date": "2026-04-01", "latest_value": -0.2, "change_1m": -0.3, "percentile_252d": 40}},
        "cfnai_3m_avg": {"summary": {"latest_date": "2026-04-01", "latest_value": -0.1, "change_1m": -0.1, "percentile_252d": 45}},
        "unemployment_rate": {"summary": {"latest_date": "2026-04-01", "latest_value": 4.1, "change_1m": 0.1, "percentile_252d": 60}},
        "initial_claims": {"summary": {"latest_date": "2026-04-25", "latest_value": 230000, "change_1m": 10000, "percentile_252d": 70}},
        "headline_cpi": {"summary": {"latest_date": "2026-04-01", "latest_value": 320.0, "change_3m": 2.0, "change_12m": 10.0, "percentile_252d": 75}},
        "core_cpi": {"summary": {"latest_date": "2026-04-01", "latest_value": 330.0, "change_3m": 1.5, "change_12m": 8.0, "percentile_252d": 70}},
        "core_pce": {"summary": {"latest_date": "2026-04-01", "latest_value": 125.0, "change_3m": 0.9, "change_12m": 3.5, "percentile_252d": 65}},
        "real_retail_sales": {"summary": {"latest_date": "2026-04-01", "latest_value": 250000, "change_1m": -1000, "percentile_252d": 45}},
        "industrial_production": {"summary": {"latest_date": "2026-04-01", "latest_value": 103.0, "change_1m": -0.2, "percentile_252d": 45}},
        "durable_goods_orders": {"summary": {"latest_date": "2026-04-01", "latest_value": 300000, "change_1m": 2000, "percentile_252d": 55}},
    }

    summary = build_score_summary(series, "2026-05-04T00:00:00Z")

    assert set(summary["scores"]) == {"market_weather", "macro_climate", "fragility"}
    assert "High-yield spreads widened over the past month." in summary["scores"]["market_weather"]["top_risks"]
    assert summary["scores"]["macro_climate"]["confidence"] < 1.0
    assert "Housing is not active in Phase 3." in summary["scores"]["macro_climate"]["missing_or_stale_notes"]
    assert summary["data_quality"]["overall_confidence"] <= 1.0
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py::test_build_score_summary_returns_three_scores_with_specific_drivers -v
```

Expected: FAIL because `build_score_summary` does not exist.

- [ ] **Step 3: Import score helpers**

At the top of `scripts/transform/compute_regime_score.py`, add:

```python
from scripts.transform.score_models import (
    ScoreDriver,
    label_for_three_score,
    score_block,
    weighted_score as weighted_three_score,
)
```

Keep the existing `weighted_score` function for old callers in this task. Use the imported alias `weighted_three_score` only inside `build_score_summary()`.

- [ ] **Step 4: Add bucket score helpers**

Add helpers that use existing `latest_summary()` and `score_inverse_percentile()`:

```python
def _summary_score(series_by_id: dict[str, dict[str, Any]], series_id: str, inverse: bool = True) -> float:
    if series_id not in series_by_id:
        return 0.0
    summary = latest_summary(series_by_id[series_id])
    return score_inverse_percentile(summary) if inverse else clamp((float(summary.get("percentile_252d") or 50) - 50) * 2)


def _inflation_momentum_score(series_by_id: dict[str, dict[str, Any]], series_id: str) -> float:
    if series_id not in series_by_id:
        return 0.0
    summary = latest_summary(series_by_id[series_id])
    three_month = _change_pct(summary, "change_3m")
    twelve_month = _change_pct(summary, "change_12m")
    if three_month is None and twelve_month is None:
        return 0.0
    three_score = clamp(-(three_month or 0.0) * 8)
    twelve_score = clamp(-(twelve_month or 0.0) * 3)
    return weighted_score({"three_month": three_score, "twelve_month": twelve_score}, {"three_month": 0.65, "twelve_month": 0.35})


def _driver(
    bucket: str,
    direction: str,
    impact: float,
    text: str,
    series_id: str,
    series_by_id: dict[str, dict[str, Any]],
) -> ScoreDriver:
    summary = latest_summary(series_by_id[series_id]) if series_id in series_by_id else {}
    latest_value = summary.get("latest_value")
    recent_change = summary.get("change_1m")
    return ScoreDriver(
        bucket=bucket,
        direction=direction,  # type: ignore[arg-type]
        impact=impact,
        text=text,
        series_id=series_id,
        latest_value=float(latest_value) if isinstance(latest_value, int | float) else None,
        recent_change=float(recent_change) if isinstance(recent_change, int | float) else None,
    )
```

- [ ] **Step 5: Implement `build_score_summary()`**

Add:

```python
def build_score_summary(series_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    market_buckets = {
        "credit_spreads": score_credit(series_by_id),
        "liquidity_funding": score_liquidity(series_by_id),
        "rates_real_yields": weighted_score(
            {
                "nominal_rates": score_rates(series_by_id),
                "real_yield_10y": _summary_score(series_by_id, "real_yield_10y"),
            },
            {"nominal_rates": 0.4, "real_yield_10y": 0.6},
        ),
        "volatility_tail_risk": score_volatility(series_by_id),
        "dollar_global": _summary_score(series_by_id, "broad_dollar"),
        "commodities_inflation_impulse": _summary_score(series_by_id, "commodity_inflation_impulse", inverse=False),
        "sentiment_positioning": score_sentiment(series_by_id),
    }
    market_weights = {
        "credit_spreads": 0.20,
        "liquidity_funding": 0.20,
        "rates_real_yields": 0.15,
        "volatility_tail_risk": 0.15,
        "dollar_global": 0.10,
        "commodities_inflation_impulse": 0.10,
        "sentiment_positioning": 0.10,
    }

    macro_buckets = {
        "growth": weighted_score({"cfnai": _summary_score(series_by_id, "cfnai", inverse=False), "cfnai_3m_avg": _summary_score(series_by_id, "cfnai_3m_avg", inverse=False)}, {"cfnai": 0.4, "cfnai_3m_avg": 0.6}),
        "labor_recession": weighted_score({"unemployment_rate": _summary_score(series_by_id, "unemployment_rate"), "initial_claims": _summary_score(series_by_id, "initial_claims"), "sahm_rule": _summary_score(series_by_id, "sahm_rule")}, {"unemployment_rate": 0.35, "initial_claims": 0.35, "sahm_rule": 0.30}),
        "inflation": weighted_score(
            {
                "headline_cpi": _inflation_momentum_score(series_by_id, "headline_cpi"),
                "core_cpi": _inflation_momentum_score(series_by_id, "core_cpi"),
                "core_pce": _inflation_momentum_score(series_by_id, "core_pce"),
                "ppi_final_demand": _inflation_momentum_score(series_by_id, "ppi_final_demand"),
                "breakeven_10y": _summary_score(series_by_id, "breakeven_10y"),
            },
            {"headline_cpi": 0.20, "core_cpi": 0.25, "core_pce": 0.30, "ppi_final_demand": 0.10, "breakeven_10y": 0.15},
        ),
        "policy_real_rates": _summary_score(series_by_id, "real_yield_10y"),
        "consumer_production": weighted_score({"real_retail_sales": _summary_score(series_by_id, "real_retail_sales", inverse=False), "industrial_production": _summary_score(series_by_id, "industrial_production", inverse=False), "durable_goods_orders": _summary_score(series_by_id, "durable_goods_orders", inverse=False)}, {"real_retail_sales": 0.4, "industrial_production": 0.35, "durable_goods_orders": 0.25}),
    }
    macro_weights = {"growth": 0.25, "labor_recession": 0.20, "inflation": 0.25, "policy_real_rates": 0.15, "consumer_production": 0.15}

    fragility_buckets = {
        "credit_spread_widening": market_buckets["credit_spreads"],
        "volatility_term_structure": weighted_score({"vix": score_volatility(series_by_id), "vix9d_vix_ratio": _summary_score(series_by_id, "vix9d_vix_ratio")}, {"vix": 0.4, "vix9d_vix_ratio": 0.6}),
        "dollar_spike": market_buckets["dollar_global"],
        "liquidity_drain": market_buckets["liquidity_funding"],
        "positioning_crowding": market_buckets["sentiment_positioning"],
        "treasury_bond_volatility": 0.0,
    }
    fragility_weights = {"credit_spread_widening": 0.25, "volatility_term_structure": 0.20, "dollar_spike": 0.15, "liquidity_drain": 0.15, "positioning_crowding": 0.15, "treasury_bond_volatility": 0.10}

    drivers = [
        _driver("credit_spreads", "risk", -35.0, "High-yield spreads widened over the past month.", "high_yield_oas", series_by_id),
        _driver("rates_real_yields", "risk", -20.0, "10Y real yield is in the upper historical percentile.", "real_yield_10y", series_by_id),
        _driver("inflation", "risk", -18.0, "Core inflation momentum remains elevated.", "core_cpi", series_by_id),
        _driver("dollar_global", "risk", -16.0, "Broad dollar strength is tightening global conditions.", "broad_dollar", series_by_id),
        _driver("sentiment_positioning", "risk", -15.0, "Leveraged-money S&P 500 positioning is crowded.", "cftc_sp500_lev_money_net", series_by_id),
        _driver("liquidity_funding", "support", 14.0, "Reserve balances improved over the past month.", "reserve_balances", series_by_id) if "reserve_balances" in series_by_id else _driver("liquidity_funding", "support", 10.0, "Net liquidity improved over the past month.", "net_liquidity", series_by_id),
    ]

    market_score = weighted_three_score(market_buckets, market_weights)
    macro_score = weighted_three_score(macro_buckets, macro_weights)
    fragility_score = weighted_three_score(fragility_buckets, fragility_weights)

    macro_notes = ["Housing is not active in Phase 3."]
    fragility_notes = ["Treasury/bond volatility source is not active."]
    market_reasons = ["Sentiment is limited to CFTC positioning."]

    latest_dates = [
        latest_summary(series).get("latest_date")
        for series in series_by_id.values()
        if isinstance(latest_summary(series).get("latest_date"), str)
    ]
    latest_date = max(latest_dates) if latest_dates else generated_at[:10]

    market_block = score_block(market_score, label_for_three_score(market_score, "market_weather"), market_buckets, market_weights, drivers, market_reasons, [])
    macro_block = score_block(macro_score, label_for_three_score(macro_score, "macro_climate"), macro_buckets, macro_weights, drivers, [], macro_notes)
    fragility_block = score_block(fragility_score, label_for_three_score(fragility_score, "fragility"), fragility_buckets, fragility_weights, drivers, [], fragility_notes)
    overall_confidence = round((float(market_block["confidence"]) + float(macro_block["confidence"]) + float(fragility_block["confidence"])) / 3, 2)

    return {
        "generated_at_utc": generated_at,
        "date": latest_date,
        "method_version": METHOD_VERSION,
        "scores": {
            "market_weather": market_block,
            "macro_climate": macro_block,
            "fragility": fragility_block,
        },
        "conflicting_signals": ["Credit is calm while inflation momentum is elevated."] if macro_buckets["inflation"] < -20 and market_buckets["credit_spreads"] > 0 else [],
        "data_quality": {
            "overall_confidence": overall_confidence,
            "reasons": sorted(set(market_reasons + macro_notes + fragility_notes)),
        },
    }
```

- [ ] **Step 6: Update method version**

Set:

```python
METHOD_VERSION = "phase3-three-score-v1"
```

- [ ] **Step 7: Emit score summary and compatibility outputs**

In `main()`, after building derived series and before status:

```python
score_summary = build_score_summary(series_by_id, generated_at)
write_json(data_dir() / "derived" / "score_summary.json", score_summary)

market_weather = score_summary["scores"]["market_weather"]
buckets = dict(market_weather["bucket_scores"])
weights = dict(market_weather["bucket_weights"])
overall_score = float(market_weather["score"])
latest_date = str(score_summary["date"])
```

Keep writing `bucket_scores.json` and `regime_score.json`, but use `market_weather["top_supports"]` and `market_weather["top_risks"]`.

- [ ] **Step 8: Validate schema for score summary**

In `validate_generated_files()`, add:

```python
data_dir() / "catalog" / "source_registry.json",
data_dir() / "derived" / "score_summary.json",
```

Add:

```python
def validate_score_summary_file() -> None:
    path = data_dir() / "derived" / "score_summary.json"
    payload = _load_json(path)
    if set(payload.get("scores", {})) != {"market_weather", "macro_climate", "fragility"}:
        raise ValueError(f"{path} must contain market_weather, macro_climate, and fragility scores")
    for key, block in payload["scores"].items():
        if not isinstance(block.get("score"), int | float):
            raise ValueError(f"{path} {key}.score must be numeric")
        if not isinstance(block.get("confidence"), int | float):
            raise ValueError(f"{path} {key}.confidence must be numeric")
        if not isinstance(block.get("top_risks"), list):
            raise ValueError(f"{path} {key}.top_risks must be a list")
```

Call `validate_score_summary_file()` from `main()`.

- [ ] **Step 9: Run tests and verify they pass**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py tests/python/test_score_models.py -v
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/transform/compute_regime_score.py scripts/validate/validate_schema.py tests/python/test_scoring.py
git commit -m "feat: emit three score summary"
```

## Task 8: Update Data Status For Source Governance

**Files:**
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `scripts/validate/validate_schema.py`
- Modify: `scripts/validate/validate_freshness.py`
- Modify: `tests/python/test_scoring.py`

- [ ] **Step 1: Add failing status tests**

Append to `tests/python/test_scoring.py`:

```python
def test_status_for_candidate_series_reports_terms_review_needed():
    entry = {
        "id": "ism_manufacturing_pmi",
        "source": "ISM",
        "frequency": "monthly",
        "max_stale_days": 45,
        "score_status": "candidate",
        "access_status": "terms_review_needed",
    }

    status = _status_for_series(entry, {}, "2026-05-04T00:00:00Z")

    assert status["status"] == "terms_review_needed"
    assert status["message"] == "Candidate source requires access or terms review before scoring."


def test_status_for_unavailable_series_reports_unavailable():
    entry = {
        "id": "move_index",
        "source": "ICE",
        "frequency": "daily",
        "max_stale_days": 7,
        "score_status": "unavailable",
        "access_status": "unavailable",
    }

    status = _status_for_series(entry, {}, "2026-05-04T00:00:00Z")

    assert status["status"] == "unavailable"
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py::test_status_for_candidate_series_reports_terms_review_needed tests/python/test_scoring.py::test_status_for_unavailable_series_reports_unavailable -v
```

Expected: FAIL because `_status_for_series` treats missing observations as failed.

- [ ] **Step 3: Update `_status_for_series()`**

At the top of `_status_for_series()`, add:

```python
    score_status = str(entry.get("score_status", "active"))
    access_status = str(entry.get("access_status", "free_public"))
    if score_status == "candidate" or access_status == "terms_review_needed":
        return {
            "status": "terms_review_needed",
            "last_observation": None,
            "source": entry["source"],
            "expected_frequency": entry["frequency"],
            "freshness_days": None,
            "max_stale_days": entry["max_stale_days"],
            "message": "Candidate source requires access or terms review before scoring.",
        }
    if score_status == "unavailable" or access_status == "unavailable":
        return {
            "status": "unavailable",
            "last_observation": None,
            "source": entry["source"],
            "expected_frequency": entry["frequency"],
            "freshness_days": None,
            "max_stale_days": entry["max_stale_days"],
            "message": "Source is unavailable for automated static ingestion.",
        }
```

- [ ] **Step 4: Update status aggregation**

In `build_status()`, compute overall status only from active data statuses:

```python
active_values = [
    status["status"]
    for status in statuses.values()
    if status["status"] not in {"terms_review_needed", "unavailable"}
]
if any(status == "failed" for status in active_values):
    overall = "failed"
elif any(status == "stale" for status in active_values):
    overall = "partial"
else:
    overall = "ok"
```

- [ ] **Step 5: Update schema validation statuses**

In `validate_status_file()`, allow:

```python
{"ok", "stale", "partial", "failed", "terms_review_needed", "unavailable"}
```

for per-series statuses. Keep root `overall_status` limited to:

```python
{"ok", "stale", "partial", "failed"}
```

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
python3 -m pytest tests/python/test_scoring.py tests/python/test_safe_update.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/transform/compute_regime_score.py scripts/validate/validate_schema.py scripts/validate/validate_freshness.py tests/python/test_scoring.py
git commit -m "feat: report source review statuses"
```

## Task 9: Add Score UI Components

**Files:**
- Create: `src/components/ScoreCard.tsx`
- Create: `src/components/HowToReadPanel.tsx`
- Create: `src/components/SourceAccessBadge.tsx`
- Modify: `src/components/MetricCard.tsx`
- Modify: `src/components/SourceNote.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing component tests**

Append to `src/components/data-components.test.tsx`:

```tsx
import ScoreCard from "./ScoreCard";
import HowToReadPanel from "./HowToReadPanel";
import SourceAccessBadge from "./SourceAccessBadge";
import type { ScoreBlock } from "../lib/types";

const scoreBlock: ScoreBlock = {
  bucket_scores: { credit_spreads: -25 },
  bucket_weights: { credit_spreads: 0.2 },
  confidence: 0.82,
  confidence_reasons: ["Sentiment is limited to CFTC positioning."],
  label: "Mixed",
  missing_or_stale_notes: ["Treasury/bond volatility source is not active."],
  recent_changes: ["High-yield spreads widened over the past month."],
  score: -12.34,
  top_risks: ["High-yield spreads widened over the past month."],
  top_supports: ["Reserve balances improved over the past month."]
};

it("renders phase 3 score card details", () => {
  const container = render(<ScoreCard title="Market Weather" score={scoreBlock} />);

  expect(container.textContent).toContain("Market Weather");
  expect(container.textContent).toContain("-12.34");
  expect(container.textContent).toContain("Mixed");
  expect(container.textContent).toContain("82%");
  expect(container.textContent).toContain("High-yield spreads widened over the past month.");
  expect(container.textContent).toContain("Reserve balances improved over the past month.");
});

it("renders how-to-read panel without exposing advice language", () => {
  const container = render(
    <HowToReadPanel
      title="How to read this"
      description="Positive values are supportive; negative values indicate observed stress."
    />
  );

  expect(container.textContent).toContain("How to read this");
  expect(container.textContent).toContain("observed stress");
  expect(container.textContent).not.toContain("buy");
});

it("renders source access status", () => {
  const container = render(<SourceAccessBadge accessStatus="terms_review_needed" termsStatus="review_needed" />);

  expect(container.textContent).toContain("Terms review needed");
  expect(container.textContent).toContain("Review needed");
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/components/data-components.test.tsx
```

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Create `ScoreCard.tsx`**

Create:

```tsx
import RegimeBadge from "./RegimeBadge";
import type { ScoreBlock } from "../lib/types";

interface ScoreCardProps {
  title: string;
  score: ScoreBlock;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function ScoreCard({ title, score }: ScoreCardProps) {
  return (
    <article className="score-card">
      <div className="score-card__header">
        <p className="eyebrow">{title}</p>
        <strong>{score.score.toFixed(2)}</strong>
        <RegimeBadge label={score.label} score={score.score} />
      </div>
      <p className="score-confidence">Confidence {percent(score.confidence)}</p>
      <div className="score-card__lists">
        <section>
          <h4>Supports</h4>
          <ul>{score.top_supports.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section>
          <h4>Risks</h4>
          <ul>{score.top_risks.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>
      {score.confidence_reasons.length ? (
        <section className="score-notes">
          <h4>Confidence notes</h4>
          <ul>{score.confidence_reasons.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Create `HowToReadPanel.tsx`**

Create:

```tsx
interface HowToReadPanelProps {
  title?: string;
  description: string;
}

export default function HowToReadPanel({ title = "How to read this", description }: HowToReadPanelProps) {
  return (
    <section className="panel how-to-read">
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}
```

- [ ] **Step 5: Create `SourceAccessBadge.tsx`**

Create:

```tsx
import type { SourceAccessStatus, SourceTermsStatus } from "../lib/types";

interface SourceAccessBadgeProps {
  accessStatus?: SourceAccessStatus;
  termsStatus?: SourceTermsStatus;
}

const accessLabels: Record<SourceAccessStatus, string> = {
  free_public: "Free public",
  restricted: "Restricted",
  terms_review_needed: "Terms review needed",
  unavailable: "Unavailable"
};

const termsLabels: Record<SourceTermsStatus, string> = {
  ok: "Terms ok",
  restricted: "Restricted",
  review_each_series: "Review each series",
  review_needed: "Review needed",
  unknown: "Terms unknown"
};

export default function SourceAccessBadge({ accessStatus, termsStatus }: SourceAccessBadgeProps) {
  if (!accessStatus && !termsStatus) return null;

  return (
    <p className="source-access">
      {accessStatus ? <span>{accessLabels[accessStatus]}</span> : null}
      {termsStatus ? <span>{termsLabels[termsStatus]}</span> : null}
    </p>
  );
}
```

- [ ] **Step 6: Update `MetricCard.tsx` and `SourceNote.tsx`**

In `MetricCard.tsx`, import `SourceAccessBadge`, render it after source text, and add 3M/12M rows:

```tsx
<SourceAccessBadge accessStatus={catalogEntry?.access_status} termsStatus={catalogEntry?.terms_status} />
```

Add metric stat rows:

```tsx
<div>
  <dt>3M</dt>
  <dd>{formatSigned(summary?.change_3m)}</dd>
</div>
<div>
  <dt>12M</dt>
  <dd>{formatSigned(summary?.change_12m)}</dd>
</div>
```

In `SourceNote.tsx`, render:

```tsx
<SourceAccessBadge accessStatus={catalogEntry.access_status} termsStatus={catalogEntry.terms_status} />
{catalogEntry.citation_notes ? <p>{catalogEntry.citation_notes}</p> : null}
```

- [ ] **Step 7: Add CSS**

In `src/styles.css`, add:

```css
.score-card {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
}

.score-card__header {
  display: grid;
  gap: 0.5rem;
}

.score-card__header strong {
  font-size: 2rem;
  line-height: 1;
}

.score-confidence,
.source-access {
  color: var(--muted);
  font-size: 0.9rem;
}

.source-access {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.source-access span {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.score-card__lists {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  margin-top: 1rem;
}

.score-notes {
  margin-top: 1rem;
}

.how-to-read {
  border-left: 4px solid var(--accent);
}
```

- [ ] **Step 8: Run component tests and verify they pass**

Run:

```bash
npm test -- src/components/data-components.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/ScoreCard.tsx src/components/HowToReadPanel.tsx src/components/SourceAccessBadge.tsx src/components/MetricCard.tsx src/components/SourceNote.tsx src/components/data-components.test.tsx src/styles.css
git commit -m "feat: add phase 3 score UI components"
```

## Task 10: Update Overview For Three Scores

**Files:**
- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Add failing overview route test**

In `src/routes/data-routes.test.tsx`, add a `scoreSummary` fixture and update the overview test to include `/data/derived/score_summary.json`. Add this assertion:

```tsx
const scoreSummary: ScoreSummaryFile = {
  date: "2026-05-01",
  generated_at_utc: "2026-05-04T00:00:00Z",
  method_version: "phase3-three-score-v1",
  scores: {
    market_weather: {
      bucket_scores: { credit_spreads: -20 },
      bucket_weights: { credit_spreads: 0.2 },
      confidence: 0.82,
      confidence_reasons: ["Sentiment is limited to CFTC positioning."],
      label: "Mixed",
      missing_or_stale_notes: [],
      recent_changes: ["High-yield spreads widened over the past month."],
      score: -12.34,
      top_risks: ["High-yield spreads widened over the past month."],
      top_supports: ["Reserve balances improved over the past month."]
    },
    macro_climate: {
      bucket_scores: { growth: 5 },
      bucket_weights: { growth: 0.25 },
      confidence: 0.7,
      confidence_reasons: ["Housing is not active in Phase 3."],
      label: "Mixed",
      missing_or_stale_notes: ["Housing is not active in Phase 3."],
      recent_changes: [],
      score: 2,
      top_risks: [],
      top_supports: []
    },
    fragility: {
      bucket_scores: { dollar_spike: -10 },
      bucket_weights: { dollar_spike: 0.15 },
      confidence: 0.68,
      confidence_reasons: ["Treasury/bond volatility source is not active."],
      label: "Moderate",
      missing_or_stale_notes: ["MOVE is a candidate input."],
      recent_changes: [],
      score: -12,
      top_risks: ["Broad dollar strength is tightening global conditions."],
      top_supports: []
    }
  },
  conflicting_signals: ["Credit is calm while inflation momentum is elevated."],
  data_quality: {
    overall_confidence: 0.73,
    reasons: ["Sentiment is limited to CFTC positioning."]
  }
};
```

In the overview test, expect:

```tsx
expect(container.textContent).toContain("Market Weather");
expect(container.textContent).toContain("Macro Climate");
expect(container.textContent).toContain("Fragility");
expect(container.textContent).toContain("What changed this week");
expect(container.textContent).toContain("Conflicting signals");
expect(container.textContent).toContain("Data confidence");
```

- [ ] **Step 2: Run route test and verify it fails**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: FAIL because `Overview` does not load `score_summary.json` or render the new sections.

- [ ] **Step 3: Update `Overview.tsx` imports and state**

Import `ScoreCard`, `HowToReadPanel`, `loadScoreSummary`, and `ScoreSummaryFile`.

Change `OverviewState` to include:

```ts
scoreSummary: ScoreSummaryFile;
```

Load `scoreSummary` in the `Promise.all()` call:

```ts
const [catalog, regime, scoreSummary, status, series] = await Promise.all([
  loadCatalog(),
  loadRegimeScore(),
  loadScoreSummary(),
  loadDataStatus(),
  Promise.all(...)
]);
```

- [ ] **Step 4: Render the new score sections**

Replace the single score hero with:

```tsx
<HowToReadPanel description="Market Weather, Macro Climate, and Fragility are separate descriptive scores. Positive values are more supportive; negative values indicate observed stress or vulnerability." />
<section className="score-grid" aria-label="Phase 3 score summary">
  <ScoreCard title="Market Weather" score={data.scoreSummary.scores.market_weather} />
  <ScoreCard title="Macro Climate" score={data.scoreSummary.scores.macro_climate} />
  <ScoreCard title="Fragility" score={data.scoreSummary.scores.fragility} />
</section>
<section className="panel">
  <h3>What changed this week</h3>
  <ul>{data.scoreSummary.scores.market_weather.recent_changes.map((item) => <li key={item}>{item}</li>)}</ul>
</section>
<section className="panel">
  <h3>Conflicting signals</h3>
  <ul>{data.scoreSummary.conflicting_signals.map((item) => <li key={item}>{item}</li>)}</ul>
</section>
<section className="panel">
  <h3>Data confidence</h3>
  <p>{Math.round(data.scoreSummary.data_quality.overall_confidence * 100)}%</p>
  <ul>{data.scoreSummary.data_quality.reasons.map((item) => <li key={item}>{item}</li>)}</ul>
</section>
```

Keep the old bucket panel lower on the page and label it `Market Weather buckets`.

- [ ] **Step 5: Add CSS for score grid**

In `src/styles.css`, add:

```css
.score-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
}
```

- [ ] **Step 6: Run route test and verify it passes**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/Overview.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: show three scores on overview"
```

## Task 11: Add And Rename Routes

**Files:**
- Create: `src/routes/Growth.tsx`
- Create: `src/routes/Inflation.tsx`
- Create: `src/routes/DollarGlobal.tsx`
- Modify: `src/routes/Rates.tsx`
- Modify: `src/routes/Credit.tsx`
- Modify: `src/routes/Sentiment.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Add failing route/navigation tests**

In `src/routes/data-routes.test.tsx`, add tests that render `App` with `MemoryRouter` for `/growth`, `/inflation`, and `/dollar-global`, and assert navigation labels:

```tsx
it("renders phase 3 navigation labels", async () => {
  mockStaticFetch(filesForAllRoutes);
  const container = render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Market Weather");

  expect(container.textContent).toContain("Growth");
  expect(container.textContent).toContain("Inflation");
  expect(container.textContent).toContain("Rates & Policy");
  expect(container.textContent).toContain("Credit & Banking");
  expect(container.textContent).toContain("Dollar & Global");
  expect(container.textContent).toContain("Sentiment & Positioning");
});

it("renders growth route with labor section", async () => {
  mockStaticFetch(filesForAllRoutes);
  const container = render(
    <MemoryRouter initialEntries={["/growth"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Growth");
  expect(container.textContent).toContain("Labor and recession risk");
  expect(container.textContent).toContain("Chicago Fed National Activity Index");
});

it("renders inflation route", async () => {
  mockStaticFetch(filesForAllRoutes);
  const container = render(
    <MemoryRouter initialEntries={["/inflation"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Inflation");
  expect(container.textContent).toContain("Core CPI");
});

it("renders dollar global route", async () => {
  mockStaticFetch(filesForAllRoutes);
  const container = render(
    <MemoryRouter initialEntries={["/dollar-global"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Dollar & Global");
  expect(container.textContent).toContain("Nominal Broad U.S. Dollar Index");
});
```

Define `filesForAllRoutes` in the test file as the existing mocked static files plus catalog entries and `seriesFile(...)` responses for these IDs:

```ts
[
  "cfnai",
  "cfnai_3m_avg",
  "real_retail_sales",
  "industrial_production",
  "durable_goods_orders",
  "unemployment_rate",
  "nonfarm_payrolls",
  "initial_claims",
  "sahm_rule",
  "headline_cpi",
  "core_cpi",
  "core_pce",
  "ppi_final_demand",
  "breakeven_10y",
  "breakeven_5y",
  "forward_inflation_5y5y",
  "broad_dollar",
  "usdjpy",
  "eurusd",
  "high_yield_oas",
  "investment_grade_oas",
  "bbb_oas",
  "reserve_balances",
  "bank_credit",
  "loans_and_leases",
  "business_loans",
  "bank_deposits"
]
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: FAIL because the routes and labels do not exist.

- [ ] **Step 3: Create `Growth.tsx`**

Use the existing route pattern:

```tsx
import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import HowToReadPanel from "../components/HowToReadPanel";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadSeries } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const growthSeriesIds = ["cfnai", "cfnai_3m_avg", "real_retail_sales", "industrial_production", "durable_goods_orders"];
const laborSeriesIds = ["unemployment_rate", "nonfarm_payrolls", "initial_claims", "sahm_rule"];
const seriesIds = [...growthSeriesIds, ...laborSeriesIds];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Growth() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadGrowth() {
      try {
        const [catalog, status, series] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          Promise.all(seriesIds.map((seriesId) => loadSeries(seriesId)))
        ]);
        if (active) setData({ catalog, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load growth data.");
      }
    }
    void loadGrowth();
    return () => {
      active = false;
    };
  }, []);

  const cfnai = data?.series.find((series) => series.series_id === "cfnai");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Macro climate</p>
        <h2>Growth</h2>
        <p>Growth, consumer demand, production, and labor-cycle inputs from delayed public data.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <HowToReadPanel description="Positive growth readings are more supportive; weakening activity and labor deterioration reduce the Macro Climate score." />
          <section className="metric-grid" aria-label="Growth metrics">
            {data.series.filter((series) => growthSeriesIds.includes(series.series_id)).map((series) => (
              <MetricCard catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)} key={series.series_id} series={series} />
            ))}
          </section>
          <section className="panel">
            <h3>Labor and recession risk</h3>
            <section className="metric-grid" aria-label="Labor metrics">
              {data.series.filter((series) => laborSeriesIds.includes(series.series_id)).map((series) => (
                <MetricCard catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)} key={series.series_id} series={series} />
              ))}
            </section>
          </section>
          {cfnai ? <TimeSeriesChart catalogEntry={data.catalog.find((entry) => entry.id === "cfnai")} series={cfnai} /> : null}
          <DataStatusTable seriesIds={seriesIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Create `Inflation.tsx`**

Create a route component with the same state shape as `Growth.tsx`: `catalog`, `series`, `status`, `error`, and a `useEffect` loader that calls `loadCatalog()`, `loadDataStatus()`, and `Promise.all(inflationSeriesIds.map(loadSeries))`.

Use:

```ts
const inflationSeriesIds = ["headline_cpi", "core_cpi", "core_pce", "ppi_final_demand", "breakeven_10y", "breakeven_5y", "forward_inflation_5y5y"];
```

Page heading:

```tsx
<p className="eyebrow">Macro climate</p>
<h2>Inflation</h2>
<p>Inflation momentum and market-implied inflation compensation.</p>
```

How-to-read text:

```tsx
<HowToReadPanel description="Inflation pressure is read through momentum and confirmation across core measures and breakevens, not raw price-index levels alone." />
```

Render a metric grid for every loaded inflation series, chart `core_cpi` when present, and render `DataStatusTable` for `inflationSeriesIds`.

- [ ] **Step 5: Create `DollarGlobal.tsx`**

Create a route component with the same state shape as `Growth.tsx`: `catalog`, `series`, `status`, `error`, and a `useEffect` loader that calls `loadCatalog()`, `loadDataStatus()`, and `Promise.all(dollarSeriesIds.map(loadSeries))`.

Use:

```ts
const dollarSeriesIds = ["broad_dollar", "usdjpy", "eurusd"];
```

Page heading:

```tsx
<p className="eyebrow">Market weather</p>
<h2>Dollar & Global</h2>
<p>Broad dollar and major FX inputs that can tighten or ease global financial conditions.</p>
```

How-to-read text:

```tsx
<HowToReadPanel description="A sharply rising dollar can tighten global financial conditions; a falling dollar can ease global liquidity pressure." />
```

Render a metric grid for every loaded dollar series, chart `broad_dollar` when present, and render `DataStatusTable` for `dollarSeriesIds`.

- [ ] **Step 6: Update existing route labels and sections**

In `Rates.tsx`, change heading to:

```tsx
<p className="eyebrow">Rates & Policy</p>
<h2>Nominal yields, real yields, and breakevens</h2>
```

Use:

```ts
const ratesSeriesIds = ["us2y", "us10y", "us20y", "us30y", "real_yield_5y", "real_yield_10y", "breakeven_5y", "breakeven_10y", "forward_inflation_5y5y"];
```

In `Credit.tsx`, change heading to `Credit & Banking` and use:

```ts
const creditSeriesIds = ["high_yield_oas", "investment_grade_oas", "bbb_oas", "financial_stress", "financial_conditions", "reserve_balances", "bank_credit", "loans_and_leases", "business_loans", "bank_deposits"];
```

In `Sentiment.tsx`, change eyebrow to `Sentiment & Positioning`.

- [ ] **Step 7: Update navigation and app routes**

In `AppLayout.tsx`, set:

```ts
const navItems = [
  { to: "/", label: "Overview" },
  { to: "/growth", label: "Growth" },
  { to: "/inflation", label: "Inflation" },
  { to: "/rates", label: "Rates & Policy" },
  { to: "/liquidity", label: "Liquidity" },
  { to: "/credit", label: "Credit & Banking" },
  { to: "/volatility", label: "Volatility" },
  { to: "/dollar-global", label: "Dollar & Global" },
  { to: "/commodities", label: "Commodities" },
  { to: "/sentiment", label: "Sentiment & Positioning" },
  { to: "/methodology", label: "Methodology" }
];
```

In `App.tsx`, import and register `Growth`, `Inflation`, and `DollarGlobal`.

- [ ] **Step 8: Run route tests and verify they pass**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/routes/Growth.tsx src/routes/Inflation.tsx src/routes/DollarGlobal.tsx src/routes/Rates.tsx src/routes/Credit.tsx src/routes/Sentiment.tsx src/components/AppLayout.tsx src/App.tsx src/routes/data-routes.test.tsx
git commit -m "feat: add phase 3 macro routes"
```

## Task 12: Update Docs And Methodology Page

**Files:**
- Modify: `README.md`
- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `src/routes/Methodology.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Add failing methodology route assertion**

In `src/routes/data-routes.test.tsx`, add:

```tsx
it("renders methodology for the three-score model", () => {
  const container = render(
    <MemoryRouter initialEntries={["/methodology"]}>
      <App />
    </MemoryRouter>
  );

  expect(container.textContent).toContain("Market Weather Score");
  expect(container.textContent).toContain("Macro Climate Score");
  expect(container.textContent).toContain("Fragility Score");
  expect(container.textContent).toContain("Source access status");
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: FAIL because `Methodology.tsx` still describes the old single score.

- [ ] **Step 3: Update `Methodology.tsx`**

Replace the score interpretation panel with panels titled:

```tsx
<h3>Market Weather Score</h3>
<p>Short-term cross-asset risk conditions from credit spreads, liquidity and funding, rates and real yields, volatility, dollar pressure, commodities, and positioning.</p>

<h3>Macro Climate Score</h3>
<p>Economic regime context from growth, labor and recession risk, inflation, policy and real rates, consumer demand, and production inputs.</p>

<h3>Fragility Score</h3>
<p>Observed vulnerability from credit spread widening, volatility stress, dollar spikes, liquidity drains, positioning crowding, and inactive Treasury volatility coverage reflected in confidence.</p>

<h3>Source access status</h3>
<p>Active no-secret inputs are separated from terms-reviewed candidates, restricted sources, and unavailable sources in the generated catalog and documentation.</p>
```

- [ ] **Step 4: Update `README.md`**

Add sections:

```md
## Phase 3 Direction

The dashboard separates:

- Market Weather: current cross-asset risk conditions.
- Macro Climate: growth, labor, inflation, and policy regime.
- Fragility: vulnerability from credit, volatility, liquidity, dollar, and crowding pressure.

## Data Access Status

| Status | Meaning | Examples |
| --- | --- | --- |
| Active no-secret public | Fetched automatically into static JSON without browser keys or backend secrets. | FRED graph CSV, Cboe public historical CSV, CFTC public compressed reports |
| Terms review needed | Useful candidate source, not scored until access and redistribution are reviewed. | ISM PMI, AAII, NAAIM, SLOOS, MOVE, put/call, NY Fed ACM term premium |
| Restricted or unavailable | Not suitable for automated static publication in this project without paid/authenticated access or different rights. | Paid live feeds, authenticated provider APIs |
```

- [ ] **Step 5: Update `docs/DATA_SOURCES.md`**

Add tables:

```md
## Active Phase 3 No-Secret Inputs

| Area | Series | Provider | Access status | Terms status | Notes |
| --- | --- | --- | --- | --- | --- |
| Credit | BAMLH0A0HYM2, BAMLC0A0CM, BAMLC0A4CBBB | FRED | free_public | review_each_series | Direct corporate credit spreads. |
| Rates | DFII10, DFII5, T10YIE, T5YIE, T5YIFR | FRED | free_public | review_each_series | Real yields and inflation compensation. |
| Growth/Labor | CFNAI, CFNAIMA3, RRSFS, INDPRO, DGORDER, UNRATE, PAYEMS, ICSA, SAHMREALTIME | FRED | free_public | review_each_series | Macro climate inputs. |
| Inflation | CPIAUCSL, CPILFESL, PCEPILFE, PPIFIS | FRED | free_public | review_each_series | Inflation momentum inputs. |
| Dollar/Banking | DTWEXBGS, DEXJPUS, DEXUSEU, WRESBAL, TOTBKCR, TOTLL, BUSLOANS, DPSACBW027SBOG | FRED | free_public | review_each_series | Dollar and bank-credit impulse. |
| Volatility | VIX, VVIX, VIX9D, VIX3M | Cboe | free_public | ok | Public historical volatility index CSV files. |

## Candidate Sources

| Source | Status | Reason |
| --- | --- | --- |
| ISM PMI | terms_review_needed | Requires access and redistribution review before automation. |
| AAII | terms_review_needed | Survey data needs terms review. |
| NAAIM | terms_review_needed | Exposure index terms and redistribution need review. |
| SLOOS | terms_review_needed | Candidate lending-standard source. |
| MOVE | terms_review_needed | ICE source access requires review. |
| Put/call ratio | terms_review_needed | Source terms need review. |
| NY Fed ACM term premium | terms_review_needed | Candidate policy/rates input. |
```

- [ ] **Step 6: Update `docs/METHODOLOGY.md`**

Document:

```md
## Three Score Model

Market Weather Score weights:
- Credit spreads: 20%
- Liquidity/funding: 20%
- Rates/real yields: 15%
- Volatility/tail risk: 15%
- Dollar/global tightening: 10%
- Commodities/inflation impulse: 10%
- Sentiment/positioning: 10%

Macro Climate Score weights:
- Growth: 25%
- Labor/recession risk: 20%
- Inflation: 25%
- Policy/real rates: 15%
- Consumer/production/housing: 15%

Fragility Score weights:
- Credit spread widening: 25%
- Volatility term-structure stress: 20%
- Dollar spike: 15%
- Liquidity drain: 15%
- Positioning crowding: 15%
- Treasury/bond volatility: 10%

Scores are descriptive and explanatory. Positive values are more supportive. Negative values indicate observed risk, stress, or fragility.
```

Add confidence and commodity impulse descriptions from the spec.

- [ ] **Step 7: Update `docs/LIMITATIONS.md`**

Add:

```md
## Source Access And Review

Candidate sources are not scored until access, licensing, citation, and redistribution are reviewed. A source can be economically useful and still be unsuitable for automated static publication.

## Score Confidence

Confidence is reduced when important sources are stale, missing, candidate-only, single-metric, or mixed across very different publication cadences.
```

- [ ] **Step 8: Run tests and docs grep**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
rg -n "Market Weather Score|Macro Climate Score|Fragility Score|terms_review_needed|free_public" README.md docs
```

Expected: route test PASS and `rg` shows the new terms in README and docs.

- [ ] **Step 9: Commit**

```bash
git add README.md docs/DATA_SOURCES.md docs/METHODOLOGY.md docs/LIMITATIONS.md src/routes/Methodology.tsx src/routes/data-routes.test.tsx
git commit -m "docs: explain phase 3 score model"
```

## Task 13: Pin Package Versions

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update package versions in `package.json`**

Replace `"latest"` versions with:

```json
"dependencies": {
  "@vitejs/plugin-react": "6.0.1",
  "vite": "8.0.10",
  "typescript": "6.0.3",
  "react": "19.2.5",
  "react-dom": "19.2.5",
  "react-router-dom": "7.14.2",
  "recharts": "3.8.1"
},
"devDependencies": {
  "@types/node": "25.6.0",
  "@types/react": "19.2.14",
  "@types/react-dom": "19.2.3",
  "vitest": "4.1.5",
  "jsdom": "29.1.1"
}
```

- [ ] **Step 2: Refresh lockfile without upgrading**

Run:

```bash
npm install --package-lock-only
```

Expected: `package-lock.json` root package now contains the exact versions.

- [ ] **Step 3: Verify package JSON no longer uses latest**

Run:

```bash
rg -n '"latest"' package.json package-lock.json
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: pin frontend package versions"
```

## Task 14: Refresh Generated Data And Validate End To End

**Files:**
- Modify generated files under `public/data`

- [ ] **Step 1: Run full data update**

Run:

```bash
python3 -m scripts.update_data
```

Expected: exit code 0 and generated files include:

```text
public/data/catalog/source_registry.json
public/data/catalog/series_catalog.json
public/data/derived/score_summary.json
public/data/derived/hy_minus_ig_oas.json
public/data/derived/commodity_inflation_impulse.json
public/data/derived/vix9d_vix_ratio.json
public/data/derived/vix_vix3m_ratio.json
```

- [ ] **Step 2: Inspect generated score summary**

Run:

```bash
node -e "const s=require('./public/data/derived/score_summary.json'); console.log(Object.keys(s.scores)); console.log(s.data_quality)"
```

Expected output includes:

```text
[ 'market_weather', 'macro_climate', 'fragility' ]
```

- [ ] **Step 3: Run Python tests**

Run:

```bash
python3 -m pytest
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Build site**

Run:

```bash
npm run build
```

Expected: PASS and `dist/404.html` exists.

- [ ] **Step 6: Commit generated data**

```bash
git add public/data
git commit -m "chore: refresh phase 3 generated data"
```

## Task 15: Final Review And Integration Check

**Files:**
- No planned code edits.

- [ ] **Step 1: Review status**

Run:

```bash
git status --short --branch
```

Expected: only intentionally untracked local files such as `.idea/` remain. No modified tracked files remain.

- [ ] **Step 2: Review recent commits**

Run:

```bash
git log --oneline -12
```

Expected: commits from this plan appear in task order.

- [ ] **Step 3: Confirm specific-risk strings are not bucket names**

Run:

```bash
node - <<'NODE'
const s = require('./public/data/derived/score_summary.json')
for (const [key, block] of Object.entries(s.scores)) {
  console.log(key, block.top_risks, block.top_supports)
}
NODE
```

Expected: printed risks and supports are human-readable driver strings such as "High-yield spreads widened over the past month.", not only bucket names such as "Credit".

- [ ] **Step 4: Confirm candidate sources are not scored**

Run:

```bash
node - <<'NODE'
const catalog = require('./public/data/catalog/series_catalog.json')
const candidates = catalog.filter((entry) => entry.score_status === 'candidate').map((entry) => entry.id)
const scoreText = JSON.stringify(require('./public/data/derived/score_summary.json'))
for (const id of candidates) {
  if (scoreText.includes(id)) {
    throw new Error(`${id} appears in score summary`)
  }
}
console.log(`checked ${candidates.length} candidate sources`)
NODE
```

Expected: prints `checked <number> candidate sources`.

- [ ] **Step 5: Final verification command group**

Run:

```bash
python3 -m scripts.update_data
python3 -m pytest
npm test
npm run build
```

Expected: all commands PASS.

- [ ] **Step 6: Commit any final verification fixes**

If Step 5 changes generated data, run:

```bash
git add public/data
git commit -m "chore: update verified phase 3 data"
```

If Step 5 does not change generated data, do not create an empty commit.
