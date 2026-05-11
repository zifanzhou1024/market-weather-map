import pytest

from scripts.ingest import fetch_bea_personal_saving_rate as mod


def test_normalize_rows_basic():
    rows = [
        {"DATE": "2024-01-01", "VALUE": "5.2"},
        {"DATE": "2024-02-01", "VALUE": "5.4"},
    ]
    obs = mod.normalize_rows(rows)
    assert len(obs) == 2
    assert obs[0] == {"date": "2024-01-01", "value": 5.2}
    assert obs[1] == {"date": "2024-02-01", "value": 5.4}


def test_normalize_rows_skips_dot_value():
    # FRED uses "." to indicate missing values.
    rows = [
        {"DATE": "2024-01-01", "VALUE": "5.2"},
        {"DATE": "2024-02-01", "VALUE": "."},
        {"DATE": "2024-03-01", "VALUE": "5.4"},
    ]
    obs = mod.normalize_rows(rows)
    dates = [o["date"] for o in obs]
    assert dates == ["2024-01-01", "2024-03-01"]


def test_normalize_rows_rejects_missing_columns():
    with pytest.raises(ValueError, match="DATE/VALUE columns"):
        mod.normalize_rows([{"wrong": "x"}])


def test_normalize_rows_empty_rows_raises():
    with pytest.raises(ValueError, match="no rows"):
        mod.normalize_rows([])


def test_normalize_rows_missing_date_field_raises():
    # Row is non-empty but the DATE value is absent/empty.
    rows = [{"DATE": "", "VALUE": "5.2"}]
    with pytest.raises(ValueError, match="missing DATE"):
        mod.normalize_rows(rows)


def test_normalize_rows_invalid_numeric_value_raises():
    rows = [{"DATE": "2024-01-01", "VALUE": "abc"}]
    with pytest.raises(ValueError, match="PSAVERT"):
        mod.normalize_rows(rows)


def test_normalize_rows_unsorted_input_returns_sorted():
    rows = [
        {"DATE": "2024-03-01", "VALUE": "5.4"},
        {"DATE": "2024-01-01", "VALUE": "5.0"},
        {"DATE": "2024-02-01", "VALUE": "5.2"},
    ]
    obs = mod.normalize_rows(rows)
    dates = [o["date"] for o in obs]
    assert dates == ["2024-01-01", "2024-02-01", "2024-03-01"]
