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
    import pytest
    with pytest.raises(ValueError, match="DATE/VALUE columns"):
        mod.normalize_rows([{"wrong": "x"}])
