import pytest
from scripts.ingest import fetch_shiller_cape as mod


def test_parse_date_first_of_month():
    assert mod._parse_date("Apr 1, 2026") == "2026-04-01"


def test_parse_date_normalizes_live_current_day():
    # The live current-day row should normalize to first-of-month.
    assert mod._parse_date("May 8, 2026") == "2026-05-01"


def test_parse_date_october():
    assert mod._parse_date("Oct 1, 2024") == "2024-10-01"


def test_extract_observations_basic():
    html = """
    <table>
    <tr><td>Apr 1, 2026</td><td>&#x2002;
38.34
</td></tr>
    <tr><td>Mar 1, 2026</td><td>&#x2002;
37.66
</td></tr>
    </table>
    """
    obs = mod.extract_observations(html)
    assert obs == [
        {"date": "2026-03-01", "value": 37.66},
        {"date": "2026-04-01", "value": 38.34},
    ]


def test_extract_observations_live_current_day_normalizes_to_month_start():
    html = """
    <tr><td>May 8, 2026</td><td>&#x2002;
42.05
</td></tr>
    <tr><td>Apr 1, 2026</td><td>&#x2002;
38.34
</td></tr>
    """
    obs = mod.extract_observations(html)
    dates = [o["date"] for o in obs]
    assert "2026-05-01" in dates
    assert "2026-05-08" not in dates  # NOT kept as a separate observation
    may = next(o for o in obs if o["date"] == "2026-05-01")
    assert may["value"] == 42.05


def test_extract_observations_dedup_keeps_live_value_over_first_of_month():
    # Edge case: if both 'May 8' (live) and 'May 1' (first-of-month) appear,
    # the first match wins. multpl.com always lists the live row first.
    html = """
    <tr><td>May 8, 2026</td><td>&#x2002;42.05</td></tr>
    <tr><td>May 1, 2026</td><td>&#x2002;41.50</td></tr>
    """
    obs = mod.extract_observations(html)
    assert obs == [{"date": "2026-05-01", "value": 42.05}]


def test_extract_observations_no_matches_raises():
    with pytest.raises(ValueError, match="no rows matched"):
        mod.extract_observations("<html>no table here</html>")


def test_extract_observations_sorts_ascending():
    html = """
    <tr><td>Apr 1, 2026</td><td>&#x2002;38.34</td></tr>
    <tr><td>Jan 1, 2026</td><td>&#x2002;40.03</td></tr>
    <tr><td>Mar 1, 2026</td><td>&#x2002;37.66</td></tr>
    """
    obs = mod.extract_observations(html)
    assert [o["date"] for o in obs] == ["2026-01-01", "2026-03-01", "2026-04-01"]
