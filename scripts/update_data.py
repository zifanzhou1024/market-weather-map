from __future__ import annotations

import runpy
import shutil
import traceback

from scripts.shared.io import data_dir
from scripts.shared.safe_update import restore_snapshot, snapshot_tree, write_failed_update_status


MODULES = [
    "scripts.ingest.fetch_cboe",
    "scripts.ingest.fetch_fred_csv",
    "scripts.ingest.fetch_cftc",
    "scripts.transform.normalize_series",
    "scripts.transform.compute_percentiles",
    "scripts.transform.compute_regime_score",
    "scripts.transform.build_signal_priority",
    "scripts.generate_macro_calendar",
    "scripts.validate.validate_schema",
    "scripts.validate.validate_freshness",
]


def run_module(module: str) -> None:
    runpy.run_module(module, run_name="__main__")


def main() -> int:
    root = data_dir()
    snapshot = snapshot_tree(root)
    try:
        for module in MODULES:
            run_module(module)
        return 0
    except SystemExit as error:
        if error.code in {0, None}:
            return 0
        restore_snapshot(snapshot, root)
        message = f"{type(error).__name__}: {error}"
        write_failed_update_status(root, message)
        traceback.print_exc()
        return 1
    except Exception as error:
        restore_snapshot(snapshot, root)
        message = f"{type(error).__name__}: {error}"
        write_failed_update_status(root, message)
        traceback.print_exc()
        return 1
    finally:
        shutil.rmtree(snapshot, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
