import pytest

from scripts.ingest import fetch_shiller_cape as mod


def test_shiller_date_to_iso_january():
    assert mod._shiller_date_to_iso("2024.01") == "2024-01-01"


def test_shiller_date_to_iso_october():
    # Shiller's convention: "2024.10" for October. Excel may strip to "2024.1".
    assert mod._shiller_date_to_iso("2024.10") == "2024-10-01"
    # If Excel stripped the trailing zero:
    assert mod._shiller_date_to_iso(2024.1) == "2024-10-01"


def test_shiller_date_to_iso_float_input():
    assert mod._shiller_date_to_iso(2024.05) == "2024-05-01"


def test_extract_cape_observations_basic():
    rows = [
        ["Some notes", None, None],            # preamble row 0
        ["More notes", None, None],            # preamble row 1
        ["Date", "S&P 500", "CAPE"],           # header row 2
        ["2024.01", 5000.0, 35.5],
        ["2024.02", 5050.0, 36.0],
    ]
    obs = mod.extract_cape_observations(rows, header_row_index=2)
    assert obs == [
        {"date": "2024-01-01", "value": 35.5},
        {"date": "2024-02-01", "value": 36.0},
    ]


def test_extract_cape_observations_skips_blank_rows():
    rows = [
        ["Date", "CAPE"],
        ["2024.01", 35.5],
        ["", None],                            # trailing blank row
        ["2024.02", 36.0],
    ]
    obs = mod.extract_cape_observations(rows, header_row_index=0)
    assert len(obs) == 2


def test_extract_cape_observations_skips_unparseable_cape():
    rows = [
        ["Date", "CAPE"],
        ["2024.01", 35.5],
        ["2024.02", "NA"],
        ["2024.03", 36.0],
    ]
    obs = mod.extract_cape_observations(rows, header_row_index=0)
    assert [o["value"] for o in obs] == [35.5, 36.0]


def test_extract_cape_observations_missing_columns_raises():
    rows = [
        ["Date", "S&P 500"],   # CAPE column missing
        ["2024.01", 5000.0],
    ]
    with pytest.raises(ValueError, match="Shiller XLS missing expected columns"):
        mod.extract_cape_observations(rows, header_row_index=0)


def test_extract_cape_observations_sorts_ascending():
    rows = [
        ["Date", "CAPE"],
        ["2024.02", 36.0],
        ["2024.01", 35.5],
    ]
    obs = mod.extract_cape_observations(rows, header_row_index=0)
    assert [o["date"] for o in obs] == ["2024-01-01", "2024-02-01"]


def test_extract_cape_observations_empty_raises():
    rows = [["Date", "CAPE"]]
    with pytest.raises(ValueError, match="no CAPE observations parsed"):
        mod.extract_cape_observations(rows, header_row_index=0)
