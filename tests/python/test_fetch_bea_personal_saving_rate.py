import pytest

from scripts.ingest import fetch_bea_personal_saving_rate as mod


def test_normalize_rows_basic():
    rows = [
        {"observation_date": "2024-01-01", "PSAVERT": "5.2"},
        {"observation_date": "2024-02-01", "PSAVERT": "5.4"},
    ]
    obs = mod.normalize_rows(rows)
    assert len(obs) == 2
    assert obs[0] == {"date": "2024-01-01", "value": 5.2}
    assert obs[1] == {"date": "2024-02-01", "value": 5.4}


def test_normalize_rows_skips_dot_value():
    # FRED uses "." to indicate missing values.
    rows = [
        {"observation_date": "2024-01-01", "PSAVERT": "5.2"},
        {"observation_date": "2024-02-01", "PSAVERT": "."},
        {"observation_date": "2024-03-01", "PSAVERT": "5.4"},
    ]
    obs = mod.normalize_rows(rows)
    dates = [o["date"] for o in obs]
    assert dates == ["2024-01-01", "2024-03-01"]


def test_normalize_rows_rejects_missing_columns():
    with pytest.raises(ValueError, match="observation_date/PSAVERT columns"):
        mod.normalize_rows([{"wrong": "x"}])


def test_normalize_rows_empty_rows_raises():
    with pytest.raises(ValueError, match="no rows"):
        mod.normalize_rows([])


def test_normalize_rows_missing_date_field_raises():
    # Row is non-empty but the observation_date value is absent/empty.
    rows = [{"observation_date": "", "PSAVERT": "5.2"}]
    with pytest.raises(ValueError, match="missing observation_date"):
        mod.normalize_rows(rows)


def test_normalize_rows_invalid_numeric_value_raises():
    rows = [{"observation_date": "2024-01-01", "PSAVERT": "abc"}]
    with pytest.raises(ValueError, match="PSAVERT"):
        mod.normalize_rows(rows)


def test_normalize_rows_unsorted_input_returns_sorted():
    rows = [
        {"observation_date": "2024-03-01", "PSAVERT": "5.4"},
        {"observation_date": "2024-01-01", "PSAVERT": "5.0"},
        {"observation_date": "2024-02-01", "PSAVERT": "5.2"},
    ]
    obs = mod.normalize_rows(rows)
    dates = [o["date"] for o in obs]
    assert dates == ["2024-01-01", "2024-02-01", "2024-03-01"]
