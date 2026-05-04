# Methodology

market-weather-map produces descriptive scores from `-100` to `+100`. Positive scores indicate more supportive observed conditions, near-zero scores indicate neutral or mixed conditions, and negative scores indicate more fragile or stressed observed conditions.

The scores are explanatory, not predictive. They are not forecasts, trading signals, portfolio recommendations, or financial advice.

## Three-Score Model

Phase 3 separates the dashboard into three related score families so fast market stress does not obscure slower macro conditions.

### Market Weather Score

Market Weather is the headline cross-asset read. It summarizes current market conditions using active no-secret public inputs.

| Bucket | Weight | Scoring status |
| --- | ---: | --- |
| Credit spreads (`credit_spreads`) | 22% | Active |
| Liquidity and funding (`liquidity_funding`) | 18% | Active |
| Rates and real yields (`rates_real_yields`) | 15% | Active |
| Volatility tail risk (`volatility_tail_risk`) | 15% | Active |
| Dollar and global (`dollar_global`) | 10% | Active when broad dollar input is available |
| Commodity inflation impulse (`commodities_inflation_impulse`) | 10% | Active |
| Sentiment and positioning (`sentiment_positioning`) | 10% | Active |

### Macro Climate Score

Macro Climate separates slower growth, labor, inflation, and real-rate conditions from the market tape.

| Bucket | Weight | Scoring status |
| --- | ---: | --- |
| Growth (`growth`) | 25% | Active when FRED growth inputs are available |
| Labor (`labor`) | 25% | Active when labor inputs are available |
| Inflation (`inflation`) | 20% | Active when CPI, PCE, and PPI inputs are available |
| Consumer and production (`consumer_production`) | 20% | Active when retail sales, production, and durable goods inputs are available |
| Real yields (`real_yields`) | 10% | Active when TIPS inputs are available |

### Fragility Score

Fragility focuses on channels that can amplify market moves or expose stress beneath otherwise stable headline conditions.

| Bucket | Weight | Scoring status |
| --- | ---: | --- |
| Credit spread widening (`credit_spread_widening`) | 25% | Active when public spread inputs are available |
| Volatility term structure (`volatility_term_structure`) | 20% | Active when public volatility-ratio inputs are available |
| Dollar spike (`dollar_spike`) | 15% | Active when broad dollar input is available |
| Liquidity drain (`liquidity_drain`) | 15% | Active |
| Positioning crowding (`positioning_crowding`) | 15% | Active |
| Treasury bond volatility (`treasury_bond_volatility`) | 10% | Candidate-only until terms review is complete |

If a bucket is unavailable or stale, its missing input lowers confidence and the remaining available buckets are normalized within the score family. Candidate-only inputs do not enter the production score until source access is reviewed.

The `percentile_252d` field name is retained for compatibility, but the percentile window is frequency-aware: daily series use 252 observations, weekly series use 52 observations, and monthly series use 12 observations.

## Bucket Logic

- Volatility uses the latest VIX percentile. Higher VIX percentile readings are treated as less supportive and more fragile.
- Rates use Treasury yield levels, curve context, recent changes, real yields, and breakevens. Larger upward rate pressure is treated as less supportive when it tightens conditions.
- Liquidity uses recent changes in Federal Reserve assets, overnight reverse repo balances, Treasury General Account balances, and funding context. Rising Fed assets are treated as more supportive, while rising reverse repo or funding pressure is treated as less supportive.
- Credit uses Fed-published financial stress and financial conditions series plus public OAS inputs. Higher stress, tighter conditions, and wider spreads are treated as less supportive.
- Growth and labor inputs describe activity breadth, jobs momentum, claims pressure, and recession-risk indicators. Stronger breadth is supportive unless it conflicts with inflation pressure.
- Inflation inputs describe price momentum across CPI, core measures, PCE, PPI, and expectations. Higher or reaccelerating inflation pressure is treated as less supportive for Macro Climate.
- Dollar and banking inputs describe global dollar pressure, reserve balances, bank credit, loans, business lending, and deposits. Dollar strength and weaker banking trends can raise Fragility.
- Commodities use oil and crop price percentiles as a commodity impulse. Higher energy and crop price pressure can be less supportive because it can reflect input-cost and inflation pressure; lower or easing commodity pressure can be more supportive when it does not signal demand weakness.
- Sentiment uses CFTC E-mini S&P 500 asset manager and leveraged money net positioning as a percent of open interest. Very high positioning percentiles are treated as crowding risk; low positioning readings are descriptive underexposure context.

Each score is the weighted average of available bucket scores, clamped to the `-100` to `+100` range. The displayed label maps the result into broad regimes:

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

## Confidence

Each score includes a confidence value from `0` to `1`. Confidence is descriptive metadata based on source freshness, missing inputs, stale observations, candidate-only gaps, and whether active buckets are broad enough to support the score. A high confidence score means the current public inputs are reasonably complete and fresh; it does not mean the score is more predictive.

Confidence reasons should be displayed with the score so users can see whether a result is supported by active `free_public` inputs or weakened by missing, stale, or `terms_review_needed` sources.
