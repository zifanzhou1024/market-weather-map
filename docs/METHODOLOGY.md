# Methodology

market-weather-map produces a descriptive weather score from `-100` to `+100`. Positive scores indicate more supportive observed conditions, near-zero scores indicate neutral or mixed conditions, and negative scores indicate more fragile or stressed observed conditions.

The score is explanatory, not predictive. It is not a forecast, trading signal, portfolio recommendation, or financial advice.

## Bucket Weights

| Bucket | Weight | Scoring status |
| --- | ---: | --- |
| Volatility | 20% | Active |
| Rates | 15% | Active |
| Liquidity | 20% | Active |
| Credit | 20% | Active |
| Commodities | 10% | Active |
| Sentiment | 15% | Active |

All six buckets are actively scored from public, no-secret inputs. The `percentile_252d` field name is retained for compatibility, but the percentile window is frequency-aware: daily series use 252 observations, weekly series use 52 observations, and monthly series use 12 observations.

## Bucket Logic

- Volatility uses the latest VIX percentile. Higher VIX percentile readings are treated as less supportive.
- Rates use the recent change in the 10-year Treasury yield. Larger upward moves are treated as less supportive.
- Liquidity uses recent changes in Federal Reserve assets and overnight reverse repo balances. Rising Fed assets are treated as more supportive, while rising reverse repo balances are treated as less supportive.
- Credit uses Fed-published financial stress and financial conditions series: STLFSI4 and NFCI. Higher percentile readings are treated as less supportive.
- Commodities use oil and crop price percentiles. Higher oil and crop price percentiles are treated as less supportive because they can reflect input-cost and inflation pressure.
- Sentiment uses CFTC E-mini S&P 500 asset manager and leveraged money net positioning as a percent of open interest. Very high positioning percentiles are treated as crowding risk; low positioning readings are descriptive underexposure context.

The overall score is the weighted average of available bucket scores, clamped to the `-100` to `+100` range. The displayed label maps the result into broad regimes:

| Score range | Interpretation |
| --- | --- |
| `<= -50` | Stressed |
| `-50` to `-20` | Fragile |
| `-20` to `20` | Neutral |
| `>= 20` | Supportive |

## Phase 2 Derived Metrics

Phase 2 adds derived series that are computed from fetched public inputs before scoring and static JSON publication.

Net liquidity proxy:

`Fed Assets - Treasury General Account - Reverse Repo`

The reverse repo input is converted from billions to millions before it is combined with Fed assets and Treasury General Account values.

Brent-WTI spread:

`Brent crude spot price - WTI crude spot price`

CFTC net positioning:

`(Long contracts - Short contracts) / Open interest * 100`

The sentiment bucket treats very high leveraged-money positioning percentiles as crowding risk. Low positioning readings are descriptive underexposure context, not a standalone bullish signal.

## Freshness And Provenance

Each generated series includes source metadata, observation dates, summary values, and percentile context where applicable. The status output reports whether each active source is fresh, stale, or failed based on the configured cadence.
