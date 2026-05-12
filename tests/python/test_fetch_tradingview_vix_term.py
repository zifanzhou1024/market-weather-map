"""Tests for scripts/ingest/fetch_tradingview_vix_term.py.

All tests mock _build_tv_client so no live network call is made.
Canary credential strings are the ones allowlisted in test_secrets_isolation.py.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from scripts.ingest import fetch_tradingview_vix_term as mod


def _enable_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user-token-abc123")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass-token-xyz789")


def _make_fake_df(dates: list[str], close: float) -> pd.DataFrame:
    return pd.DataFrame(
        {"close": [close] * len(dates)},
        index=pd.to_datetime(dates),
    )


# ---------------------------------------------------------------------------
# Test 1: skips gracefully when secrets/feature-flag are absent
# ---------------------------------------------------------------------------


def test_skips_when_secrets_disabled(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """main() prints a skip notice and returns without writing any file."""
    monkeypatch.delenv("ENABLE_AUTHENTICATED_CANDIDATES", raising=False)
    monkeypatch.delenv("TRADINGVIEW_USERNAME", raising=False)
    monkeypatch.delenv("TRADINGVIEW_PASSWORD", raising=False)
    mod.main()
    captured = capsys.readouterr()
    assert "skipping" in captured.out.lower()


# ---------------------------------------------------------------------------
# Test 2: writes a well-formed candidate JSON on success (all 6 series)
# ---------------------------------------------------------------------------


def test_writes_candidate_file_on_success(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    """main() writes tradingview_vix_term_candidate.json with correct shape."""
    _enable_secrets(monkeypatch)

    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir()

    dates = ["2024-01-01", "2024-01-02"]
    # Each call to get_hist returns close values matching the symbol order.
    symbol_closes = {
        "VIX9D": 16.89,
        "VIX": 18.38,
        "VIX3M": 21.24,
        "VIX6M": 23.06,
        "VIX1Y": 23.99,
        "VVIX": 98.06,
    }

    fake_tv = MagicMock()

    def get_hist_side_effect(symbol, exchange, interval, n_bars):
        return _make_fake_df(dates, symbol_closes[symbol])

    fake_tv.get_hist.side_effect = get_hist_side_effect

    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()

    out = tmp_path / "candidates" / "tradingview_vix_term_candidate.json"
    assert out.exists(), "Expected candidate JSON not written"

    payload = json.loads(out.read_text())
    assert payload["series_id"] == "tradingview_vix_term_candidate"
    assert payload["access_status"] == "authenticated_candidate"
    assert payload["requires_secret"] is True
    assert payload["active_scoring_allowed"] is False
    assert payload["public_redistribution_allowed"] is False

    symbol_keys = payload["symbol_keys"]
    assert set(symbol_keys) == {"vix9d", "vix", "vix3m", "vix6m", "vix1y", "vvix"}

    observations = payload["observations"]
    assert len(observations) == 2
    # Each observation must have all 6 series keys plus date.
    for obs in observations:
        assert "date" in obs
        for key in symbol_keys:
            assert key in obs
            assert isinstance(obs[key], float)


# ---------------------------------------------------------------------------
# Test 3: credential values never appear in stdout/stderr on error
# ---------------------------------------------------------------------------


def test_scrubs_credentials_from_error(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """When a series fetch raises, the exception message is scrubbed before printing."""
    _enable_secrets(monkeypatch)

    fake_tv = MagicMock()
    fake_tv.get_hist.side_effect = RuntimeError(
        "login failed for fake-user-token-abc123"
    )

    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()

    captured = capsys.readouterr()
    assert "fake-user-token-abc123" not in captured.out
    assert "fake-user-token-abc123" not in captured.err
    assert "fake-pass-token-xyz789" not in captured.out
    assert "fake-pass-token-xyz789" not in captured.err


# ---------------------------------------------------------------------------
# Test 4: partial series failure — 2 of 6 raise, 4 succeed; file still written
# ---------------------------------------------------------------------------


def test_handles_partial_series_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    """When 2 of 6 series fail, main() writes output with the 4 successful series."""
    _enable_secrets(monkeypatch)

    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir()

    dates = ["2024-01-01", "2024-01-02"]
    # VIX6M and VVIX will fail; the other 4 succeed.
    failing_symbols = {"VIX6M", "VVIX"}

    fake_tv = MagicMock()

    def get_hist_side_effect(symbol, exchange, interval, n_bars):
        if symbol in failing_symbols:
            raise RuntimeError(f"network error fetching {symbol}")
        return _make_fake_df(dates, 20.0)

    fake_tv.get_hist.side_effect = get_hist_side_effect

    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()

    out = tmp_path / "candidates" / "tradingview_vix_term_candidate.json"
    assert out.exists(), "Expected candidate JSON even with partial failure"

    payload = json.loads(out.read_text())
    symbol_keys = set(payload["symbol_keys"])
    # Failed symbols should not appear.
    assert "vix6m" not in symbol_keys
    assert "vvix" not in symbol_keys
    # Successful symbols should appear.
    assert {"vix9d", "vix", "vix3m", "vix1y"} <= symbol_keys

    observations = payload["observations"]
    assert len(observations) == 2
    for obs in observations:
        assert "date" in obs
        for key in symbol_keys:
            assert key in obs


# ---------------------------------------------------------------------------
# Test 5: all series empty — no file written, no crash
# ---------------------------------------------------------------------------


def test_handles_all_series_empty(
    monkeypatch: pytest.MonkeyPatch, tmp_path, capsys: pytest.CaptureFixture[str]
) -> None:
    """When all 6 get_hist calls return empty DataFrames, main() exits without writing."""
    _enable_secrets(monkeypatch)

    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir()

    fake_tv = MagicMock()
    fake_tv.get_hist.return_value = pd.DataFrame()

    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()

    out = tmp_path / "candidates" / "tradingview_vix_term_candidate.json"
    assert not out.exists(), "Expected no output file when all DataFrames are empty"
    captured = capsys.readouterr()
    # Should print some failure indication.
    assert "abort" in captured.err.lower() or "skipping" in captured.err.lower() or "failed" in captured.err.lower()
