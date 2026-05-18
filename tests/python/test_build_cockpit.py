import json
from pathlib import Path

import pytest

from scripts.transform._cockpit_inputs import (
    load_signal_priority_index,
    load_series_observations,
)


@pytest.fixture
def sample_signal_priority(tmp_path):
    payload = {
        "top_warnings": [
            {"id": "inflation", "priority": 495.0, "importance": 5,
             "why_it_matters": "Inflation drives Fed policy."},
        ],
        "top_supports": [
            {"id": "credit_spreads", "priority": 359.0, "importance": 5,
             "why_it_matters": "Credit confirms stress."},
        ],
        "missing_high_value_signals": [],
        "overall_read": {},
    }
    path = tmp_path / "signal_priority.json"
    path.write_text(json.dumps(payload))
    return path


def test_load_signal_priority_index_merges_warnings_and_supports(sample_signal_priority):
    index = load_signal_priority_index(sample_signal_priority)
    assert "inflation" in index
    assert "credit_spreads" in index
    assert index["inflation"]["priority"] == 495.0


def test_load_signal_priority_index_missing_file_returns_empty(tmp_path):
    index = load_signal_priority_index(tmp_path / "nope.json")
    assert index == {}


def test_load_series_observations_returns_sorted_pairs(tmp_path):
    payload = {
        "observations": [
            {"date": "2026-05-15", "value": 3.2},
            {"date": "2026-05-14", "value": 3.1},
            {"date": "2026-05-13", "value": 3.0},
        ]
    }
    path = tmp_path / "core_cpi.json"
    path.write_text(json.dumps(payload))
    obs = load_series_observations(path)
    assert [o["value"] for o in obs] == [3.0, 3.1, 3.2]


def test_load_series_observations_missing_file_returns_none(tmp_path):
    assert load_series_observations(tmp_path / "nope.json") is None
