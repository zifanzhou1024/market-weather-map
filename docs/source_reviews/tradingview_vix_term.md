# TradingView VIX Term-Structure Candidate Source Review

## Candidate Use

Authenticated TradingView path for six constant-maturity VIX indices that together describe the shape of the implied-volatility term structure from the short end (9-day) through the long end (1-year), plus the volatility-of-volatility index (VVIX). These are **constant-maturity index levels published by Cboe**, not VX futures contracts. The distinction matters: VX futures are exchange-traded contracts with their own settlement mechanics; the Cboe constant-maturity indices are computed reference levels. TradingView carries both, but this fetcher targets only the index family.

The six series fetched, all on the `CBOE` exchange:

| TradingView symbol | Output key | Description |
|---|---|---|
| `CBOE:VIX9D` | `vix9d` | Cboe 9-day Volatility Index |
| `CBOE:VIX` | `vix` | Cboe Volatility Index (30-day) |
| `CBOE:VIX3M` | `vix3m` | Cboe 3-Month Volatility Index |
| `CBOE:VIX6M` | `vix6m` | Cboe 6-Month Volatility Index |
| `CBOE:VIX1Y` | `vix1y` | Cboe 1-Year Volatility Index |
| `CBOE:VVIX` | `vvix` | Cboe VIX Volatility Index |

The active dashboard already ingests VIX, VVIX, VIX9D, and VIX3M directly from Cboe's public CSV download (`cboe_index_series` in `scripts/shared/catalog.py`). This TradingView path is a cross-validation candidate only — it does **not** replace or supplement the active series in `public/data/series/`. The candidate output lands in `public/data/candidates/` with governance flags `active_scoring_allowed: false`, `public_redistribution_allowed: false`, `requires_secret: true`.

VIX6M and VIX1Y are not currently ingested from any active path; this candidate provides their first data point for future readiness review.

## Review Answers

Source owner: Cboe Global Markets (index owner); TradingView Inc. (delivery mechanism, https://www.tradingview.com).
Official page / documentation reviewed: https://www.cboe.com/tradable_products/vix/ (Cboe VIX family overview), https://www.cboe.com/tradable_products/vix/vix_historical_data/ (Cboe public CSV download page), https://www.tradingview.com/policies/ (TradingView Terms of Use). The Python client choice (community-maintained fork of the unmaintained `tvdatafeed` package) is pinned in requirements.txt as of PR C2.
Data format: Daily OHLCV bars returned as a pandas DataFrame with DatetimeIndex via the TradingView authenticated session client (rongardF/tvdatafeed@e6f6aaa7de43). The `close` column is used as the index level. Wide-format JSON: each observation has a `date` field plus one numeric field per series key (vix9d, vix, vix3m, vix6m, vix1y, vvix). A derived file with five term-structure metrics (spreads and contango score) is written separately.
Historical availability: Up to ~5000 daily bars per `get_hist` call. For CBOE:VIX, history runs from approximately 2005-12-15 to present. Newer tenors (VIX6M, VIX1Y) have shorter histories. The fetcher requests 5000 bars for each symbol; the wide-format merge keeps only dates where all successfully-fetched series overlap.
Automated download allowed: Conditional, same governance as the broader TradingView authenticated candidate family (see `docs/source_reviews/tradingview_authenticated_candidates.md`). The fetch runs only inside GitHub Actions, gated on `ENABLE_AUTHENTICATED_CANDIDATES=true` plus both `TRADINGVIEW_USERNAME` and `TRADINGVIEW_PASSWORD` repo secrets.
Static JSON redistribution allowed: No. Cboe owns the underlying index levels and does not authorize redistribution in derived static datasets through a third-party authenticated session. Candidate JSON files carry `public_redistribution_allowed: false`.
Attribution requirement: Cboe Global Markets (index owner) and TradingView Inc. (delivery). Any candidate panel displaying these values must name both.
API key required: No traditional REST API key. TradingView username and password (GitHub Actions secrets `TRADINGVIEW_USERNAME`, `TRADINGVIEW_PASSWORD`) plus the boolean gate `ENABLE_AUTHENTICATED_CANDIDATES`. No secret values appear in committed JSON, frontend code, logs, or build artifacts; see the secret-isolation test in `tests/python/test_secrets_isolation.py`.
Can it be used in browser: No. The browser must never call TradingView or Cboe directly, and must never see the username, password, or any session token.
Can it be used in GitHub Actions ingestion: Yes, conditionally. The ingest step in `.github/workflows/update-data.yml` injects the three secrets. If any is unset or empty, the fetcher skips gracefully. The safe-update path in `scripts/update_data.py` preserves any prior good JSON when the fetcher skips or fails.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: TradingView authenticated candidate (https://www.tradingview.com). Constant-maturity VIX index term structure (VIX9D, VIX, VIX3M, VIX6M, VIX1Y, VVIX) from CBOE via authenticated session. Index levels owned by Cboe Global Markets. Not a free-public source. Candidate-only; does not enter active scores, regime labels, page-insights primary slots, or checklists.
Notes / unresolved questions: VIX6M and VIX1Y have no current active ingestion path; a free-public Cboe CSV for these tenors was not confirmed as of 2026-05-11. If Cboe adds public CSV download for these tenors, this candidate path should be superseded and the source review updated. The derived metrics file (`tradingview_vix_term_metrics_candidate`) computes five spreads; the contango_score formula uses `max(vix, 1.0)` in the denominator to guard against a hypothetical zero-VIX edge case. Re-review if TradingView changes its Terms of Use, if the `tvdatafeed` fork library becomes unmaintained, or if a direct free-public Cboe endpoint appears for all six tenors.

## Decision

Adopt as `terms_review_needed` / `candidate`. `active_scoring_allowed: false`. `requires_secret: true`. `public_redistribution_allowed: false`. Candidate output goes to `public/data/candidates/` only.

### Live probe outcomes (2026-05-11)

All six CBOE series returned 30 daily bars in under one second using `rongardF/tvdatafeed@e6f6aaa7de43`:

| Symbol | Last close |
|---|---|
| CBOE:VIX9D | 16.89 |
| CBOE:VIX | 18.38 |
| CBOE:VIX3M | 21.24 |
| CBOE:VIX6M | 23.06 |
| CBOE:VIX1Y | 23.99 |
| CBOE:VVIX | 98.06 |

Term structure on probe date was in full contango (VIX9D < VIX < VIX3M < VIX6M < VIX1Y), which is the historically normal state; VVIX at 98 indicates moderate volatility-of-volatility. These values are recorded for reference; they do not constitute a forecast or investment recommendation.

Re-review the source if TradingView changes its Terms of Use, if the `tvdatafeed` fork becomes unmaintained, or if a direct free-public Cboe download appears for all six tenors.
