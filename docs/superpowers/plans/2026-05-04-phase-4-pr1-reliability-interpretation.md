# Phase 4 PR 1 Reliability And Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Phase 3 data explain itself by adding release-aware freshness, confidence decomposition, three-score-first Overview, reusable interpretation UI, and route surfacing for active data.

**Architecture:** Keep the static GitHub Pages model. Python generation remains responsible for `public/data` contracts, while React routes read static JSON and render interpretation components. PR 1 does not add new source families; it improves reliability and interpretation for existing active generated data.

**Tech Stack:** Python 3.11 data scripts and pytest-style tests; React 19, TypeScript, React Router, Recharts, Vitest/jsdom; static JSON under `public/data`.

---

## File Structure And Ownership

Create:

- `scripts/transform/freshness.py`: release-aware freshness helpers shared by score/status generation.
- `tests/python/test_freshness.py`: focused tests for daily, weekly, monthly, quarterly, and derived dependency freshness.
- `src/components/ConfidenceBreakdown.tsx`: renders coverage, freshness, model, source, and overall confidence.
- `src/components/SignalList.tsx`: shared compact list for supports, risks, conflicts, and notes.
- `src/components/DataGapPanel.tsx`: summarizes stale, failed, unavailable, candidate, and expected-lag rows.
- `src/components/InterpretationPanel.tsx`: reusable route-level interpretation panel.

Modify:

- `scripts/transform/compute_regime_score.py`: uses release-aware freshness, builds status before score summary, passes status into confidence calculation, and emits confidence decomposition.
- `scripts/transform/score_models.py`: accepts explicit confidence values and emits optional confidence breakdown metadata.
- `scripts/validate/validate_schema.py`: validates new confidence fields and optional release-aware status fields.
- `tests/python/test_scoring.py`: updates score-summary/status tests around confidence and status integration.
- `src/lib/types.ts`: adds data-quality and status optional fields.
- `src/components/DataStatusTable.tsx`: shows observation period, expected release window, and status messages.
- `src/components/data-components.test.tsx`: adds tests for new UI components and updated status table.
- `src/routes/Overview.tsx`: removes visible legacy regime score and renders confidence/data gap panels.
- `src/routes/Volatility.tsx`: surfaces VIX, VVIX, VIX9D, VIX3M, VIX9D/VIX, and VIX/VIX3M.
- `src/routes/Liquidity.tsx`: makes net liquidity the headline and adds reserve balances/status.
- `src/routes/Credit.tsx`: surfaces HY minus IG OAS and direct spread structure.
- `src/routes/Commodities.tsx`: surfaces commodity inflation impulse separately.
- `src/routes/Sentiment.tsx`: labels active data as CFTC positioning only.
- `src/routes/Growth.tsx`, `src/routes/Inflation.tsx`, `src/routes/Rates.tsx`, `src/routes/DollarGlobal.tsx`: add concise interpretation panels and data-gap context.
- `src/routes/data-routes.test.tsx`: updates route expectations for Overview and surfaced active data.
- `src/styles.css`: styles new panels without changing the app’s visual system.
- `README.md`, `docs/METHODOLOGY.md`, `docs/DATA_SOURCES.md`, `docs/LIMITATIONS.md`: document PR 1 behavior.

Do not modify:

- Source expansion for Housing, GDP, Consumer, Fiscal, Event Calendar, PMIs, SLOOS, sentiment surveys, valuation, or market internals.
- `.idea/` or other unrelated local files.

---

### Task 1: Add Release-Aware Freshness Helpers

**Files:**
- Create: `scripts/transform/freshness.py`
- Create: `tests/python/test_freshness.py`
- Modify: `scripts/transform/compute_regime_score.py`
- Test: `tests/python/test_freshness.py`

- [ ] **Step 1: Write failing tests for freshness rules**

Create `tests/python/test_freshness.py` with these tests:

```python
from datetime import date

from scripts.transform.freshness import (
    add_months,
    evaluate_freshness,
    observation_period,
)


def test_add_months_clamps_end_of_month():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 12, 31), 2) == date(2027, 2, 28)


def test_observation_period_formats_by_frequency():
    assert observation_period(date(2026, 5, 1), "daily") == "2026-05-01"
    assert observation_period(date(2026, 5, 1), "weekly") == "week of 2026-05-01"
    assert observation_period(date(2026, 3, 1), "monthly") == "2026-03"
    assert observation_period(date(2026, 1, 1), "quarterly") == "2026-Q1"


def test_daily_series_uses_raw_age_buffer():
    result = evaluate_freshness(
        latest_date="2026-04-24",
        generated_at="2026-05-04T14:46:53Z",
        frequency="daily",
        max_stale_days=7,
    )

    assert result["status"] == "stale"
    assert result["freshness_days"] == 10
    assert result["observation_period"] == "2026-04-24"
    assert result["expected_next_release_window"] is None
    assert result["message"] == "Latest daily observation is 10 days old, above the 7 day freshness buffer."


def test_weekly_series_waits_for_next_weekly_release_window():
    result = evaluate_freshness(
        latest_date="2026-04-24",
        generated_at="2026-05-04T14:46:53Z",
        frequency="weekly",
        max_stale_days=14,
    )

    assert result["status"] == "ok"
    assert result["freshness_days"] == 10
    assert result["observation_period"] == "week of 2026-04-24"
    assert result["expected_next_release_window"] == {
        "start": "2026-05-01",
        "end": "2026-05-15",
    }
    assert result["message"] == "Latest weekly observation is within the expected release window ending 2026-05-15."


def test_monthly_series_uses_next_observation_month_release_window():
    result = evaluate_freshness(
        latest_date="2026-03-01",
        generated_at="2026-05-04T14:46:53Z",
        frequency="monthly",
        max_stale_days=45,
    )

    assert result["status"] == "ok"
    assert result["freshness_days"] == 64
    assert result["observation_period"] == "2026-03"
    assert result["expected_next_release_window"] == {
        "start": "2026-04-01",
        "end": "2026-05-16",
    }
    assert result["message"] == "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."


def test_monthly_series_stales_after_release_window_plus_buffer():
    result = evaluate_freshness(
        latest_date="2026-03-01",
        generated_at="2026-05-20T14:46:53Z",
        frequency="monthly",
        max_stale_days=45,
    )

    assert result["status"] == "stale"
    assert result["expected_next_release_window"] == {
        "start": "2026-04-01",
        "end": "2026-05-16",
    }
    assert result["message"] == "Latest monthly observation covers 2026-03; expected release window ended 2026-05-16."


def test_quarterly_series_uses_next_quarter_release_window():
    result = evaluate_freshness(
        latest_date="2026-01-01",
        generated_at="2026-05-04T14:46:53Z",
        frequency="quarterly",
        max_stale_days=60,
    )

    assert result["status"] == "ok"
    assert result["observation_period"] == "2026-Q1"
    assert result["expected_next_release_window"] == {
        "start": "2026-04-01",
        "end": "2026-05-31",
    }
    assert result["message"] == "Latest quarterly observation covers 2026-Q1 and is within the expected release window ending 2026-05-31."


def test_future_observation_fails():
    result = evaluate_freshness(
        latest_date="2026-05-05",
        generated_at="2026-05-04T14:46:53Z",
        frequency="daily",
        max_stale_days=7,
    )

    assert result["status"] == "failed"
    assert result["freshness_days"] == -1
    assert result["message"] == "Latest observation is future-dated."


def test_missing_latest_date_fails():
    result = evaluate_freshness(
        latest_date=None,
        generated_at="2026-05-04T14:46:53Z",
        frequency="monthly",
        max_stale_days=45,
    )

    assert result == {
        "status": "failed",
        "last_observation": None,
        "observation_period": None,
        "freshness_days": None,
        "expected_next_release_window": None,
        "message": "No observations available.",
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
python -m pytest tests/python/test_freshness.py -v
```

Expected: FAIL because `scripts.transform.freshness` does not exist.

- [ ] **Step 3: Implement freshness helper module**

Create `scripts/transform/freshness.py`:

```python
from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Any, Literal


Frequency = Literal["daily", "weekly", "monthly", "quarterly"]


def _parse_generated_date(generated_at: str) -> date:
    return datetime.fromisoformat(generated_at.replace("Z", "+00:00")).date()


def _parse_observation_date(value: str | None) -> date | None:
    if not isinstance(value, str):
        return None
    return datetime.fromisoformat(value).date()


def add_months(value: date, months: int) -> date:
    month_index = (value.month - 1) + months
    year = value.year + (month_index // 12)
    month = (month_index % 12) + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def observation_period(value: date, frequency: str) -> str:
    if frequency == "monthly":
        return f"{value.year:04d}-{value.month:02d}"
    if frequency == "quarterly":
        quarter = ((value.month - 1) // 3) + 1
        return f"{value.year:04d}-Q{quarter}"
    if frequency == "weekly":
        return f"week of {value.isoformat()}"
    return value.isoformat()


def _window_for(value: date, frequency: str, max_stale_days: int) -> dict[str, str] | None:
    if frequency == "daily":
        return None
    if frequency == "weekly":
        start = value + timedelta(days=7)
    elif frequency == "monthly":
        start = add_months(date(value.year, value.month, 1), 1)
    elif frequency == "quarterly":
        quarter_start_month = (((value.month - 1) // 3) * 3) + 1
        start = add_months(date(value.year, quarter_start_month, 1), 3)
    else:
        return None
    end = start + timedelta(days=max_stale_days)
    return {"start": start.isoformat(), "end": end.isoformat()}


def evaluate_freshness(
    *,
    latest_date: str | None,
    generated_at: str,
    frequency: str,
    max_stale_days: int,
) -> dict[str, Any]:
    observed_date = _parse_observation_date(latest_date)
    if observed_date is None:
        return {
            "status": "failed",
            "last_observation": None,
            "observation_period": None,
            "freshness_days": None,
            "expected_next_release_window": None,
            "message": "No observations available.",
        }

    current_date = _parse_generated_date(generated_at)
    freshness_days = (current_date - observed_date).days
    period = observation_period(observed_date, frequency)
    window = _window_for(observed_date, frequency, max_stale_days)

    if freshness_days < 0:
        return {
            "status": "failed",
            "last_observation": latest_date,
            "observation_period": period,
            "freshness_days": freshness_days,
            "expected_next_release_window": window,
            "message": "Latest observation is future-dated.",
        }

    if window is not None:
        window_end = datetime.fromisoformat(window["end"]).date()
        if current_date > window_end:
            return {
                "status": "stale",
                "last_observation": latest_date,
                "observation_period": period,
                "freshness_days": freshness_days,
                "expected_next_release_window": window,
                "message": f"Latest {frequency} observation covers {period}; expected release window ended {window['end']}.",
            }
        return {
            "status": "ok",
            "last_observation": latest_date,
            "observation_period": period,
            "freshness_days": freshness_days,
            "expected_next_release_window": window,
            "message": f"Latest {frequency} observation covers {period} and is within the expected release window ending {window['end']}.",
        }

    status = "stale" if freshness_days > max_stale_days else "ok"
    message = (
        f"Latest daily observation is {freshness_days} days old, above the {max_stale_days} day freshness buffer."
        if status == "stale"
        else f"Latest daily observation is {freshness_days} days old and within the {max_stale_days} day freshness buffer."
    )
    return {
        "status": status,
        "last_observation": latest_date,
        "observation_period": period,
        "freshness_days": freshness_days,
        "expected_next_release_window": None,
        "message": message,
    }
```

- [ ] **Step 4: Integrate freshness helper into `_status_for_series`**

Modify `scripts/transform/compute_regime_score.py` imports:

```python
from scripts.transform.freshness import evaluate_freshness
```

Replace the active-source freshness branch in `_status_for_series` with:

```python
    summary = latest_summary(series)
    latest_date = summary.get("latest_date")
    freshness = evaluate_freshness(
        latest_date=latest_date if isinstance(latest_date, str) else None,
        generated_at=generated_at,
        frequency=str(entry["frequency"]),
        max_stale_days=int(entry["max_stale_days"]),
    )
    return {
        "status": freshness["status"],
        "last_observation": freshness["last_observation"],
        "observation_period": freshness["observation_period"],
        "source": entry["source"],
        "expected_frequency": entry["frequency"],
        "freshness_days": freshness["freshness_days"],
        "max_stale_days": entry["max_stale_days"],
        "expected_next_release_window": freshness["expected_next_release_window"],
        "message": freshness["message"],
    }
```

- [ ] **Step 5: Run focused freshness tests**

Run:

```bash
python -m pytest tests/python/test_freshness.py tests/python/test_scoring.py::test_status_for_series_marks_future_observations_failed -v
```

Expected: PASS.

- [ ] **Step 6: Commit freshness helper**

```bash
git add scripts/transform/freshness.py tests/python/test_freshness.py scripts/transform/compute_regime_score.py tests/python/test_scoring.py
git commit -m "feat: add release-aware freshness"
```

---

### Task 2: Add Confidence Decomposition To Generated Scores

**Files:**
- Modify: `scripts/transform/score_models.py`
- Modify: `scripts/transform/compute_regime_score.py`
- Modify: `scripts/validate/validate_schema.py`
- Modify: `tests/python/test_scoring.py`

- [ ] **Step 1: Add failing confidence decomposition tests**

Append these tests to `tests/python/test_scoring.py`:

```python
def test_score_summary_emits_data_quality_confidence_breakdown():
    series = {
        "vix": _summary(percentile_252d=50.0),
        "vvix": _summary(percentile_252d=50.0),
        "vix9d": _summary(percentile_252d=50.0),
        "vix3m": _summary(percentile_252d=50.0),
        "vix9d_vix_ratio": _summary(percentile_252d=50.0),
        "vix_vix3m_ratio": _summary(percentile_252d=50.0),
        "high_yield_oas": _summary(percentile_252d=50.0),
        "investment_grade_oas": _summary(percentile_252d=50.0),
        "bbb_oas": _summary(percentile_252d=50.0),
        "hy_minus_ig_oas": _summary(percentile_252d=50.0),
        "net_liquidity": _summary(percentile_252d=50.0),
        "reverse_repo": _summary(percentile_252d=50.0),
        "sofr": _summary(percentile_252d=50.0),
        "real_yield_10y": _summary(percentile_252d=50.0),
        "broad_dollar": _summary(percentile_252d=50.0),
        "commodity_inflation_impulse": _summary(latest_value=0.0, percentile_252d=50.0),
        "breakeven_10y": _summary(percentile_252d=50.0),
        "cftc_sp500_asset_mgr_net": _summary(percentile_252d=50.0),
        "cftc_sp500_lev_money_net": _summary(percentile_252d=50.0),
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
    }
    statuses = {
        series_id: {"status": "ok", "message": "Fresh."}
        for series_id in series
    }

    summary = compute_regime_score.build_score_summary(
        series,
        "2026-05-04T00:00:00Z",
        statuses,
    )

    data_quality = summary["data_quality"]
    assert set(data_quality) >= {
        "coverage_confidence",
        "freshness_confidence",
        "model_confidence",
        "source_confidence",
        "overall_confidence",
        "reasons",
    }
    assert data_quality["coverage_confidence"] > 0.9
    assert data_quality["freshness_confidence"] == 1.0
    assert data_quality["overall_confidence"] < 1.0
    assert "Housing is not active in Phase 4 PR 1." in data_quality["reasons"]


def test_stale_status_lowers_freshness_confidence():
    series = {
        "vix": _summary(percentile_252d=50.0),
        "reverse_repo": _summary(percentile_252d=50.0),
        "net_liquidity": _summary(percentile_252d=50.0),
    }
    statuses = {
        "vix": {"status": "ok", "message": "Fresh."},
        "reverse_repo": {"status": "stale", "message": "Latest daily observation is stale."},
        "net_liquidity": {"status": "ok", "message": "Fresh."},
    }

    summary = compute_regime_score.build_score_summary(
        series,
        "2026-05-04T00:00:00Z",
        statuses,
    )

    assert summary["data_quality"]["freshness_confidence"] < 1.0
    assert any("reverse_repo" in reason for reason in summary["data_quality"]["reasons"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
python -m pytest tests/python/test_scoring.py::test_score_summary_emits_data_quality_confidence_breakdown tests/python/test_scoring.py::test_stale_status_lowers_freshness_confidence -v
```

Expected: FAIL because `build_score_summary` does not accept status data and does not emit confidence fields.

- [ ] **Step 3: Update score block helper for explicit confidence**

Modify `scripts/transform/score_models.py` so `score_block` accepts optional explicit confidence:

```python
def score_block(
    score: float,
    label: str,
    bucket_scores: dict[str, float],
    bucket_weights: dict[str, float],
    drivers: list[ScoreDriver],
    confidence_reasons: list[str],
    missing_or_stale_notes: list[str],
    confidence: float | None = None,
    confidence_breakdown: dict[str, float] | None = None,
) -> dict[str, object]:
    recent_changes = driver_texts(drivers, "risk", limit=2) + driver_texts(
        drivers,
        "support",
        limit=2,
    )
    block: dict[str, object] = {
        "score": clamp(score),
        "label": label,
        "confidence": round(max(0.0, min(1.0, confidence)), 2)
        if confidence is not None
        else confidence_from_reasons(confidence_reasons + missing_or_stale_notes),
        "confidence_reasons": confidence_reasons,
        "bucket_scores": bucket_scores,
        "bucket_weights": bucket_weights,
        "top_supports": driver_texts(drivers, "support"),
        "top_risks": driver_texts(drivers, "risk"),
        "recent_changes": recent_changes[:4],
        "missing_or_stale_notes": missing_or_stale_notes,
    }
    if confidence_breakdown is not None:
        block["confidence_breakdown"] = confidence_breakdown
    return block
```

- [ ] **Step 4: Add confidence functions in `compute_regime_score.py`**

Add these helpers near `_source_coverage`:

```python
def _ratio_confidence(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 1.0
    return round(max(0.0, min(1.0, numerator / denominator)), 2)


def _coverage_confidence(coverage: dict[str, object]) -> float:
    available = coverage.get("available", [])
    expected = coverage.get("expected", [])
    return _ratio_confidence(
        len(available) if isinstance(available, list) else 0,
        len(expected) if isinstance(expected, list) else 0,
    )


def _freshness_confidence(
    status_by_id: dict[str, dict[str, Any]],
    series_ids: list[str],
) -> tuple[float, list[str]]:
    considered = [series_id for series_id in series_ids if series_id in status_by_id]
    if not considered:
        return 0.75, ["No status rows are available for confidence freshness checks."]
    penalties = 0.0
    reasons: list[str] = []
    for series_id in considered:
        row = status_by_id[series_id]
        status = row.get("status")
        if status == "stale":
            penalties += 0.25
            reasons.append(f"{series_id} is stale: {row.get('message', 'no message')}")
        elif status == "failed":
            penalties += 0.5
            reasons.append(f"{series_id} failed: {row.get('message', 'no message')}")
        elif status == "unavailable":
            penalties += 0.2
            reasons.append(f"{series_id} is unavailable for active scoring.")
    confidence = max(0.0, 1.0 - min(0.8, penalties / max(1, len(considered))))
    return round(confidence, 2), reasons


def _model_confidence(coverage: dict[str, object]) -> tuple[float, list[str]]:
    groups = coverage.get("groups", {})
    if not isinstance(groups, dict) or not groups:
        return 0.75, ["Model breadth cannot be evaluated without coverage groups."]
    thin_groups = []
    for group, row in groups.items():
        if not isinstance(row, dict):
            continue
        available = row.get("available", [])
        expected = row.get("expected", [])
        if isinstance(available, list) and isinstance(expected, list) and len(expected) > 1 and len(available) <= 1:
            thin_groups.append(str(group))
    confidence = max(0.5, 1.0 - (0.08 * len(thin_groups)))
    notes = [f"{group} depends on limited active inputs." for group in thin_groups]
    return round(confidence, 2), notes


def _source_confidence(notes: list[str]) -> tuple[float, list[str]]:
    candidate_notes = [
        note for note in notes
        if "not active" in note or "Missing" in note or "candidate" in note.lower()
    ]
    confidence = max(0.5, 1.0 - (0.08 * len(candidate_notes)))
    return round(confidence, 2), candidate_notes


def _confidence_breakdown(
    coverage: dict[str, object],
    status_by_id: dict[str, dict[str, Any]],
    notes: list[str],
) -> tuple[dict[str, float], list[str]]:
    expected = coverage.get("expected", [])
    expected_ids = [str(item) for item in expected] if isinstance(expected, list) else []
    coverage_confidence = _coverage_confidence(coverage)
    freshness_confidence, freshness_reasons = _freshness_confidence(status_by_id, expected_ids)
    model_confidence, model_reasons = _model_confidence(coverage)
    source_confidence, source_reasons = _source_confidence(notes)
    breakdown = {
        "coverage_confidence": coverage_confidence,
        "freshness_confidence": freshness_confidence,
        "model_confidence": model_confidence,
        "source_confidence": source_confidence,
    }
    breakdown["overall_confidence"] = round(
        (coverage_confidence * 0.4)
        + (freshness_confidence * 0.3)
        + (model_confidence * 0.2)
        + (source_confidence * 0.1),
        2,
    )
    reasons = sorted(set(freshness_reasons + model_reasons + source_reasons + notes))
    return breakdown, reasons
```

- [ ] **Step 5: Update `build_score_summary` signature and call sites**

Change signature:

```python
def build_score_summary(
    series_by_id: dict[str, dict[str, Any]],
    generated_at: str,
    status_by_id: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
```

Inside the function, set:

```python
    statuses = status_by_id or {}
```

Change hard-coded Phase 3 notes:

```python
    macro_notes.append("Housing is not active in Phase 4 PR 1.")
    fragility_notes.append("Treasury/bond volatility source is not active.")
```

After coverage is built:

```python
    market_confidence, market_confidence_reasons = _confidence_breakdown(
        market_coverage, statuses, market_notes
    )
    macro_confidence, macro_confidence_reasons = _confidence_breakdown(
        macro_coverage, statuses, macro_notes
    )
    fragility_confidence, fragility_confidence_reasons = _confidence_breakdown(
        fragility_coverage, statuses, fragility_notes
    )
```

Pass explicit confidence into each score block:

```python
    market_block = score_block(
        market_score,
        label_for_three_score(market_score, "market_weather"),
        market_buckets,
        MARKET_WEIGHTS,
        _market_weather_drivers(series_by_id, market_buckets),
        market_confidence_reasons,
        market_notes,
        confidence=market_confidence["overall_confidence"],
        confidence_breakdown=market_confidence,
    )
```

Use the same call shape for macro and fragility.

Replace `quality_reasons` and `overall_confidence` logic:

```python
    quality_reasons = sorted(
        set(market_confidence_reasons + macro_confidence_reasons + fragility_confidence_reasons)
    )
    data_quality = {
        "coverage_confidence": round(
            (
                market_confidence["coverage_confidence"]
                + macro_confidence["coverage_confidence"]
                + fragility_confidence["coverage_confidence"]
            )
            / 3,
            2,
        ),
        "freshness_confidence": round(
            (
                market_confidence["freshness_confidence"]
                + macro_confidence["freshness_confidence"]
                + fragility_confidence["freshness_confidence"]
            )
            / 3,
            2,
        ),
        "model_confidence": round(
            (
                market_confidence["model_confidence"]
                + macro_confidence["model_confidence"]
                + fragility_confidence["model_confidence"]
            )
            / 3,
            2,
        ),
        "source_confidence": round(
            (
                market_confidence["source_confidence"]
                + macro_confidence["source_confidence"]
                + fragility_confidence["source_confidence"]
            )
            / 3,
            2,
        ),
        "overall_confidence": round(
            (
                float(market_block["confidence"])
                + float(macro_block["confidence"])
                + float(fragility_block["confidence"])
            )
            / 3,
            2,
        ),
        "reasons": quality_reasons,
    }
```

Return `data_quality`.

In `main`, build status before score summary:

```python
    status = build_status(series_by_id, generated_at)
    score_summary = build_score_summary(series_by_id, generated_at, status["series"])
    write_json(data_dir() / "derived" / "score_summary.json", score_summary)
    market_weather = score_summary["scores"]["market_weather"]
    buckets = dict(market_weather["bucket_scores"])
    weights = dict(market_weather["bucket_weights"])
    overall_score = float(market_weather["score"])
    latest_date = str(score_summary["date"])
    write_json(data_dir() / "status" / "data_status.json", status)
```

- [ ] **Step 6: Update schema validation**

In `scripts/validate/validate_schema.py`, add:

```python
CONFIDENCE_FIELDS = {
    "coverage_confidence",
    "freshness_confidence",
    "model_confidence",
    "source_confidence",
    "overall_confidence",
}
```

In `validate_score_summary_file`, after score block validation:

```python
    data_quality = payload.get("data_quality")
    if not isinstance(data_quality, dict):
        raise ValueError(f"{path} data_quality must be an object")
    for field in CONFIDENCE_FIELDS:
        _validate_finite_number(data_quality.get(field), path, f"data_quality.{field}")
    if not isinstance(data_quality.get("reasons"), list):
        raise ValueError(f"{path} data_quality.reasons must be a list")
```

In `validate_status_file`, allow optional fields:

```python
        if "observation_period" in status and status["observation_period"] is not None and not isinstance(status["observation_period"], str):
            raise ValueError(f"{path} observation_period must be a string or null for {series_id}")
        if "expected_next_release_window" in status and status["expected_next_release_window"] is not None:
            window = status["expected_next_release_window"]
            if not isinstance(window, dict) or not isinstance(window.get("start"), str) or not isinstance(window.get("end"), str):
                raise ValueError(f"{path} expected_next_release_window must contain start and end strings for {series_id}")
        if "message" in status and not isinstance(status["message"], str):
            raise ValueError(f"{path} status message must be a string for {series_id}")
```

- [ ] **Step 7: Run confidence/schema tests**

Run:

```bash
python -m pytest tests/python/test_scoring.py tests/python/test_score_models.py -v
python -m scripts.validate.validate_schema
```

Expected: PASS.

- [ ] **Step 8: Regenerate data**

Run:

```bash
python -m scripts.update_data
```

Expected: exit code 0. `public/data/status/data_status.json` contains release-aware messages, and `public/data/derived/score_summary.json` contains confidence decomposition.

- [ ] **Step 9: Commit confidence decomposition**

```bash
git add scripts/transform/score_models.py scripts/transform/compute_regime_score.py scripts/validate/validate_schema.py tests/python/test_scoring.py public/data
git commit -m "feat: decompose score confidence"
```

---

### Task 3: Add Frontend Types And Interpretation Components

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/components/ConfidenceBreakdown.tsx`
- Create: `src/components/SignalList.tsx`
- Create: `src/components/DataGapPanel.tsx`
- Create: `src/components/InterpretationPanel.tsx`
- Modify: `src/components/DataStatusTable.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Add imports in `src/components/data-components.test.tsx`:

```typescript
import ConfidenceBreakdown from "./ConfidenceBreakdown";
import DataGapPanel from "./DataGapPanel";
import InterpretationPanel from "./InterpretationPanel";
import SignalList from "./SignalList";
```

Add tests:

```typescript
  it("renders confidence breakdown values", () => {
    const container = render(
      <ConfidenceBreakdown
        dataQuality={{
          coverage_confidence: 0.91,
          freshness_confidence: 0.72,
          model_confidence: 0.84,
          source_confidence: 0.75,
          overall_confidence: 0.82,
          reasons: ["Housing is not active in Phase 4 PR 1."]
        }}
      />
    );

    expect(container.textContent).toContain("Data confidence");
    expect(container.textContent).toContain("82%");
    expect(container.textContent).toContain("Coverage");
    expect(container.textContent).toContain("91%");
    expect(container.textContent).toContain("Freshness");
    expect(container.textContent).toContain("72%");
    expect(container.textContent).toContain("Housing is not active in Phase 4 PR 1.");
  });

  it("renders signal list fallbacks and list items", () => {
    const container = render(
      <SignalList
        emptyText="No signals available."
        items={["Credit spreads are contained.", "Volatility is calm."]}
        title="Supports"
      />
    );

    expect(container.textContent).toContain("Supports");
    expect(container.textContent).toContain("Credit spreads are contained.");
    expect(container.textContent).not.toContain("No signals available.");
  });

  it("renders data gap panel for stale and candidate rows", () => {
    const status: DataStatusFile = {
      generated_at_utc: "2026-05-04T14:46:53Z",
      last_successful_update_utc: "2026-05-04T14:46:53Z",
      overall_status: "partial",
      series: {
        core_cpi: {
          expected_frequency: "monthly",
          freshness_days: 64,
          last_observation: "2026-03-01",
          max_stale_days: 45,
          message: "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16.",
          observation_period: "2026-03",
          expected_next_release_window: { start: "2026-04-01", end: "2026-05-16" },
          source: "FRED",
          status: "ok"
        },
        ism_manufacturing_pmi: {
          expected_frequency: "monthly",
          freshness_days: null,
          last_observation: null,
          max_stale_days: 45,
          message: "Candidate source requires access or terms review before scoring.",
          source: "ISM",
          status: "terms_review_needed"
        },
        broad_dollar: {
          expected_frequency: "daily",
          freshness_days: 10,
          last_observation: "2026-04-24",
          max_stale_days: 7,
          message: "Latest daily observation is 10 days old, above the 7 day freshness buffer.",
          source: "FRED",
          status: "stale"
        }
      }
    };

    const container = render(
      <DataGapPanel
        status={status}
        seriesIds={["core_cpi", "broad_dollar", "ism_manufacturing_pmi"]}
      />
    );

    expect(container.textContent).toContain("Data gaps");
    expect(container.textContent).toContain("broad_dollar");
    expect(container.textContent).toContain("Stale");
    expect(container.textContent).toContain("ism_manufacturing_pmi");
    expect(container.textContent).toContain("Terms review needed");
    expect(container.textContent).toContain("expected release window ending 2026-05-16");
  });

  it("renders route interpretation panel", () => {
    const container = render(
      <InterpretationPanel
        conflicts={["Credit is calm while liquidity is draining."]}
        label="Mixed disinflationary slowdown"
        notes={["Monthly macro inputs can lag."]}
        risks={["Real yields are elevated."]}
        summary="Growth is mixed while inflation pressure is easing slowly."
        supports={["Credit spreads are contained."]}
        title="What this page says"
      />
    );

    expect(container.textContent).toContain("Mixed disinflationary slowdown");
    expect(container.textContent).toContain("Growth is mixed");
    expect(container.textContent).toContain("Credit spreads are contained.");
    expect(container.textContent).toContain("Real yields are elevated.");
    expect(container.textContent).toContain("Credit is calm while liquidity is draining.");
    expect(container.textContent).toContain("Monthly macro inputs can lag.");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/components/data-components.test.tsx
```

Expected: FAIL because new components and fields do not exist.

- [ ] **Step 3: Extend TypeScript types**

Modify `src/lib/types.ts`:

```typescript
export type SeriesFrequency = "daily" | "weekly" | "monthly" | "quarterly";
```

Add:

```typescript
export interface ConfidenceBreakdownData {
  coverage_confidence: number;
  freshness_confidence: number;
  model_confidence: number;
  source_confidence: number;
  overall_confidence: number;
  reasons: string[];
}
```

Update `ScoreBlock`:

```typescript
  confidence_breakdown?: Omit<ConfidenceBreakdownData, "reasons">;
```

Update `ScoreSummaryFile.data_quality`:

```typescript
  data_quality: ConfidenceBreakdownData;
```

Update `SeriesStatus`:

```typescript
  observation_period?: string | null;
  expected_next_release_window?: {
    start: string;
    end: string;
  } | null;
```

- [ ] **Step 4: Add `SignalList`**

Create `src/components/SignalList.tsx`:

```typescript
interface SignalListProps {
  emptyText: string;
  items: string[];
  title: string;
}

export default function SignalList({ emptyText, items, title }: SignalListProps) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length ? (
        <ul className="score-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">{emptyText}</p>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Add `ConfidenceBreakdown`**

Create `src/components/ConfidenceBreakdown.tsx`:

```typescript
import type { ConfidenceBreakdownData } from "../lib/types";

interface ConfidenceBreakdownProps {
  dataQuality: ConfidenceBreakdownData;
}

function confidencePercent(value: number) {
  const bounded = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return `${Math.round(bounded * 100)}%`;
}

const rows = [
  ["coverage_confidence", "Coverage"],
  ["freshness_confidence", "Freshness"],
  ["model_confidence", "Model breadth"],
  ["source_confidence", "Source readiness"]
] as const;

export default function ConfidenceBreakdown({ dataQuality }: ConfidenceBreakdownProps) {
  return (
    <section className="panel confidence-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Data confidence</p>
          <h3>{confidencePercent(dataQuality.overall_confidence)} overall</h3>
        </div>
      </div>
      <dl className="confidence-grid">
        {rows.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{confidencePercent(dataQuality[key])}</dd>
          </div>
        ))}
      </dl>
      {dataQuality.reasons.length ? (
        <ul className="score-list">
          {dataQuality.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">No confidence notes in the current score summary.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Add `DataGapPanel`**

Create `src/components/DataGapPanel.tsx`:

```typescript
import { formatDate, statusLabel } from "../lib/formatters";
import type { DataStatusFile, SeriesStatus } from "../lib/types";

interface DataGapPanelProps {
  status: DataStatusFile;
  seriesIds?: string[];
}

const noteworthyStatuses = new Set(["stale", "failed", "terms_review_needed", "unavailable"]);

function isNoteworthy(row: SeriesStatus) {
  return noteworthyStatuses.has(row.status) || Boolean(row.message?.includes("expected release window"));
}

export default function DataGapPanel({ status, seriesIds }: DataGapPanelProps) {
  const selectedIds = seriesIds ? new Set(seriesIds) : undefined;
  const rows = Object.entries(status.series).filter(
    ([seriesId, row]) => (!selectedIds || selectedIds.has(seriesId)) && isNoteworthy(row)
  );

  return (
    <section className="panel data-gap-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Data gaps</p>
          <h3>Freshness and coverage notes</h3>
        </div>
      </div>
      {rows.length ? (
        <div className="status-table-wrap">
          <table className="status-table">
            <thead>
              <tr>
                <th>Series</th>
                <th>Status</th>
                <th>Observation</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([seriesId, row]) => (
                <tr key={seriesId}>
                  <td>{seriesId}</td>
                  <td>
                    <span className={`status-pill status-${row.status}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td>{row.observation_period ?? formatDate(row.last_observation)}</td>
                  <td>{row.message ?? "No status message."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="score-note">No stale, failed, unavailable, or candidate rows in this view.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Add `InterpretationPanel`**

Create `src/components/InterpretationPanel.tsx`:

```typescript
import SignalList from "./SignalList";

interface InterpretationPanelProps {
  conflicts?: string[];
  label: string;
  notes?: string[];
  risks?: string[];
  summary: string;
  supports?: string[];
  title?: string;
}

export default function InterpretationPanel({
  conflicts = [],
  label,
  notes = [],
  risks = [],
  summary,
  supports = [],
  title = "What this page says"
}: InterpretationPanelProps) {
  return (
    <section className="panel interpretation-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{label}</h3>
        </div>
      </div>
      <p>{summary}</p>
      <div className="interpretation-grid">
        <SignalList emptyText="No supportive signals listed." items={supports} title="Supports" />
        <SignalList emptyText="No risk signals listed." items={risks} title="Risks" />
        <SignalList emptyText="No conflicting signals listed." items={conflicts} title="Conflicts" />
        <SignalList emptyText="No caveats listed." items={notes} title="Caveats" />
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Update `DataStatusTable` columns**

Modify the table headers and body in `src/components/DataStatusTable.tsx`:

```typescript
              <th>Observation</th>
              <th>Freshness</th>
              <th>Note</th>
```

Render:

```typescript
                <td>{row.observation_period ?? formatDate(row.last_observation)}</td>
                <td>{formatFreshness(row.freshness_days)}</td>
                <td>{row.message ?? "N/A"}</td>
```

- [ ] **Step 9: Add CSS for new components**

Append to `src/styles.css`:

```css
.confidence-grid,
.interpretation-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.confidence-grid {
  margin: 0 0 16px;
}

.confidence-grid div {
  border: 1px solid #e4e8df;
  border-radius: 8px;
  padding: 12px;
  background: #fbfcf7;
}

.confidence-grid dt {
  color: #607066;
  font-size: 0.82rem;
  font-weight: 700;
}

.confidence-grid dd {
  margin: 4px 0 0;
  color: #1f3730;
  font-size: 1.35rem;
  font-weight: 800;
}

.interpretation-panel > p {
  max-width: 860px;
  color: #536157;
}

.data-gap-panel .status-table td:last-child,
.status-table td:last-child {
  max-width: 420px;
}
```

In the existing mobile media query, add:

```css
  .confidence-grid,
  .interpretation-grid {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 10: Run component tests**

Run:

```bash
npm test -- src/components/data-components.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit components**

```bash
git add src/lib/types.ts src/components/ConfidenceBreakdown.tsx src/components/SignalList.tsx src/components/DataGapPanel.tsx src/components/InterpretationPanel.tsx src/components/DataStatusTable.tsx src/components/data-components.test.tsx src/styles.css
git commit -m "feat: add interpretation UI components"
```

---

### Task 4: Rebuild Overview Around The Three-Score Model

**Files:**
- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Add failing Overview route test**

In `src/routes/data-routes.test.tsx`, update or add an Overview test:

```typescript
  it("renders the three-score overview without legacy weather score duplication", async () => {
    mockStaticFetch(overviewFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Market Weather");

    expect(container.textContent).toContain("Macro Climate");
    expect(container.textContent).toContain("Fragility");
    expect(container.textContent).toContain("Data confidence");
    expect(container.textContent).toContain("Freshness and coverage notes");
    expect(container.textContent).not.toContain("Weather score");
    expect(container.textContent).not.toContain("Market Weather buckets");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx -t "three-score overview"
```

Expected: FAIL because Overview still renders legacy `Weather score` and `Market Weather buckets`.

- [ ] **Step 3: Update Overview imports and state**

In `src/routes/Overview.tsx`, remove:

```typescript
import RegimeBadge from "../components/RegimeBadge";
import { formatSigned } from "../lib/formatters";
import type { RegimeScoreFile } from "../lib/types";
```

Add:

```typescript
import ConfidenceBreakdown from "../components/ConfidenceBreakdown";
import DataGapPanel from "../components/DataGapPanel";
import InterpretationPanel from "../components/InterpretationPanel";
```

Remove `loadRegimeScore` from imports and loader.

Update `OverviewState`:

```typescript
interface OverviewState {
  catalog: SeriesCatalogEntry[];
  scoreSummary: ScoreSummaryFile;
  status: DataStatusFile;
  series: Array<TimeSeriesFile | DerivedSeriesFile>;
}
```

- [ ] **Step 4: Remove legacy helpers and panels**

Delete the helper functions named `titleCaseBucket`, `confidencePercent`, and `ScoreListPanel` from `Overview.tsx`.

Remove the legacy `<section className="hero-panel">` and the bucket panel rendering `data.regime`.

- [ ] **Step 5: Add interpretation panels and confidence/data gaps**

Inside the existing `data ?` rendering block, compute:

```typescript
            const market = scoreSummary.scores.market_weather;
            const macro = scoreSummary.scores.macro_climate;
            const fragility = scoreSummary.scores.fragility;
            const recentChanges = safeStringList(market.recent_changes)
              .concat(safeStringList(macro.recent_changes))
              .concat(safeStringList(fragility.recent_changes));
            const topSupports = safeStringList(market.top_supports)
              .concat(safeStringList(macro.top_supports))
              .concat(safeStringList(fragility.top_supports))
              .slice(0, 6);
            const topRisks = safeStringList(market.top_risks)
              .concat(safeStringList(macro.top_risks))
              .concat(safeStringList(fragility.top_risks))
              .slice(0, 6);
            const conflictingSignals = safeStringList(scoreSummary.conflicting_signals);
```

Render after the score grid:

```tsx
                <InterpretationPanel
                  conflicts={conflictingSignals}
                  label={`${market.label} market weather, ${macro.label} macro climate, ${fragility.label.toLowerCase()} fragility`}
                  notes={safeStringList(scoreSummary.data_quality?.reasons)}
                  risks={topRisks}
                  summary="The overview combines the three descriptive scores with source freshness and coverage notes so stale or missing inputs remain visible beside the headline read."
                  supports={topSupports}
                  title="Current regime read"
                />
                <section className="detail-grid overview-detail-grid">
                  <SignalList
                    emptyText="No recent changes in the current score summary."
                    items={recentChanges}
                    title="Recent changes"
                  />
                  <SignalList
                    emptyText="No conflicting signals in the current score summary."
                    items={conflictingSignals}
                    title="Conflicting signals"
                  />
                </section>
                <ConfidenceBreakdown dataQuality={scoreSummary.data_quality} />
                <DataGapPanel status={data.status} />
```

Add `SignalList` import if using it directly:

```typescript
import SignalList from "../components/SignalList";
```

- [ ] **Step 6: Run Overview tests**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx -t "three-score overview"
```

Expected: PASS.

- [ ] **Step 7: Run full route tests**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: PASS after updating fixtures to include `coverage_confidence`, `freshness_confidence`, `model_confidence`, and `source_confidence` in `scoreSummary.data_quality`.

- [ ] **Step 8: Commit Overview cleanup**

```bash
git add src/routes/Overview.tsx src/routes/data-routes.test.tsx
git commit -m "feat: make overview three-score first"
```

---

### Task 5: Surface Active Data On Volatility, Liquidity, Credit, Commodities, And Sentiment

**Files:**
- Modify: `src/routes/Volatility.tsx`
- Modify: `src/routes/Liquidity.tsx`
- Modify: `src/routes/Credit.tsx`
- Modify: `src/routes/Commodities.tsx`
- Modify: `src/routes/Sentiment.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Add failing route tests for active data surfacing**

In `src/routes/data-routes.test.tsx`, add tests:

```typescript
  it("volatility route surfaces active Cboe volatility curve inputs", async () => {
    mockStaticFetch(routeFetchFiles({
      "/data/series/vix.json": seriesFile("vix", 17.1),
      "/data/series/vvix.json": seriesFile("vvix", 91.2),
      "/data/series/vix9d.json": seriesFile("vix9d", 13.4),
      "/data/series/vix3m.json": seriesFile("vix3m", 20.5),
      "/data/derived/vix9d_vix_ratio.json": derivedFile("vix9d_vix_ratio", 0.78),
      "/data/derived/vix_vix3m_ratio.json": derivedFile("vix_vix3m_ratio", 0.83)
    }));

    const container = render(
      <MemoryRouter initialEntries={["/volatility"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Cboe Volatility Index");
    expect(container.textContent).toContain("Cboe VIX Volatility Index");
    expect(container.textContent).toContain("Cboe 9-Day Volatility Index");
    expect(container.textContent).toContain("Cboe 3-Month Volatility Index");
    expect(container.textContent).toContain("VIX9D / VIX");
    expect(container.textContent).toContain("VIX / VIX3M");
  });

  it("liquidity route makes net liquidity and reserve balances visible", async () => {
    mockStaticFetch(routeFetchFiles({
      "/data/derived/net_liquidity.json": derivedFile("net_liquidity", 5750000),
      "/data/series/reserve_balances.json": seriesFile("reserve_balances", 3200000)
    }));

    const container = render(
      <MemoryRouter initialEntries={["/liquidity"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Net liquidity proxy");
    expect(container.textContent).toContain("Reserve Balances");
  });

  it("credit route surfaces HY minus IG spread", async () => {
    mockStaticFetch(routeFetchFiles({
      "/data/derived/hy_minus_ig_oas.json": derivedFile("hy_minus_ig_oas", 3.1)
    }));

    const container = render(
      <MemoryRouter initialEntries={["/credit"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "HY minus IG OAS");
  });

  it("commodities route surfaces commodity inflation impulse", async () => {
    mockStaticFetch(routeFetchFiles({
      "/data/derived/commodity_inflation_impulse.json": derivedFile("commodity_inflation_impulse", -35)
    }));

    const container = render(
      <MemoryRouter initialEntries={["/commodities"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Commodity inflation impulse");
  });

  it("sentiment route labels active data as positioning only", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/sentiment"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Active data is positioning only");
  });
```

Add helper fixtures near existing fixtures:

```typescript
function derivedFile(seriesId: string, value: number): DerivedSeriesFile {
  return {
    depends_on: ["fixture"],
    frequency: "daily",
    generated_at_utc: "2026-05-04T14:46:53Z",
    method: `${seriesId} derived fixture.`,
    observations: [{ date: "2026-05-01", value, percentile_252d: 50 }],
    series_id: seriesId,
    source: "Derived",
    source_url: `https://example.com/${seriesId}`,
    summary: {
      change_1d: 0,
      change_1m: 0,
      change_1w: 0,
      change_3m: 0,
      change_12m: 0,
      latest_date: "2026-05-01",
      latest_value: value,
      percentile_252d: 50
    },
    units: "index"
  };
}
```

Add this helper after `derivedFile`:

```typescript
function routeFetchFiles(overrides: Record<string, unknown> = {}) {
  return Object.assign(
    {
      "/data/catalog/series_catalog.json": catalog,
      "/data/status/data_status.json": status,
      "/data/series/vix.json": seriesFile("vix", 17.1),
      "/data/series/vvix.json": seriesFile("vvix", 91.2),
      "/data/series/vix9d.json": seriesFile("vix9d", 13.4),
      "/data/series/vix3m.json": seriesFile("vix3m", 20.5),
      "/data/derived/vix9d_vix_ratio.json": derivedFile("vix9d_vix_ratio", 0.78),
      "/data/derived/vix_vix3m_ratio.json": derivedFile("vix_vix3m_ratio", 0.83),
      "/data/series/fed_assets.json": seriesFile("fed_assets", 7200000),
      "/data/series/reverse_repo.json": seriesFile("reverse_repo", 450),
      "/data/series/treasury_general_account.json": seriesFile("treasury_general_account", 800000),
      "/data/series/sofr.json": seriesFile("sofr", 5.3),
      "/data/series/reserve_balances.json": seriesFile("reserve_balances", 3200000),
      "/data/derived/net_liquidity.json": derivedFile("net_liquidity", 5750000),
      "/data/series/high_yield_oas.json": seriesFile("high_yield_oas", 3.8),
      "/data/series/investment_grade_oas.json": seriesFile("investment_grade_oas", 1.2),
      "/data/series/bbb_oas.json": seriesFile("bbb_oas", 1.6),
      "/data/series/financial_stress.json": seriesFile("financial_stress", -0.3),
      "/data/series/financial_conditions.json": seriesFile("financial_conditions", -0.2),
      "/data/series/bank_credit.json": seriesFile("bank_credit", 17500),
      "/data/series/loans_and_leases.json": seriesFile("loans_and_leases", 12500),
      "/data/series/business_loans.json": seriesFile("business_loans", 2800),
      "/data/series/bank_deposits.json": seriesFile("bank_deposits", 18000),
      "/data/derived/hy_minus_ig_oas.json": derivedFile("hy_minus_ig_oas", 2.6),
      "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
      "/data/series/brent_crude.json": seriesFile("brent_crude", 82.2),
      "/data/series/corn_price.json": seriesFile("corn_price", 210),
      "/data/series/wheat_price.json": seriesFile("wheat_price", 240),
      "/data/series/soybean_price.json": seriesFile("soybean_price", 420),
      "/data/derived/brent_wti_spread.json": derivedFile("brent_wti_spread", 3.8),
      "/data/derived/commodity_inflation_impulse.json": derivedFile("commodity_inflation_impulse", -35),
      "/data/series/cftc_sp500_asset_mgr_net.json": seriesFile("cftc_sp500_asset_mgr_net", 12),
      "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 8),
      "/data/series/cfnai.json": seriesFile("cfnai", 0.1),
      "/data/series/cfnai_3m_avg.json": seriesFile("cfnai_3m_avg", 0.05),
      "/data/series/real_retail_sales.json": seriesFile("real_retail_sales", 240000),
      "/data/series/industrial_production.json": seriesFile("industrial_production", 103),
      "/data/series/durable_goods_orders.json": seriesFile("durable_goods_orders", 290000),
      "/data/series/unemployment_rate.json": seriesFile("unemployment_rate", 4.0),
      "/data/series/nonfarm_payrolls.json": seriesFile("nonfarm_payrolls", 160000),
      "/data/series/initial_claims.json": seriesFile("initial_claims", 215000),
      "/data/series/sahm_rule.json": seriesFile("sahm_rule", 0.2),
      "/data/series/headline_cpi.json": seriesFile("headline_cpi", 320),
      "/data/series/core_cpi.json": seriesFile("core_cpi", 330),
      "/data/series/core_pce.json": seriesFile("core_pce", 125),
      "/data/series/ppi_final_demand.json": seriesFile("ppi_final_demand", 260),
      "/data/series/breakeven_10y.json": seriesFile("breakeven_10y", 2.3),
      "/data/series/breakeven_5y.json": seriesFile("breakeven_5y", 2.4),
      "/data/series/forward_inflation_5y5y.json": seriesFile("forward_inflation_5y5y", 2.2),
      "/data/series/us2y.json": seriesFile("us2y", 4.1),
      "/data/series/us10y.json": seriesFile("us10y", 4.3),
      "/data/series/us20y.json": seriesFile("us20y", 4.5),
      "/data/series/us30y.json": seriesFile("us30y", 4.4),
      "/data/series/real_yield_5y.json": seriesFile("real_yield_5y", 1.9),
      "/data/series/real_yield_10y.json": seriesFile("real_yield_10y", 2.0),
      "/data/derived/us10y_minus_us2y.json": derivedFile("us10y_minus_us2y", 0.2),
      "/data/series/broad_dollar.json": seriesFile("broad_dollar", 126),
      "/data/series/usdjpy.json": seriesFile("usdjpy", 155),
      "/data/series/eurusd.json": seriesFile("eurusd", 1.08)
    },
    overrides
  );
}
```

- [ ] **Step 2: Run route tests to verify failures**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx -t "surfaces|positioning only|net liquidity"
```

Expected: FAIL because routes do not yet load/render the newly asserted data.

- [ ] **Step 3: Update Volatility route**

In `src/routes/Volatility.tsx`:

- Load catalog and status.
- Load active series ids: `["vix", "vvix", "vix9d", "vix3m"]`.
- Load derived ids: `["vix9d_vix_ratio", "vix_vix3m_ratio"]`.
- Render `InterpretationPanel`.
- Render a metric grid for all six files.
- Keep a VIX chart and add `DataStatusTable`.

Use derived catalog entries:

```typescript
function volatilityDerivedEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "volatility",
    frequency: series.frequency,
    higher_is: "contextual",
    id: series.series_id,
    max_stale_days: 7,
    name: series.series_id === "vix9d_vix_ratio" ? "VIX9D / VIX" : "VIX / VIX3M",
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units
  };
}
```

- [ ] **Step 4: Update Liquidity route**

In `src/routes/Liquidity.tsx`:

- Add `reserve_balances` to `liquiditySeriesIds`.
- Load `loadDataStatus`.
- Render `InterpretationPanel` with label `Liquidity funding conditions`.
- Render `MetricCard` for `netLiquidity` first, then active series.
- Render `TimeSeriesChart` for `netLiquidity`.
- Render `DataGapPanel` and `DataStatusTable`.

- [ ] **Step 5: Update Credit route**

In `src/routes/Credit.tsx`:

- Load `hy_minus_ig_oas` with `loadDerivedSeries`.
- Add a derived catalog entry named `HY minus IG OAS`.
- Render `InterpretationPanel`.
- Render the derived metric next to high-yield, investment-grade, and BBB OAS.
- Keep financial stress chart.
- Render `DataGapPanel` and `DataStatusTable`.

- [ ] **Step 6: Update Commodities route**

In `src/routes/Commodities.tsx`:

- Load `commodity_inflation_impulse` with `loadDerivedSeries`.
- Add derived catalog entry named `Commodity inflation impulse`.
- Render `InterpretationPanel` explaining price level versus impulse.
- Render commodity impulse before oil/crop cards.
- Keep WTI chart and status table.

- [ ] **Step 7: Update Sentiment route**

In `src/routes/Sentiment.tsx`:

- Add `InterpretationPanel` with:

```tsx
<InterpretationPanel
  label="Active data is positioning only"
  notes={[
    "CFTC positioning is weekly, delayed, and futures-specific.",
    "Survey sentiment, options sentiment, fund flows, and exposure indexes remain candidate sources."
  ]}
  risks={["Very high leveraged-money positioning can indicate crowding risk."]}
  summary="This page currently shows CFTC E-mini S&P 500 asset-manager and leveraged-money positioning. It should not be read as a complete sentiment model."
  supports={["Low or moderate positioning can describe underexposure context."]}
/>
```

Add `DataGapPanel` and keep `DataStatusTable`.

- [ ] **Step 8: Run route tests**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit surfaced active data routes**

```bash
git add src/routes/Volatility.tsx src/routes/Liquidity.tsx src/routes/Credit.tsx src/routes/Commodities.tsx src/routes/Sentiment.tsx src/routes/data-routes.test.tsx
git commit -m "feat: surface active route data"
```

---

### Task 6: Add Interpretation Panels To Remaining Macro Routes

**Files:**
- Modify: `src/routes/Growth.tsx`
- Modify: `src/routes/Inflation.tsx`
- Modify: `src/routes/Rates.tsx`
- Modify: `src/routes/DollarGlobal.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Add failing tests for remaining route interpretation**

In `src/routes/data-routes.test.tsx`, add:

```typescript
  it("growth route explains growth and labor interpretation", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/growth"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Growth and labor read");
    expect(container.textContent).toContain("Monthly growth and labor data can lag source release schedules.");
  });

  it("inflation route explains level versus expectations", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/inflation"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Inflation pressure read");
    expect(container.textContent).toContain("CPI, PCE, PPI, breakevens, and forward inflation expectations");
  });

  it("rates route explains nominal, real, and curve context", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/rates"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Rates and policy read");
    expect(container.textContent).toContain("Nominal yields, real yields, breakevens, and the 10Y-2Y curve");
  });

  it("dollar route explains global tightening context", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/dollar-global"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Dollar pressure read");
    expect(container.textContent).toContain("Broad dollar strength can tighten global financial conditions.");
  });
```

- [ ] **Step 2: Run tests to verify failures**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx -t "read"
```

Expected: FAIL because the interpretation text is not rendered.

- [ ] **Step 3: Update Growth**

In `src/routes/Growth.tsx`, import:

```typescript
import DataGapPanel from "../components/DataGapPanel";
import InterpretationPanel from "../components/InterpretationPanel";
```

Render after heading:

```tsx
          <InterpretationPanel
            label="Growth and labor read"
            notes={["Monthly growth and labor data can lag source release schedules."]}
            risks={["Rising claims, unemployment, or Sahm Rule pressure can indicate recession risk."]}
            summary="Growth combines activity breadth, real demand, production, durable goods, labor momentum, and recession-risk indicators."
            supports={["Firm CFNAI, retail sales, production, and payroll inputs support the macro climate score."]}
          />
          <DataGapPanel status={data.status} seriesIds={growthSeriesIds.concat(laborSeriesIds)} />
```

- [ ] **Step 4: Update Inflation**

In `src/routes/Inflation.tsx`, import components and render:

```tsx
          <InterpretationPanel
            label="Inflation pressure read"
            notes={["Monthly inflation indexes use observation months and should be read with release-aware freshness notes."]}
            risks={["High or reaccelerating core inflation can keep policy pressure elevated."]}
            summary="CPI, PCE, PPI, breakevens, and forward inflation expectations separate realized price pressure from market-implied inflation compensation."
            supports={["Contained breakevens and easing core momentum can reduce macro climate pressure."]}
          />
          <DataGapPanel status={data.status} seriesIds={inflationSeriesIds} />
```

- [ ] **Step 5: Update Rates**

In `src/routes/Rates.tsx`, import components and render:

```tsx
          <InterpretationPanel
            label="Rates and policy read"
            notes={["Real-yield and breakeven data are daily market-implied context, not policy forecasts."]}
            risks={["Elevated real yields can tighten financial conditions and pressure valuation-sensitive assets."]}
            summary="Nominal yields, real yields, breakevens, and the 10Y-2Y curve describe policy-rate pressure, inflation compensation, and curve regime."
            supports={["Falling real yields or less inverted curves can ease market weather pressure."]}
          />
          <DataGapPanel status={data.status} seriesIds={ratesSeriesIds.concat(["us10y_minus_us2y"])} />
```

- [ ] **Step 6: Update DollarGlobal**

In `src/routes/DollarGlobal.tsx`, import components and render:

```tsx
          <InterpretationPanel
            label="Dollar pressure read"
            notes={["FX series can be stale around holidays and should be checked against freshness status."]}
            risks={["Broad dollar strength can tighten global financial conditions."]}
            summary="The broad dollar, USDJPY, and EURUSD provide global dollar-pressure context for Market Weather and Fragility."
            supports={["Dollar easing can reduce global liquidity pressure."]}
          />
          <DataGapPanel status={data.status} seriesIds={dollarSeriesIds} />
```

- [ ] **Step 7: Run route tests**

Run:

```bash
npm test -- src/routes/data-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit remaining route interpretation**

```bash
git add src/routes/Growth.tsx src/routes/Inflation.tsx src/routes/Rates.tsx src/routes/DollarGlobal.tsx src/routes/data-routes.test.tsx
git commit -m "feat: add macro route interpretation"
```

---

### Task 7: Update Documentation For PR 1 Behavior

**Files:**
- Modify: `README.md`
- Modify: `docs/METHODOLOGY.md`
- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/LIMITATIONS.md`

- [ ] **Step 1: Update README Phase 4 direction**

Add a `Phase 4 direction` section after the Phase 3 direction:

```markdown
Phase 4 direction:

- Make the three-score model the primary Overview experience.
- Replace raw observation-age freshness with release-aware freshness for daily, weekly, monthly, and quarterly data.
- Decompose confidence into coverage, freshness, model breadth, source readiness, and overall confidence.
- Surface active Phase 3 data more fully before adding many new source families.
- Keep Housing, GDP/final demand, consumer balance sheet, fiscal/Treasury supply, Event Calendar, PMIs, SLOOS, survey sentiment, valuation, and market internals as staged follow-up work unless their source status is reviewed and documented.
```

- [ ] **Step 2: Update Methodology freshness and confidence**

In `docs/METHODOLOGY.md`, replace the `Freshness And Provenance` and `Confidence` sections with:

```markdown
## Freshness And Provenance

Each generated series includes source metadata, observation dates, summary values, and percentile context where applicable. The status output distinguishes raw data age from expected release cadence.

Daily series use short calendar-day freshness buffers with normal non-trading-day tolerance. Weekly series use expected weekly cadence plus buffer. Monthly and quarterly series are evaluated against their observation period and expected release window, so a first-of-month observation is not automatically stale before the next release is expected.

Derived series inherit freshness context from their dependencies. A derived file can be generated today while still depending on lagged monthly inputs, so dependency notes should be read with headline status.

## Confidence

Each score includes a confidence value from `0` to `1`. The overall data-quality block decomposes confidence into:

- Coverage confidence: active expected series are present and have usable observations.
- Freshness confidence: active series are fresh or within expected release lag.
- Model confidence: buckets have enough breadth and are not overly dependent on one proxy.
- Source confidence: important domains are not blocked by candidate, unavailable, restricted, or unresolved source status.

Overall confidence is a weighted blend of those components. Confidence is a data-quality indicator, not a probability that the score is predictive.
```

- [ ] **Step 3: Update Data Sources with FRED-first PR 1 note**

In `docs/DATA_SOURCES.md`, add before `Candidate Sources`:

```markdown
## Phase 4 PR 1 Source Handling

Phase 4 PR 1 does not add new source families. It improves release-aware freshness, confidence decomposition, and route interpretation for the existing active generated data.

Future Phase 4 source expansion should prefer FRED graph CSV mirrors for time series when a clean FRED-hosted series exists. Original no-secret government APIs or official machine-readable pages should be used when FRED is not enough, especially for event calendars, Treasury auction metadata, fiscal datasets, and release schedules.
```

- [ ] **Step 4: Update Limitations with confidence caveats**

Add to `docs/LIMITATIONS.md` under Score Confidence Limitations:

```markdown
- Release-aware freshness reduces false stale flags for monthly and quarterly data, but it still depends on configured cadence assumptions.
- Expected-lag status means the source may be behaving normally; it does not mean the latest economic observation is current in a real-time sense.
- Confidence decomposition makes stale, missing, candidate, and thin-model inputs visible, but it does not turn descriptive scores into forecasts.
```

- [ ] **Step 5: Commit docs**

```bash
git add README.md docs/METHODOLOGY.md docs/DATA_SOURCES.md docs/LIMITATIONS.md
git commit -m "docs: explain phase 4 reliability model"
```

---

### Task 8: Final Verification And Clean-Up

**Files:**
- Verify all modified files.
- Do not modify unrelated `.idea/` files.

- [ ] **Step 1: Run Python tests**

Run:

```bash
python -m pytest tests/python -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Build static app**

Run:

```bash
npm run build
```

Expected: PASS and `dist/404.html` is created by the build script.

- [ ] **Step 4: Inspect generated status and confidence**

Run:

```bash
jq '.data_quality' public/data/derived/score_summary.json
jq '{overall_status, generated_at_utc, stale: ([.series|to_entries[]|select(.value.status=="stale")|.key])}' public/data/status/data_status.json
```

Expected: `score_summary.json` shows `coverage_confidence`, `freshness_confidence`, `model_confidence`, `source_confidence`, and `overall_confidence`. Monthly macro series that are still inside expected release windows are not reported as stale solely because their observation date is the first day of the prior month.

- [ ] **Step 5: Inspect git diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only PR 1 files are modified. `.idea/` remains untracked and untouched.

- [ ] **Step 6: Final commit if verification changed generated data or snapshots**

If verification or data regeneration produced tracked changes after the prior commits, commit them:

```bash
git add public/data src scripts tests docs README.md
git commit -m "chore: verify phase 4 reliability data"
```

Expected: commit is created only when tracked files changed.

---

## Self-Review Notes

Spec coverage:

- Release-aware freshness is covered by Tasks 1 and 2.
- Confidence decomposition is covered by Task 2 and frontend display in Task 3.
- Three-score-first Overview is covered by Task 4.
- Reusable interpretation components are covered by Task 3.
- Active data surfacing is covered by Tasks 5 and 6.
- Documentation is covered by Task 7.
- Final verification is covered by Task 8.

Out-of-scope items from the design are intentionally excluded from this PR 1 plan:

- Housing route.
- GDP/final-demand source expansion.
- Consumer balance sheet source expansion.
- Fiscal/Treasury supply source expansion.
- Event Calendar route.
- Data Health route.
- Macro Regime Matrix.
- Driver contribution waterfall.
- First-class conflicting-signal detector beyond existing `score_summary.conflicting_signals` display.
