"""Tests for scripts/transform/build_tradingview_vix_term_metrics.py."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.transform import build_tradingview_vix_term_metrics as mod


def _make_input_file(tmp_path: Path, observations: list[dict]) -> Path:
    candidates_dir = tmp_path / "candidates"
    candidates_dir.mkdir(exist_ok=True)
    path = candidates_dir / "tradingview_vix_term_candidate.json"
    payload = {
        "series_id": "tradingview_vix_term_candidate",
        "generated_at_utc": "2024-01-02T12:00:00+00:00",
        "source": "TradingView",
        "observations": observations,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# Test 1: skips when input file doesn't exist
# ---------------------------------------------------------------------------


def test_skips_when_input_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """When the input candidate file doesn't exist, transform exits without writing output."""
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir()

    mod.main()

    out = tmp_path / "candidates" / "tradingview_vix_term_metrics_candidate.json"
    assert not out.exists(), "Expected no output when input is missing"
    captured = capsys.readouterr()
    assert "skipping" in captured.err.lower() or "does not exist" in captured.err.lower()


# ---------------------------------------------------------------------------
# Test 2: computes metrics correctly for known input values
# ---------------------------------------------------------------------------


def test_computes_metrics_correctly(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Verify each metric formula against known VIX values."""
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)

    observations = [
        {
            "date": "2024-01-01",
            "vix9d": 16.89,
            "vix": 18.38,
            "vix3m": 21.24,
            "vix6m": 23.06,
            "vix1y": 23.99,
            "vvix": 98.06,
        },
        {
            "date": "2024-01-02",
            "vix9d": 15.00,
            "vix": 17.00,
            "vix3m": 20.00,
            "vix6m": 22.00,
            "vix1y": 24.00,
            "vvix": 95.00,
        },
    ]
    _make_input_file(tmp_path, observations)

    mod.main()

    out = tmp_path / "candidates" / "tradingview_vix_term_metrics_candidate.json"
    assert out.exists(), "Expected output metrics file"

    payload = json.loads(out.read_text())
    assert payload["series_id"] == "tradingview_vix_term_metrics_candidate"
    assert payload["access_status"] == "authenticated_candidate"
    assert payload["requires_secret"] is True
    assert payload["active_scoring_allowed"] is False
    assert payload["public_redistribution_allowed"] is False

    obs_list = payload["observations"]
    assert len(obs_list) == 2

    # Verify first observation (2024-01-01) formulas.
    obs = obs_list[0]
    assert obs["date"] == "2024-01-01"

    # vix_event_spread = vix9d - vix = 16.89 - 18.38 = -1.49
    assert abs(obs["vix_event_spread"] - (16.89 - 18.38)) < 1e-9
    # vix_front_spread = vix3m - vix = 21.24 - 18.38 = 2.86
    assert abs(obs["vix_front_spread"] - (21.24 - 18.38)) < 1e-9
    # vix_mid_curve_spread = vix6m - vix3m = 23.06 - 21.24 = 1.82
    assert abs(obs["vix_mid_curve_spread"] - (23.06 - 21.24)) < 1e-9
    # vix_long_curve_spread = vix1y - vix6m = 23.99 - 23.06 = 0.93
    assert abs(obs["vix_long_curve_spread"] - (23.99 - 23.06)) < 1e-9
    # vix_term_contango_score = (vix1y - vix) / max(vix, 1.0) = (23.99 - 18.38) / 18.38
    expected_contango = (23.99 - 18.38) / max(18.38, 1.0)
    assert abs(obs["vix_term_contango_score"] - expected_contango) < 1e-9

    # Verify second observation.
    obs2 = obs_list[1]
    assert obs2["date"] == "2024-01-02"
    assert abs(obs2["vix_event_spread"] - (15.00 - 17.00)) < 1e-9
    assert abs(obs2["vix_front_spread"] - (20.00 - 17.00)) < 1e-9
    assert abs(obs2["vix_mid_curve_spread"] - (22.00 - 20.00)) < 1e-9
    assert abs(obs2["vix_long_curve_spread"] - (24.00 - 22.00)) < 1e-9
    expected_contango2 = (24.00 - 17.00) / max(17.00, 1.0)
    assert abs(obs2["vix_term_contango_score"] - expected_contango2) < 1e-9


# ---------------------------------------------------------------------------
# Test 3: handles vix=0 in contango_score denominator (max guard)
# ---------------------------------------------------------------------------


def test_handles_zero_vix_in_score_denominator(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """When vix=0 (impossible in practice), denominator clamps to max(vix, 1.0)=1.0."""
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)

    observations = [
        {
            "date": "2024-01-01",
            "vix9d": 0.5,
            "vix": 0.0,
            "vix3m": 1.0,
            "vix6m": 2.0,
            "vix1y": 3.0,
            "vvix": 50.0,
        },
    ]
    _make_input_file(tmp_path, observations)

    mod.main()

    out = tmp_path / "candidates" / "tradingview_vix_term_metrics_candidate.json"
    assert out.exists(), "Expected output file even when vix=0"

    payload = json.loads(out.read_text())
    obs_list = payload["observations"]
    assert len(obs_list) == 1

    obs = obs_list[0]
    # contango_score = (vix1y - vix) / max(vix, 1.0) = (3.0 - 0.0) / 1.0 = 3.0
    assert abs(obs["vix_term_contango_score"] - 3.0) < 1e-9
    # Ensure no ZeroDivisionError; computation completes normally.
    assert isinstance(obs["vix_term_contango_score"], float)
