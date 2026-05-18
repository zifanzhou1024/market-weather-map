"""Build the per-route ``page_insights.json`` snapshot.

Reads ``signal_priority.json`` (already produced by
``scripts.transform.build_signal_priority``) and projects its ranked
warnings/supports onto twelve canonical route keys consumed by the new
``PageInsightHero`` component.

For each route, the highest-priority risk signal becomes
``primary_warning`` and the highest-priority support signal becomes
``primary_support``. Candidate-class signals are excluded from primary
slots via :func:`is_active_scoring_allowed` — gating is the project's
strongest invariant and the same predicate runs upstream in
``build_signal_priority``.

Tone is descriptive only; the ``why_it_matters`` text comes verbatim
from the underlying ranked signal so it inherits the existing tone
review.

The ``SECTION_CATALOG`` constant maps each section's route key to a
``SectionTemplate``. Each template carries static question text and a
``derive`` callable that reads the ``loaded_data_bundle`` dict to produce
dynamic answer/why/risk/support/caveat/freshness_status fields. Routes
that appear in SECTION_CATALOG are always included in the output even if
they carry no ranked signals, so the ``sections`` array is always present
for FocusBlock placements. Twelve placements ship: Volatility, Rates,
Regime map, Sentiment, Tactical, Liquidity, Credit, Dollar / Global,
Commodities, Growth, Housing, Inflation.
"""
from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any, Callable, TypedDict

from scripts.shared.access_status import is_active_scoring_allowed
from scripts.shared.io import data_dir, utc_now_iso, write_json


METHOD_VERSION = "phase8-pr1-page-insights-v1"

# Severity threshold above which a support-only route is labelled
# "support" rather than "calm". Severity in this project is the absolute
# bucket score, scaled 0..100 (see build_signal_priority._build_signal);
# 25 corresponds to the "meaningful but below elevated" band where the
# support is strong enough to call out rather than ambient noise.
SUPPORT_STATE_THRESHOLD = 25.0

# Thirteen canonical routes consumed by PageInsightHero.
# "tactical" is added alongside the original twelve to support the
# TacticalTradingWeather route's FocusBlock placement (D3/D4 PRs).
ROUTE_KEYS: tuple[str, ...] = (
    "rates",
    "volatility",
    "regime_map",
    "credit",
    "liquidity",
    "dollar_global",
    "commodities",
    "inflation",
    "growth",
    "housing",
    "sentiment",
    "fragility",
    "tactical",
)

ROUTE_TITLES: dict[str, str] = {
    "rates": "Rates",
    "volatility": "Volatility",
    "regime_map": "Regime map",
    "credit": "Credit",
    "liquidity": "Liquidity",
    "dollar_global": "Dollar / Global",
    "commodities": "Commodities",
    "inflation": "Inflation",
    "growth": "Growth",
    "housing": "Housing",
    "sentiment": "Sentiment",
    "fragility": "Fragility / shock risk",
    "tactical": "Tactical trading weather",
}

# Macro-category signals are routed by signal id since the "macro" category
# umbrella spans growth, inflation, housing, commodities, consumer balance
# sheet, etc. The same id may map to multiple routes (e.g. labor goes to
# growth as the strategic backdrop).
MACRO_ID_TO_ROUTES: dict[str, tuple[str, ...]] = {
    "inflation": ("inflation",),
    "growth": ("growth",),
    "labor": ("growth",),
    "consumer_balance_sheet": ("growth",),
    "commodities_inflation_impulse": ("commodities",),
}

# Non-macro categories map to a tuple of routes (a category can surface in
# more than one route, e.g. volatility surfaces in both Volatility and
# Fragility, which observes the volatility complex as part of shock risk).
CATEGORY_TO_ROUTES: dict[str, tuple[str, ...]] = {
    "volatility": ("volatility", "fragility"),
    "rates": ("rates",),
    "credit": ("credit",),
    "liquidity": ("liquidity",),
    "dollar": ("dollar_global",),
    "positioning": ("sentiment",),
    # event signals don't map to any single-domain route
    "event": (),
}

# Default why_it_matters per route, used when no warning/support is present
# but freshness data still warrants the route surfacing.
DEFAULT_WHY_IT_MATTERS: dict[str, str] = {
    "rates": "Rates set the discount-rate backdrop for valuations.",
    "volatility": "Implied volatility frames near-term hedging pressure.",
    "regime_map": "The regime quadrant blends rates, dollar and risk inputs.",
    "credit": "Credit spreads confirm whether stress is spreading beyond equities.",
    "liquidity": "Net liquidity defines the funding backdrop for risk assets.",
    "dollar_global": "Dollar moves transmit global liquidity and risk-off pressure.",
    "commodities": "Commodity prices feed inflation expectations and rates.",
    "inflation": "Inflation trajectory drives Fed policy expectations.",
    "growth": "Growth conditions set the strategic backdrop for risk assets.",
    "housing": "Housing turnover signals consumer balance-sheet pressure.",
    "sentiment": "Positioning extremes amplify drawdowns when sentiment turns.",
    "fragility": "Tail-risk fragility captures cross-asset stress build-up.",
    "tactical": "Short-term tactical signals track the immediate risk posture across asset classes.",
}

MISSING_HIGH_VALUE_SIGNAL_NOTES: dict[str, str] = {
    "move_index": "MOVE official unavailable; TradingView candidate gated.",
    "skew_index": "Cboe SKEW source gated; no implemented candidate.",
    "vx_futures_curve": (
        "VX futures curve source-gated; Cboe settlement candidate is non-scoring "
        "until redistribution review approves publication."
    ),
}


# ---------------------------------------------------------------------------
# Section catalog — FocusBlock data layer (D2)
# ---------------------------------------------------------------------------

class SectionTemplate(TypedDict, total=False):
    id: str
    eyebrow: str
    question: str
    derive: Callable[[dict], dict]  # returns answer/why/risk/support/caveat/freshness_status


def _derive_volatility_complex(loaded: dict) -> dict:
    """Read volatility_dashboard.json and build the section's dynamic fields.

    Branches on the latest hidden_stress state (calm / watch / elevated).
    Questions explore VVIX-vs-VIX divergence — distinct from the route's
    why_it_matters which focuses on VIX curve backwardation.
    """
    vol = loaded.get("volatility_dashboard")
    if vol is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    curve = vol.get("latest_curve", [])
    hidden = vol.get("hidden_stress", [])
    latest_hidden = hidden[-1] if hidden else None
    if not curve or latest_hidden is None:
        return {
            "answer": "Data partially loaded; awaiting full volatility dashboard.",
            "freshness_status": "stale",
        }
    state = latest_hidden.get("state", "calm")
    answer_map = {
        "calm": "Volatility term structure remains contained and short-end stress is muted.",
        "watch": "Term structure remains contained but VVIX-vs-VIX divergence suggests hidden options stress is building.",
        "elevated": "Hidden options stress is elevated while headline VIX still understates the move.",
    }
    return {
        "answer": answer_map.get(state, answer_map["calm"]),
        "why": "Term-structure inversion and VVIX-vs-VIX divergence are leading indicators ahead of headline VIX.",
        "risk": "VVIX percentile is above VIX percentile" if state in {"watch", "elevated"} else None,
        "support": "Front-end percentile remains in normal range" if state == "calm" else None,
        "caveat": "Volatility indices are delayed Cboe public data; intraday moves not reflected.",
        "freshness_status": "ok",
    }


def _derive_rates_pressure(loaded: dict) -> dict:
    """Read rates_dashboard.json and determine whether the 1M 10Y move is
    driven by real yields, breakevens, or is balanced.

    Questions explore the decomposition of recent rate moves — distinct from
    the route's why_it_matters which focuses on the level of real yields.
    """
    rates = loaded.get("rates_dashboard")
    if rates is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    windows = rates.get("yield_change_windows")
    decomp = rates.get("current_decomposition")
    if not windows or not decomp:
        return {
            "answer": "Rates decomposition data partially loaded.",
            "freshness_status": "stale",
        }
    # Use the 1M window as the primary reference for the recent move.
    one_month = windows.get("1M", {})
    driver = one_month.get("driver", "balanced")
    nominal_bps = one_month.get("nominal_10y_bps", 0.0)
    real_bps = one_month.get("real_yield_10y_bps", 0.0)
    breakeven_bps = one_month.get("breakeven_10y_bps", 0.0)

    direction = "higher" if nominal_bps >= 0 else "lower"

    if driver == "real_yield":
        answer = (
            f"The recent 10Y move ({direction}) is driven by real yields "
            f"({real_bps:+.0f} bps), not inflation expectations."
        )
        why = "Real-yield-driven moves tighten financial conditions more directly than inflation-driven moves."
        risk = "Rising real yields compress equity valuations across all sectors." if real_bps > 0 else None
        support = "Falling real yields ease discount-rate pressure on growth assets." if real_bps < 0 else None
    elif driver == "breakeven":
        answer = (
            f"The recent 10Y move ({direction}) is driven by inflation breakevens "
            f"({breakeven_bps:+.0f} bps), not real yields."
        )
        why = "Breakeven-driven moves signal changing inflation expectations rather than Fed policy tightening."
        risk = "Rising breakevens may accelerate Fed hawkishness expectations." if breakeven_bps > 0 else None
        support = "Falling breakevens suggest inflation pressure is easing." if breakeven_bps < 0 else None
    else:
        answer = (
            f"The recent 10Y move ({direction}) reflects both real yields "
            f"({real_bps:+.0f} bps) and breakevens ({breakeven_bps:+.0f} bps)."
        )
        why = "Balanced moves suggest broad repricing of both growth and inflation expectations."
        risk = "Simultaneous rise in both components narrows the room for risk-asset relief." if nominal_bps > 0 else None
        support = "Broad declines in both components ease cross-asset discount-rate pressure." if nominal_bps < 0 else None

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "Decomposition uses FRED TIPS and nominal yields; intraday moves not reflected.",
        "freshness_status": "ok",
    }


def _derive_regime_drivers(loaded: dict) -> dict:
    """Read regime_dashboard.json and characterise whether real yields and
    the dollar are jointly tightening or easing financial conditions.

    Uses the 20D window as the most recent short-term read.
    Questions focus on the joint direction of real yields and dollar —
    distinct from the route's why_it_matters which describes the regime quadrant.
    """
    regime = loaded.get("regime_dashboard")
    if regime is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    windows = regime.get("windows", {})
    thresholds = regime.get("thresholds", {})
    short_window = windows.get("20D", [])
    if not short_window:
        return {
            "answer": "Regime driver data partially loaded.",
            "freshness_status": "stale",
        }
    latest = short_window[-1]
    real_yield_chg = float(latest.get("real_yield_change_bps", 0.0))
    dollar_chg = float(latest.get("dollar_change_pct", 0.0))
    ry_threshold = float(thresholds.get("real_yield_neutral_bps", 5.0))
    usd_threshold = float(thresholds.get("dollar_neutral_pct", 0.5))

    ry_rising = real_yield_chg > ry_threshold
    ry_falling = real_yield_chg < -ry_threshold
    usd_rising = dollar_chg > usd_threshold
    usd_falling = dollar_chg < -usd_threshold

    if ry_rising and usd_rising:
        answer = (
            "Both real yields and the dollar are rising over the short window, "
            "creating a joint tightening of global financial conditions."
        )
        why = "When real yields and the dollar rise together, cross-asset liquidity tightens via both the discount rate and dollar funding."
        risk = "Dual tightening historically pressures EM assets and credit spreads simultaneously."
        support = None
    elif ry_falling and usd_falling:
        answer = (
            "Both real yields and the dollar are declining over the short window, "
            "easing financial conditions from two directions."
        )
        why = "Falling real yields and a weaker dollar together ease discount-rate and dollar-funding pressure."
        risk = None
        support = "Dual easing can support risk assets and relieve EM funding stress."
    elif ry_rising and usd_falling:
        answer = (
            "Real yields are rising while the dollar is falling, a diverging signal "
            "that points to reflationary or growth-driven repricing."
        )
        why = "A weaker dollar partly offsets rising real yields; net tightening impact depends on which force dominates."
        risk = "Rising real yields still weigh on duration-sensitive assets despite dollar relief."
        support = None
    elif ry_falling and usd_rising:
        answer = (
            "Real yields are falling while the dollar is rising, a diverging signal "
            "consistent with a safe-haven or growth-scare environment."
        )
        why = "Dollar strength alongside falling real yields often reflects flight to Treasuries, which compresses yields while demand for dollars rises."
        risk = "Dollar strength tightens global financial conditions even as domestic real yields fall."
        support = None
    else:
        answer = (
            "Real yield and dollar moves are within neutral thresholds over the short window; "
            "no dominant directional driver is evident."
        )
        why = "Neutral short-window readings suggest the regime is consolidating rather than trending."
        risk = None
        support = "Absence of a dominant tightening impulse leaves conditions in a holding pattern."

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "20D window uses closing prices; intraday volatility and FX moves not captured.",
        "freshness_status": "ok",
    }


def _derive_positioning(loaded: dict) -> dict:
    """Read CFTC asset-manager positioning (always present) and optionally
    NAAIM exposure (candidate — may be absent).

    Questions ask whether positioning is crowded enough to amplify downside —
    distinct from the route's why_it_matters which describes positioning extremes
    amplifying drawdowns.
    """
    cftc = loaded.get("cftc_sp500_asset_mgr_net")
    if cftc is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    observations = cftc.get("observations", [])
    if not observations:
        return {
            "answer": "CFTC positioning data partially loaded.",
            "freshness_status": "stale",
        }
    latest_obs = observations[-1]
    percentile = float(latest_obs.get("percentile_252d", 50.0))
    value = float(latest_obs.get("value", 0.0))

    # Crowding thresholds: above 85th percentile = crowded; below 20th = washed out.
    crowded = percentile >= 85.0
    washed = percentile <= 20.0

    # NAAIM is a candidate source — load gracefully, treat as absent if missing.
    naaim = loaded.get("naaim_exposure_candidate")
    naaim_note = ""
    if naaim is not None:
        naaim_obs = naaim.get("observations", [])
        if naaim_obs:
            naaim_latest = naaim_obs[-1]
            naaim_val = naaim_latest.get("value")
            if naaim_val is not None:
                naaim_note = f" NAAIM exposure is {float(naaim_val):.0f}%."

    if crowded:
        answer = (
            f"Asset-manager S&P 500 net positioning is crowded at the "
            f"{percentile:.0f}th percentile of the past year ({value:+.1f}% OI)."
            f"{naaim_note}"
        )
        why = "Crowded positioning raises the risk of a sharp unwind if sentiment shifts."
        risk = "High long concentration amplifies downside when risk-off catalysts emerge."
        support = None
    elif washed:
        answer = (
            f"Asset-manager S&P 500 net positioning is washed out at the "
            f"{percentile:.0f}th percentile of the past year ({value:+.1f}% OI)."
            f"{naaim_note}"
        )
        why = "Depressed positioning reduces the crowding risk but may reflect already-realized risk-off."
        risk = None
        support = "Low long concentration reduces the amplification risk from forced selling."
    else:
        answer = (
            f"Asset-manager S&P 500 net positioning is within a neutral range at the "
            f"{percentile:.0f}th percentile of the past year ({value:+.1f}% OI)."
            f"{naaim_note}"
        )
        why = "Neutral positioning does not add amplification pressure in either direction."
        risk = None
        support = "Positioning is not stretched enough to generate a crowding-driven unwind."

    caveat = (
        "CFTC data is weekly and delayed by several days; short-term positioning shifts"
        " are not captured. NAAIM is a candidate source and may be absent."
    )
    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": caveat,
        "freshness_status": "ok",
    }


def _yoy_pct_change(observations: list[dict]) -> float | None:
    """Compute year-over-year percent change from a monthly index series.

    Returns ``None`` when the series is too short or the prior-year value is
    zero or missing. Uses the latest observation versus the observation 12
    rows back (assuming monthly cadence with no gaps).
    """
    if not observations or len(observations) < 13:
        return None
    try:
        latest = float(observations[-1].get("value"))
        prior = float(observations[-13].get("value"))
    except (TypeError, ValueError):
        return None
    if prior == 0:
        return None
    return (latest / prior - 1.0) * 100.0


def _change_over_window(observations: list[dict], window: int) -> float | None:
    """Absolute change between the latest observation and ``window`` rows back."""
    if not observations or len(observations) < window + 1:
        return None
    try:
        latest = float(observations[-1].get("value"))
        prior = float(observations[-1 - window].get("value"))
    except (TypeError, ValueError):
        return None
    return latest - prior


def _pct_change_over_window(observations: list[dict], window: int) -> float | None:
    """Percent change between the latest observation and ``window`` rows back."""
    if not observations or len(observations) < window + 1:
        return None
    try:
        latest = float(observations[-1].get("value"))
        prior = float(observations[-1 - window].get("value"))
    except (TypeError, ValueError):
        return None
    if prior == 0:
        return None
    return (latest / prior - 1.0) * 100.0


def _derive_liquidity_funding(loaded: dict) -> dict:
    """Read net_liquidity derived series and characterise its short-term trend.

    Branches on the sign of the 4-week change. Mentions the dominant
    component driver in text — distinct from the route's why_it_matters which
    focuses on net liquidity as the funding backdrop.
    """
    net_liq = loaded.get("net_liquidity")
    if net_liq is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    obs = net_liq.get("observations") or []
    if len(obs) < 5:
        return {
            "answer": "Net liquidity history partially loaded; awaiting 4-week change context.",
            "freshness_status": "stale",
        }
    latest_value = float(obs[-1].get("value", 0.0))
    delta_4w = _change_over_window(obs, 4)
    if delta_4w is None:
        return {
            "answer": "Net liquidity history partially loaded; awaiting 4-week change context.",
            "freshness_status": "stale",
        }

    latest_b = latest_value / 1_000.0  # millions to billions for readability
    delta_b = delta_4w / 1_000.0
    if delta_4w > 0:
        answer = (
            f"Net liquidity is expanding (+${delta_b:,.0f}B over four weeks to "
            f"${latest_b:,.0f}B); Fed balance sheet outpaces TGA and reverse repo drain."
        )
        why = "Rising net liquidity loosens funding conditions across risk assets and credit."
        risk = None
        support = "Expanding net liquidity supports risk-asset funding."
    elif delta_4w < 0:
        answer = (
            f"Net liquidity is contracting (${delta_b:,.0f}B over four weeks to "
            f"${latest_b:,.0f}B); TGA and reverse repo drain outpaces Fed balance sheet."
        )
        why = "Falling net liquidity tightens funding conditions and historically pressures risk assets."
        risk = "Net liquidity drains historically precede risk-off episodes."
        support = None
    else:
        answer = (
            f"Net liquidity is roughly flat over the past four weeks at ${latest_b:,.0f}B; "
            f"Fed balance sheet, TGA, and reverse repo components are offsetting."
        )
        why = "Flat net liquidity describes a balanced funding backdrop with no dominant driver."
        risk = None
        support = "Stable net liquidity is not adding to funding pressure."

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "Net liquidity is a derived weekly proxy from Fed assets, TGA, and reverse repo — not a measure of funding-market stress.",
        "freshness_status": "ok",
    }


def _derive_credit_dispersion(loaded: dict) -> dict:
    """Read HY-IG OAS spread and characterise the 30-day trend.

    Widening HY-IG dispersion is an early credit-stress signal; tightening
    describes risk-on conditions or stress not yet propagating from equity vol.
    """
    spread = loaded.get("hy_minus_ig_oas")
    if spread is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    obs = spread.get("observations") or []
    if len(obs) < 22:
        return {
            "answer": "Credit dispersion history partially loaded; awaiting 30-day change context.",
            "freshness_status": "stale",
        }
    latest = float(obs[-1].get("value", 0.0))
    delta_30d = _change_over_window(obs, 21)  # ~21 trading days
    if delta_30d is None:
        return {
            "answer": "Credit dispersion history partially loaded; awaiting 30-day change context.",
            "freshness_status": "stale",
        }

    # Threshold of +/- 15 bps over 30 days as a noise filter
    if delta_30d > 0.15:
        answer = (
            f"The HY-IG OAS spread is widening (+{delta_30d:.2f} pp over 30 days "
            f"to {latest:.2f} pp), an early sign of credit-quality dispersion."
        )
        why = "Widening HY-IG dispersion signals lower-quality credit underperforming higher-quality credit."
        risk = "HY-IG widening typically leads broader risk-off."
        support = None
    elif delta_30d < -0.15:
        answer = (
            f"The HY-IG OAS spread is tightening ({delta_30d:.2f} pp over 30 days "
            f"to {latest:.2f} pp), describing a risk-on credit backdrop."
        )
        why = "Tighter HY-IG dispersion describes broad credit risk appetite and limited cross-asset stress propagation."
        risk = None
        support = "Tight HY-IG dispersion suggests stress is not spreading from equity vol into credit."
    else:
        answer = (
            f"The HY-IG OAS spread is roughly stable ({delta_30d:+.2f} pp over 30 days "
            f"at {latest:.2f} pp); credit dispersion is not currently widening or tightening."
        )
        why = "Stable HY-IG dispersion describes a credit market without a directional impulse."
        risk = None
        support = "Steady credit dispersion is not amplifying cross-asset stress."

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "OAS spreads are derived daily from ICE BofA indices via FRED; intraday credit moves not reflected.",
        "freshness_status": "ok",
    }


def _derive_dollar_pressure(loaded: dict) -> dict:
    """Read broad_dollar series and characterise its 1-month change.

    Strengthening dollar tightens global financial conditions; weakening
    eases them.
    """
    broad = loaded.get("broad_dollar")
    if broad is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    obs = broad.get("observations") or []
    if len(obs) < 22:
        return {
            "answer": "Broad-dollar history partially loaded; awaiting 1-month change context.",
            "freshness_status": "stale",
        }
    latest = float(obs[-1].get("value", 0.0))
    pct_1m = _pct_change_over_window(obs, 21)
    if pct_1m is None:
        return {
            "answer": "Broad-dollar history partially loaded; awaiting 1-month change context.",
            "freshness_status": "stale",
        }

    # +/- 0.5% over 21 trading days threshold
    if pct_1m > 0.5:
        answer = (
            f"The broad dollar is strengthening ({pct_1m:+.2f}% over one month "
            f"to {latest:.2f}); global financial conditions are tightening from the FX side."
        )
        why = "A rising broad dollar transmits tighter global liquidity and pressures dollar-funded borrowers."
        risk = "Strong broad dollar tightens global financial conditions and stresses dollar-funded borrowers."
        support = None
    elif pct_1m < -0.5:
        answer = (
            f"The broad dollar is weakening ({pct_1m:+.2f}% over one month "
            f"to {latest:.2f}); global financial conditions are easing from the FX side."
        )
        why = "A falling broad dollar loosens global liquidity and tends to support EM and risk assets."
        risk = None
        support = "Easing dollar pressure typically supports global risk assets and EM."
    else:
        answer = (
            f"The broad dollar is roughly stable ({pct_1m:+.2f}% over one month "
            f"at {latest:.2f}); dollar pressure is not adding to global conditions in either direction."
        )
        why = "A stable broad dollar describes a balanced FX channel for global liquidity."
        risk = None
        support = "Stable dollar is not amplifying global financial-condition pressure."

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "Broad dollar uses Fed's nominal trade-weighted index; FX series can be stale around holidays.",
        "freshness_status": "ok",
    }


def _derive_commodity_impulse(loaded: dict) -> dict:
    """Read commodity_inflation_impulse and characterise its direction.

    Positive impulse adds to headline inflation pressure; negative impulse
    subtracts from it.
    """
    impulse = loaded.get("commodity_inflation_impulse")
    if impulse is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    obs = impulse.get("observations") or []
    if not obs:
        return {
            "answer": "Commodity-impulse history partially loaded.",
            "freshness_status": "stale",
        }
    latest_value = float(obs[-1].get("value", 0.0))
    latest_percentile = float(obs[-1].get("percentile_252d", 50.0))

    # The impulse is mapped so positive impulse score corresponds to inflation
    # pressure; the derived series field returns positive when commodities are
    # adding inflation pressure (per the upstream method note).
    # Threshold of +/- 5 score units to filter noise
    if latest_value > 5:
        answer = (
            f"Commodity prices are adding to inflation pressure (impulse {latest_value:+.1f}, "
            f"{latest_percentile:.0f}th percentile of the past year)."
        )
        why = "A positive commodity impulse feeds headline inflation and can pressure rate-cut expectations."
        risk = "Rising commodity prices add to headline inflation pressure and may pressure the Fed."
        support = None
    elif latest_value < -5:
        answer = (
            f"Commodity prices are subtracting from inflation pressure (impulse {latest_value:+.1f}, "
            f"{latest_percentile:.0f}th percentile of the past year)."
        )
        why = "A negative commodity impulse eases headline inflation pressure and supports disinflation."
        risk = None
        support = "Easing commodity prices reduce inflation pressure and rate-cut risk."
    else:
        answer = (
            f"Commodity prices are roughly neutral for inflation pressure (impulse {latest_value:+.1f}, "
            f"{latest_percentile:.0f}th percentile of the past year)."
        )
        why = "A flat commodity impulse describes a balanced backdrop for headline inflation."
        risk = None
        support = "Neutral commodity pressure is not amplifying headline inflation in either direction."

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "Commodity impulse blends oil and crop momentum with breakeven confirmation; monthly food/oil pass-through varies.",
        "freshness_status": "ok",
    }


def _derive_growth_breadth(loaded: dict) -> dict:
    """Read growth and labor series and compute a simple breadth score.

    Counts how many of unemployment, payrolls, claims, CFNAI 3M average,
    and industrial production are in their constructive zones.
    """
    series_keys = (
        "unemployment_rate",
        "nonfarm_payrolls",
        "cfnai_3m_avg",
        "industrial_production",
        "initial_claims",
    )
    series_payloads: dict[str, Any] = {key: loaded.get(key) for key in series_keys}
    if not any(series_payloads.values()):
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    # Need at least 3 of 5 series to compute a breadth read
    available = [k for k, v in series_payloads.items() if v is not None]
    if len(available) < 3:
        return {
            "answer": "Growth and labor history partially loaded; breadth read awaiting more inputs.",
            "freshness_status": "stale",
        }

    firm_count = 0
    eval_count = 0

    # Unemployment rate: firm if 12m change is non-positive (jobless rate not rising)
    ur = series_payloads.get("unemployment_rate")
    if ur is not None:
        ur_obs = ur.get("observations") or []
        change_12m = _change_over_window(ur_obs, 12)
        if change_12m is not None:
            eval_count += 1
            if change_12m <= 0:
                firm_count += 1

    # Payrolls: firm if latest month-over-month change is positive
    nfp = series_payloads.get("nonfarm_payrolls")
    if nfp is not None:
        nfp_obs = nfp.get("observations") or []
        nfp_change = _change_over_window(nfp_obs, 1)
        if nfp_change is not None:
            eval_count += 1
            if nfp_change > 0:
                firm_count += 1

    # CFNAI 3M average: firm if latest value >= -0.7 (expansion)
    cfnai = series_payloads.get("cfnai_3m_avg")
    if cfnai is not None:
        cfnai_obs = cfnai.get("observations") or []
        if cfnai_obs:
            try:
                cfnai_val = float(cfnai_obs[-1].get("value", 0.0))
                eval_count += 1
                if cfnai_val >= -0.7:
                    firm_count += 1
            except (TypeError, ValueError):
                pass

    # Industrial production: firm if 3m change is non-negative
    ip = series_payloads.get("industrial_production")
    if ip is not None:
        ip_obs = ip.get("observations") or []
        ip_change = _change_over_window(ip_obs, 3)
        if ip_change is not None:
            eval_count += 1
            if ip_change >= 0:
                firm_count += 1

    # Initial claims: firm if latest is below 350k (rough recession-risk floor)
    claims = series_payloads.get("initial_claims")
    if claims is not None:
        claims_obs = claims.get("observations") or []
        if claims_obs:
            try:
                claims_val = float(claims_obs[-1].get("value", 0.0))
                eval_count += 1
                if claims_val < 350.0:
                    firm_count += 1
            except (TypeError, ValueError):
                pass

    if eval_count == 0:
        return {
            "answer": "Growth and labor history partially loaded; breadth read awaiting more inputs.",
            "freshness_status": "stale",
        }

    if firm_count >= max(4, eval_count - 1):
        answer = (
            f"Growth breadth is firm: {firm_count} of {eval_count} growth and labor inputs "
            f"are in their constructive zones."
        )
        why = "Broad-based firmness across labor and production inputs describes a resilient cyclical backdrop."
        risk = None
        support = "Firm growth breadth supports cyclical risk assets."
    elif firm_count <= max(1, eval_count - 4):
        answer = (
            f"Growth breadth is softening: only {firm_count} of {eval_count} growth and "
            f"labor inputs are currently in constructive territory."
        )
        why = "Narrow growth breadth across labor and production inputs raises recession-risk attention."
        risk = "Softening growth breadth raises recession risk."
        support = None
    else:
        answer = (
            f"Growth breadth is mixed: {firm_count} of {eval_count} growth and labor inputs "
            f"are constructive while others have softened."
        )
        why = "Mixed growth breadth describes an economy with both expansionary and contractionary pockets."
        risk = None
        support = None

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "Breadth uses heuristic thresholds; release timing varies by indicator and some inputs may lag.",
        "freshness_status": "ok",
    }


def _derive_housing_pulse(loaded: dict) -> dict:
    """Read housing_starts, building_permits, and mortgage_rate_30y to
    characterise housing activity given mortgage-rate level.
    """
    starts = loaded.get("housing_starts")
    permits = loaded.get("building_permits")
    mortgage = loaded.get("mortgage_rate_30y")
    if starts is None and permits is None and mortgage is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    starts_obs = (starts or {}).get("observations") or []
    permits_obs = (permits or {}).get("observations") or []
    mortgage_obs = (mortgage or {}).get("observations") or []
    if not starts_obs or not permits_obs or not mortgage_obs:
        return {
            "answer": "Housing activity history partially loaded; awaiting starts, permits, and mortgage rate context.",
            "freshness_status": "stale",
        }

    starts_change_3m = _change_over_window(starts_obs, 3)
    permits_change_3m = _change_over_window(permits_obs, 3)
    if starts_change_3m is None or permits_change_3m is None:
        return {
            "answer": "Housing activity history partially loaded; awaiting starts, permits, and mortgage rate context.",
            "freshness_status": "stale",
        }
    try:
        mortgage_latest = float(mortgage_obs[-1].get("value", 0.0))
    except (TypeError, ValueError):
        return {
            "answer": "Housing activity history partially loaded; awaiting starts, permits, and mortgage rate context.",
            "freshness_status": "stale",
        }

    activity_up = starts_change_3m + permits_change_3m
    elevated_rate = mortgage_latest >= 6.0

    if activity_up > 0 and elevated_rate:
        answer = (
            f"Housing activity is resilient despite elevated rates: starts and permits are "
            f"rising over three months with the 30Y mortgage at {mortgage_latest:.2f}%."
        )
        why = "Housing turnover is holding up despite the most rate-sensitive sector facing high financing costs."
        risk = None
        support = "Resilient housing activity despite elevated rates suggests demand backstop."
    elif activity_up < 0 and elevated_rate:
        answer = (
            f"Housing activity is contracting at elevated rates: starts and permits are falling "
            f"over three months with the 30Y mortgage at {mortgage_latest:.2f}%."
        )
        why = "Rate transmission is working through the most rate-sensitive sector of the economy."
        risk = "Falling housing activity at elevated mortgage rates suggests rate transmission is working through the most rate-sensitive sector."
        support = None
    elif activity_up > 0:
        answer = (
            f"Housing activity is expanding with the 30Y mortgage at {mortgage_latest:.2f}%; "
            f"starts and permits are rising over three months."
        )
        why = "Rising starts and permits at moderate rates describe a supportive housing pulse."
        risk = None
        support = "Expanding housing activity supports cyclical growth."
    else:
        answer = (
            f"Housing activity is softening with the 30Y mortgage at {mortgage_latest:.2f}%; "
            f"starts and permits are falling over three months."
        )
        why = "Falling starts and permits at moderate rates describe a softening housing pulse."
        risk = "Slowing housing activity reduces residential construction's contribution to growth."
        support = None

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "Housing starts and permits are monthly; mortgage rate updates weekly. Series can move in opposite directions over short horizons.",
        "freshness_status": "ok",
    }


def _derive_inflation_dispersion(loaded: dict) -> dict:
    """Read CPI, core CPI, core PCE, and PPI to characterise inflation alignment.

    Computes YoY changes from monthly index series and branches on whether
    core and headline are moving in the same direction.
    """
    headline = loaded.get("headline_cpi")
    core_cpi = loaded.get("core_cpi")
    core_pce = loaded.get("core_pce")
    ppi = loaded.get("ppi_final_demand")
    if headline is None and core_cpi is None and core_pce is None and ppi is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    headline_obs = (headline or {}).get("observations") or []
    core_obs = (core_cpi or {}).get("observations") or []
    if len(headline_obs) < 25 or len(core_obs) < 25:
        return {
            "answer": "Inflation history partially loaded; awaiting CPI and core CPI YoY context.",
            "freshness_status": "stale",
        }

    headline_yoy_now = _yoy_pct_change(headline_obs)
    headline_yoy_prior = _yoy_pct_change(headline_obs[:-1])
    core_yoy_now = _yoy_pct_change(core_obs)
    core_yoy_prior = _yoy_pct_change(core_obs[:-1])
    if (
        headline_yoy_now is None
        or headline_yoy_prior is None
        or core_yoy_now is None
        or core_yoy_prior is None
    ):
        return {
            "answer": "Inflation history partially loaded; awaiting CPI and core CPI YoY context.",
            "freshness_status": "stale",
        }

    headline_dir = headline_yoy_now - headline_yoy_prior
    core_dir = core_yoy_now - core_yoy_prior
    # Threshold of 0.05 pp to filter near-zero noise
    headline_rising = headline_dir > 0.05
    headline_falling = headline_dir < -0.05
    core_rising = core_dir > 0.05
    core_falling = core_dir < -0.05

    if headline_falling and core_falling:
        answer = (
            f"Core and headline inflation are aligned and disinflating "
            f"(headline {headline_yoy_now:.1f}% YoY, core CPI {core_yoy_now:.1f}% YoY, both easing)."
        )
        why = "Aligned disinflation describes broad-based easing of price pressure."
        risk = None
        support = "Aligned disinflation supports rate-cut conditions."
    elif headline_rising and core_rising:
        answer = (
            f"Core and headline inflation are aligned and rising "
            f"(headline {headline_yoy_now:.1f}% YoY, core CPI {core_yoy_now:.1f}% YoY, both firming)."
        )
        why = "Aligned reacceleration in headline and core describes a broad rebuild of inflation pressure."
        risk = "Headline and core re-accelerating together complicates Fed easing expectations."
        support = None
    elif headline_rising and core_falling:
        answer = (
            f"Headline and core inflation are diverging upward in headline (headline "
            f"{headline_yoy_now:.1f}% YoY firming, core CPI {core_yoy_now:.1f}% YoY easing)."
        )
        why = "Divergence between headline and core may reflect food/energy passthrough rather than persistent pressure."
        risk = "Headline and core diverging upward complicates the Fed's reaction function."
        support = None
    elif headline_falling and core_rising:
        answer = (
            f"Headline is easing while core is firming (headline {headline_yoy_now:.1f}% YoY, "
            f"core CPI {core_yoy_now:.1f}% YoY rising)."
        )
        why = "Core firming despite headline easing describes sticky underlying inflation."
        risk = "Sticky core inflation extends the policy-rate path even as headline cools."
        support = None
    else:
        answer = (
            f"Headline and core inflation are roughly stable "
            f"(headline {headline_yoy_now:.1f}% YoY, core CPI {core_yoy_now:.1f}% YoY)."
        )
        why = "Stable headline and core describe a holding pattern for inflation."
        risk = None
        support = "Stable inflation backdrop is not currently amplifying policy uncertainty."

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "YoY changes are computed from monthly index levels; release timing differs across CPI, PCE, and PPI.",
        "freshness_status": "ok",
    }


def _derive_tactical_stress(loaded: dict) -> dict:
    """Read signal_priority.json and count the number of active warning signals.

    Questions ask which warnings are clustering on the short-term board —
    distinct from the route's why_it_matters which describes short-term signals
    tracking the immediate risk posture.
    """
    sp = loaded.get("signal_priority")
    if sp is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    top_warnings = sp.get("top_warnings")
    top_supports = sp.get("top_supports") or []
    if not isinstance(top_warnings, list):
        return {
            "answer": "Signal priority data partially loaded.",
            "freshness_status": "stale",
        }
    top_warnings = top_warnings or []

    warning_count = len(top_warnings)
    support_count = len(top_supports)

    # Severity-weighted: count warnings with severity >= 40 as significant
    significant_warnings = [
        w for w in top_warnings if float(w.get("severity", 0.0)) >= 40.0
    ]
    sig_count = len(significant_warnings)

    # Collect top 2 warning labels for context
    sorted_warnings = sorted(top_warnings, key=lambda w: float(w.get("severity", 0.0)), reverse=True)
    top_labels = [w.get("label", w.get("id", "")) for w in sorted_warnings[:2]]

    if warning_count == 0:
        answer = (
            "No active warnings are present on the short-term board; "
            "all ranked signals are currently in the support direction."
        )
        why = "An absence of ranked warnings describes a low-stress tactical environment."
        risk = None
        support = "All ranked signals are in the support direction."
    elif sig_count >= 3:
        label_str = "; ".join(top_labels) if top_labels else "multiple channels"
        answer = (
            f"{warning_count} warnings are active on the short-term board, "
            f"with {sig_count} carrying elevated severity — led by {label_str}."
        )
        why = "Multiple high-severity warnings across channels describe a tactically stressed environment."
        risk = f"{sig_count} signals above the elevated-severity threshold are clustering simultaneously."
        support = None
    elif sig_count >= 1:
        label_str = "; ".join(top_labels) if top_labels else "multiple channels"
        answer = (
            f"{warning_count} warnings are active on the short-term board, "
            f"with {sig_count} carrying elevated severity — led by {label_str}."
        )
        why = "Some warnings carry elevated severity; the tactical board is cautionary but not in broad stress."
        risk = f"{sig_count} signal(s) above the elevated-severity threshold warrant monitoring."
        support = f"{support_count} support signal(s) partially offset the warning cluster." if support_count else None
    else:
        label_str = "; ".join(top_labels) if top_labels else "multiple channels"
        answer = (
            f"{warning_count} low-severity warnings are present on the short-term board "
            f"— led by {label_str}."
        )
        why = "Active warnings are below the elevated-severity threshold; tactical stress is contained."
        risk = None
        support = f"{support_count} support signal(s) are also active." if support_count else None

    return {
        "answer": answer,
        "why": why,
        "risk": risk,
        "support": support,
        "caveat": "Signal priority reflects the most recent daily update; intraday moves are not captured.",
        "freshness_status": "ok",
    }


# Hand-curated text. Questions are <= 120 chars and distinct from each route's
# why_it_matters string in page_insights.json.
SECTION_CATALOG: dict[str, list[SectionTemplate]] = {
    "volatility": [
        {
            "id": "volatility_complex",
            "eyebrow": "Volatility complex",
            "question": "Is the term structure pricing calm, stress, or hidden options stress?",
            "derive": _derive_volatility_complex,
        },
    ],
    "rates": [
        {
            "id": "rates_pressure",
            "eyebrow": "Rates pressure",
            "question": "Is the recent 10Y move coming from real yields, breakevens, or curve shape?",
            "derive": _derive_rates_pressure,
        },
    ],
    "regime_map": [
        {
            "id": "regime_drivers",
            "eyebrow": "Regime drivers",
            "question": "Are real yields and the dollar tightening or easing financial conditions together?",
            "derive": _derive_regime_drivers,
        },
    ],
    "sentiment": [
        {
            "id": "positioning_vs_candidate_sentiment",
            "eyebrow": "Positioning vs sentiment",
            "question": "Is positioning crowded enough to amplify downside?",
            "derive": _derive_positioning,
        },
    ],
    "tactical": [
        {
            "id": "tactical_stress_board",
            "eyebrow": "Tactical stress",
            "question": "Which warnings are clustering on the short-term board today?",
            "derive": _derive_tactical_stress,
        },
    ],
    # PR follow-up: FocusBlock placements on the remaining 7 channel tabs.
    "liquidity": [
        {
            "id": "liquidity_funding",
            "eyebrow": "Liquidity & funding",
            "question": "Is net liquidity expanding or contracting, and which Fed components are driving it?",
            "derive": _derive_liquidity_funding,
        },
    ],
    "credit": [
        {
            "id": "credit_dispersion",
            "eyebrow": "Credit dispersion",
            "question": "Is the HY-IG spread widening (early credit stress) or tightening (risk-on)?",
            "derive": _derive_credit_dispersion,
        },
    ],
    "dollar_global": [
        {
            "id": "dollar_pressure",
            "eyebrow": "Dollar pressure",
            "question": "Is the broad dollar tightening or easing global financial conditions?",
            "derive": _derive_dollar_pressure,
        },
    ],
    "commodities": [
        {
            "id": "commodity_impulse",
            "eyebrow": "Commodity impulse",
            "question": "Are commodity prices adding to or subtracting from inflation pressure?",
            "derive": _derive_commodity_impulse,
        },
    ],
    "growth": [
        {
            "id": "growth_breadth",
            "eyebrow": "Growth breadth",
            "question": "Is broad-based growth firm, mixed, or softening across labor and production inputs?",
            "derive": _derive_growth_breadth,
        },
    ],
    "housing": [
        {
            "id": "housing_pulse",
            "eyebrow": "Housing pulse",
            "question": "Is housing activity expanding or contracting given current mortgage rates?",
            "derive": _derive_housing_pulse,
        },
    ],
    "inflation": [
        {
            "id": "inflation_dispersion",
            "eyebrow": "Inflation dispersion",
            "question": "Are core and headline inflation moving in the same direction or diverging?",
            "derive": _derive_inflation_dispersion,
        },
    ],
}

# Route keys that should always appear in the output even if they carry no
# ranked signals, because SECTION_CATALOG provides a sections array for them.
_SECTION_CATALOG_ROUTES: frozenset[str] = frozenset(SECTION_CATALOG.keys())


def _signal_routes(entry: dict[str, Any]) -> tuple[str, ...]:
    """Resolve which RouteKey(s) a ranked signal contributes to."""
    category = str(entry.get("category", ""))
    signal_id = str(entry.get("id", ""))
    if category == "macro":
        return MACRO_ID_TO_ROUTES.get(signal_id, ())
    return CATEGORY_TO_ROUTES.get(category, ())


def _to_signal_ref(entry: dict[str, Any]) -> dict[str, Any]:
    """Project a ranked signal entry onto the SignalRef schema for the hero."""
    ref: dict[str, Any] = {
        "id": str(entry["id"]),
        "label": str(entry["label"]),
        "message": str(entry["message"]),
        "why_it_matters": str(entry["why_it_matters"]),
        "severity": float(entry["severity"]),
        "freshness_status": str(entry["freshness_status"]),
        "confidence": float(entry["confidence"]),
        "source_status": _project_source_status(entry),
    }
    # Preserve the upstream access_status when present so the
    # candidate-isolation validator and any downstream consumer can apply
    # the same active-scoring predicate without re-loading the catalog.
    if "access_status" in entry:
        ref["access_status"] = str(entry["access_status"])
    return ref


def _project_source_status(entry: dict[str, Any]) -> str:
    """Project the upstream source_status onto the PageInsight enum.

    Upstream ranked entries carry source_status == "active" once they are
    promoted into top_warnings/top_supports. The PageInsight schema uses a
    different vocabulary that distinguishes "free_public" from gated
    statuses. Map "active" -> "free_public" so the public-data shape is
    consistent. Preserve gated statuses verbatim so the gating filter
    upstream can still rely on the original tag.
    """
    status = str(entry.get("source_status", "free_public"))
    if status == "active":
        return "free_public"
    return status


def _select_primary(
    entries: Iterable[dict[str, Any]],
    direction: str,
    route: str,
) -> dict[str, Any] | None:
    """Pick the highest-priority active signal for ``direction`` in ``route``.

    Excludes candidate-class signals — they can never populate a primary slot.
    """
    best: dict[str, Any] | None = None
    best_priority = float("-inf")
    for entry in entries:
        if entry.get("direction") != direction:
            continue
        if not is_active_scoring_allowed(entry):
            continue
        if route not in _signal_routes(entry):
            continue
        priority = float(entry.get("priority", 0.0))
        if priority > best_priority:
            best_priority = priority
            best = entry
    return _to_signal_ref(best) if best is not None else None


def _route_signals(payload: dict[str, Any], route: str) -> list[dict[str, Any]]:
    """All active-eligible signals from top_warnings + top_supports that map
    to ``route``."""
    signals = list(payload.get("top_warnings", []) or [])
    signals.extend(payload.get("top_supports", []) or [])
    return [
        entry
        for entry in signals
        if route in _signal_routes(entry) and is_active_scoring_allowed(entry)
    ]


def _derive_state(
    primary_warning: dict[str, Any] | None,
    primary_support: dict[str, Any] | None,
) -> str:
    if primary_warning is None and primary_support is None:
        return "unknown"
    if primary_warning is not None and primary_support is not None:
        return "mixed"
    if primary_warning is not None:
        return "risk"
    # support-only — high severity is a real "support" read; otherwise calm.
    severity = float(primary_support["severity"]) if primary_support else 0.0
    return "support" if severity >= SUPPORT_STATE_THRESHOLD else "calm"


def _confidence_for_route(route_signals: list[dict[str, Any]]) -> float:
    if not route_signals:
        return 0.0
    return round(
        sum(float(entry.get("confidence", 0.0)) for entry in route_signals)
        / len(route_signals),
        3,
    )


def _why_it_matters(
    primary_warning: dict[str, Any] | None,
    primary_support: dict[str, Any] | None,
    route: str,
) -> str:
    """Use the higher-severity primary slot's text; fall back to the route default."""
    candidates = [c for c in (primary_warning, primary_support) if c is not None]
    if not candidates:
        return DEFAULT_WHY_IT_MATTERS[route]
    candidates.sort(key=lambda c: float(c.get("severity", 0.0)), reverse=True)
    return str(candidates[0]["why_it_matters"])


def _freshness_notes_for_route(
    payload: dict[str, Any],
    route: str,
) -> list[str]:
    """Compose freshness notes from any stale or unavailable signals — both
    active (top_warnings/top_supports) and gated (missing_high_value_signals)
    — that map to this route's category."""
    notes: list[str] = []
    seen: set[str] = set()

    for entry in (
        list(payload.get("top_warnings", []) or [])
        + list(payload.get("top_supports", []) or [])
    ):
        status = str(entry.get("freshness_status", "ok"))
        if status not in {"stale", "unavailable"}:
            continue
        if route not in _signal_routes(entry):
            continue
        signal_id = str(entry.get("id", ""))
        if signal_id in seen:
            continue
        seen.add(signal_id)
        label = str(entry.get("label", signal_id))
        notes.append(f"{label} is {status}.")

    # Source-gated missing high-value signals also surface here so the user
    # can see "this route's data is missing X" alongside any active stale
    # notes. Gated signals are by definition unavailable for active scoring.
    for entry in payload.get("missing_high_value_signals", []) or []:
        if route not in _signal_routes(entry):
            continue
        signal_id = str(entry.get("id", ""))
        if signal_id in seen:
            continue
        seen.add(signal_id)
        label = str(entry.get("label", signal_id))
        notes.append(MISSING_HIGH_VALUE_SIGNAL_NOTES.get(signal_id, f"{label} is unavailable."))

    return notes


def _load_data_bundle(derived: Any) -> dict[str, Any]:
    """Pre-load derived JSON files into a keyed dict for use by derive functions.

    Each key is the file stem (without ``.json``). Missing or malformed files
    are stored as ``None`` so derive functions can return
    ``freshness_status="unavailable"`` rather than raising.

    ``derived`` must be a ``pathlib.Path``-compatible object pointing to the
    ``public/data/derived/`` directory, and the series directory is located
    relative to it.
    """
    from pathlib import Path

    bundle: dict[str, Any] = {}

    def _try_load(path: Path, key: str) -> None:
        try:
            bundle[key] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            bundle[key] = None

    derived_path = Path(str(derived))
    series_path = derived_path.parent / "series"

    _try_load(derived_path / "volatility_dashboard.json", "volatility_dashboard")
    _try_load(derived_path / "rates_dashboard.json", "rates_dashboard")
    _try_load(derived_path / "regime_dashboard.json", "regime_dashboard")
    _try_load(derived_path / "signal_priority.json", "signal_priority")
    _try_load(series_path / "cftc_sp500_asset_mgr_net.json", "cftc_sp500_asset_mgr_net")

    # NAAIM is a candidate source — gracefully absent.
    naaim_path = derived_path.parent / "candidates" / "naaim_exposure_candidate.json"
    _try_load(naaim_path, "naaim_exposure_candidate")

    # PR follow-up: inputs for the 7 channel-tab FocusBlock placements.
    _try_load(derived_path / "net_liquidity.json", "net_liquidity")
    _try_load(derived_path / "hy_minus_ig_oas.json", "hy_minus_ig_oas")
    _try_load(derived_path / "commodity_inflation_impulse.json", "commodity_inflation_impulse")
    _try_load(series_path / "broad_dollar.json", "broad_dollar")
    _try_load(series_path / "unemployment_rate.json", "unemployment_rate")
    _try_load(series_path / "nonfarm_payrolls.json", "nonfarm_payrolls")
    _try_load(series_path / "cfnai_3m_avg.json", "cfnai_3m_avg")
    _try_load(series_path / "industrial_production.json", "industrial_production")
    _try_load(series_path / "initial_claims.json", "initial_claims")
    _try_load(series_path / "housing_starts.json", "housing_starts")
    _try_load(series_path / "building_permits.json", "building_permits")
    _try_load(series_path / "mortgage_rate_30y.json", "mortgage_rate_30y")
    _try_load(series_path / "headline_cpi.json", "headline_cpi")
    _try_load(series_path / "core_cpi.json", "core_cpi")
    _try_load(series_path / "core_pce.json", "core_pce")
    _try_load(series_path / "ppi_final_demand.json", "ppi_final_demand")

    return bundle


def build_page_insights(
    *,
    signal_priority: dict[str, Any],
    generated_at_utc: str,
    loaded_data_bundle: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the per-route descriptive snapshot.

    ``signal_priority`` is the parsed ``signal_priority.json`` payload.
    ``loaded_data_bundle`` is a pre-loaded dict of derived JSON payloads
    (keyed by file stem). When ``None``, sections are omitted.
    Returns the ``page_insights.json`` shape directly.
    """
    routes_block: dict[str, dict[str, Any]] = {}

    all_active = list(signal_priority.get("top_warnings", []) or [])
    all_active.extend(signal_priority.get("top_supports", []) or [])

    for route in ROUTE_KEYS:
        route_signals = _route_signals(signal_priority, route)
        primary_warning = _select_primary(all_active, "risk", route)
        primary_support = _select_primary(all_active, "support", route)
        freshness_notes = _freshness_notes_for_route(signal_priority, route)

        # Build sections from SECTION_CATALOG if a bundle is available.
        sections: list[dict[str, Any]] = []
        if loaded_data_bundle is not None:
            templates = SECTION_CATALOG.get(route, [])
            for template in templates:
                dynamic = template["derive"](loaded_data_bundle)
                sections.append(
                    {
                        "id": template["id"],
                        "eyebrow": template["eyebrow"],
                        "question": template["question"],
                        "answer": dynamic.get("answer", ""),
                        "why": dynamic.get("why"),
                        "risk": dynamic.get("risk"),
                        "support": dynamic.get("support"),
                        "caveat": dynamic.get("caveat"),
                        "freshness_status": dynamic.get("freshness_status", "unavailable"),
                    }
                )

        # Omit a route entirely when it has zero ranked signals, no freshness
        # notes, AND no sections. Routes that appear in SECTION_CATALOG are
        # always included so the sections array is available for FocusBlock.
        has_data = (
            primary_warning is not None
            or primary_support is not None
            or freshness_notes
            or route_signals
        )
        if not has_data and not sections:
            continue

        state = _derive_state(primary_warning, primary_support)
        confidence = _confidence_for_route(route_signals)
        why_it_matters = _why_it_matters(primary_warning, primary_support, route)

        insight: dict[str, Any] = {
            "title": ROUTE_TITLES[route],
            "state": state,
            "why_it_matters": why_it_matters,
            "confidence": confidence,
            "freshness_notes": freshness_notes,
        }
        if primary_warning is not None:
            insight["primary_warning"] = primary_warning
        if primary_support is not None:
            insight["primary_support"] = primary_support
        if sections:
            insight["sections"] = sections
        routes_block[route] = insight

    return {
        "generated_at_utc": generated_at_utc,
        "date": str(signal_priority.get("date", "")),
        "method_version": METHOD_VERSION,
        "routes": routes_block,
    }


def main() -> None:
    derived = data_dir() / "derived"
    signal_priority = json.loads(
        (derived / "signal_priority.json").read_text(encoding="utf-8")
    )
    loaded_data_bundle = _load_data_bundle(derived)
    payload = build_page_insights(
        signal_priority=signal_priority,
        generated_at_utc=utc_now_iso(),
        loaded_data_bundle=loaded_data_bundle,
    )
    write_json(derived / "page_insights.json", payload)


if __name__ == "__main__":
    main()
