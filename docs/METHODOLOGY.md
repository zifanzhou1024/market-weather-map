# Methodology

market-weather-map produces a descriptive weather score from `-100` to `+100`. Positive scores indicate more supportive observed conditions, near-zero scores indicate neutral or mixed conditions, and negative scores indicate more fragile or stressed observed conditions.

The score is explanatory, not predictive. It is not a forecast, trading signal, portfolio recommendation, or financial advice.

## Bucket Weights

| Bucket | Weight | Phase 1 scoring status |
| --- | ---: | --- |
| Volatility | 20% | Active |
| Rates | 15% | Active |
| Liquidity | 20% | Active |
| Credit | 20% | Active |
| Commodities | 10% | Neutral |
| Sentiment | 15% | Neutral |

Phase 1 actively scores volatility, rates, liquidity, and credit. Commodities and sentiment are included in the target bucket model but are held neutral at `0` until public, no-secret Phase 1-compatible inputs are added.

## Bucket Logic

- Volatility uses the latest VIX percentile. Higher VIX percentile readings are treated as less supportive.
- Rates use the recent change in the 10-year Treasury yield. Larger upward moves are treated as less supportive.
- Liquidity uses recent changes in Federal Reserve assets and overnight reverse repo balances. Rising Fed assets are treated as more supportive, while rising reverse repo balances are treated as less supportive.
- Credit uses Fed-published financial stress and financial conditions series: STLFSI4 and NFCI. Higher percentile readings are treated as less supportive.
- Commodities and sentiment are neutral in Phase 1.

The overall score is the weighted average of available bucket scores, clamped to the `-100` to `+100` range. The displayed label maps the result into broad regimes:

| Score range | Interpretation |
| --- | --- |
| `<= -50` | Stressed |
| `-50` to `-20` | Fragile |
| `-20` to `20` | Neutral |
| `>= 20` | Supportive |

## Freshness And Provenance

Each generated series includes source metadata, observation dates, summary values, and percentile context where applicable. The status output reports whether each active source is fresh, stale, or failed based on the configured cadence.
