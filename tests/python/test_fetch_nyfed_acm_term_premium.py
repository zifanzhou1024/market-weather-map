"""Tests for the NY Fed ACM Term Premium fetcher (TDD — written before implementation)."""
import pytest
from scripts.ingest import fetch_nyfed_acm_term_premium as mod


# ---------------------------------------------------------------------------
# Date parsing: dates in ACMTermPremium.xls are text strings "DD-Mon-YYYY"
# (not Excel serial numbers), so parse_acm_date converts the text format.
# ---------------------------------------------------------------------------

def test_parse_acm_date_basic():
    assert mod.parse_acm_date("14-Jun-1961") == "1961-06-14"


def test_parse_acm_date_single_digit_day():
    assert mod.parse_acm_date("06-May-2026") == "2026-05-06"


def test_parse_acm_date_december():
    assert mod.parse_acm_date("31-Dec-2020") == "2020-12-31"


# ---------------------------------------------------------------------------
# find_header_row_index: locates the row containing DATE and ACMTP10
# ---------------------------------------------------------------------------

def _make_rows_with_header_at(index: int) -> list[list[object]]:
    """Build a minimal rows list with the header at a given index."""
    rows: list[list[object]] = []
    for i in range(index):
        rows.append([f"junk_row_{i}", "x", "y"])
    rows.append(["DATE", "ACMY01", "ACMTP01", "ACMTP10", "ACMRNY10"])
    rows.append(["14-Jun-1961", 2.97, 0.01, 0.5, 2.47])
    return rows


def test_find_header_row_index_first_row():
    rows = _make_rows_with_header_at(0)
    assert mod.find_header_row_index(rows) == 0


def test_find_header_row_index_non_zero():
    rows = _make_rows_with_header_at(3)
    assert mod.find_header_row_index(rows) == 3


def test_find_header_row_index_not_found_raises():
    rows = [["foo", "bar", "baz"], ["a", "b", "c"]]
    with pytest.raises(ValueError, match="no header row found"):
        mod.find_header_row_index(rows)


# ---------------------------------------------------------------------------
# extract_acm_observations: converts rows to observations list
# ---------------------------------------------------------------------------

_HEADER = ["DATE", "ACMY01", "ACMTP01", "ACMTP10", "ACMRNY10"]


def _obs_rows() -> list[list[object]]:
    return [
        _HEADER,
        ["14-Jun-1961", 2.97, 0.01, 0.5, 2.47],
        ["15-Jun-1961", 2.98, 0.02, 0.6, 2.38],
        ["19-Jun-1961", 3.00, 0.03, 0.4, 2.60],
    ]


def test_extract_acm_observations_basic():
    rows = _obs_rows()
    obs = mod.extract_acm_observations(rows, header_row_index=0)
    assert len(obs) == 3
    assert obs[0] == {"date": "1961-06-14", "value": 0.5}
    assert obs[1] == {"date": "1961-06-15", "value": 0.6}
    assert obs[2] == {"date": "1961-06-19", "value": 0.4}


def test_extract_acm_observations_sorts_ascending():
    rows = [
        _HEADER,
        ["19-Jun-1961", 3.00, 0.03, 0.4, 2.60],
        ["14-Jun-1961", 2.97, 0.01, 0.5, 2.47],
        ["15-Jun-1961", 2.98, 0.02, 0.6, 2.38],
    ]
    obs = mod.extract_acm_observations(rows, header_row_index=0)
    dates = [o["date"] for o in obs]
    assert dates == sorted(dates)


def test_extract_acm_observations_missing_column_raises():
    bad_header_rows = [
        ["DATE", "ACMY01", "ACMRNY10"],  # no ACMTP10
        ["14-Jun-1961", 2.97, 2.47],
    ]
    with pytest.raises(ValueError, match="missing expected columns"):
        mod.extract_acm_observations(bad_header_rows, header_row_index=0)


def test_extract_acm_observations_skips_empty_value_rows():
    rows = [
        _HEADER,
        ["14-Jun-1961", 2.97, 0.01, 0.5, 2.47],
        ["15-Jun-1961", 2.98, 0.02, "", 2.38],  # empty value — skip
        ["19-Jun-1961", 3.00, 0.03, 0.4, 2.60],
    ]
    obs = mod.extract_acm_observations(rows, header_row_index=0)
    assert len(obs) == 2
    assert all(o["date"] != "1961-06-15" for o in obs)


def test_extract_acm_observations_skips_empty_date_rows():
    rows = [
        _HEADER,
        ["14-Jun-1961", 2.97, 0.01, 0.5, 2.47],
        ["", 2.98, 0.02, 0.6, 2.38],  # empty date — skip
    ]
    obs = mod.extract_acm_observations(rows, header_row_index=0)
    assert len(obs) == 1


def test_extract_acm_observations_empty_raises():
    rows = [_HEADER]  # no data rows
    with pytest.raises(ValueError, match="no ACM observations parsed"):
        mod.extract_acm_observations(rows, header_row_index=0)


def test_extract_acm_observations_uses_header_row_index():
    rows = [
        ["junk", "row"],
        ["another", "junk"],
        _HEADER,
        ["14-Jun-1961", 2.97, 0.01, 0.5, 2.47],
    ]
    obs = mod.extract_acm_observations(rows, header_row_index=2)
    assert len(obs) == 1
    assert obs[0]["date"] == "1961-06-14"
