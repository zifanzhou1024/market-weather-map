from __future__ import annotations

import runpy
import shutil
import traceback

from scripts.shared.io import data_dir
from scripts.shared.safe_update import restore_snapshot, snapshot_tree, write_failed_update_status


MODULES_INGEST_EXISTING = [
    "scripts.ingest.fetch_cboe",
    "scripts.ingest.fetch_fred_csv",
    "scripts.ingest.fetch_treasury",
    "scripts.ingest.fetch_cftc",
]

# Phase B / official-sources-agent appends entries here.
MODULES_INGEST_PHASE_B_OFFICIAL: list[str] = [
    "scripts.ingest.fetch_bea_personal_saving_rate",
    "scripts.ingest.fetch_shiller_cape",
    "scripts.ingest.fetch_nyfed_acm_term_premium",
]

# Phase B / cboe-candidate-agent appends entries here.
MODULES_INGEST_PHASE_B_CBOE: list[str] = []

# Phase B / sentiment-candidate-agent appends entries here.
MODULES_INGEST_PHASE_B_SENTIMENT: list[str] = []

# Phase C / tradingview-candidate-agent appends entries here.
MODULES_INGEST_PHASE_C_TRADINGVIEW: list[str] = [
    "scripts.ingest.fetch_tradingview_move",
    "scripts.ingest.fetch_tradingview_put_call",
    "scripts.ingest.fetch_tradingview_vix_term",
]

MODULES_TRANSFORM_EXISTING = [
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
]

# Phase B transform modules.
MODULES_TRANSFORM_PHASE_B: list[str] = [
    "scripts.transform.build_treasury_supply_pressure",
]

# Phase C transform modules.
MODULES_TRANSFORM_PHASE_C: list[str] = [
    "scripts.transform.build_tradingview_vix_term_metrics",
]

MODULES_VALIDATE = [
    "scripts.validate.validate_schema",
    "scripts.validate.validate_freshness",
    # Task A8 will make validate_schema transitively run validate_candidate_isolation
    # so a separate entry here is intentionally omitted.
]

MODULES = (
    MODULES_INGEST_EXISTING
    + MODULES_INGEST_PHASE_B_OFFICIAL
    + MODULES_INGEST_PHASE_B_CBOE
    + MODULES_INGEST_PHASE_B_SENTIMENT
    + MODULES_INGEST_PHASE_C_TRADINGVIEW
    + MODULES_TRANSFORM_EXISTING
    + MODULES_TRANSFORM_PHASE_B
    + MODULES_TRANSFORM_PHASE_C
    + MODULES_VALIDATE
)


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
