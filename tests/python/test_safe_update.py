import json
from pathlib import Path

from scripts.shared.safe_update import restore_snapshot, snapshot_tree, write_failed_update_status


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
