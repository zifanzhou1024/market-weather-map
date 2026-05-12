from __future__ import annotations

import json

import pytest

from scripts.ingest import fetch_cboe_vx_settlement as mod


SETTLEMENT_CSV = """Product,Symbol,Expiration Date,Price
VX,VX19/K6,2026-05-13,19.4709
VX,VX/K6,2026-05-19,19.4709
VX,VX21/K6,2026-05-27,19.4709
VX,VX/M6,2026-06-17,20.99
VX,VX/N6,2026-07-22,21.9478
VX,VX/Q6,2026-08-19,22.225
VX,VX/U6,2026-09-16,22.5121
VX,VX/V6,2026-10-21,22.925
VX,VX/X6,2026-11-18,22.975
VX,VX/Z6,2026-12-16,22.775
VXM,VXM/K6,2026-05-19,19.4709
"""


def test_discover_latest_csv_url_from_settlement_page() -> None:
    page = """
    <a href="https://www-api.cboe.com/us/futures/market_statistics/settlement/csv?dt=2026-05-11">
      Download this as CSV
    </a>
    <a href="https://www-api.cboe.com/us/futures/market_statistics/settlement/csv?dt=2026-05-08">
      Download this as CSV
    </a>
    """

    assert mod.discover_latest_csv_url(page) == (
        "2026-05-11",
        "https://www-api.cboe.com/us/futures/market_statistics/settlement/csv?dt=2026-05-11",
    )


def test_normalize_vx_monthly_contracts_ignores_weeklies_and_mini_contracts() -> None:
    rows = mod.parse_settlement_rows(SETTLEMENT_CSV)

    result = mod.normalize_vx_settlement_rows(rows, settlement_date="2026-05-11", max_tenors=8)

    assert result["date"] == "2026-05-11"
    assert result["vx1"] == 19.4709
    assert result["vx2"] == 20.99
    assert result["vx8"] == 22.775
    assert result["vx_front_spread"] == pytest.approx(1.5191)
    assert result["vx1_vx2_ratio"] == pytest.approx(0.927627)
    assert result["vx_curve_slope"] == pytest.approx(3.3041)
    assert result["contracts"][0] == {
        "expiration_date": "2026-05-19",
        "symbol": "VX/K6",
        "tenor": "vx1",
        "value": 19.4709,
    }
    assert all(not contract["symbol"].startswith("VXM") for contract in result["contracts"])
    assert all("VX19/" not in contract["symbol"] for contract in result["contracts"])


def test_main_writes_non_scoring_candidate_file(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    from scripts.shared import io as shared_io

    page = """
    <a href="https://www-api.cboe.com/us/futures/market_statistics/settlement/csv?dt=2026-05-11">
      Download this as CSV
    </a>
    """

    def fake_download_text(url: str) -> str:
        if url == mod.SETTLEMENT_PAGE_URL:
            return page
        if url == "https://www-api.cboe.com/us/futures/market_statistics/settlement/csv?dt=2026-05-11":
            return SETTLEMENT_CSV
        raise AssertionError(f"unexpected URL {url}")

    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    monkeypatch.setattr(mod, "download_text", fake_download_text)

    mod.main()

    out = tmp_path / "candidates" / "cboe_vx_settlement_candidate.json"
    payload = json.loads(out.read_text())
    assert payload["series_id"] == "cboe_vx_settlement_candidate"
    assert payload["source"] == "Cboe Futures Exchange"
    assert payload["access_status"] == "terms_review_needed"
    assert payload["score_status"] == "candidate"
    assert payload["active_scoring_allowed"] is False
    assert payload["public_redistribution_allowed"] is False
    assert payload["requires_secret"] is False
    assert payload["settlement_date"] == "2026-05-11"
    assert payload["observations"][0]["vx1"] == 19.4709
    assert payload["observations"][0]["vx_curve_slope"] == pytest.approx(3.3041)
