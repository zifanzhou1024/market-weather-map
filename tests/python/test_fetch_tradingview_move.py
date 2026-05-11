"""Tests for scripts/ingest/fetch_tradingview_move.py.

All tests mock _build_tv_client so no live network call is made.
Canary credential strings are the ones allowlisted in test_secrets_isolation.py.
"""
from __future__ import annotations

import json
import os
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from scripts.ingest import fetch_tradingview_move as mod


def _enable_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user-token-abc123")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass-token-xyz789")


# ---------------------------------------------------------------------------
# Test 1: skips gracefully when secrets/feature-flag are absent
# ---------------------------------------------------------------------------


def test_skips_when_secrets_disabled(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    """main() prints a skip notice and returns without writing any file."""
    monkeypatch.delenv("ENABLE_AUTHENTICATED_CANDIDATES", raising=False)
    monkeypatch.delenv("TRADINGVIEW_USERNAME", raising=False)
    monkeypatch.delenv("TRADINGVIEW_PASSWORD", raising=False)
    mod.main()
    captured = capsys.readouterr()
    assert "skipping" in captured.out.lower()


# ---------------------------------------------------------------------------
# Test 2: writes a well-formed candidate JSON on success
# ---------------------------------------------------------------------------


def test_writes_candidate_file_on_success(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    """main() writes tradingview_move_candidate.json with correct shape."""
    _enable_secrets(monkeypatch)

    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir()

    fake_df = pd.DataFrame(
        {"close": [120.0, 121.5]},
        index=pd.to_datetime(["2024-01-01", "2024-01-02"]),
    )
    fake_tv = MagicMock()
    fake_tv.get_hist.return_value = fake_df

    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()

    out = tmp_path / "candidates" / "tradingview_move_candidate.json"
    assert out.exists(), "Expected candidate JSON not written"

    payload = json.loads(out.read_text())
    assert payload["series_id"] == "tradingview_move_candidate"
    assert payload["access_status"] == "authenticated_candidate"
    assert payload["requires_secret"] is True
    assert payload["active_scoring_allowed"] is False
    assert payload["public_redistribution_allowed"] is False
    assert len(payload["observations"]) == 2
    assert payload["observations"][0] == {"date": "2024-01-01", "value": 120.0}
    assert payload["observations"][1] == {"date": "2024-01-02", "value": 121.5}


# ---------------------------------------------------------------------------
# Test 3: credential values never appear in stdout/stderr on error
# ---------------------------------------------------------------------------


def test_scrubs_credentials_from_error(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """When the TV client raises, the exception message is scrubbed before printing."""
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
# Test 4: empty DataFrame is handled gracefully (no file written, no crash)
# ---------------------------------------------------------------------------


def test_handles_empty_dataframe(
    monkeypatch: pytest.MonkeyPatch, tmp_path, capsys: pytest.CaptureFixture[str]
) -> None:
    """When get_hist returns an empty DataFrame, main() exits without writing."""
    _enable_secrets(monkeypatch)

    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir()

    fake_tv = MagicMock()
    fake_tv.get_hist.return_value = pd.DataFrame()

    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()

    out = tmp_path / "candidates" / "tradingview_move_candidate.json"
    assert not out.exists(), "Expected no output file when DataFrame is empty"
    captured = capsys.readouterr()
    assert "skipping" in captured.err.lower() or "empty" in captured.err.lower()
