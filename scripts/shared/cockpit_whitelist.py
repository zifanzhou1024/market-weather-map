"""Cockpit whitelist + display config.

The cockpit roster is intentionally Python (not JSON) so entries can carry
default-factory lists and so the type system enforces shape at import time.
Every entry must map to a series that exists in `scripts/shared/catalog.py`
(test_cockpit_whitelist enforces this) and that is `free_public_active`
or `proxy_only` (test_validate_cockpit_schema enforces this on output).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Direction = Literal["risk", "support", "neutral"]


@dataclass(frozen=True)
class CockpitSecondaryLine:
    label: str
    series_id: str
    unit: str = ""
    decimals: int = 1
    value_scale: float = 1.0
    """Same semantics as CockpitSignal.value_scale, for secondary chips."""

    value_transform: str | None = None
    """Same semantics as CockpitSignal.value_transform, for secondary chips."""


@dataclass(frozen=True)
class CockpitSignal:
    id: str
    priority_key: str
    display_label: str
    primary_series_id: str
    secondary_lines: tuple[CockpitSecondaryLine, ...] = field(default_factory=tuple)
    primary_unit: str = ""
    primary_decimals: int = 1
    direction: Direction = "risk"
    importance: int = 3
    why_it_matters: str = ""
    value_scale: float = 1.0
    """Multiplier applied to primary_value, deltas, and sparkline.

    Example: 100 for FRED OAS series that arrive in percent but should
    display as basis points; 0.001 for raw counts that should display
    as thousands. 1.0 means no scaling.
    """

    value_transform: str | None = None
    """Named transform applied to the series before scaling.

    Currently supported:
      - 'yoy_pct' : (value[T] - value[T-12mo]) / value[T-12mo] * 100,
                    computed per-observation. Used to convert raw index
                    series (e.g. CPILFESL) into year-over-year percent.

    None means no transform (raw values used as-is).
    """


# Source-of-truth for regime labels: src/lib/types.ts (ScoreBlock['label'] union).
# Keep keys in sync; this is enforced by test_regime_tone_map_covers_known_regime_labels.
REGIME_TONE_MAP: dict[str, str] = {
    "Goldilocks": "positive",
    "Reflation": "positive",
    "Stagflation Pressure": "negative",
    "Risk-Off": "negative",
    "Disinflationary Slowdown": "negative",
    "Crowded Calm": "neutral",
    "Credit Stress": "negative",
    "Liquidity Stress": "negative",
}


COCKPIT_WHITELIST: tuple[CockpitSignal, ...] = (
    CockpitSignal(
        id="vix_complex",
        priority_key="vix_complex",
        display_label="VIX",
        primary_series_id="vix",
        secondary_lines=(
            CockpitSecondaryLine(label="VIX9D", series_id="vix9d"),
            CockpitSecondaryLine(label="VIX3M", series_id="vix3m"),
        ),
        primary_decimals=1,
        direction="risk",
        importance=5,
    ),
    CockpitSignal(
        id="us10y",
        priority_key="real_yields",  # piggybacks on rates pressure group
        display_label="US 10Y",
        primary_series_id="us10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="real_yields",
        priority_key="real_yields",
        display_label="10Y Real Yield",
        primary_series_id="real_yield_10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=5,
    ),
    CockpitSignal(
        id="credit_spreads",
        priority_key="credit_spreads",
        display_label="HY OAS",
        primary_series_id="high_yield_oas",
        primary_unit=" bp",
        primary_decimals=0,
        direction="risk",
        importance=5,
        value_scale=100.0,  # FRED BAMLH0A0HYM2 arrives in percent; display in bp
    ),
    CockpitSignal(
        id="ig_spreads",
        priority_key="credit_spreads",
        display_label="IG OAS",
        primary_series_id="investment_grade_oas",
        primary_unit=" bp",
        primary_decimals=0,
        direction="risk",
        importance=4,
        value_scale=100.0,  # FRED BAMLC0A0CM arrives in percent; display in bp
    ),
    CockpitSignal(
        id="broad_dollar",
        priority_key="broad_dollar",
        display_label="Broad USD",
        primary_series_id="broad_dollar",
        primary_decimals=1,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="wti_crude",
        priority_key="commodities_inflation_impulse",
        display_label="WTI Crude",
        primary_series_id="wti_crude",
        primary_unit="$",
        primary_decimals=1,
        direction="risk",
        importance=3,
    ),
    CockpitSignal(
        id="inflation",
        priority_key="inflation",
        display_label="Core CPI YoY",
        primary_series_id="core_cpi",
        secondary_lines=(
            CockpitSecondaryLine(
                label="Core PCE",
                series_id="core_pce",
                unit="% YoY",
                value_transform="yoy_pct",
            ),
        ),
        primary_unit="% YoY",
        primary_decimals=1,
        direction="risk",
        importance=5,
        value_transform="yoy_pct",  # CPILFESL arrives as raw index; compute YoY%
    ),
    CockpitSignal(
        id="labor_claims",
        priority_key="labor",
        display_label="Initial Claims",
        primary_series_id="initial_claims",
        primary_unit="k",
        primary_decimals=0,
        direction="support",
        importance=4,
        value_scale=0.001,  # FRED ICSA arrives as raw count; display in thousands
    ),
    CockpitSignal(
        id="payrolls",
        priority_key="labor",
        display_label="Nonfarm Payrolls",
        primary_series_id="nonfarm_payrolls",
        primary_unit="k",
        primary_decimals=0,
        direction="support",
        importance=4,
    ),
    CockpitSignal(
        id="sp500_positioning",
        priority_key="sentiment_positioning",
        display_label="SP500 Lev-Money",
        primary_series_id="cftc_sp500_lev_money_net",
        primary_unit="",
        primary_decimals=0,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="term_premium",
        priority_key="real_yields",
        display_label="10Y Term Premium",
        primary_series_id="term_premium_acm_10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=3,
    ),
    CockpitSignal(
        id="breakeven_10y",
        priority_key="inflation",
        display_label="10Y Breakeven",
        primary_series_id="breakeven_10y",
        primary_unit="%",
        primary_decimals=2,
        direction="risk",
        importance=4,
    ),
    CockpitSignal(
        id="yield_curve",
        priority_key="real_yields",
        display_label="10Y−2Y",
        primary_series_id="us10y_minus_us2y",
        primary_unit=" bp",
        primary_decimals=0,
        direction="risk",
        importance=4,
        value_scale=100.0,  # us10y_minus_us2y is in percentage points; display in bp
    ),
    CockpitSignal(
        id="net_liquidity",
        priority_key="net_liquidity",
        display_label="Net Liquidity",
        primary_series_id="net_liquidity",
        primary_unit=" T",
        primary_decimals=1,
        direction="support",
        importance=4,
    ),
)
