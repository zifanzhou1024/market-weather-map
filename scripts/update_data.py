from __future__ import annotations

import runpy
import shutil
import traceback

from scripts.shared.io import data_dir
from scripts.shared.safe_update import restore_snapshot, snapshot_tree, write_failed_update_status


MODULES = [
    "scripts.ingest.fetch_cboe",
    "scripts.ingest.fetch_fred_csv",
    "scripts.ingest.fetch_treasury",
    "scripts.ingest.fetch_cftc",
    "scripts.transform.normalize_series",
    "scripts.transform.compute_percentiles",
    "scripts.transform.compute_regime_score",
    "scripts.transform.build_signal_priority",
    # Wave-1 derived dashboards (consume signal_priority + series). Run
    # after upstream data is generated so the safe-update path preserves
    # prior good JSON if any builder fails. Run BEFORE schema validation
    # so malformed output is caught by the gate.
    "scripts.transform.build_page_insights",
    "scripts.transform.build_volatility_dashboard",
    "scripts.transform.build_rates_dashboard",
    "scripts.transform.build_regime_dashboard",
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
