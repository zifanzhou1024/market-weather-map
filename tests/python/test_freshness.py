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
