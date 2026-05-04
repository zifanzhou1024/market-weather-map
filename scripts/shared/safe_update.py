from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

from scripts.shared.io import utc_now_iso, write_json


def snapshot_tree(source: Path) -> Path:
    snapshot = Path(tempfile.mkdtemp(prefix="market-weather-map-data-"))
    if source.exists():
        shutil.copytree(source, snapshot / "data", dirs_exist_ok=True)
    else:
        (snapshot / "data").mkdir(parents=True)
    return snapshot


def restore_snapshot(snapshot: Path, target: Path) -> None:
    snapshot_data = snapshot / "data"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(snapshot_data, target, dirs_exist_ok=True)


def _read_existing_status(data_root: Path) -> dict[str, Any]:
    path = data_root / "status" / "data_status.json"
    if not path.exists():
        return {
            "generated_at_utc": None,
            "last_successful_update_utc": None,
            "overall_status": "failed",
            "series": {},
        }
    return json.loads(path.read_text(encoding="utf-8"))


def write_failed_update_status(data_root: Path, message: str, now: str | None = None) -> None:
    timestamp = now or utc_now_iso()
    status = _read_existing_status(data_root)
    status["generated_at_utc"] = timestamp
    status["last_attempt_utc"] = timestamp
    status["overall_status"] = "partial" if status.get("last_successful_update_utc") else "failed"
    status["update_status"] = "failed"
    status["update_message"] = message
    write_json(data_root / "status" / "data_status.json", status)
