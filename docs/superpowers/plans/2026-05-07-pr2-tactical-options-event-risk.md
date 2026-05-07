# PR 2 Tactical Options And Event Risk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Tactical Trading Weather with options-sentiment readiness, VIX futures readiness, and event-risk context while preserving strict source gates.

**Architecture:** Add candidate source metadata and UI panels first. Active ingestion is allowed only for sources already classified as `free_public`; otherwise the app must render source-gap/candidate rows and keep scores unchanged.

**Tech Stack:** Python catalog/status generation and validation; React TypeScript route/components; Vitest/jsdom and pytest.

---

## File Structure

Create:

- `src/components/CandidateSourcePanel.tsx`: reusable panel for source-gated inputs.
- `src/components/OptionsSentimentPanel.tsx`: displays put/call active data when present or candidate status when gated.
- `src/components/EventRiskPanel.tsx`: displays active event-risk JSON when present or source-gap rows when gated.
- `src/components/VixFuturesReadinessPanel.tsx`: displays active VX curve when present or fallback VIX9D/VIX/VIX3M proxy.
- `src/routes/TacticalSourceGates.tsx`: optional methodology/data-library route for tactical candidate sources if the main tactical page gets dense.
- `tests/python/test_tactical_candidate_sources.py`: source catalog/status tests.

Modify:

- `scripts/shared/catalog.py`: add candidate catalog rows for put/call categories, VIX futures curve, SKEW candidate marker if not already added in PR 3, and event-risk families.
- `scripts/shared/source_registry.py`: add provider registry entries for `cboe_options`, `occ`, `cboe_futures`, `economic_calendar`, and `treasury_calendar` with gated statuses.
- `scripts/transform/compute_regime_score.py`: include candidate statuses in `data_status.json`; do not score candidates.
- `scripts/validate/validate_schema.py`: validate candidate rows and optional event-risk artifact shape.
- `src/lib/types.ts`: add candidate source and event-risk types.
- `src/lib/data.ts`: add optional loaders for candidate/active tactical artifacts.
- `src/routes/TacticalTradingWeather.tsx`: add options/event/VX panels.
- `src/routes/Volatility.tsx`: show VX futures candidate state beside VIX proxy.
- `src/components/data-components.test.tsx`: component coverage.
- `src/routes/data-routes.test.tsx`: route coverage.
- `docs/DATA_SOURCES.md`, `docs/METHODOLOGY.md`, `docs/LIMITATIONS.md`, `README.md`: source-gate documentation.

---

## Task 1: Add Tactical Candidate Source Registry

**Files:**

- Modify: `scripts/shared/source_registry.py`
- Modify: `scripts/shared/catalog.py`
- Create: `tests/python/test_tactical_candidate_sources.py`
- Regenerate: `public/data/catalog/source_registry.json`
- Regenerate: `public/data/catalog/series_catalog.json`

- [ ] **Step 1: Write failing tests**

Create `tests/python/test_tactical_candidate_sources.py`:

```python
from scripts.shared.catalog import catalog_entries
from scripts.shared.source_registry import source_registry_entries


def entries_by_id():
    return {str(entry["id"]): entry for entry in catalog_entries()}


def test_tactical_candidate_sources_are_gated():
    registry = source_registry_entries()

    assert registry["cboe_options"]["access_status"] == "terms_review_needed"
    assert registry["cboe_options"]["terms_status"] == "review_needed"
    assert registry["cboe_futures"]["access_status"] == "terms_review_needed"
    assert registry["economic_calendar"]["access_status"] == "terms_review_needed"


def test_put_call_candidate_catalog_rows_do_not_score():
    entries = entries_by_id()
    expected = {
        "put_call_total",
        "put_call_index",
        "put_call_equity",
        "put_call_etp",
        "put_call_vix",
        "put_call_spx",
        "put_call_spxw",
    }

    assert expected <= set(entries)
    for series_id in expected:
        entry = entries[series_id]
        assert entry["score_status"] == "candidate"
        assert entry["access_status"] == "terms_review_needed"
        assert entry["horizon"] == "tactical"
        assert "sentiment" in entry["regime_role"]


def test_vix_futures_and_event_candidates_are_gated():
    entries = entries_by_id()

    for series_id in ("vx1", "vx2", "vx3", "vx4", "vx5", "vx6", "vx7", "vx8"):
        assert entries[series_id]["score_status"] == "candidate"
        assert entries[series_id]["preferred_chart"] == "curve"

    for series_id in ("event_cpi", "event_fomc", "event_payrolls", "event_treasury_auction", "event_opex"):
        assert entries[series_id]["score_status"] == "candidate"
        assert entries[series_id]["horizon"] == "tactical"
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
python -m pytest tests/python/test_tactical_candidate_sources.py -v
```

Expected: FAIL because candidate providers and rows do not exist.

- [ ] **Step 3: Add provider registry entries**

In `scripts/shared/source_registry.py`, add:

```python
"cboe_options": {
    "name": "Cboe Options Market Statistics",
    "base_url": "https://www.cboe.com/markets/us/options/market_statistics/",
    "requires_secret": False,
    "access_status": "terms_review_needed",
    "terms_status": "review_needed",
    "update_cadence": "daily_market_data",
    "notes": "Put-call category data requires access, automation, attribution, and redistribution review before static publication.",
},
"occ": {
    "name": "Options Clearing Corporation",
    "base_url": "https://www.theocc.com",
    "requires_secret": False,
    "access_status": "terms_review_needed",
    "terms_status": "review_needed",
    "update_cadence": "daily_market_data",
    "notes": "Options statistics require source-specific review before publication.",
},
"cboe_futures": {
    "name": "Cboe Futures Exchange",
    "base_url": "https://www.cboe.com/us/futures/",
    "requires_secret": False,
    "access_status": "terms_review_needed",
    "terms_status": "review_needed",
    "update_cadence": "daily_market_data",
    "notes": "VIX futures curve data requires access and redistribution review before static publication.",
},
"economic_calendar": {
    "name": "Economic Release Calendar",
    "base_url": "",
    "requires_secret": False,
    "access_status": "terms_review_needed",
    "terms_status": "review_needed",
    "update_cadence": "calendar",
    "notes": "Calendar sources must be reviewed before automated publication.",
},
"treasury_calendar": {
    "name": "Treasury Auction Calendar",
    "base_url": "",
    "requires_secret": False,
    "access_status": "terms_review_needed",
    "terms_status": "review_needed",
    "update_cadence": "calendar",
    "notes": "Treasury auction schedules must be reviewed before automated publication.",
},
```

- [ ] **Step 4: Add candidate rows**

In `scripts/shared/catalog.py`, add helper builders:

```python
def candidate_row(series_id: str, name: str, category: str, source: str, source_url: str, provider_id: str, notes: str, units: str = "index") -> dict[str, object]:
    return {
        "id": series_id,
        "name": name,
        "category": category,
        "source": source,
        "source_url": source_url,
        "endpoint_url": None,
        "frequency": "daily",
        "units": units,
        "higher_is": "contextual",
        "public": False,
        "max_stale_days": 7,
        "notes": notes,
        **governance(provider_id, score_status="candidate"),
        **decision_metadata(series_id, category),
    }
```

Add rows for put/call categories, `vx1` through `vx8`, and event-risk candidates. Ensure `decision_metadata` maps put/call to `["sentiment"]`, VX to `["volatility"]`, and event rows to `["volatility", "sentiment"]` or a dedicated `"event"` role if PR 1 added it.

- [ ] **Step 5: Regenerate and verify**

Run:

```bash
python -m scripts.update_data
python -m pytest tests/python/test_tactical_candidate_sources.py tests/python/test_catalog.py -v
python -m scripts.validate.validate_schema
```

Expected: PASS. Candidate rows appear in catalog and data status with `terms_review_needed`.

Commit:

```bash
git add scripts/shared/source_registry.py scripts/shared/catalog.py tests/python/test_tactical_candidate_sources.py public/data/catalog/source_registry.json public/data/catalog/series_catalog.json public/data/status/data_status.json
git commit -m "feat: add tactical candidate source gates"
```

---

## Task 2: Add Candidate and Tactical Panels

**Files:**

- Create: `src/components/CandidateSourcePanel.tsx`
- Create: `src/components/OptionsSentimentPanel.tsx`
- Create: `src/components/EventRiskPanel.tsx`
- Create: `src/components/VixFuturesReadinessPanel.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write component tests**

Add tests that assert:

- `CandidateSourcePanel` renders candidate names and `Terms review needed`.
- `OptionsSentimentPanel` prioritizes SPX/SPXW, index, equity, and VIX rows.
- `EventRiskPanel` renders CPI, FOMC, payrolls, Treasury auctions, and OPEX candidate rows.
- `VixFuturesReadinessPanel` renders VX1-VX8 candidate rows and fallback VIX proxy text when no active VX data exists.

- [ ] **Step 2: Implement components**

Use these props:

```ts
export interface CandidateSourceItem {
  id: string;
  label: string;
  status: string;
  note: string;
}

export default function CandidateSourcePanel({
  title,
  items
}: {
  title: string;
  items: CandidateSourceItem[];
}) {}
```

`OptionsSentimentPanel` should accept active series files and candidate rows. When active rows are absent, it must render:

- SPX/SPXW put/call: candidate
- Index put/call: candidate
- Equity put/call: candidate
- VIX put/call: candidate
- ETP put/call: candidate
- Total put/call: candidate

Do not render signal labels such as "panic" from candidate rows; use "Source review required".

- [ ] **Step 3: Verify components**

Run:

```bash
npm run test -- src/components/data-components.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/components/CandidateSourcePanel.tsx src/components/OptionsSentimentPanel.tsx src/components/EventRiskPanel.tsx src/components/VixFuturesReadinessPanel.tsx src/components/data-components.test.tsx src/styles.css
git commit -m "feat: add tactical candidate panels"
```

---

## Task 3: Integrate Panels Into Tactical and Volatility Routes

**Files:**

- Modify: `src/routes/TacticalTradingWeather.tsx`
- Modify: `src/routes/Volatility.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write route tests**

Add expectations:

- `/tactical` contains "Options sentiment", "Event risk", and "VIX futures readiness".
- `/volatility` contains "VX futures curve" and "Fallback proxy".
- Candidate rows do not alter Market Weather or Fragility score labels in fixtures.

- [ ] **Step 2: Load candidate rows from status/catalog**

In route code, build candidate item arrays from `catalog` and `status.series`:

```ts
const optionCandidateIds = [
  "put_call_spxw",
  "put_call_spx",
  "put_call_index",
  "put_call_equity",
  "put_call_vix",
  "put_call_etp",
  "put_call_total"
];
```

Filter catalog entries by these IDs and pass the status message into the candidate panels.

- [ ] **Step 3: Verify routes**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/routes/TacticalTradingWeather.tsx src/routes/Volatility.tsx src/routes/data-routes.test.tsx
git commit -m "feat: surface tactical source-gated panels"
```

---

## Task 4: Document Tactical Source Gates

**Files:**

- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `README.md`

- [ ] **Step 1: Add data-source rows**

Document put/call categories, VIX futures, and event calendar families as `terms_review_needed`. Include the exact rule:

```md
These candidate rows are displayed as source gaps. They do not affect active scores, regime labels, checklist states, or confidence except as documented source-readiness gaps.
```

- [ ] **Step 2: Add methodology caveat**

Document the fallback VIX proxy:

```md
When VIX futures data is not active, the tactical page uses VIX9D, VIX, VIX3M, VIX9D/VIX, and VIX/VIX3M as a proxy for near-term event pressure and contango/backwardation-like stress. This proxy is not the same as a tradable VIX futures curve.
```

- [ ] **Step 3: Verify docs**

Run:

```bash
rg -n "buy|sell|short|entry|target|stop loss|recommendation" README.md docs src
npm run build
```

Expected: no new advice-language matches from this PR.

Commit:

```bash
git add docs/DATA_SOURCES.md docs/METHODOLOGY.md docs/LIMITATIONS.md README.md
git commit -m "docs: document tactical source gates"
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

Expected: all tests pass; candidate tactical rows are visible but inactive; no unreviewed source is fetched or scored.

