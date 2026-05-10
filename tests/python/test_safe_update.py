import importlib
import json
from pathlib import Path

import pytest

import scripts.update_data as update_data
import scripts.shared.safe_update as safe_update
from scripts.shared.safe_update import restore_snapshot, snapshot_tree, write_failed_update_status


def test_update_runner_modules_are_importable():
    for module in update_data.MODULES:
        importlib.import_module(module)


def test_update_runner_generates_macro_calendar_before_schema_validation():
    assert "scripts.generate_macro_calendar" in update_data.MODULES
    assert update_data.MODULES.index("scripts.generate_macro_calendar") < update_data.MODULES.index(
        "scripts.validate.validate_schema"
    )


def test_update_runner_includes_next_phase_dashboard_builders():
    """The four next-phase derived dashboards must run after their upstream
    inputs are generated and before schema validation so the validator
    catches malformed output rather than missing files."""
    expected_builders = [
        "scripts.transform.build_page_insights",
        "scripts.transform.build_volatility_dashboard",
        "scripts.transform.build_rates_dashboard",
        "scripts.transform.build_regime_dashboard",
    ]
    for module in expected_builders:
        assert module in update_data.MODULES, (
            f"Wave-1 builder {module} not wired into update_data.MODULES"
        )

    # page_insights must run AFTER signal_priority (its upstream input).
    assert update_data.MODULES.index(
        "scripts.transform.build_signal_priority"
    ) < update_data.MODULES.index("scripts.transform.build_page_insights")

    # All builders must run BEFORE schema validation.
    schema_idx = update_data.MODULES.index("scripts.validate.validate_schema")
    for module in expected_builders:
        assert update_data.MODULES.index(module) < schema_idx, (
            f"{module} runs after schema validation; validator can't catch bad output"
        )


def test_update_runner_safe_update_path_records_failure_when_dashboard_builder_fails(tmp_path, monkeypatch):
    """Simulate one of the new builders failing; the safe-update path must
    preserve prior good JSON and write a failure entry into data_status."""
    data_root = tmp_path / "public" / "data"
    status_dir = data_root / "status"
    status_dir.mkdir(parents=True)
    (status_dir / "data_status.json").write_text(
        json.dumps(
            {
                "generated_at_utc": "2026-05-02T00:00:00Z",
                "last_successful_update_utc": "2026-05-02T00:00:00Z",
                "overall_status": "ok",
                "series": {},
            }
        )
    )

    # Pre-existing (prior good) page_insights file.
    derived_dir = data_root / "derived"
    derived_dir.mkdir(parents=True)
    (derived_dir / "page_insights.json").write_text(
        '{"prior_good": true}'
    )

    monkeypatch.setattr(update_data, "data_dir", lambda: data_root)
    monkeypatch.setattr(
        update_data,
        "MODULES",
        ["scripts.transform.build_page_insights"],
    )

    def fail_module(module):
        raise RuntimeError(f"{module} failed")

    monkeypatch.setattr(update_data, "run_module", fail_module)

    assert update_data.main() == 1

    # Prior good JSON must be preserved.
    assert (
        derived_dir / "page_insights.json"
    ).read_text() == '{"prior_good": true}'

    # data_status.json must record the failure.
    payload = json.loads((status_dir / "data_status.json").read_text())
    assert payload["update_status"] == "failed"
    assert "build_page_insights" in payload["update_message"]


def test_restore_snapshot_preserves_prior_good_json(tmp_path):
    data_dir = tmp_path / "public" / "data"
    series_dir = data_dir / "series"
    series_dir.mkdir(parents=True)
    original = series_dir / "vix.json"
    original.write_text('{"series_id":"vix","observations":[{"date":"2026-05-01","value":16.0}]}\n')

    snapshot = snapshot_tree(data_dir)
    original.write_text('{"series_id":"vix","observations":[]}\n')

    restore_snapshot(snapshot, data_dir)

    assert '"value":16.0' in original.read_text()


def test_failed_update_status_keeps_last_successful_timestamp(tmp_path):
    data_dir = tmp_path / "public" / "data"
    status_dir = data_dir / "status"
    status_dir.mkdir(parents=True)
    status_path = status_dir / "data_status.json"
    status_path.write_text(
        json.dumps(
            {
                "generated_at_utc": "2026-05-02T00:00:00Z",
                "last_successful_update_utc": "2026-05-02T00:00:00Z",
                "overall_status": "ok",
                "series": {},
            }
        )
    )

    write_failed_update_status(data_dir, "provider timeout", now="2026-05-03T00:00:00Z")

    payload = json.loads(status_path.read_text())
    assert payload["generated_at_utc"] == "2026-05-03T00:00:00Z"
    assert payload["last_attempt_utc"] == "2026-05-03T00:00:00Z"
    assert payload["last_successful_update_utc"] == "2026-05-02T00:00:00Z"
    assert payload["overall_status"] == "partial"
    assert payload["update_status"] == "failed"
    assert payload["update_message"] == "provider timeout"


def test_restore_snapshot_raises_without_deleting_target_when_snapshot_data_missing(tmp_path):
    data_dir = tmp_path / "public" / "data"
    series_dir = data_dir / "series"
    series_dir.mkdir(parents=True)
    original = series_dir / "vix.json"
    original.write_text('{"series_id":"vix","observations":[{"date":"2026-05-01","value":16.0}]}\n')
    snapshot = tmp_path / "snapshot"
    snapshot.mkdir()

    with pytest.raises(FileNotFoundError):
        restore_snapshot(snapshot, data_dir)

    assert '"value":16.0' in original.read_text()


def test_restore_snapshot_keeps_target_when_replacement_copy_fails(tmp_path, monkeypatch):
    data_dir = tmp_path / "public" / "data"
    series_dir = data_dir / "series"
    series_dir.mkdir(parents=True)
    original = series_dir / "vix.json"
    original.write_text('{"series_id":"vix","observations":[{"date":"2026-05-01","value":16.0}]}\n')

    snapshot = tmp_path / "snapshot"
    snapshot_series_dir = snapshot / "data" / "series"
    snapshot_series_dir.mkdir(parents=True)
    (snapshot_series_dir / "vix.json").write_text('{"series_id":"vix","observations":[]}\n')

    def fail_copytree(*args, **kwargs):
        raise OSError("copy failed")

    monkeypatch.setattr(safe_update.shutil, "copytree", fail_copytree)

    with pytest.raises(OSError, match="copy failed"):
        restore_snapshot(snapshot, data_dir)

    assert '"value":16.0' in original.read_text()


def test_update_runner_returns_failure_status_and_cleans_snapshot(tmp_path, monkeypatch):
    data_root = tmp_path / "public" / "data"
    status_dir = data_root / "status"
    status_dir.mkdir(parents=True)
    (status_dir / "data_status.json").write_text(
        json.dumps(
            {
                "generated_at_utc": "2026-05-02T00:00:00Z",
                "last_successful_update_utc": "2026-05-02T00:00:00Z",
                "overall_status": "ok",
                "series": {},
            }
        )
    )

    snapshots = []
    original_snapshot_tree = update_data.snapshot_tree

    def tracked_snapshot_tree(source):
        snapshot = original_snapshot_tree(source)
        snapshots.append(snapshot)
        return snapshot

    def fail_module(module):
        raise RuntimeError(f"{module} failed")

    monkeypatch.setattr(update_data, "data_dir", lambda: data_root)
    monkeypatch.setattr(update_data, "MODULES", ["scripts.ingest.fetch_cftc"])
    monkeypatch.setattr(update_data, "snapshot_tree", tracked_snapshot_tree)
    monkeypatch.setattr(update_data, "run_module", fail_module)

    assert update_data.main() == 1

    payload = json.loads((status_dir / "data_status.json").read_text())
    assert payload["update_status"] == "failed"
    assert payload["update_message"] == "RuntimeError: scripts.ingest.fetch_cftc failed"
    assert snapshots
    assert not snapshots[0].exists()


def test_update_runner_converts_module_system_exit_to_failed_update(tmp_path, monkeypatch):
    data_root = tmp_path / "public" / "data"
    status_dir = data_root / "status"
    status_dir.mkdir(parents=True)
    (status_dir / "data_status.json").write_text(
        json.dumps(
            {
                "generated_at_utc": "2026-05-02T00:00:00Z",
                "last_successful_update_utc": "2026-05-02T00:00:00Z",
                "overall_status": "ok",
                "series": {},
            }
        )
    )

    monkeypatch.setattr(update_data, "data_dir", lambda: data_root)
    monkeypatch.setattr(update_data, "MODULES", ["scripts.validate.validate_freshness"])
    monkeypatch.setattr(update_data, "run_module", lambda module: (_ for _ in ()).throw(SystemExit("stale data")))

    assert update_data.main() == 1

    payload = json.loads((status_dir / "data_status.json").read_text())
    assert payload["update_status"] == "failed"
    assert payload["update_message"] == "SystemExit: stale data"
