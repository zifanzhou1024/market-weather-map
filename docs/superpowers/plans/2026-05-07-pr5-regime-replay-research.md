# PR 5 Historical Regime Replay Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add descriptive historical regime replay and score attribution so users can inspect past active-data regimes without presenting forecasts or trade recommendations.

**Architecture:** Precompute replay artifacts from active static series during the Python data workflow. The frontend reads fixed JSON scenarios and lets users filter descriptive historical occurrences. Asset-return columns for SPY/TLT/GLD remain disabled until a compliant source is reviewed.

**Tech Stack:** Python static transforms, JSON validation, React route/components, pytest, Vitest/jsdom.

---

## File Structure

Create:

- `scripts/transform/regime_replay.py`: scenario detection and summary builder.
- `tests/python/test_regime_replay.py`: replay tests.
- `src/routes/HistoricalRegimeReplay.tsx`: research route.
- `src/components/HistoricalRegimeReplayPanel.tsx`: scenario table and descriptive stats.
- `src/components/DriverAttributionPanel.tsx`: score-change attribution from score history.

Modify:

- `scripts/transform/compute_regime_score.py`: call replay builder and emit score history.
- `scripts/validate/validate_schema.py`: validate replay artifacts.
- `src/lib/types.ts`: add replay and score-history types.
- `src/lib/data.ts`: add replay loaders.
- `src/App.tsx`, `src/components/AppLayout.tsx`: add `/replay`.
- `src/routes/Overview.tsx`, `src/routes/TacticalTradingWeather.tsx`: add driver attribution.
- `src/components/data-components.test.tsx`, `src/routes/data-routes.test.tsx`: tests.
- `docs/METHODOLOGY.md`, `docs/LIMITATIONS.md`, `README.md`: caveats.

Generated files:

- `public/data/derived/regime_replay.json`
- `public/data/derived/score_history.json`

---

## Task 1: Build Replay Artifact

**Files:**

- Create: `scripts/transform/regime_replay.py`
- Create: `tests/python/test_regime_replay.py`
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `scripts/validate/validate_schema.py`

- [ ] **Step 1: Write tests**

Create `tests/python/test_regime_replay.py`:

```python
from scripts.transform.regime_replay import build_regime_replay


def make_series(series_id, values):
    return {
        "series_id": series_id,
        "frequency": "daily",
        "observations": [{"date": date, "value": value} for date, value in values],
    }


def test_replay_detects_tightening_risk_off_occurrences():
    dates = [f"2026-05-{day:02d}" for day in range(1, 31)]
    series_by_id = {
        "real_yield_10y": make_series("real_yield_10y", [(date, 2.0 + index * 0.02) for index, date in enumerate(dates)]),
        "broad_dollar": make_series("broad_dollar", [(date, 120.0 + index * 0.15) for index, date in enumerate(dates)]),
        "high_yield_oas": make_series("high_yield_oas", [(date, 3.5 + index * 0.02) for index, date in enumerate(dates)]),
        "vix_vix3m_ratio": make_series("vix_vix3m_ratio", [(date, 0.92 + index * 0.008) for index, date in enumerate(dates)]),
        "us10y": make_series("us10y", [(date, 4.0 + index * 0.02) for index, date in enumerate(dates)]),
    }

    replay = build_regime_replay(series_by_id, "2026-05-31T00:00:00Z")

    scenario = next(item for item in replay["scenarios"] if item["id"] == "tightening_risk_off")
    assert scenario["occurrence_count"] > 0
    assert scenario["description"].startswith("Real yields rising")
    assert "future_return_summary" not in scenario
```

- [ ] **Step 2: Implement replay builder**

`scripts/transform/regime_replay.py` should export:

```python
SCENARIOS = [
    {
        "id": "tightening_risk_off",
        "label": "Tightening / risk-off",
        "description": "Real yields rising, dollar rising, and credit or volatility pressure rising.",
    },
    {
        "id": "strong_risk_on",
        "label": "Strong risk-on",
        "description": "Real yields falling, dollar falling, and credit or volatility pressure contained.",
    },
    {
        "id": "bonds_first_safe_haven",
        "label": "Bonds-first / safe haven",
        "description": "Real yields falling while the dollar rises and credit or volatility pressure is mixed.",
    },
    {
        "id": "reallocation_rotation",
        "label": "Reallocation / rotation",
        "description": "Real yields rising while the dollar does not confirm broad stress.",
    },
]
```

Use a 20-observation lookback. Emit each scenario:

```json
{
  "id": "tightening_risk_off",
  "label": "Tightening / risk-off",
  "description": "...",
  "occurrence_count": 12,
  "last_occurrence_date": "2026-05-06",
  "occurrences": [
    {
      "date": "2026-05-06",
      "real_yield_20obs_change": 0.25,
      "dollar_20obs_change": 2.3,
      "credit_20obs_change": 0.35,
      "vix_curve_20obs_change": 0.14,
      "nominal_10y_20obs_change": 0.31
    }
  ],
  "caveat": "Historical regime occurrences are descriptive context, not forecasts."
}
```

Do not emit SPY/TLT/GLD forward returns in this PR unless compliant active return series already exist.

- [ ] **Step 3: Integrate builder**

In `compute_regime_score.main()`, after active derived series are available:

```python
from scripts.transform.regime_replay import build_regime_replay

regime_replay = build_regime_replay(series_by_id, generated_at)
write_json(data_dir() / "derived" / "regime_replay.json", regime_replay)
```

Add `regime_replay.json` to required generated files and schema validation.

- [ ] **Step 4: Verify**

Run:

```bash
python -m pytest tests/python/test_regime_replay.py -v
python -m scripts.update_data
python -m scripts.validate.validate_schema
```

Expected: PASS.

Commit:

```bash
git add scripts/transform/regime_replay.py scripts/transform/compute_regime_score.py scripts/validate/validate_schema.py tests/python/test_regime_replay.py public/data/derived/regime_replay.json
git commit -m "feat: build historical regime replay artifact"
```

---

## Task 2: Add Score History and Attribution

**Files:**

- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `tests/python/test_regime_replay.py`
- Generate: `public/data/derived/score_history.json`

- [ ] **Step 1: Write tests**

Add:

```python
def test_score_history_contains_current_scores_and_drivers():
    history = compute_regime_score.build_score_history(
        {
            "scores": {
                "market_weather": {"score": -6, "recent_changes": ["VIX rose."], "top_risks": ["Credit widened."], "top_supports": []},
                "macro_climate": {"score": 12, "recent_changes": ["Labor stable."], "top_risks": [], "top_supports": ["Growth firm."]},
                "fragility": {"score": -22, "recent_changes": ["Dollar strengthened."], "top_risks": ["Dollar pressure."], "top_supports": []},
            },
            "date": "2026-05-06",
        },
        "2026-05-07T00:00:00Z",
    )

    assert history["observations"][-1]["date"] == "2026-05-06"
    assert history["observations"][-1]["market_weather"] == -6
    assert "Credit widened." in history["latest_attribution"]["market_weather"]["top_risks"]
```

- [ ] **Step 2: Implement score history**

Add `build_score_history(score_summary, generated_at)`. It reads existing `public/data/derived/score_history.json` when present, appends or replaces the current date, keeps the latest 520 observations, and emits:

```json
{
  "generated_at_utc": "2026-05-07T00:00:00Z",
  "method_version": "phase5-score-history-v1",
  "observations": [
    {
      "date": "2026-05-06",
      "market_weather": -6,
      "macro_climate": 12,
      "fragility": -22
    }
  ],
  "latest_attribution": {
    "market_weather": {
      "recent_changes": [],
      "top_risks": [],
      "top_supports": []
    }
  }
}
```

- [ ] **Step 3: Verify**

Run:

```bash
python -m pytest tests/python/test_regime_replay.py -v
python -m scripts.update_data
python -m scripts.validate.validate_schema
```

Expected: PASS.

Commit:

```bash
git add scripts/transform/compute_regime_score.py tests/python/test_regime_replay.py public/data/derived/score_history.json
git commit -m "feat: add score history attribution"
```

---

## Task 3: Add Replay Route and Attribution UI

**Files:**

- Create: `src/routes/HistoricalRegimeReplay.tsx`
- Create: `src/components/HistoricalRegimeReplayPanel.tsx`
- Create: `src/components/DriverAttributionPanel.tsx`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/TacticalTradingWeather.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add tests**

Component tests assert:

- `HistoricalRegimeReplayPanel` renders scenario count and caveat.
- `DriverAttributionPanel` renders recent changes, risks, and supports.

Route test asserts `/replay` contains "Historical Regime Replay" and "descriptive context, not forecasts".

- [ ] **Step 2: Add loaders and types**

Add:

```ts
export interface RegimeReplayFile {
  generated_at_utc: string;
  method_version: string;
  scenarios: Array<{
    id: string;
    label: string;
    description: string;
    occurrence_count: number;
    last_occurrence_date: string | null;
    occurrences: Array<Record<string, number | string | null>>;
    caveat: string;
  }>;
}
```

Add `loadRegimeReplay()` and `loadScoreHistory()`.

- [ ] **Step 3: Implement route**

`HistoricalRegimeReplay.tsx` loads replay and score history. Render:

- page heading
- caveat panel
- scenario cards/table
- latest score attribution
- candidate source note for SPY/TLT/GLD return replay

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- src/components/data-components.test.tsx src/routes/data-routes.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/routes/HistoricalRegimeReplay.tsx src/components/HistoricalRegimeReplayPanel.tsx src/components/DriverAttributionPanel.tsx src/lib/types.ts src/lib/data.ts src/App.tsx src/components/AppLayout.tsx src/routes/Overview.tsx src/routes/TacticalTradingWeather.tsx src/components/data-components.test.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: add historical replay route"
```

---

## Task 4: Document Replay Limits

**Files:**

- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `README.md`

- [ ] **Step 1: Add caveats**

Document:

- replay is conditional historical description
- no forecasts
- no trade recommendations
- no SPY/TLT/GLD forward returns until a compliant source is active
- active v1 replay uses only existing internal market/macro indicators

- [ ] **Step 2: Verify**

Run:

```bash
rg -n "buy|sell|short|entry|target|stop loss|recommendation" README.md docs src
npm run build
```

Expected: no new advice-language matches from this PR.

Commit:

```bash
git add docs/METHODOLOGY.md docs/LIMITATIONS.md README.md
git commit -m "docs: explain historical replay limits"
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

Expected: all tests pass; replay and score-history artifacts exist; `/replay` renders descriptive regime research.

