# Overview Cockpit Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Overview from a 19-panel data inventory into a fixed-slot instrument cockpit (3 composite scores + 9 vital signs), add a persistent regime header on every route, add a Brief/Detail mode toggle, and consolidate 18 nav pills into 7 + redirects.

**Architecture:** New Python builder produces `public/data/derived/cockpit.json` from a curated whitelist of ~15 universally-watched signals ranked by today's `signal_priority.json`. React renders the JSON via new `<MarketCockpit>`, `<CockpitCell>`, `<PersistentRegimeHeader>` components using inline SVG primitives (no new chart library). Static GitHub Pages + GitHub Actions — no backend, no client-side ranking.

**Tech Stack:** Python 3.11 (pandas, requests), React 19 + TypeScript 6, Vite 8, vitest, Recharts (existing — untouched), ECharts (existing — untouched).

**Spec:** [docs/superpowers/specs/2026-05-17-overview-cockpit-redesign-design.md](../specs/2026-05-17-overview-cockpit-redesign-design.md) — read this first for the why, the schema, and the source-gating contract.

---

## How to execute

- **One worktree per PR.** Branch from post-merge `main` each time. Worktree paths and branch names listed in each chunk header.
- **Verification gate** (run before every PR's final commit, per CLAUDE.md):
  ```bash
  npm test
  npm run build
  python -m pytest tests/python -v
  python -m scripts.validate.validate_schema
  python -m scripts.validate.validate_freshness
  ```
  For PR 1 (data-only) also run `python -m scripts.update_data` to confirm the safe-update path.
- **Local Python uses venv** (CLAUDE.md): `.venv/bin/python -m ...`. Commands in this plan are written as `python -m ...` to match CI — substitute `.venv/bin/python` locally.
- **Frequent commits.** Each task ends with a commit. The "Step 5: Commit" pattern is mandatory.
- **TDD.** Every code-producing task starts with a failing test before the implementation. Run the test, see it fail, then implement, then see it pass.
- **Skip ahead-of-time fixtures.** Don't write the all-15 truncation fixture in PR 1 if PR 2 will consume it more naturally — keep tasks bite-sized.

---

## File structure across all 7 PRs

### New Python files
| Path | Owner PR | Purpose |
|---|---|---|
| `scripts/shared/cockpit_whitelist.py` | PR 1 | `CockpitSignal` / `CockpitSecondaryLine` dataclasses + the ~15-entry roster + `REGIME_TONE_MAP` |
| `scripts/transform/build_cockpit.py` | PR 1 | Reads inputs, computes per-cell payload, sorts, truncates to top 9, writes `cockpit.json` |
| `tests/python/test_build_cockpit.py` | PR 1 | Builder shape + selection logic + delta/percentile/sparkline math |
| `tests/python/test_cockpit_whitelist.py` | PR 1 | Whitelist is self-consistent (no dup ids, ≥9 entries, every series id in catalog) |
| `tests/python/test_validate_cockpit_schema.py` | PR 1 | `check_cockpit_schema` accepts valid samples, rejects every required-key violation |
| `tests/python/test_cockpit_priority_merge.py` | PR 1 | Sample `signal_priority.json` produces correct top-9; ties resolve correctly |
| `tests/python/test_cockpit_freshness.py` | PR 1 | Stale series still occupies slot; unavailable falls back to next-priority |

### New React files
| Path | Owner PR | Purpose |
|---|---|---|
| `src/components/Sparkline.tsx` | PR 2 | Reusable inline SVG sparkline (no ECharts) |
| `src/components/PercentileBand.tsx` | PR 2 | Reusable inline SVG percentile bar |
| `src/components/FreshnessPill.tsx` | PR 2 | Reusable ok/stale/unavailable pill |
| `src/components/CockpitCell.tsx` | PR 2 | Atomic vital-sign cell template |
| `src/components/CompositeScoresRow.tsx` | PR 2 | Always 3 fixed composite-score cells |
| `src/components/MarketCockpit.tsx` | PR 2 | Owns the cockpit grid |
| `src/components/__tests__/*.test.tsx` | PR 2 | Vitest specs for each of the above |
| `src/__fixtures__/cockpit/today.json` | PR 2 | Happy-path render fixture |
| `src/__fixtures__/cockpit/all-stale.json` | PR 2 | Every-cell-stale fixture |
| `src/__fixtures__/cockpit/partial-fill.json` | PR 2 | Only 5 vital signs available |
| `src/__fixtures__/cockpit/truncation.json` | PR 2 | All 15 whitelist entries valid; top-9 truncation test |
| `src/__fixtures__/cockpit/composite-missing.json` | PR 2 | Schema-rejection negative fixture |
| `src/lib/mode.ts` | PR 3 | Mode context (URL/localStorage/viewport precedence) |
| `src/components/PersistentRegimeHeader.tsx` | PR 3 | Sticky regime header in AppLayout |
| `src/components/RouteScoreStrip.tsx` | PR 3 | Slim per-route adapter replacing HorizonScoreHeader |
| `src/components/TodaysNotable.tsx` | PR 4 | 3-column Today's Notable band |
| `src/components/WhatChangedColumn.tsx` | PR 4 | Driver-attribution diff (3rd column) |
| `src/components/ContextBlock.tsx` | PR 4 | `<details>` collapsible wrapper |
| `src/routes/Channels.tsx` | PR 5 | Tabbed route hosting 10 channel tabs |
| `src/components/channels/ChannelTabs.tsx` | PR 5 | Tab strip with URL state |
| `src/components/channels/{Volatility,Rates,Liquidity,Credit,Dollar,Commodities,Growth,Housing,Inflation,Positioning}Tab.tsx` | PR 5 | Extracted bodies of the 10 old routes |
| `src/routes/History.tsx` | PR 6 | Tabbed route for regime + replay |
| `src/components/history/{RegimeTab,ReplayTab}.tsx` | PR 6 | Extracted bodies |

### Modified Python files
| Path | Touched in PRs | Why |
|---|---|---|
| `scripts/update_data.py` | PR 1 | Add `build_cockpit` to module run list |
| `scripts/validate/validate_schema.py` | PR 1 | Add `check_cockpit_schema()` |
| `scripts/validate/validate_freshness.py` | PR 1 | Add `cockpit` expectation |

### Modified React files
| Path | Touched in PRs | Why |
|---|---|---|
| `src/lib/types.ts` | PR 2, 3 | Add `CockpitFile`, `Mode` types |
| `src/lib/data.ts` | PR 2 | Add `loadCockpit()` |
| `src/styles.css` | PR 2, 3, 4 | Cockpit grid + sticky header + Brief/Detail mode + Today's Notable |
| `src/routes/Overview.tsx` | PR 2, 4 | Insert cockpit (PR 2), then delete duplicates + add Today's Notable + Context (PR 4) |
| `src/components/AppLayout.tsx` | PR 3, 5 | Mount header (PR 3), collapse nav (PR 5) |
| `src/App.tsx` | PR 3, 5, 6 | Mount ModeProvider (PR 3), register /channels + 10 redirects (PR 5), register /history + 2 redirects (PR 6) |
| `src/routes/TacticalTradingWeather.tsx` | PR 7 | Remove duplicated chrome, swap HorizonScoreHeader → RouteScoreStrip |
| `src/routes/LongTermMacroClimate.tsx` | PR 7 | Same |
| `src/routes/FragilityShockRisk.tsx` | PR 7 | Same |

### Deleted files (by PR)
- **PR 5** deletes `src/routes/{Volatility,Rates,Liquidity,Credit,DollarGlobal,Commodities,Growth,Housing,Inflation,Sentiment}.tsx` (10 files).
- **PR 6** deletes `src/routes/RegimeMap.tsx`, `src/routes/HistoricalRegimeReplay.tsx`.
- **PR 7** deletes `src/components/OverviewDecisionCard.tsx`, `src/components/MarketBriefHeader.tsx`, `src/components/HorizonScoreHeader.tsx`.

---

## Chunk 1: PR 1 — Cockpit Python pipeline

**Branch:** `feat/cockpit-pipeline`
**Worktree:** `.worktrees/cockpit-pipeline`
**Estimated effort:** ~1 day
**No frontend changes. No user-visible change.**

### Task 1.0: Bootstrap worktree + venv

**Files:** workspace setup only.

- [ ] **Step 1: Create worktree off main and switch into it**

```bash
cd /Users/sakura/WebstormProjects/market-weather-map
git fetch origin main
git worktree add .worktrees/cockpit-pipeline -b feat/cockpit-pipeline origin/main
cd .worktrees/cockpit-pipeline
```

- [ ] **Step 2: Create local venv and install deps**

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
```

- [ ] **Step 3: Verify baseline is green**

```bash
.venv/bin/python -m pytest tests/python -v
npm test
```
Expected: both pass.

- [ ] **Step 4: Capture pre-initiative bundle-size baseline (used by PR 7 Task 7.4)**

```bash
npm run build
du -sk dist/assets/*.js | sort -n | tail -1
```
Record the output number (e.g., `912 dist/assets/index-abc123.js`) in PR 1's description under "Baseline metrics for PR 7 bundle-size budget". This is the pre-initiative baseline; PR 7 will compare against it.

### Task 1.1: Add `CockpitSignal` + `CockpitSecondaryLine` dataclasses (TDD)

**Files:**
- Create: `scripts/shared/cockpit_whitelist.py`
- Create: `tests/python/test_cockpit_whitelist.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/test_cockpit_whitelist.py
from scripts.shared.cockpit_whitelist import (
    COCKPIT_WHITELIST,
    CockpitSignal,
    CockpitSecondaryLine,
    REGIME_TONE_MAP,
)


def test_whitelist_has_at_least_nine_entries():
    assert len(COCKPIT_WHITELIST) >= 9


def test_whitelist_ids_are_unique():
    ids = [e.id for e in COCKPIT_WHITELIST]
    assert len(ids) == len(set(ids))


def test_every_direction_is_valid():
    for e in COCKPIT_WHITELIST:
        assert e.direction in {"risk", "support", "neutral"}


def test_default_importance_is_three():
    e = CockpitSignal(
        id="x", priority_key="x", display_label="X", primary_series_id="vix"
    )
    assert e.importance == 3


def test_secondary_line_defaults():
    sl = CockpitSecondaryLine(label="L", series_id="vix")
    assert sl.unit == ""
    assert sl.decimals == 1


def test_regime_tone_map_includes_known_labels():
    assert REGIME_TONE_MAP["Goldilocks"] == "positive"
    assert REGIME_TONE_MAP["Stagflation Pressure"] == "negative"
    assert REGIME_TONE_MAP.get("Reallocation / rotation", "neutral") == "neutral"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv/bin/python -m pytest tests/python/test_cockpit_whitelist.py -v
```
Expected: `ImportError: cannot import name 'CockpitSignal'`.

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/shared/cockpit_whitelist.py
"""Cockpit whitelist + display config.

The cockpit roster is intentionally Python (not JSON) so entries can carry
default-factory lists and so the type system enforces shape at import time.
Every entry must map to a series that exists in `scripts/shared/catalog.py`
(test_cockpit_whitelist enforces this) and that is `free_public_active`
or `proxy_only` (test_validate_cockpit_schema enforces this on output).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Direction = Literal["risk", "support", "neutral"]


@dataclass(frozen=True)
class CockpitSecondaryLine:
    label: str
    series_id: str
    unit: str = ""
    decimals: int = 1


@dataclass(frozen=True)
class CockpitSignal:
    id: str
    priority_key: str
    display_label: str
    primary_series_id: str
    secondary_lines: tuple[CockpitSecondaryLine, ...] = field(default_factory=tuple)
    primary_unit: str = ""
    primary_decimals: int = 1
    direction: Direction = "risk"
    importance: int = 3
    why_it_matters: str = ""


REGIME_TONE_MAP: dict[str, str] = {
    "Goldilocks": "positive",
    "Reflation": "positive",
    "Stagflation Pressure": "negative",
    "Risk-Off": "negative",
    "Disinflationary Slowdown": "negative",
    "Crowded Calm": "neutral",
    "Credit Stress": "negative",
    "Liquidity Stress": "negative",
}


COCKPIT_WHITELIST: tuple[CockpitSignal, ...] = (
    CockpitSignal(
        id="vix_complex",
        priority_key="vix_complex",
        display_label="VIX",
        primary_series_id="vix",
        secondary_lines=(
            CockpitSecondaryLine(label="VIX9D", series_id="vix9d"),
            CockpitSecondaryLine(label="VIX3M", series_id="vix3m"),
        ),
        primary_decimals=1,
        direction="risk",
        importance=5,
    ),
    CockpitSignal(
        id="us10y",
        priority_key="real_yields",  # piggybacks on rates pressure group
        display_label="US 10Y",
        primary_series_id="us10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="real_yields",
        priority_key="real_yields",
        display_label="10Y Real Yield",
        primary_series_id="real_yield_10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=5,
    ),
    CockpitSignal(
        id="yield_curve",
        priority_key="real_yields",
        display_label="10Y−2Y",
        primary_series_id="us10y_minus_us2y",
        primary_unit=" bp",
        primary_decimals=0,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="credit_spreads",
        priority_key="credit_spreads",
        display_label="HY OAS",
        primary_series_id="high_yield_oas",
        primary_unit=" bp",
        primary_decimals=0,
        direction="risk",
        importance=5,
    ),
    CockpitSignal(
        id="ig_spreads",
        priority_key="credit_spreads",
        display_label="IG OAS",
        primary_series_id="investment_grade_oas",
        primary_unit=" bp",
        primary_decimals=0,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="broad_dollar",
        priority_key="broad_dollar",
        display_label="Broad USD",
        primary_series_id="broad_dollar",
        primary_decimals=1,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="wti_crude",
        priority_key="commodities_inflation_impulse",
        display_label="WTI Crude",
        primary_series_id="wti_crude",
        primary_unit="$",
        primary_decimals=1,
        direction="risk",
        importance=3,
    ),
    CockpitSignal(
        id="net_liquidity",
        priority_key="net_liquidity",
        display_label="Net Liquidity",
        primary_series_id="net_liquidity",
        primary_unit=" T",
        primary_decimals=1,
        direction="support",
        importance=4,
    ),
    CockpitSignal(
        id="inflation",
        priority_key="inflation",
        display_label="Core CPI YoY",
        primary_series_id="core_cpi",
        secondary_lines=(
            CockpitSecondaryLine(label="Core PCE", series_id="core_pce", unit="% YoY"),
        ),
        primary_unit="% YoY",
        primary_decimals=1,
        direction="risk",
        importance=5,
    ),
    CockpitSignal(
        id="labor_claims",
        priority_key="labor",
        display_label="Initial Claims",
        primary_series_id="initial_claims",
        primary_unit="k",
        primary_decimals=0,
        direction="support",
        importance=4,
    ),
    CockpitSignal(
        id="payrolls",
        priority_key="labor",
        display_label="Nonfarm Payrolls",
        primary_series_id="nonfarm_payrolls",
        primary_unit="k",
        primary_decimals=0,
        direction="support",
        importance=4,
    ),
    CockpitSignal(
        id="sp500_positioning",
        priority_key="sentiment_positioning",
        display_label="SP500 Lev-Money",
        primary_series_id="cftc_sp500_lev_money_net",
        primary_unit="",
        primary_decimals=0,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="term_premium",
        priority_key="real_yields",
        display_label="10Y Term Premium",
        primary_series_id="term_premium_acm_10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=3,
    ),
    CockpitSignal(
        id="breakeven_10y",
        priority_key="inflation",
        display_label="10Y Breakeven",
        primary_series_id="breakeven_10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=4,
    ),
)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
.venv/bin/python -m pytest tests/python/test_cockpit_whitelist.py -v
```
Expected: all 6 tests pass.

- [ ] **Step 5: Extend test to check every series id exists in catalog**

Append to `tests/python/test_cockpit_whitelist.py`:

```python
from scripts.shared.catalog import catalog_entries


def test_every_whitelisted_series_is_in_catalog():
    catalog_ids = {e["id"] for e in catalog_entries()}
    for entry in COCKPIT_WHITELIST:
        assert entry.primary_series_id in catalog_ids, (
            f"{entry.id}: primary {entry.primary_series_id} not in catalog"
        )
        for sec in entry.secondary_lines:
            assert sec.series_id in catalog_ids, (
                f"{entry.id}: secondary {sec.series_id} not in catalog"
            )
```

Run: `.venv/bin/python -m pytest tests/python/test_cockpit_whitelist.py -v`
Expected: passes. If any whitelist entry references a missing series id, fix the whitelist before continuing.

- [ ] **Step 6: Commit**

```bash
git add scripts/shared/cockpit_whitelist.py tests/python/test_cockpit_whitelist.py
git commit -m "feat(cockpit): add whitelist dataclasses and 15-entry roster"
```

### Task 1.2: Add `loadable inputs` helper layer (TDD)

**Files:**
- Create: `scripts/transform/_cockpit_inputs.py` (NEW — keeps `build_cockpit.py` focused on transform logic)
- Add tests to: `tests/python/test_build_cockpit.py` (NEW)

- [ ] **Step 1: Write the failing test**

```python
# tests/python/test_build_cockpit.py
import json
from pathlib import Path

import pytest

from scripts.transform._cockpit_inputs import (
    load_signal_priority_index,
    load_series_observations,
)


@pytest.fixture
def sample_signal_priority(tmp_path):
    payload = {
        "top_warnings": [
            {"id": "inflation", "priority": 495.0, "importance": 5,
             "why_it_matters": "Inflation drives Fed policy."},
        ],
        "top_supports": [
            {"id": "credit_spreads", "priority": 359.0, "importance": 5,
             "why_it_matters": "Credit confirms stress."},
        ],
        "missing_high_value_signals": [],
        "overall_read": {},
    }
    path = tmp_path / "signal_priority.json"
    path.write_text(json.dumps(payload))
    return path


def test_load_signal_priority_index_merges_warnings_and_supports(sample_signal_priority):
    index = load_signal_priority_index(sample_signal_priority)
    assert "inflation" in index
    assert "credit_spreads" in index
    assert index["inflation"]["priority"] == 495.0


def test_load_signal_priority_index_missing_file_returns_empty(tmp_path):
    index = load_signal_priority_index(tmp_path / "nope.json")
    assert index == {}


def test_load_series_observations_returns_sorted_pairs(tmp_path):
    payload = {
        "observations": [
            {"date": "2026-05-15", "value": 3.2},
            {"date": "2026-05-14", "value": 3.1},
            {"date": "2026-05-13", "value": 3.0},
        ]
    }
    path = tmp_path / "core_cpi.json"
    path.write_text(json.dumps(payload))
    obs = load_series_observations(path)
    assert [o["value"] for o in obs] == [3.0, 3.1, 3.2]


def test_load_series_observations_missing_file_returns_none(tmp_path):
    assert load_series_observations(tmp_path / "nope.json") is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv/bin/python -m pytest tests/python/test_build_cockpit.py -v
```
Expected: `ImportError: cannot import name 'load_signal_priority_index'`.

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/transform/_cockpit_inputs.py
"""Input loaders for build_cockpit.py.

Each loader is permissive on missing files: returns None or {} rather than
raising, so the builder can degrade gracefully when a single upstream
artifact has not yet been generated (CI safe-update path).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_signal_priority_index(path: Path) -> dict[str, dict[str, Any]]:
    """Load signal_priority.json into {id: entry} dict.

    Merges top_warnings + top_supports. If both contain the same id (should not
    happen in practice), the warnings entry wins.
    """
    if not path.exists():
        return {}
    raw = json.loads(path.read_text())
    index: dict[str, dict[str, Any]] = {}
    for entry in raw.get("top_supports", []):
        index[entry["id"]] = entry
    for entry in raw.get("top_warnings", []):
        index[entry["id"]] = entry
    return index


def load_series_observations(path: Path) -> list[dict[str, Any]] | None:
    """Load a series JSON and return observations sorted ascending by date.

    Returns None if file does not exist or has no observations.
    """
    if not path.exists():
        return None
    raw = json.loads(path.read_text())
    obs = raw.get("observations") or []
    if not obs:
        return None
    return sorted(obs, key=lambda o: o["date"])
```

- [ ] **Step 4: Run test to verify it passes**

```bash
.venv/bin/python -m pytest tests/python/test_build_cockpit.py -v
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transform/_cockpit_inputs.py tests/python/test_build_cockpit.py
git commit -m "feat(cockpit): add input loaders for signal_priority and series JSONs"
```

### Task 1.3: Add per-cell math helpers (delta, percentile, sparkline) (TDD)

**Files:**
- Create: `scripts/transform/_cockpit_math.py`
- Add tests to: `tests/python/test_build_cockpit.py`

- [ ] **Step 1: Write the failing tests (append to test_build_cockpit.py)**

```python
from datetime import date

from scripts.transform._cockpit_math import (
    delta_against_window,
    percentile_5y,
    sparkline_90d,
    parse_date,
)


def _make_obs(date_str: str, value: float) -> dict[str, Any]:
    return {"date": date_str, "value": value}


def test_delta_against_window_daily():
    obs = [
        _make_obs("2026-05-01", 1.0),
        _make_obs("2026-05-08", 1.5),  # exactly 7d
        _make_obs("2026-05-15", 2.0),  # latest
    ]
    assert delta_against_window(obs, days=7) == pytest.approx(0.5)


def test_delta_against_window_returns_none_when_no_old_enough_obs():
    obs = [
        _make_obs("2026-05-13", 1.0),
        _make_obs("2026-05-14", 1.5),
        _make_obs("2026-05-15", 2.0),
    ]
    assert delta_against_window(obs, days=30) is None


def test_delta_against_window_uses_most_recent_obs_at_or_before_cutoff():
    obs = [
        _make_obs("2026-05-01", 1.0),
        _make_obs("2026-05-02", 1.1),
        _make_obs("2026-05-07", 1.4),
        _make_obs("2026-05-15", 2.0),
    ]
    # 7d back from 2026-05-15 = 2026-05-08; most recent strictly older = 2026-05-07
    assert delta_against_window(obs, days=7) == pytest.approx(0.6)


def test_percentile_5y_returns_position_and_window():
    obs = [_make_obs(f"2026-{m:02d}-01", float(m)) for m in range(1, 13)]
    pct, window = percentile_5y(obs)
    assert window == 12  # only 12 obs available; falls back
    # latest value (12.0) is the max -> 100th percentile bucket
    assert 90 <= pct <= 100


def test_percentile_5y_returns_none_when_insufficient_history():
    obs = [_make_obs("2026-05-15", 1.0)] * 5
    pct, window = percentile_5y(obs)
    assert pct is None
    assert window == 5


def test_sparkline_90d_takes_trailing_observations():
    obs = [_make_obs(f"2026-01-{i:02d}", float(i)) for i in range(1, 32)]
    obs += [_make_obs(f"2026-02-{i:02d}", float(i)) for i in range(1, 29)]
    obs += [_make_obs(f"2026-03-{i:02d}", float(i)) for i in range(1, 32)]
    spark = sparkline_90d(obs)
    assert len(spark) == 90
    # last point matches latest observation
    assert spark[-1] == 31.0


def test_sparkline_90d_pads_short_history():
    obs = [_make_obs(f"2026-05-{i:02d}", float(i)) for i in range(1, 11)]
    spark = sparkline_90d(obs)
    assert len(spark) == 10  # no padding; the front-end handles shorter arrays
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/python -m pytest tests/python/test_build_cockpit.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/transform/_cockpit_math.py
"""Pure-function math helpers for build_cockpit.

All functions are stateless and operate on the observation-list shape
[{"date": "YYYY-MM-DD", "value": float}, ...] sorted ascending by date.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any


def parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def delta_against_window(observations: list[dict[str, Any]], *, days: int) -> float | None:
    """Return latest_value - value_at_or_before(latest - `days`).

    Uses the most recent observation whose date is <= (latest_date - days).
    An observation that is EXACTLY `days` old qualifies. Returns None when
    no observation that old exists in the series.
    """
    if not observations:
        return None
    latest = observations[-1]
    latest_date = parse_date(latest["date"])
    cutoff = latest_date - timedelta(days=days)
    candidates = [o for o in observations[:-1] if parse_date(o["date"]) <= cutoff]
    if not candidates:
        return None
    base = candidates[-1]  # most recent at or before cutoff
    return latest["value"] - base["value"]


def percentile_5y(observations: list[dict[str, Any]]) -> tuple[int | None, int]:
    """Return (percentile_0_to_100, window_days_used).

    Uses up to 1260 trailing observations (5 trading years).
    If fewer than 60 observations exist, returns (None, len(observations)).
    """
    if not observations:
        return None, 0
    window = observations[-1260:]
    n = len(window)
    if n < 60:
        return None, n
    values = sorted(o["value"] for o in window)
    latest_value = observations[-1]["value"]
    rank = sum(1 for v in values if v < latest_value)
    pct = round(100 * rank / max(n - 1, 1))
    return min(max(pct, 0), 100), n


def sparkline_90d(observations: list[dict[str, Any]]) -> list[float]:
    """Return up to 90 trailing values."""
    if not observations:
        return []
    return [o["value"] for o in observations[-90:]]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
.venv/bin/python -m pytest tests/python/test_build_cockpit.py -v
```
Expected: all new tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transform/_cockpit_math.py tests/python/test_build_cockpit.py
git commit -m "feat(cockpit): add delta/percentile/sparkline math helpers"
```

### Task 1.4: Wire up the builder main flow (TDD)

**Files:**
- Create: `scripts/transform/build_cockpit.py`
- Add tests to: `tests/python/test_build_cockpit.py`

- [ ] **Step 1: Write the failing test (append)**

```python
from scripts.transform.build_cockpit import build_cockpit_payload


@pytest.fixture
def sample_inputs(tmp_path):
    """Minimal viable input tree: signal_priority + 2 series + score_summary + regime_snapshot."""
    # signal_priority
    sp = tmp_path / "signal_priority.json"
    sp.write_text(json.dumps({
        "top_warnings": [
            {"id": "inflation", "priority": 495.0, "importance": 5,
             "why_it_matters": "Inflation drives Fed policy."},
        ],
        "top_supports": [
            {"id": "credit_spreads", "priority": 359.0, "importance": 5,
             "why_it_matters": "Credit confirms stress."},
        ],
        "missing_high_value_signals": [],
        "overall_read": {},
    }))

    # series dir with 2 series the whitelist references
    series_dir = tmp_path / "series"
    series_dir.mkdir()
    (series_dir / "core_cpi.json").write_text(json.dumps({
        "series_id": "core_cpi",
        "observations": [
            {"date": f"2026-{m:02d}-15", "value": 3.0 + 0.01 * m}
            for m in range(1, 13)
        ],
    }))
    (series_dir / "high_yield_oas.json").write_text(json.dumps({
        "series_id": "high_yield_oas",
        "observations": [
            {"date": f"2026-05-{d:02d}", "value": 310 + d}
            for d in range(1, 16)
        ],
    }))

    # score_summary
    (tmp_path / "score_summary.json").write_text(json.dumps({
        "generated_at_utc": "2026-05-16T00:00:00Z",
        "date": "2026-05-15",
        "method_version": "test",
        "scores": {
            "market_weather": {"score": 4.3, "label": "Mixed", "confidence": 0.99,
                               "bucket_scores": {}, "bucket_weights": {},
                               "top_supports": [], "top_risks": [], "recent_changes": [],
                               "missing_or_stale_notes": [], "confidence_reasons": []},
            "macro_climate": {"score": 12.0, "label": "Mixed", "confidence": 0.99,
                              "bucket_scores": {}, "bucket_weights": {},
                              "top_supports": [], "top_risks": [], "recent_changes": [],
                              "missing_or_stale_notes": [], "confidence_reasons": []},
            "fragility": {"score": 28.8, "label": "Low Fragility", "confidence": 0.98,
                          "bucket_scores": {}, "bucket_weights": {},
                          "top_supports": [], "top_risks": [], "recent_changes": [],
                          "missing_or_stale_notes": [], "confidence_reasons": []},
        },
        "conflicting_signals": [],
        "data_quality": {},
    }))

    # regime_snapshot
    (tmp_path / "regime_snapshot.json").write_text(json.dumps({
        "regime": {"label": "Reallocation / rotation"},
    }))

    # data_status — mark both series ok
    (tmp_path / "data_status.json").write_text(json.dumps({
        "series": {
            "core_cpi": {"status": "ok"},
            "high_yield_oas": {"status": "ok"},
        }
    }))

    return tmp_path


def test_build_cockpit_payload_has_three_composite_scores(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    assert len(payload["composite_scores"]) == 3
    ids = [s["id"] for s in payload["composite_scores"]]
    assert ids == ["market_weather", "macro_climate", "fragility"]


def test_build_cockpit_payload_regime_field_from_snapshot(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    assert payload["regime"]["label"] == "Reallocation / rotation"
    assert payload["regime"]["tone"] == "neutral"


def test_build_cockpit_payload_vital_signs_sorted_by_priority(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    # Only 2 whitelist entries have matching series in the fixture, so only
    # 2 vital_signs emitted; inflation (priority 495) ranks before credit (359).
    vs = payload["vital_signs"]
    assert len(vs) == 2
    assert vs[0]["id"] == "inflation"
    assert vs[0]["rank"] == 1
    assert vs[1]["id"] == "credit_spreads"
    assert vs[1]["rank"] == 2


def test_build_cockpit_payload_includes_method_version(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    assert payload["method_version"].startswith("phase-e-cockpit-v")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/python -m pytest tests/python/test_build_cockpit.py -v
```
Expected: `ImportError: cannot import name 'build_cockpit_payload'`.

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/transform/build_cockpit.py
"""Builds public/data/derived/cockpit.json from signal_priority + series + scores.

Selection rule (see spec §"Cockpit selection rule"):
1. For each whitelist entry, compute a per-cell payload from its primary series.
2. Look up today's priority from signal_priority.json by matching priority_key.
3. Filter out unavailable / non-active cells.
4. Sort by (priority desc, importance desc, id asc).
5. Take top 9 as vital_signs; emit the rest as candidates_not_shown.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.shared.cockpit_whitelist import (
    COCKPIT_WHITELIST,
    REGIME_TONE_MAP,
    CockpitSignal,
)
from scripts.shared.io import utc_now_iso
from scripts.transform._cockpit_inputs import (
    load_series_observations,
    load_signal_priority_index,
)
from scripts.transform._cockpit_math import (
    delta_against_window,
    percentile_5y,
    sparkline_90d,
)

METHOD_VERSION = "phase-e-cockpit-v1"
MAX_VITAL_SIGNS = 9
COMPOSITE_SCORE_ORDER: tuple[str, ...] = ("market_weather", "macro_climate", "fragility")


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def _compose_composite_scores(score_summary: dict[str, Any]) -> list[dict[str, Any]]:
    scores = score_summary.get("scores", {})
    out: list[dict[str, Any]] = []
    for sid in COMPOSITE_SCORE_ORDER:
        s = scores.get(sid, {})
        out.append({
            "id": sid,
            "label": sid.replace("_", " ").title(),
            "value": s.get("score"),
            "regime_label": s.get("label"),
            "percentile_5y": None,        # populated when score_history.json arrives
            "percentile_window_days": None,
            "delta_7d": None,
            "delta_1m": None,
            "sparkline_90d": [],
            "direction": "neutral",
        })
    return out


def _compose_vital_sign(
    entry: CockpitSignal,
    series_root: Path,
    data_status: dict[str, Any],
    priority_index: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    """Return the payload for one whitelist entry, or None if unavailable."""
    # Load primary series — try public/data/series first, then public/data/derived.
    obs = _load_series_or_derived(series_root, entry.primary_series_id)
    if obs is None:
        return None

    # Freshness + score_status come from data_status.json
    status_entry = data_status.get("series", {}).get(entry.primary_series_id, {})
    freshness = _normalize_freshness(status_entry.get("status"))
    score_status = _project_score_status(status_entry.get("status"))
    if score_status != "active":
        return None  # defense-in-depth — never emit a candidate cell

    # Per-cell payload
    pct, window = percentile_5y(obs)
    priority_meta = priority_index.get(entry.priority_key, {})
    payload = {
        "id": entry.id,
        "label": entry.display_label,
        "primary_value": obs[-1]["value"],
        "primary_unit": entry.primary_unit,
        "primary_decimals": entry.primary_decimals,
        "secondary_values": _compose_secondary_values(entry, series_root),
        "percentile_5y": pct,
        "percentile_window_days": window,
        "delta_7d": delta_against_window(obs, days=7),
        "delta_1m": delta_against_window(obs, days=30),
        "sparkline_90d": sparkline_90d(obs),
        "freshness_status": freshness,
        "score_status": score_status,
        "as_of": obs[-1]["date"],
        "direction": entry.direction,
        "source_series_ids": [entry.primary_series_id] + [s.series_id for s in entry.secondary_lines],
        "priority": float(priority_meta.get("priority", 0)),
        "importance": int(priority_meta.get("importance", entry.importance)),
        "why_it_matters": priority_meta.get("why_it_matters") or entry.why_it_matters,
    }
    return payload


def _compose_secondary_values(entry: CockpitSignal, series_root: Path) -> list[dict[str, Any]]:
    out = []
    for sec in entry.secondary_lines:
        obs = _load_series_or_derived(series_root, sec.series_id)
        if obs is None:
            continue
        out.append({"label": sec.label, "value": obs[-1]["value"], "unit": sec.unit})
    return out


def _load_series_or_derived(series_root: Path, series_id: str) -> list[dict[str, Any]] | None:
    """Look for series_id in series/ then derived/ subdirs of series_root."""
    for sub in ("series", "derived", ""):
        candidate = series_root / sub / f"{series_id}.json" if sub else series_root / f"{series_id}.json"
        obs = load_series_observations(candidate)
        if obs is not None:
            return obs
    return None


def _normalize_freshness(status: str | None) -> str:
    if status in {"ok", "stale", "unavailable"}:
        return status
    return "unavailable"


def _project_score_status(status: str | None) -> str:
    """Project per-status freshness into the score_status enum."""
    if status in {"ok", "stale"}:
        return "active"
    if status in {"terms_review_needed", "source_review_required"}:
        return "candidate"
    return "unavailable"


def build_cockpit_payload(input_root: Path) -> dict[str, Any]:
    """Pure function: read inputs, produce cockpit.json payload."""
    signal_priority = load_signal_priority_index(input_root / "signal_priority.json")
    score_summary = _read_json(input_root / "score_summary.json", {})
    regime_snapshot = _read_json(input_root / "regime_snapshot.json", {})
    data_status = _read_json(input_root / "data_status.json", {"series": {}})

    composite = _compose_composite_scores(score_summary)

    # Compose all whitelist entries
    cells_with_priority: list[tuple[float, int, str, dict[str, Any]]] = []
    skipped: list[dict[str, Any]] = []
    for entry in COCKPIT_WHITELIST:
        cell = _compose_vital_sign(entry, input_root, data_status, signal_priority)
        if cell is None:
            skipped.append({
                "id": entry.id,
                "priority": float(signal_priority.get(entry.priority_key, {}).get("priority", 0)),
                "reason": "unavailable",
            })
            continue
        cells_with_priority.append((cell["priority"], cell["importance"], entry.id, cell))

    # Sort: priority desc, importance desc, id asc
    cells_with_priority.sort(key=lambda t: (-t[0], -t[1], t[2]))
    vital_signs = [c for _, _, _, c in cells_with_priority[:MAX_VITAL_SIGNS]]
    for rank, vs in enumerate(vital_signs, start=1):
        vs["rank"] = rank
    not_shown = skipped + [
        {"id": entry_id, "priority": prio, "reason": "below top 9 today"}
        for prio, _, entry_id, _ in cells_with_priority[MAX_VITAL_SIGNS:]
    ]

    regime_label = regime_snapshot.get("regime", {}).get("label", "Unknown")

    return {
        "generated_at_utc": utc_now_iso(),
        "date": score_summary.get("date"),
        "method_version": METHOD_VERSION,
        "regime": {
            "label": regime_label,
            "tone": REGIME_TONE_MAP.get(regime_label, "neutral"),
        },
        "composite_scores": composite,
        "vital_signs": vital_signs,
        "candidates_not_shown": not_shown,
    }


def main() -> None:
    """CLI entry point — reads from public/data/, writes public/data/derived/cockpit.json."""
    from scripts.shared.io import write_json

    project_root = Path(__file__).resolve().parents[2]
    data_root = project_root / "public" / "data"

    payload = build_cockpit_payload(data_root)
    out_path = data_root / "derived" / "cockpit.json"
    write_json(out_path, payload)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
.venv/bin/python -m pytest tests/python/test_build_cockpit.py -v
```
Expected: all tests pass.

- [ ] **Step 5: Add a derived/-path fallback test (load_series_or_derived branch)**

```python
def test_build_cockpit_loads_from_derived_dir(tmp_path):
    """Whitelist entries pointing to derived series (us10y_minus_us2y, net_liquidity)
    must resolve from public/data/derived/ when the file is not in series/."""
    # Build a minimal fixture where us10y_minus_us2y lives under derived/
    sp = tmp_path / "signal_priority.json"
    sp.write_text(json.dumps({
        "top_warnings": [{"id": "real_yields", "priority": 100.0, "importance": 4,
                          "why_it_matters": ""}],
        "top_supports": [], "missing_high_value_signals": [], "overall_read": {},
    }))
    (tmp_path / "series").mkdir()
    derived_dir = tmp_path / "derived"
    derived_dir.mkdir()
    (derived_dir / "us10y_minus_us2y.json").write_text(json.dumps({
        "series_id": "us10y_minus_us2y",
        "observations": [{"date": f"2026-05-{d:02d}", "value": -33.0 + d}
                         for d in range(1, 16)],
    }))
    (tmp_path / "score_summary.json").write_text(json.dumps({
        "date": "2026-05-15",
        "scores": {s: {"score": 0, "label": "M", "confidence": 1, "bucket_scores": {},
                       "bucket_weights": {}, "top_supports": [], "top_risks": [],
                       "recent_changes": [], "missing_or_stale_notes": [],
                       "confidence_reasons": []}
                   for s in ("market_weather", "macro_climate", "fragility")},
    }))
    (tmp_path / "regime_snapshot.json").write_text(json.dumps({"regime": {"label": "X"}}))
    (tmp_path / "data_status.json").write_text(json.dumps({
        "series": {"us10y_minus_us2y": {"status": "ok"}}
    }))
    payload = build_cockpit_payload(tmp_path)
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "yield_curve" in vs_ids  # whitelist entry whose primary_series_id is us10y_minus_us2y
```

Run: `.venv/bin/python -m pytest tests/python/test_build_cockpit.py -v`. Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/transform/build_cockpit.py tests/python/test_build_cockpit.py
git commit -m "feat(cockpit): implement builder main flow + derived-path fallback"
```

### Task 1.5: Add freshness + truncation tests

**Files:**
- Create: `tests/python/test_cockpit_freshness.py`
- Create: `tests/python/test_cockpit_priority_merge.py`

- [ ] **Step 1: Write tests for stale-still-occupies-slot + unavailable-falls-back**

```python
# tests/python/test_cockpit_freshness.py
import json

import pytest

from scripts.transform.build_cockpit import build_cockpit_payload


def _make_minimal_inputs(tmp_path, *, core_cpi_status="ok"):
    """Helper: minimal fixture with only one whitelist signal available."""
    (tmp_path / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [{"id": "inflation", "priority": 495.0, "importance": 5,
                          "why_it_matters": ""}],
        "top_supports": [],
        "missing_high_value_signals": [],
        "overall_read": {},
    }))
    series_dir = tmp_path / "series"
    series_dir.mkdir()
    (series_dir / "core_cpi.json").write_text(json.dumps({
        "series_id": "core_cpi",
        "observations": [
            {"date": f"2026-{m:02d}-15", "value": 3.0 + 0.01 * m}
            for m in range(1, 13)
        ],
    }))
    (tmp_path / "score_summary.json").write_text(json.dumps({
        "date": "2026-05-15",
        "scores": {
            sid: {"score": 0, "label": "Mixed", "confidence": 0.99, "bucket_scores": {},
                  "bucket_weights": {}, "top_supports": [], "top_risks": [],
                  "recent_changes": [], "missing_or_stale_notes": [],
                  "confidence_reasons": []}
            for sid in ("market_weather", "macro_climate", "fragility")
        },
    }))
    (tmp_path / "regime_snapshot.json").write_text(json.dumps({
        "regime": {"label": "Mixed"}
    }))
    (tmp_path / "data_status.json").write_text(json.dumps({
        "series": {"core_cpi": {"status": core_cpi_status}}
    }))
    return tmp_path


def test_stale_signal_still_occupies_slot(tmp_path):
    payload = build_cockpit_payload(_make_minimal_inputs(tmp_path, core_cpi_status="stale"))
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "inflation" in vs_ids
    inflation = next(v for v in payload["vital_signs"] if v["id"] == "inflation")
    assert inflation["freshness_status"] == "stale"


def test_candidate_status_excludes_from_cockpit(tmp_path):
    payload = build_cockpit_payload(_make_minimal_inputs(tmp_path, core_cpi_status="terms_review_needed"))
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "inflation" not in vs_ids
    # And it lands in candidates_not_shown
    not_shown_ids = [c["id"] for c in payload["candidates_not_shown"]]
    assert "inflation" in not_shown_ids


def test_unavailable_signal_excluded(tmp_path):
    inputs = _make_minimal_inputs(tmp_path, core_cpi_status="unavailable")
    # Also delete the series file
    (inputs / "series" / "core_cpi.json").unlink()
    payload = build_cockpit_payload(inputs)
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "inflation" not in vs_ids
```

- [ ] **Step 2: Run tests**

```bash
.venv/bin/python -m pytest tests/python/test_cockpit_freshness.py -v
```
Expected: pass.

- [ ] **Step 3: Write priority-merge / tie-break test**

```python
# tests/python/test_cockpit_priority_merge.py
import json

from scripts.transform.build_cockpit import build_cockpit_payload


def _multi_signal_inputs(tmp_path):
    """Fixture: 3 whitelist signals available, with intentional priority ties."""
    (tmp_path / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [
            {"id": "inflation", "priority": 100.0, "importance": 5, "why_it_matters": ""},
            {"id": "credit_spreads", "priority": 100.0, "importance": 4, "why_it_matters": ""},
        ],
        "top_supports": [
            {"id": "labor", "priority": 50.0, "importance": 5, "why_it_matters": ""},
        ],
        "missing_high_value_signals": [],
        "overall_read": {},
    }))
    series_dir = tmp_path / "series"
    series_dir.mkdir()
    for sid in ("core_cpi", "high_yield_oas", "initial_claims"):
        (series_dir / f"{sid}.json").write_text(json.dumps({
            "series_id": sid,
            "observations": [{"date": f"2026-05-{d:02d}", "value": d * 1.0}
                             for d in range(1, 16)],
        }))
    (tmp_path / "score_summary.json").write_text(json.dumps({
        "date": "2026-05-15",
        "scores": {sid: {"score": 0, "label": "M", "confidence": 1, "bucket_scores": {},
                          "bucket_weights": {}, "top_supports": [], "top_risks": [],
                          "recent_changes": [], "missing_or_stale_notes": [],
                          "confidence_reasons": []}
                    for sid in ("market_weather", "macro_climate", "fragility")},
    }))
    (tmp_path / "regime_snapshot.json").write_text(json.dumps({"regime": {"label": "X"}}))
    (tmp_path / "data_status.json").write_text(json.dumps({"series": {
        "core_cpi": {"status": "ok"},
        "high_yield_oas": {"status": "ok"},
        "initial_claims": {"status": "ok"},
    }}))
    return tmp_path


def test_tie_breaks_by_importance_then_id(tmp_path):
    payload = build_cockpit_payload(_multi_signal_inputs(tmp_path))
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    # inflation (priority 100, importance 5) > credit_spreads (priority 100, importance 4)
    # > labor_claims + payrolls (both priority 50, importance 4, tiebreak by id)
    assert vs_ids.index("inflation") < vs_ids.index("credit_spreads")
    assert vs_ids.index("credit_spreads") < vs_ids.index("labor_claims")
    # Alphabetical tiebreak: labor_claims < payrolls
    if "payrolls" in vs_ids:
        assert vs_ids.index("labor_claims") < vs_ids.index("payrolls")
```

- [ ] **Step 4: Run tests**

```bash
.venv/bin/python -m pytest tests/python/test_cockpit_priority_merge.py -v
```
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add tests/python/test_cockpit_freshness.py tests/python/test_cockpit_priority_merge.py
git commit -m "test(cockpit): freshness + priority-tiebreak behavior"
```

### Task 1.6: Wire builder into `scripts/update_data.py`

**Files:**
- Modify: `scripts/update_data.py`

- [ ] **Step 1: Read the existing module structure**

```bash
grep -n "MODULES_TRANSFORM\|MODULES = " scripts/update_data.py
```
Note the existing per-phase lists: `MODULES_TRANSFORM_EXISTING`, `MODULES_TRANSFORM_PHASE_B`, `MODULES_TRANSFORM_PHASE_C`. The aggregate `MODULES` tuple concatenates them in order.

- [ ] **Step 2: Add a new phase list and concatenate it**

`build_cockpit` depends on both `compute_regime_score` (writes `score_summary.json`) and `build_signal_priority`. Both live in `MODULES_TRANSFORM_EXISTING`. Add a new `MODULES_TRANSFORM_PHASE_E` list AFTER the existing phase lists so cockpit runs last, after all upstream artifacts are present:

```python
# In scripts/update_data.py, add after MODULES_TRANSFORM_PHASE_C:
MODULES_TRANSFORM_PHASE_E: list[str] = [
    "scripts.transform.build_cockpit",
]
```

Then update the aggregate `MODULES` concatenation to include the new list (follow the same `+ MODULES_TRANSFORM_PHASE_X` pattern already present).

- [ ] **Step 3: Run the full pipeline**

```bash
.venv/bin/python -m scripts.update_data
ls -la public/data/derived/cockpit.json
```
Expected: file exists, recent timestamp, valid JSON.

- [ ] **Step 4: Inspect the output**

```bash
.venv/bin/python -c "import json; d=json.load(open('public/data/derived/cockpit.json')); print('vital_signs:', len(d['vital_signs'])); print('composite_scores:', [s['id'] for s in d['composite_scores']]); print('regime:', d['regime'])"
```
Expected: 9 vital signs (or fewer if not all whitelist entries have active series), 3 composite scores in fixed order, regime populated.

- [ ] **Step 5: Commit**

```bash
git add scripts/update_data.py public/data/derived/cockpit.json
git commit -m "feat(cockpit): wire build_cockpit into update_data pipeline"
```

### Task 1.7: Add schema validator (TDD)

**Files:**
- Modify: `scripts/validate/validate_schema.py`
- Create: `tests/python/test_validate_cockpit_schema.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/test_validate_cockpit_schema.py
import json
import pytest

from scripts.validate.validate_schema import check_cockpit_schema


def _valid_payload():
    return {
        "generated_at_utc": "2026-05-17T16:13:45Z",
        "date": "2026-05-15",
        "method_version": "phase-e-cockpit-v1",
        "regime": {"label": "Mixed", "tone": "neutral"},
        "composite_scores": [
            {"id": sid, "label": sid, "value": 4.3, "regime_label": "Mixed",
             "percentile_5y": None, "percentile_window_days": None,
             "delta_7d": None, "delta_1m": None, "sparkline_90d": [],
             "direction": "neutral"}
            for sid in ("market_weather", "macro_climate", "fragility")
        ],
        "vital_signs": [
            {"id": "inflation", "rank": 1, "label": "Inflation",
             "primary_value": 3.2, "primary_unit": "% YoY", "primary_decimals": 1,
             "secondary_values": [], "percentile_5y": 78, "percentile_window_days": 1260,
             "delta_7d": 0.1, "delta_1m": None, "sparkline_90d": [3.0, 3.2],
             "freshness_status": "ok", "score_status": "active",
             "as_of": "2026-04-01", "direction": "risk",
             "source_series_ids": ["core_cpi"], "priority": 495.0,
             "importance": 5, "why_it_matters": "..."}
        ],
        "candidates_not_shown": [],
    }


def test_valid_payload_passes(tmp_path):
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(_valid_payload()))
    check_cockpit_schema(p)  # should not raise


def test_missing_composite_score_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"].pop()
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_wrong_composite_order_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"].reverse()
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_more_than_nine_vital_signs_rejected(tmp_path):
    payload = _valid_payload()
    template = payload["vital_signs"][0]
    payload["vital_signs"] = [
        {**template, "id": f"id{i}", "rank": i} for i in range(1, 11)
    ]
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_candidate_score_status_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"][0]["score_status"] = "candidate"
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_out_of_range_percentile_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"][0]["percentile_5y"] = 200
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv/bin/python -m pytest tests/python/test_validate_cockpit_schema.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Read `validate_schema.py` to find the dispatch convention**

```bash
grep -n "def check_\|def main\|file_exists\|json.loads" scripts/validate/validate_schema.py | head -30
```
Identify how `check_signal_priority_schema` (or any other `check_*` function) is invoked from the `main()` / dispatch loop. Most likely either (a) `check_X(Path(...))` is called directly with a hardcoded path, or (b) there's a registry list of `(filename, validator)` tuples. Mirror whichever pattern exists.

- [ ] **Step 4: Implement `check_cockpit_schema` in validate_schema.py**

```python
# Add to scripts/validate/validate_schema.py
COCKPIT_REQUIRED_TOP_KEYS = {
    "generated_at_utc", "date", "method_version", "regime",
    "composite_scores", "vital_signs", "candidates_not_shown",
}
COCKPIT_COMPOSITE_ORDER = ("market_weather", "macro_climate", "fragility")
COCKPIT_VITAL_REQUIRED_KEYS = {
    "id", "rank", "label", "primary_value", "primary_unit", "primary_decimals",
    "secondary_values", "percentile_5y", "percentile_window_days",
    "delta_7d", "delta_1m", "sparkline_90d",
    "freshness_status", "score_status", "as_of", "direction",
    "source_series_ids", "priority", "importance", "why_it_matters",
}


def check_cockpit_schema(path: Path) -> None:
    data = json.loads(path.read_text())
    missing = COCKPIT_REQUIRED_TOP_KEYS - set(data.keys())
    assert not missing, f"cockpit.json missing top-level keys: {missing}"

    cs = data["composite_scores"]
    assert len(cs) == 3, f"composite_scores must have 3 entries, got {len(cs)}"
    ids = tuple(s["id"] for s in cs)
    assert ids == COCKPIT_COMPOSITE_ORDER, (
        f"composite_scores order must be {COCKPIT_COMPOSITE_ORDER}, got {ids}"
    )

    vs = data["vital_signs"]
    assert 1 <= len(vs) <= 9, f"vital_signs count must be 1-9, got {len(vs)}"
    for cell in vs:
        missing_cell = COCKPIT_VITAL_REQUIRED_KEYS - set(cell.keys())
        assert not missing_cell, f"vital_signs cell missing keys: {missing_cell}"
        assert cell["score_status"] == "active", (
            f"vital_signs cell {cell['id']} score_status must be 'active', "
            f"got {cell['score_status']}"
        )
        assert cell["freshness_status"] in {"ok", "stale", "unavailable"}, (
            f"freshness_status invalid: {cell['freshness_status']}"
        )
        assert cell["direction"] in {"risk", "support", "neutral"}
        if cell["percentile_5y"] is not None:
            assert 0 <= cell["percentile_5y"] <= 100, (
                f"percentile_5y out of range: {cell['percentile_5y']}"
            )
        assert len(cell["sparkline_90d"]) <= 90, "sparkline_90d too long"
```

Then register `check_cockpit_schema` in the dispatch convention you identified in Step 3 — most likely a one-line addition matching the existing `check_signal_priority_schema` registration pattern.

- [ ] **Step 5: Run tests**

```bash
.venv/bin/python -m pytest tests/python/test_validate_cockpit_schema.py -v
.venv/bin/python -m scripts.validate.validate_schema
```
Expected: tests pass.

- [ ] **Step 6: Explicit single-file invocation to confirm the just-generated cockpit.json validates**

```bash
.venv/bin/python -c "from pathlib import Path; from scripts.validate.validate_schema import check_cockpit_schema; check_cockpit_schema(Path('public/data/derived/cockpit.json')); print('OK')"
```
Expected: prints `OK`. If the dispatch registration in Step 4 was missed, this step still catches it.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate/validate_schema.py tests/python/test_validate_cockpit_schema.py
git commit -m "feat(cockpit): add schema validator with required-keys + cardinality checks"
```

### Task 1.8: Add freshness expectation

**Files:**
- Modify: `scripts/validate/validate_freshness.py`

- [ ] **Step 1: Read the existing expectation table**

```bash
grep -n "DASHBOARD_FRESHNESS_TOLERANCE_DAYS\|page_insights\.json" scripts/validate/validate_freshness.py
```
Expected to find a `DASHBOARD_FRESHNESS_TOLERANCE_DAYS: dict[str, int]` keyed by filename (`"page_insights.json": 7`, etc.). Confirm this is the pattern.

- [ ] **Step 2: Add cockpit entry to the tolerance dict**

```python
# In scripts/validate/validate_freshness.py, append to DASHBOARD_FRESHNESS_TOLERANCE_DAYS:
"cockpit.json": 2,  # daily refresh + weekend tolerance
```

- [ ] **Step 3: Run freshness validator**

```bash
.venv/bin/python -m scripts.validate.validate_freshness
```
Expected: pass (cockpit.json was just generated).

- [ ] **Step 4: Commit**

```bash
git add scripts/validate/validate_freshness.py
git commit -m "feat(cockpit): add freshness expectation for cockpit.json"
```

### Task 1.85: Add backend truncation + composite-missing tests

These were originally bucketed into PR 2 fixtures but they test Python behavior; they belong here.

**Files:**
- Modify: `tests/python/test_build_cockpit.py`
- Modify: `tests/python/test_validate_cockpit_schema.py`

- [ ] **Step 1: Truncation test** — build a fixture where all 15 whitelist signals have valid series + non-zero priority; assert payload emits exactly 9 in priority order and the remaining 6 land in `candidates_not_shown` with `reason: "below top 9 today"`.

```python
def test_truncation_emits_top_nine_and_overflow_to_candidates_not_shown(tmp_path):
    """When all 15 whitelist entries qualify, only top 9 occupy vital_signs."""
    from scripts.shared.cockpit_whitelist import COCKPIT_WHITELIST
    # Build signal_priority with one entry per priority_key, descending priority
    keys_seen: set[str] = set()
    warnings = []
    for i, entry in enumerate(COCKPIT_WHITELIST):
        if entry.priority_key in keys_seen:
            continue
        keys_seen.add(entry.priority_key)
        warnings.append({
            "id": entry.priority_key,
            "priority": float(1000 - i * 10),
            "importance": entry.importance,
            "why_it_matters": "",
        })
    (tmp_path / "signal_priority.json").write_text(json.dumps({
        "top_warnings": warnings, "top_supports": [],
        "missing_high_value_signals": [], "overall_read": {},
    }))
    # Build series + derived files for every primary_series_id
    (tmp_path / "series").mkdir()
    (tmp_path / "derived").mkdir()
    for entry in COCKPIT_WHITELIST:
        target_dir = tmp_path / ("derived" if entry.primary_series_id in
                                 ("us10y_minus_us2y", "net_liquidity")
                                 else "series")
        (target_dir / f"{entry.primary_series_id}.json").write_text(json.dumps({
            "series_id": entry.primary_series_id,
            "observations": [{"date": f"2026-05-{d:02d}", "value": float(d)}
                             for d in range(1, 16)],
        }))
    (tmp_path / "score_summary.json").write_text(json.dumps({
        "date": "2026-05-15",
        "scores": {s: {"score": 0, "label": "M", "confidence": 1, "bucket_scores": {},
                       "bucket_weights": {}, "top_supports": [], "top_risks": [],
                       "recent_changes": [], "missing_or_stale_notes": [],
                       "confidence_reasons": []}
                   for s in ("market_weather", "macro_climate", "fragility")},
    }))
    (tmp_path / "regime_snapshot.json").write_text(json.dumps({"regime": {"label": "X"}}))
    (tmp_path / "data_status.json").write_text(json.dumps({
        "series": {e.primary_series_id: {"status": "ok"} for e in COCKPIT_WHITELIST}
    }))

    payload = build_cockpit_payload(tmp_path)
    assert len(payload["vital_signs"]) == 9
    not_shown_reasons = {c["reason"] for c in payload["candidates_not_shown"]}
    assert "below top 9 today" in not_shown_reasons
```

- [ ] **Step 2: Composite-missing rejection test** — augment `test_validate_cockpit_schema.py`:

```python
def test_composite_missing_fragility_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"] = [s for s in payload["composite_scores"] if s["id"] != "fragility"]
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)
```

- [ ] **Step 3: Run + commit**

```bash
.venv/bin/python -m pytest tests/python/test_build_cockpit.py tests/python/test_validate_cockpit_schema.py -v
git add tests/python/test_build_cockpit.py tests/python/test_validate_cockpit_schema.py
git commit -m "test(cockpit): truncation top-9 + composite-missing schema rejection"
```

### Task 1.9: Full verification gate + PR

- [ ] **Step 1: Run full gate**

```bash
.venv/bin/python -m pytest tests/python -v
npm test
npm run build
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
.venv/bin/python -m scripts.update_data
```
Expected: all green. The last command re-runs the full pipeline including safe_update, confirming the cockpit step doesn't break the rest.

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/cockpit-pipeline
gh pr create --title "feat(cockpit): backend pipeline producing public/data/derived/cockpit.json" --body "$(cat <<'EOF'
## Summary
- Adds `scripts/shared/cockpit_whitelist.py` with 15-signal `CockpitSignal` roster
- Adds `scripts/transform/build_cockpit.py` builder + helpers (`_cockpit_inputs.py`, `_cockpit_math.py`)
- Wires builder into `scripts/update_data.py`
- Adds `check_cockpit_schema()` + freshness expectation
- Adds 5 test modules covering whitelist, math, builder, freshness, schema

Spec: [docs/superpowers/specs/2026-05-17-overview-cockpit-redesign-design.md](docs/superpowers/specs/2026-05-17-overview-cockpit-redesign-design.md)

## Test plan
- [x] `pytest tests/python -v` passes
- [x] `npm test` passes
- [x] `python -m scripts.update_data` succeeds end-to-end
- [x] `python -m scripts.validate.validate_schema` passes for new cockpit.json
- [x] `python -m scripts.validate.validate_freshness` passes
- [x] No frontend changes; safe to merge independently

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Chunk 2: PR 2 — MarketCockpit React component

**Branch:** `feat/cockpit-component`
**Worktree:** `.worktrees/cockpit-component`
**Depends on:** PR 1 merged (consumes `cockpit.json`)
**Estimated effort:** ~2 days
**User-visible change:** new cockpit section appears above the old Overview content. Everything else unchanged.

### Task 2.0: Bootstrap worktree

**Prerequisite:** PR 1 must be merged to `main`. Verify with:
```bash
git log origin/main --oneline | head -3 | grep -q "cockpit" || echo "PR 1 not yet merged — wait."
```

- [ ] Create worktree + venv:

```bash
cd /Users/sakura/WebstormProjects/market-weather-map
git fetch origin main
git worktree add .worktrees/cockpit-component -b feat/cockpit-component origin/main
cd .worktrees/cockpit-component
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
```

- [ ] Confirm `public/data/derived/cockpit.json` is present (it was generated by PR 1 and committed to main).

### Task 2.1: Add `CockpitFile` types (TDD)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/__tests__/types.test.ts` (or create if not present)

- [ ] **Step 1: Write a compile-time type assertion test**

Vitest doesn't really test TypeScript types at runtime, but the import + JSON parse against a fixture is the practical test. Create `src/__fixtures__/cockpit/today.json` minimal sample then write:

```ts
// src/lib/__tests__/cockpit-types.test.ts
import type { CockpitFile, CockpitVitalSign } from "../types";
import sampleCockpit from "../../__fixtures__/cockpit/today.json";

test("cockpit fixture conforms to CockpitFile type", () => {
  const data = sampleCockpit as CockpitFile;
  expect(data.composite_scores).toHaveLength(3);
  expect(data.vital_signs[0]).toHaveProperty("primary_value");
  expect(data.regime.label).toBeTruthy();
});
```

And create a minimal fixture:

```bash
mkdir -p src/__fixtures__/cockpit
```

```json
// src/__fixtures__/cockpit/today.json
{
  "generated_at_utc": "2026-05-17T00:00:00Z",
  "date": "2026-05-15",
  "method_version": "phase-e-cockpit-v1",
  "regime": { "label": "Reallocation / rotation", "tone": "neutral" },
  "composite_scores": [
    { "id": "market_weather", "label": "Market Weather", "value": 4.3,
      "regime_label": "Mixed", "percentile_5y": 62, "percentile_window_days": 1260,
      "delta_7d": 0.3, "delta_1m": -0.5,
      "sparkline_90d": [3.8, 3.9, 4.0, 4.1, 4.2, 4.32],
      "direction": "neutral" },
    { "id": "macro_climate", "label": "Macro Climate", "value": 12.0,
      "regime_label": "Mixed", "percentile_5y": 71, "percentile_window_days": 1260,
      "delta_7d": -0.1, "delta_1m": -0.5,
      "sparkline_90d": [11.5, 11.7, 11.8, 11.9, 12.0],
      "direction": "neutral" },
    { "id": "fragility", "label": "Fragility", "value": 28.8,
      "regime_label": "Low Fragility", "percentile_5y": 18, "percentile_window_days": 1260,
      "delta_7d": 1.2, "delta_1m": 0.5,
      "sparkline_90d": [27.0, 27.5, 28.0, 28.5, 28.8],
      "direction": "neutral" }
  ],
  "vital_signs": [
    { "id": "inflation", "rank": 1, "label": "Inflation",
      "primary_value": 3.2, "primary_unit": "% YoY", "primary_decimals": 1,
      "secondary_values": [{"label": "Core PCE", "value": 2.8, "unit": "% YoY"}],
      "percentile_5y": 78, "percentile_window_days": 1260,
      "delta_7d": 0.1, "delta_1m": null,
      "sparkline_90d": [3.0, 3.1, 3.2],
      "freshness_status": "ok", "score_status": "active",
      "as_of": "2026-04-01", "direction": "risk",
      "source_series_ids": ["core_cpi", "core_pce"],
      "priority": 495.0, "importance": 5,
      "why_it_matters": "Inflation drives Fed policy expectations." }
  ],
  "candidates_not_shown": []
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- cockpit-types
```
Expected: TS error / cannot import `CockpitFile`.

- [ ] **Step 3: Add types to `src/lib/types.ts`**

```ts
// Append to src/lib/types.ts
export type CockpitDirection = "risk" | "support" | "neutral";
export type CockpitFreshnessStatus = "ok" | "stale" | "unavailable";
export type CockpitScoreStatus = "active" | "candidate" | "unavailable";
export type RegimeTone = "positive" | "neutral" | "negative";

export interface CockpitSecondaryValue {
  label: string;
  value: number;
  unit: string;
}

export interface CockpitCompositeScore {
  id: "market_weather" | "macro_climate" | "fragility";
  label: string;
  value: number | null;
  regime_label: string;
  percentile_5y: number | null;
  percentile_window_days: number | null;
  delta_7d: number | null;
  delta_1m: number | null;
  sparkline_90d: number[];
  direction: CockpitDirection;
}

export interface CockpitVitalSign {
  id: string;
  rank: number;
  label: string;
  primary_value: number;
  primary_unit: string;
  primary_decimals: number;
  secondary_values: CockpitSecondaryValue[];
  percentile_5y: number | null;
  percentile_window_days: number | null;
  delta_7d: number | null;
  delta_1m: number | null;
  sparkline_90d: number[];
  freshness_status: CockpitFreshnessStatus;
  score_status: CockpitScoreStatus;
  as_of: string;
  direction: CockpitDirection;
  source_series_ids: string[];
  priority: number;
  importance: number;
  why_it_matters: string;
}

export interface CockpitFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  regime: { label: string; tone: RegimeTone };
  composite_scores: CockpitCompositeScore[];
  vital_signs: CockpitVitalSign[];
  candidates_not_shown: Array<{ id: string; priority: number; reason: string }>;
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- cockpit-types
```
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/__tests__/cockpit-types.test.ts src/__fixtures__/cockpit/today.json
git commit -m "feat(cockpit): add CockpitFile types + minimal fixture"
```

### Task 2.2: Add `loadCockpit()` to data loader (TDD)

**Files:**
- Modify: `src/lib/data.ts`
- Modify: `src/lib/data.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// Append to src/lib/data.test.ts
import { loadCockpit } from "./data";

test("loadCockpit fetches cockpit.json and returns CockpitFile", async () => {
  const fixture = await import("../__fixtures__/cockpit/today.json");
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: true,
    json: async () => fixture.default,
  } as Response);
  const data = await loadCockpit();
  expect(data.vital_signs).toHaveLength(1);
  expect(data.composite_scores[0].id).toBe("market_weather");
});
```

- [ ] **Step 2: Run test → fail**

```bash
npm test -- data
```

- [ ] **Step 3: Read the existing pattern**

```bash
grep -n "loadSignalPriority\|fetchJson\|loadJson" src/lib/data.ts | head
```
Note the exact path-string convention used by existing loaders (with or without leading slash, with or without `data/` prefix). Copy that convention exactly — the dev/prod base-path handling lives in the shared helper.

- [ ] **Step 4: Implement**

```ts
// In src/lib/data.ts (use the same path convention as loadSignalPriority)
import type { CockpitFile } from "./types";

export async function loadCockpit(): Promise<CockpitFile> {
  // Substitute the exact path string used by loadSignalPriority — e.g.,
  // "derived/cockpit.json" or "/data/derived/cockpit.json" depending on
  // the existing helper. DO NOT guess; match the established pattern.
  return loadJson<CockpitFile>("derived/cockpit.json");
}
```

- [ ] **Step 4: Run test → pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/data.ts src/lib/data.test.ts
git commit -m "feat(cockpit): add loadCockpit() data loader"
```

### Task 2.3: Build `<Sparkline>` primitive (TDD)

**Files:**
- Create: `src/components/Sparkline.tsx`
- Create: `src/components/__tests__/Sparkline.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/__tests__/Sparkline.test.tsx
import { render } from "@testing-library/react";
import Sparkline from "../Sparkline";

test("renders an SVG polyline for the given points", () => {
  const { container } = render(
    <Sparkline points={[1, 2, 3, 4, 3, 2]} width={60} height={24} />
  );
  const poly = container.querySelector("polyline");
  expect(poly).not.toBeNull();
  expect(poly?.getAttribute("points")).toBeTruthy();
});

test("renders nothing when given fewer than 2 points", () => {
  const { container } = render(<Sparkline points={[]} />);
  expect(container.querySelector("polyline")).toBeNull();
});

test("scales values to fit the height", () => {
  const { container } = render(
    <Sparkline points={[0, 10]} width={100} height={20} />
  );
  const points = container.querySelector("polyline")?.getAttribute("points") ?? "";
  // First and last y should hit the extremes (0 and 20 with margin)
  const ys = points.split(" ").map(p => parseFloat(p.split(",")[1]));
  expect(ys.length).toBe(2);
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```tsx
// src/components/Sparkline.tsx
interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}

export default function Sparkline({
  points,
  width = 60,
  height = 24,
  className,
}: SparklineProps) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const polyPoints = points
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(" ");
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={polyPoints}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/Sparkline.tsx src/components/__tests__/Sparkline.test.tsx
git commit -m "feat(cockpit): add Sparkline inline-SVG primitive"
```

### Task 2.4: Build `<PercentileBand>` (TDD)

**Files:**
- Create: `src/components/PercentileBand.tsx`
- Create: `src/components/__tests__/PercentileBand.test.tsx`

- [ ] Follow same TDD pattern. The component takes `percentile` (0-100), `direction` ("risk"|"support"|"neutral"), and renders an inline-SVG gradient bar with a vertical tick at `percentile`. Test: renders SVG with tick at correct x; renders nothing when percentile is null. Commit.

### Task 2.5: Build `<FreshnessPill>` (TDD)

**Files:**
- Create: `src/components/FreshnessPill.tsx`
- Create: `src/components/__tests__/FreshnessPill.test.tsx`

- [ ] TDD: takes `status` and `asOf`. Renders a small pill with appropriate color class (`tone-positive`, `tone-warning`, `tone-negative` for ok/stale/unavailable). Test: each status renders the correct class; `asOf` shows in title attribute. Commit.

### Task 2.6: Build `<CockpitCell>` (TDD)

**Files:**
- Create: `src/components/CockpitCell.tsx`
- Create: `src/components/__tests__/CockpitCell.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// src/components/__tests__/CockpitCell.test.tsx
import { render, screen } from "@testing-library/react";
import CockpitCell from "../CockpitCell";
import sample from "../../__fixtures__/cockpit/today.json";

const inflation = sample.vital_signs[0];

test("renders label, primary value, sparkline, and percentile", () => {
  render(<CockpitCell sign={inflation as any} mode="detail" />);
  expect(screen.getByText("Inflation")).toBeInTheDocument();
  expect(screen.getByText(/3\.2/)).toBeInTheDocument();
  expect(document.querySelector("polyline")).not.toBeNull();
});

test("shows delta_7d and secondary in detail mode", () => {
  render(<CockpitCell sign={inflation as any} mode="detail" />);
  expect(screen.getByText(/0\.1/)).toBeInTheDocument(); // delta_7d
  expect(screen.getByText(/Core PCE/)).toBeInTheDocument();
});

test("hides delta_7d and secondary in brief mode", () => {
  render(<CockpitCell sign={inflation as any} mode="brief" />);
  expect(screen.queryByText(/Core PCE/)).toBeNull();
});

test("freshness pill renders with the correct status", () => {
  const stale = { ...inflation, freshness_status: "stale" as const };
  render(<CockpitCell sign={stale as any} mode="detail" />);
  // pill is keyed by class — assert appropriate selector
  expect(document.querySelector(".tone-warning, .freshness-pill--stale")).not.toBeNull();
});
```

- [ ] **Step 2: Implement** following the spec's "atomic vital-sign cell template":

```tsx
// src/components/CockpitCell.tsx
import type { CockpitVitalSign } from "../lib/types";
import type { Mode } from "../lib/mode";
import Sparkline from "./Sparkline";
import PercentileBand from "./PercentileBand";
import FreshnessPill from "./FreshnessPill";

interface Props {
  sign: CockpitVitalSign;
  mode: Mode;
}

function formatDelta(d: number | null): string | null {
  if (d === null) return null;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(2)}`;
}

export default function CockpitCell({ sign, mode }: Props) {
  const value = sign.primary_value.toFixed(sign.primary_decimals);
  return (
    <article
      className={`cockpit-cell cockpit-cell--${sign.direction} cockpit-cell--${mode}`}
      tabIndex={0}
      aria-label={`${sign.label}: ${value}${sign.primary_unit}`}
    >
      <header className="cockpit-cell__header">
        <span className="cockpit-cell__rank">#{sign.rank}</span>
        <h3 className="cockpit-cell__label">{sign.label}</h3>
        <span className={`cockpit-cell__direction cockpit-cell__direction--${sign.direction}`}>
          {sign.direction}
        </span>
      </header>
      <div className="cockpit-cell__primary">
        <span className="cockpit-cell__value">{value}</span>
        <span className="cockpit-cell__unit">{sign.primary_unit}</span>
      </div>
      <Sparkline points={sign.sparkline_90d} className={`cockpit-cell__spark cockpit-cell__spark--${sign.direction}`} />
      <PercentileBand percentile={sign.percentile_5y} direction={sign.direction} />
      {mode === "detail" && (
        <>
          {(sign.delta_7d !== null || sign.delta_1m !== null) && (
            <p className="cockpit-cell__deltas">
              {sign.delta_7d !== null && <span>Δ7d {formatDelta(sign.delta_7d)}</span>}
              {sign.delta_1m !== null && <span>Δ1m {formatDelta(sign.delta_1m)}</span>}
            </p>
          )}
          {sign.secondary_values.length > 0 && (
            <ul className="cockpit-cell__secondary">
              {sign.secondary_values.map((s) => (
                <li key={s.label}>{s.label} {s.value}{s.unit}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <FreshnessPill status={sign.freshness_status} asOf={sign.as_of} />
      <p className="cockpit-cell__why" aria-hidden="true">{sign.why_it_matters}</p>
    </article>
  );
}
```

Note: `Mode` type comes from `src/lib/mode.ts` in PR 3 — for PR 2, **declare and export it locally** at the top of `CockpitCell.tsx`:

```ts
export type Mode = "brief" | "detail";
```

Then `CompositeScoresRow.tsx` and `MarketCockpit.tsx` (later tasks in this PR) `import type { Mode } from "./CockpitCell";`. Tests import the same way.

**PR 3 obligation (tracked in Task 3.4 Step 3):** delete the local `Mode` declaration here; switch all three component files to `import type { Mode } from "../lib/mode";`.

- [ ] **Step 3: Run tests → pass.**
- [ ] **Step 4: Commit.**

### Task 2.7: Build `<CompositeScoresRow>` (TDD)

- [ ] Same TDD pattern. Component takes `scores: CockpitCompositeScore[]` and `mode: Mode`. Always renders exactly 3 cells in fixed order even if input is shuffled (re-sort by the fixed order). Each cell shows label + value + delta + sparkline. Test: render with shuffled input → output is still in fixed order. Commit.

### Task 2.8: Build `<MarketCockpit>` orchestrator (TDD)

**Files:**
- Create: `src/components/MarketCockpit.tsx`
- Create: `src/components/__tests__/MarketCockpit.test.tsx`

- [ ] TDD: takes `data: CockpitFile | null` and `mode: Mode`. When data is null, renders a loading state. When data is present, renders `<CompositeScoresRow>` + a 3×3 grid of `<CockpitCell>`. Test: loading state visible when data null; 3 composite cards + N vital cells rendered when data present. Commit.

### Task 2.9: Slot `<MarketCockpit>` into `Overview.tsx`

**Files:**
- Modify: `src/routes/Overview.tsx`

- [ ] **Step 0**: Read the current `Overview.tsx` structure so subsequent insertions land in the right place:

```bash
grep -n "Promise.all\|OverviewState\|page-heading\|MarketBriefHeader" src/routes/Overview.tsx
```

Confirm: there is a `Promise.all([...])` block that loads the route's data, an `OverviewState` interface, a `<section className="page-heading">`, and a `<MarketBriefHeader>` use. If any are renamed, adapt Steps 1-2 accordingly.

- [ ] **Step 1**: Add `loadCockpit` to the parallel `Promise.all` call. Add `cockpit: CockpitFile;` to the `OverviewState` interface. Default mode for PR 2 is hardcoded `"detail"` (PR 3 adds the toggle).

- [ ] **Step 2**: Insert `<MarketCockpit data={cockpit} mode="detail" />` between `<section className="page-heading">` and the existing `<MarketBriefHeader>` use.

- [ ] **Step 3**: Run dev server, visually verify cockpit renders above the existing content.

```bash
npm run dev -- --port 5175
```
Open `http://localhost:5175/`. Cockpit visible with 3 score cards + N vital cells.

- [ ] **Step 4: Run `npm test` and `npm run build`.** Commit.

### Task 2.10: CSS for cockpit grid + cell

**Files:**
- Modify: `src/styles.css`

- [ ] Add styles for `.market-cockpit`, `.cockpit-composite-row` (3-col grid), `.cockpit-vital-grid` (3×3 grid on desktop, single column on mobile via existing `auto-fit, minmax(220px, 1fr)`), `.cockpit-cell`, `.cockpit-cell--risk` (red left border), `.cockpit-cell--support` (green), `.cockpit-cell__value` (tabular-nums, large), etc.

- [ ] Use existing tone tokens where possible (`--accent`, `--border`, `--muted`, `--panel`).

- [ ] Visual review at desktop (1440px) and mobile (390px) via `agent-browser` or browser devtools.

- [ ] Commit.

### Task 2.11: Add additional frontend fixtures + tests

**Files:**
- Create: `src/__fixtures__/cockpit/all-stale.json`
- Create: `src/__fixtures__/cockpit/partial-fill.json`

These are **frontend rendering fixtures only**. The backend-equivalent fixtures (`truncation.json` for the 15→9 selection logic, `composite-missing.json` for schema rejection) live in PR 1 and assert Python behavior — not duplicated here.

- [ ] **Step 1**: Build `all-stale.json` — every vital_signs cell `freshness_status: "stale"`. Add a vitest assertion that every rendered cell carries the stale freshness pill.

- [ ] **Step 2**: Build `partial-fill.json` — only 5 vital_signs present (cockpit not fully populated). Add a vitest assertion that `<MarketCockpit>` renders 5 cells gracefully without crashing or rendering 4 empty slots.

- [ ] **Step 3**: Commit.

### Task 2.12: Verification + PR

- [ ] Run full gate:

```bash
npm test
npm run build
.venv/bin/python -m pytest tests/python -v
```

- [ ] Visual smoke check via `agent-browser`:

```bash
npm run dev -- --port 5175 &
agent-browser set viewport 1440 900
agent-browser open http://localhost:5175/
agent-browser screenshot /tmp/cockpit-pr2.png
```
Confirm cockpit visible above the old Overview content.

- [ ] Push + open PR:

```bash
git push -u origin feat/cockpit-component
gh pr create --title "feat(cockpit): MarketCockpit component + primitives on Overview" --body "..."
```

---

## Chunk 3: PR 3 — PersistentRegimeHeader + ModeProvider

**Branch:** `feat/persistent-header`
**Worktree:** `.worktrees/persistent-header`
**Depends on:** PR 1 merged. (Does not require PR 2.)
**Estimated effort:** ~1 day.

### Task 3.0: Bootstrap worktree (same pattern as Task 1.0)

### Task 3.1: Build `src/lib/mode.ts` (TDD)

**Files:**
- Create: `src/lib/mode.ts`
- Create: `src/lib/__tests__/mode.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// src/lib/__tests__/mode.test.ts
import { resolveMode } from "../mode";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

test("URL ?mode=brief wins over localStorage and viewport", () => {
  localStorage.setItem("mwm.mode", "detail");
  window.history.replaceState({}, "", "/?mode=brief");
  expect(resolveMode(1440)).toBe("brief");
});

test("localStorage wins when no URL param", () => {
  localStorage.setItem("mwm.mode", "brief");
  expect(resolveMode(1440)).toBe("brief");
});

test("viewport auto-default at <900px is brief", () => {
  expect(resolveMode(800)).toBe("brief");
});

test("viewport auto-default at >=900px is detail", () => {
  expect(resolveMode(1200)).toBe("detail");
});

test("invalid URL param falls back to next layer", () => {
  window.history.replaceState({}, "", "/?mode=garbage");
  localStorage.setItem("mwm.mode", "brief");
  expect(resolveMode(1200)).toBe("brief");
});
```

- [ ] **Step 2 → 5**: Implement `resolveMode(viewportWidth: number): Mode`. Also export `setMode(mode: Mode)` (writes URL + localStorage), a React context `ModeContext`, and a `<ModeProvider>` component that wires viewport-resize handling per the spec's "viewport-resize behavior" rule (explicit choice persists; auto only fires on first visit). Commit.

### Task 3.2: Build `<PersistentRegimeHeader>` (TDD)

**Files:**
- Create: `src/components/PersistentRegimeHeader.tsx`
- Create: `src/components/__tests__/PersistentRegimeHeader.test.tsx`

- [ ] TDD: renders regime label + color dot + composite risk score (computed from `cockpit.composite_scores`) + as-of date + Brief/Detail toggle. Sticky CSS. Test: renders all elements; toggle updates URL + localStorage. Commit.

### Task 3.3: Build `<RouteScoreStrip>` (TDD)

**Files:**
- Create: `src/components/RouteScoreStrip.tsx`
- Create: `src/components/__tests__/RouteScoreStrip.test.tsx`

Per spec §"Subpage header coverage": slim per-route adapter showing one composite score's label + value + percentile + sparkline, **without** the full driver-list bloat that `HorizonScoreHeader` carries today. **Data source**: reads directly from `cockpit.json[composite_scores]` (the same payload `MarketCockpit` already loads); the route picks which of the 3 composites to surface via a route→composite-id map. This keeps the data loader path single — no extra `score_summary.json` fetch on subpages.

Route→composite map:
- `/short-term` → `composite_scores[0]` (market_weather)
- `/long-term` → `composite_scores[1]` (macro_climate)
- `/fragility` → `composite_scores[2]` (fragility)

- [ ] **Step 1: Failing test**

```tsx
// src/components/__tests__/RouteScoreStrip.test.tsx
import { render, screen } from "@testing-library/react";
import RouteScoreStrip from "../RouteScoreStrip";
import sample from "../../__fixtures__/cockpit/today.json";

const marketWeather = sample.composite_scores[0];

test("renders label, value, regime label, and sparkline", () => {
  render(<RouteScoreStrip composite={marketWeather as any} />);
  expect(screen.getByText("Market Weather")).toBeInTheDocument();
  expect(screen.getByText(/4\.3/)).toBeInTheDocument();
  expect(screen.getByText(/Mixed/)).toBeInTheDocument();
  expect(document.querySelector("polyline")).not.toBeNull();
});

test("does not render the driver lists from HorizonScoreHeader", () => {
  // Sanity: this component should NOT carry the supports/risks list bloat.
  render(<RouteScoreStrip composite={marketWeather as any} />);
  expect(screen.queryByText(/Supports/i)).toBeNull();
  expect(screen.queryByText(/Risks/i)).toBeNull();
});
```

- [ ] **Step 2: Run → fail. Implement minimal component.** Roughly:

```tsx
// src/components/RouteScoreStrip.tsx
import type { CockpitCompositeScore } from "../lib/types";
import Sparkline from "./Sparkline";
import PercentileBand from "./PercentileBand";

interface Props {
  composite: CockpitCompositeScore;
}

export default function RouteScoreStrip({ composite }: Props) {
  const value = composite.value !== null ? composite.value.toFixed(1) : "—";
  return (
    <section className="route-score-strip" aria-label={`${composite.label} score`}>
      <header className="route-score-strip__header">
        <span className="route-score-strip__eyebrow">{composite.label}</span>
        <span className="route-score-strip__value">{value}</span>
        <span className="route-score-strip__regime">{composite.regime_label}</span>
      </header>
      <PercentileBand percentile={composite.percentile_5y} direction="neutral" />
      <Sparkline points={composite.sparkline_90d} width={200} height={32} />
    </section>
  );
}
```

- [ ] **Step 3: Run → pass. Commit.**

```bash
git add src/components/RouteScoreStrip.tsx src/components/__tests__/RouteScoreStrip.test.tsx
git commit -m "feat(cockpit): RouteScoreStrip for per-subpage composite score"
```

(PR 7 Task 7.1 will swap `<HorizonScoreHeader>` for this component on the 3 horizon routes.)

### Task 3.4: Mount `<ModeProvider>` + `<PersistentRegimeHeader>` in AppLayout

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/CockpitCell.tsx`, `src/components/CompositeScoresRow.tsx`, `src/components/MarketCockpit.tsx`

- [ ] **Step 1**: Wrap `<Routes>` in `<ModeProvider>` in `App.tsx`.

- [ ] **Step 2**: At top of `AppLayout`, fetch cockpit data and pass to header. Since `loadCockpit()` is a plain async function (not a hook), use a small inline pattern:

```tsx
// In AppLayout
const [cockpit, setCockpit] = useState<CockpitFile | null>(null);
useEffect(() => { loadCockpit().then(setCockpit).catch(() => {}); }, []);
// Render header — accepts null and shows skeleton:
<PersistentRegimeHeader cockpit={cockpit} />
```

(If you want a `useCockpit()` hook later for reuse, add it in a follow-up PR.)

- [ ] **Step 3 — PR 2 Mode handoff**: Now that `src/lib/mode.ts` exports the canonical `Mode` type, update three files to import it instead of the PR-2 local declaration:
  - In `src/components/CockpitCell.tsx`: delete `export type Mode = "brief" | "detail";`; add `import type { Mode } from "../lib/mode";`.
  - In `src/components/CompositeScoresRow.tsx`: change `import type { Mode } from "./CockpitCell";` → `import type { Mode } from "../lib/mode";`.
  - In `src/components/MarketCockpit.tsx`: same change.
  - Update any test file that imported `Mode` from `CockpitCell` to import from `../lib/mode`.

Run `npm test` to confirm no broken imports.

- [ ] **Step 4**: Use `useMode()` (from `src/lib/mode.ts`) in `Overview.tsx` to source the `mode` prop currently hardcoded to `"detail"`:

```tsx
import { useMode } from "../lib/mode";
const mode = useMode();
// <MarketCockpit data={cockpit} mode={mode} />
```

- [ ] **Step 5**: Add CSS in `src/styles.css`:
  - `.persistent-regime-header { position: sticky; top: 0; z-index: 20; ... }`
  - Scroll-shrink rule: a class added via JS listener (e.g., `.persistent-regime-header--thin`) compresses padding + hides date/refresh after 80px scroll.
  - Honor `@media (prefers-reduced-motion: reduce) { ... no transitions ... }`.

- [ ] **Step 6**: Visual check via dev server at desktop (1440×900) and mobile (390×844). Confirm header renders on every route, toggle persists across navigation, sticky behavior + thin-bar collapse work. Commit.

### Task 3.5: Verification + PR

- [ ] Verification gate + PR open per the established pattern.

---

## Chunk 4: PR 4 — Demote Overview duplicates + Today's Notable + Context

**Branch:** `feat/overview-demote`
**Worktree:** `.worktrees/overview-demote`
**Depends on:** PRs 2 + 3 merged.
**Estimated effort:** ~2 days. **Highest visual-risk PR.**

### Task 4.0: Bootstrap worktree.

### Task 4.1: Build `<TodaysNotable>` (TDD)

**Files:**
- Create: `src/components/TodaysNotable.tsx`
- Create: `src/components/__tests__/TodaysNotable.test.tsx`

- [ ] 3-column band: Warnings (existing `TopSignalList`), Supports (existing), WhatChangedColumn (new). Test: renders all 3 columns from sample inputs. Commit.

### Task 4.2: Build `<WhatChangedColumn>` (TDD)

**Files:**
- Create: `src/components/WhatChangedColumn.tsx`
- Create: `src/components/__tests__/WhatChangedColumn.test.tsx`

- [ ] Renders driver-attribution diff. Reads from `score_history.json[latest_attribution]`. Test: renders changes; hides when empty. Commit.

### Task 4.3: Build `<ContextBlock>` (TDD)

**Files:**
- Create: `src/components/ContextBlock.tsx`
- Create: `src/components/__tests__/ContextBlock.test.tsx`

- [ ] Wrapper around `<details>` with eyebrow + summary text. Test: collapsed by default; expand on click. Commit.

### Task 4.4: Refactor `Overview.tsx`

**Files:**
- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/__tests__/Overview.test.tsx` (create if not present)

**Important:** Per spec §"Deleted from Overview (kept as files until PR 7 cleanup)", this task removes IMPORTS and JSX USAGES on Overview only. The component files themselves (`OverviewDecisionCard.tsx`, `MarketBriefHeader.tsx`, `ScoreCard.tsx`, `InterpretationPanel.tsx`, `SignalList.tsx`, `ConfidenceBreakdown.tsx`, `HowToReadPanel.tsx`) **stay on disk** — PR 7 handles physical file deletion after `git grep` confirms no remaining consumers.

- [ ] **Step 1: Write failing tests first**

Create `src/routes/__tests__/Overview.test.tsx` with three failing tests:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModeProvider } from "../../lib/mode";
import Overview from "../Overview";

function renderOverview(mode: "brief" | "detail") {
  return render(
    <MemoryRouter>
      <ModeProvider initialMode={mode}>
        <Overview />
      </ModeProvider>
    </MemoryRouter>
  );
}

test("Brief mode shows only cockpit + footer; no Today's Notable, no Context block", async () => {
  renderOverview("brief");
  expect(await screen.findByTestId("market-cockpit")).toBeInTheDocument();
  expect(screen.queryByTestId("todays-notable")).toBeNull();
  expect(screen.queryByTestId("context-block")).toBeNull();
});

test("Detail mode shows cockpit + Today's Notable + collapsed Context + footer", async () => {
  renderOverview("detail");
  expect(await screen.findByTestId("market-cockpit")).toBeInTheDocument();
  expect(screen.getByTestId("todays-notable")).toBeInTheDocument();
  expect(screen.getByTestId("context-block")).toBeInTheDocument();
});

test("Overview no longer renders any of the deleted-from-overview panels", async () => {
  renderOverview("detail");
  // Every deleted panel either had a unique text marker or testid — assert none render
  expect(screen.queryByText(/Short-Term Market Reaction/)).toBeNull();   // OverviewDecisionCard
  expect(screen.queryByTestId("market-brief-header")).toBeNull();         // MarketBriefHeader
  expect(screen.queryByText(/How to read this/i)).toBeNull();             // HowToReadPanel
  expect(screen.queryByTestId("interpretation-panel")).toBeNull();
  expect(screen.queryByTestId("confidence-breakdown")).toBeNull();
});
```

Run `npm test -- Overview` → expected to fail (Overview still renders the old panels).

- [ ] **Step 2: Locate every panel to remove**

```bash
grep -n "OverviewDecisionCard\|ScoreCard\|InterpretationPanel\|SignalList\|ConfidenceBreakdown\|MarketBriefHeader\|HowToReadPanel" src/routes/Overview.tsx
```
Note every line so the JSX delete is comprehensive.

- [ ] **Step 3: Restructure the body**

```tsx
import { useMode } from "../lib/mode";

<main className="page-shell">
  <MarketCockpit data={cockpit} mode={mode} />
  {mode === "detail" && (
    <>
      <TodaysNotable
        warnings={signalPriority.top_warnings}
        supports={signalPriority.top_supports}
        history={scoreHistory}
      />
      <ContextBlock label="Score contributions, history, missing data, calendar">
        <ScoreContributionHeatmap scoreSummary={scoreSummary} />
        <DriverAttributionPanel history={scoreHistory} />
        <MissingSignalPanel signals={signalPriority.missing_high_value_signals} />
        <HorizonImpactMatrix />
      </ContextBlock>
    </>
  )}
  <OverviewFooter status={status} />
</main>
```

`<OverviewFooter>` is a new wrapper introduced in this task (small inline component or its own file `src/components/OverviewFooter.tsx` — your choice; the spec's Tier 4 says it wraps `DataQualityBanner` (one-line) + `DataStatusTable` (in `<details>`)). If you create `OverviewFooter.tsx`, add it to the New React files table at the top of this plan.

- [ ] **Step 4: Update `OverviewState`**

Drop fields no longer consumed: removes `derivedSeries` and any per-MetricCard payloads (the cockpit owns the headline metrics now). Keep `cockpit`, `scoreSummary`, `scoreHistory`, `signalPriority`, `regimeSnapshot`, `shockSnapshot`, `status`.

- [ ] **Step 5: Add `data-testid` props on the surviving panels**

So the tests in Step 1 have stable selectors. Example:
```tsx
<section className="market-cockpit" data-testid="market-cockpit">...
<section className="todays-notable" data-testid="todays-notable">...
```

- [ ] **Step 6: Run tests → pass. Visual check via dev server at 390 and 1440 viewports.**

- [ ] **Step 7: Commit**

```bash
git add src/routes/Overview.tsx src/routes/__tests__/Overview.test.tsx \
       src/components/OverviewFooter.tsx  # if newly created
git commit -m "feat(cockpit): demote Overview duplicates; add Today's Notable + Context + Footer"
```

### Task 4.5: CSS for Today's Notable + ContextBlock

**Files:**
- Modify: `src/styles.css`

- [ ] Add styles per spec. Commit.

### Task 4.6: Verification + PR

- [ ] Full gate + PR open. PR description must include before/after screenshots from `agent-browser`.

---

## Chunk 5: PR 5 — Channels route + 10 detail-route redirects

**Branch:** `feat/channels-route`
**Worktree:** `.worktrees/channels-route`
**Depends on:** PR 4 merged.
**Estimated effort:** ~3 days. **Mechanical but bulky.**

### Task 5.0: Bootstrap worktree.

### Task 5.1: Build `<ChannelTabs>` (TDD)

**Files:**
- Create: `src/components/channels/ChannelTabs.tsx`
- Create: `src/components/channels/__tests__/ChannelTabs.test.tsx`

- [ ] Tab strip; current tab from `useSearchParams().get("tab")`; clicking a tab updates the URL. Test: renders all 10 tabs; click updates URL. Commit.

### Task 5.2: Build `<Channels>` route (TDD)

**Files:**
- Create: `src/routes/Channels.tsx`
- Create: `src/routes/__tests__/Channels.test.tsx`

- [ ] Renders `<ChannelTabs>` + the corresponding `*Tab` component based on URL. Lazy-load each tab component. Test: each `?tab=` value mounts the correct tab. Commit.

### Task 5.3: Extract 10 `*Tab` components

**Files (per old route):**
- Create: `src/components/channels/VolatilityTab.tsx`, `RatesTab.tsx`, `LiquidityTab.tsx`, `CreditTab.tsx`, `DollarTab.tsx`, `CommoditiesTab.tsx`, `GrowthTab.tsx`, `HousingTab.tsx`, `InflationTab.tsx`, `PositioningTab.tsx`

- [ ] For each tab component:
  - Copy the body of the corresponding `src/routes/<Old>.tsx` (e.g., `Volatility.tsx` → `VolatilityTab.tsx`).
  - Strip the duplicated `<DataQualityBanner>` and any per-route header (PersistentRegimeHeader covers).
  - Keep route-specific FocusBlock + charts intact.
  - Add a minimal test that the tab body renders without crashing.
- [ ] Commit per tab (10 commits) — keeps each task bite-sized.

### Task 5.4: Register `/channels` and 10 redirects in App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/routes/__tests__/redirects.test.tsx` (new)

- [ ] **Step 1**: Write failing test asserting each of the 10 old URLs resolves to `/channels?tab=<id>`.

- [ ] **Step 2**: In `App.tsx`, remove the 10 imports for the old route files. Add `import Channels from "./routes/Channels";`. Replace each `<Route path="/volatility" element={<Volatility />} />` with `<Route path="/volatility" element={<Navigate to="/channels?tab=volatility" replace />} />`. Add `<Route path="/channels" element={<Channels />} />`.

- [ ] **Step 3**: Run tests → pass.

- [ ] **Step 4: Delete the 10 old route files** in `src/routes/`. Commit.

### Task 5.5: Update `<AppLayout>` nav

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] Collapse `navSections` from 3 sections to 1 horizontal bar with 7 visible pills (Overview, Short-Term, Long-Term, Fragility, Channels, History — placeholder, PR 6 wires up, More ▾). For PR 5, History is not yet a route — point it to `/regime-map` for now and PR 6 will fix.

- [ ] Move `Calendar` + `Methodology` under "More ▾" disclosure menu.

- [ ] Mobile: implement bottom-tab-bar pattern per spec.

- [ ] Update tests. Commit.

### Task 5.6: Update `data-routes.test.tsx`

**Files:**
- Modify: `src/routes/data-routes.test.tsx`

**End-of-PR-5 route count** (History does not yet exist; RegimeMap + HistoricalRegimeReplay still active):

| Active routes (9) | Redirects (12) |
|---|---|
| Overview, TacticalTradingWeather, LongTermMacroClimate, FragilityShockRisk, RegimeMap, HistoricalRegimeReplay, Channels, Calendar, Methodology | `/tactical`, `/macro-climate` (existing) + 10 new from Task 5.4 |

- [ ] Update route-count assertion to **9 active + 12 redirects** in this PR. PR 6 will change it to 8 active + 14 redirects after RegimeMap/HistoricalRegimeReplay become tabs.

Run `npm test -- data-routes`. Expected pass. Commit.

### Task 5.7: Verification + PR

- [ ] Full gate + PR. Screenshot every old URL redirecting correctly.

---

## Chunk 6: PR 6 — History route (regime-map + replay merge)

**Branch:** `feat/history-route`
**Worktree:** `.worktrees/history-route`
**Depends on:** PR 5 merged.
**Estimated effort:** ~1 day.

### Task 6.0: Bootstrap worktree

(Same pattern as Task 1.0 / 2.0; branch from post-PR-5 `main`.)

### Task 6.1: Extract `RegimeTab` from existing `/regime-map`

**Files:**
- Create: `src/components/history/RegimeTab.tsx`
- Create: `src/components/history/__tests__/RegimeTab.test.tsx`

- [ ] **Step 1: Write failing test** — assert RegimeTab renders the existing quadrant chart + checklist + driver attribution.
- [ ] **Step 2: Copy the body of `src/routes/RegimeMap.tsx`** into `RegimeTab.tsx`. Strip the duplicated `<DataQualityBanner>` and any page-heading masthead (PersistentRegimeHeader covers).
- [ ] **Step 3: Run tests → pass. Commit.**

### Task 6.2: Extract `ReplayTab` from existing `/replay`

**Files:**
- Create: `src/components/history/ReplayTab.tsx`
- Create: `src/components/history/__tests__/ReplayTab.test.tsx`

- [ ] **Step 1: Failing test** — asserts replay-scenarios + analogue table render from sample data.
- [ ] **Step 2: Copy `src/routes/HistoricalRegimeReplay.tsx` body**. Strip duplicated chrome.
- [ ] **Step 3: Run tests → pass. Commit.**

### Task 6.3: Build `<History>` route

**Files:**
- Create: `src/routes/History.tsx`
- Create: `src/routes/__tests__/History.test.tsx`

- [ ] **Step 1: Failing test** — assert that `?tab=regime` mounts `<RegimeTab>` and `?tab=replay` mounts `<ReplayTab>`; default tab is `regime`.
- [ ] **Step 2: Implement** with `useSearchParams` + lazy-loaded tab components, mirroring `Channels.tsx` from PR 5.
- [ ] **Step 3: Run tests → pass. Commit.**

### Task 6.4: Register `/history` + 2 redirects in App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/routes/__tests__/redirects.test.tsx`

- [ ] **Step 1: Failing test** — assert `/regime-map → /history?tab=regime` and `/replay → /history?tab=replay`.
- [ ] **Step 2: Implement** — remove `RegimeMap` and `HistoricalRegimeReplay` imports from `App.tsx`; replace their routes with `<Navigate>` redirects to `/history`; register `<Route path="/history" element={<History />} />`.
- [ ] **Step 3: Delete `src/routes/RegimeMap.tsx` and `src/routes/HistoricalRegimeReplay.tsx`** plus their test files.
- [ ] **Step 4: Run tests → pass. Commit.**

### Task 6.5: Update nav to point History to `/history`

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] PR 5 placeholder pointed History at `/regime-map`. Now that `/history` exists, update the nav entry's `to` prop to `/history` (the existing `/regime-map` redirect from PR 5 still works for old bookmarks). Commit.

### Task 6.6: Update `data-routes.test.tsx` route count

**Files:**
- Modify: `src/routes/data-routes.test.tsx`

**End-of-PR-6 route count**: **8 active + 14 redirects** (final state per spec).
| Active routes (8) | Redirects (14) |
|---|---|
| Overview, TacticalTradingWeather, LongTermMacroClimate, FragilityShockRisk, Channels, History, Calendar, Methodology | `/tactical`, `/macro-climate` + 10 channels + 2 history |

- [ ] Update the assertion. Commit.

### Task 6.7: Verification gate + PR

- [ ] Full verification gate. Manual browser check: every old URL (`/regime-map`, `/replay`) redirects correctly. PR.

---

## Chunk 7: PR 7 — Subpage cleanup

**Branch:** `feat/subpage-cleanup`
**Worktree:** `.worktrees/subpage-cleanup`
**Depends on:** PR 6 merged.
**Estimated effort:** ~1 day. **Cleanup only — no new features.**

### Task 7.0: Bootstrap worktree.

### Task 7.1: Swap `<HorizonScoreHeader>` → `<RouteScoreStrip>` on 3 subpages

- [ ] Modify `src/routes/TacticalTradingWeather.tsx`: remove `<HorizonScoreHeader>`, replace with `<RouteScoreStrip composite={cockpit.composite_scores[0]} />` (market_weather).
- [ ] Same for `LongTermMacroClimate.tsx` (use `composite_scores[1]` = macro_climate).
- [ ] Same for `FragilityShockRisk.tsx` (use `composite_scores[2]` = fragility).
- [ ] Update tests.
- [ ] Commit.

### Task 7.2: Remove `<DataQualityBanner>` from 3 subpages

- [ ] PersistentRegimeHeader carries the worst-case freshness state — DataQualityBanner is redundant.
- [ ] Remove the JSX + the loader if data is unused elsewhere.
- [ ] Update tests.
- [ ] Commit.

### Task 7.3: Delete 3 unused components

- [ ] Verify nothing imports them:

```bash
git grep -l "OverviewDecisionCard"   # should return nothing
git grep -l "MarketBriefHeader"      # should return nothing
git grep -l "HorizonScoreHeader"     # should return nothing
```

- [ ] Delete `src/components/OverviewDecisionCard.tsx`, `src/components/MarketBriefHeader.tsx`, `src/components/HorizonScoreHeader.tsx`. Delete their test files.
- [ ] Commit.

### Task 7.4: Bundle-size check

The pre-initiative baseline was captured in PR 1 Task 1.0 Step 4 and recorded in PR 1's description. Look up that number first.

- [ ] **Step 1: Build current bundle**

```bash
npm run build
du -sk dist/assets/*.js | sort -n | tail -1
```

- [ ] **Step 2: Compare against PR 1 baseline**

Confirm the largest JS chunk is no larger than `baseline + 5%`. If PR 1's recorded baseline is unrecoverable (lost from description), reconstruct it:

```bash
# In a separate worktree, check out the commit immediately before PR 1 landed.
# The grep finds PR 1's merge commit by its title, ^1 means "first parent" =
# the main branch state right before the merge.
BEFORE_PR1=$(git log --grep="feat(cockpit): backend pipeline" --format=%H origin/main | tail -1)^1
git worktree add /tmp/baseline-check $BEFORE_PR1
cd /tmp/baseline-check && npm ci && npm run build
du -sk dist/assets/*.js | sort -n | tail -1
cd - && git worktree remove /tmp/baseline-check
```

- [ ] **Step 3: If over budget**, investigate which new component added weight. Likely culprits: a primitive accidentally pulled in a large dependency. Fix; rebuild; commit.

### Task 7.5: Verification + PR

- [ ] Full gate. PR title: `chore(cockpit): subpage cleanup + bundle-size check`.

---

## Initiative completion checklist

After all 7 PRs merge:

- [ ] Overview shows the cockpit at the top: 3 composite scores in fixed order + up to 9 vital signs ranked by today's priority.
- [ ] Persistent regime header renders on every route.
- [ ] Brief/Detail toggle persists across navigation; auto-defaults at <900px viewport.
- [ ] All 12 redirects resolve (10 detail routes + regime-map + replay).
- [ ] Nav at desktop shows 7 visible pills + "More ▾"; mobile shows 5-item bottom bar.
- [ ] No duplicated `<DataQualityBanner>` / `<HorizonScoreHeader>` on subpages.
- [ ] No new data source promoted; source-gating contract unchanged.
- [ ] Bundle size within budget.
- [ ] `cockpit.json` validates against schema + freshness expectations.
- [ ] Live dashboard at https://&lt;org&gt;.github.io/market-weather-map/ renders the cockpit on next data refresh.

Open follow-ups (out of scope for this initiative, captured for tracking):
- FocusBlock placements on Channels tabs.
- Per-cell glossary tooltips (`<abbr>`).
- Print stylesheet, `/diff` route, keyboard shortcuts.
- Confidence aggregate recalibration.
