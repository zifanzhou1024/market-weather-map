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

Macro Climate separates slower growth, labor, inflation, housing, and real-rate conditions from the market tape.

| Bucket | Weight | Scoring status |
| --- | ---: | --- |
| Growth (`growth`) | 18% | Active when FRED growth inputs are available |
| Labor (`labor`) | 18% | Active when labor inputs are available |
| Inflation (`inflation`) | 16% | Active when CPI, PCE, and PPI inputs are available |
| Consumer and production (`consumer_production`) | 16% | Active when retail sales, production, and durable goods inputs are available |
| Housing (`housing`) | 12% | Housing starts, building permits, and 30Y mortgage-rate pressure |
| Consumer balance sheet (`consumer_balance_sheet`) | 10% | Active when household debt service, consumer debt service, and credit-card delinquency inputs are available |
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

If a bucket's coverage is missing or stale, the score builders keep the emitted weighted bucket keys and lower confidence. Missing inputs may contribute `0.0` neutral fallback values rather than being reweighted out. Candidate-only inputs do not enter active scoring until source access is reviewed.

PR 2 tactical candidates for put/call categories, VIX futures, and event calendar families are source-readiness displays only. They do not affect active scoring, regime labels, checklist states, or confidence until source review is complete, except through documented source-readiness gaps.

PR 3 shock-risk candidates for MOVE and SKEW follow the same gate. Candidate MOVE and SKEW rows are source-readiness displays only before source review, so they do not affect active scoring, regime labels, checklist states, or confidence except through documented source-readiness gaps.

PR 4 strategic candidates for PMIs, SLOOS, term premium, Treasury supply, valuation, and earnings revisions follow the same gate. Active PR 4 consumer balance-sheet inputs come from FRED-hosted public series; strategic candidates remain source-readiness rows only until governance review promotes a specific endpoint.

PR 5 historical replay and score attribution are descriptive research surfaces. Replay scenarios match prior dates where active real-yield, broad-dollar, credit, VIX-curve, and nominal-yield changes met the configured regime pattern. Score attribution stores the latest Market Weather, Macro Climate, and Fragility scores with recent changes, supports, and risks from the generated score summary.

The `percentile_252d` field name is retained for compatibility, but the percentile window is frequency-aware: daily series use 252 observations, weekly series use 52 observations, and monthly series use 12 observations.

## Bucket Logic

- Volatility uses the latest VIX percentile. Higher VIX percentile readings are treated as less supportive and more fragile.
- Rates use Treasury yield levels, curve context, recent changes, and real yields. Larger upward rate pressure is treated as less supportive when it tightens conditions.
- Liquidity uses recent changes in Federal Reserve assets, overnight reverse repo balances, Treasury General Account balances, and funding context. Rising Fed assets are treated as more supportive, while rising reverse repo or funding pressure is treated as less supportive.
- Credit uses Fed-published financial stress and financial conditions series plus public OAS inputs. Higher stress, tighter conditions, and wider spreads are treated as less supportive.
- Growth and labor inputs describe activity breadth, jobs momentum, claims pressure, and recession-risk indicators. Stronger breadth is supportive unless it conflicts with inflation pressure.
- Inflation inputs describe price momentum across CPI, core measures, PCE, and PPI. Higher or reaccelerating inflation pressure is treated as less supportive for Macro Climate.
- Housing inputs describe construction activity, permit activity, and mortgage-rate pressure. Stronger starts and permits are treated as more supportive housing activity; higher 30-year mortgage rates are treated as riskier or more restrictive. Housing should be read with release-aware freshness because monthly construction data and weekly mortgage rates update on different schedules.
- Consumer balance-sheet inputs describe debt-service burdens and credit-card delinquency pressure. Higher debt-service ratios or higher credit-card delinquencies are treated as less supportive for Macro Climate.
- Dollar and banking inputs describe global dollar pressure, reserve balances, bank credit, loans, business lending, and deposits. Dollar strength and weaker banking trends can raise Fragility.
- Commodities use oil and crop price percentiles as a commodity impulse. Higher energy and crop price pressure can be less supportive because it can reflect input-cost and inflation pressure; lower or easing commodity pressure can be more supportive when it does not signal demand weakness.
- Sentiment uses CFTC E-mini S&P 500 asset manager and leveraged money net positioning as a percent of open interest. Very high positioning percentiles are treated as crowding risk; low positioning readings are descriptive underexposure context.

Each score is a weighted average of emitted bucket scores, including neutral fallbacks when coverage is missing, clamped to the `-100` to `+100` range.

## Phase 5 Horizon Regime Definitions

Phase 5 PR 1 organizes the descriptive outputs by horizon using existing active no-secret data. Labels are descriptive historical and current-state summaries. They are not forecasts, causal claims, trading signals, or trade recommendations.

### TIPS x Dollar Quadrants

The TIPS x dollar view compares real-yield pressure with broad dollar pressure to describe cross-asset regime context.

| Quadrant | Real-yield pressure | Dollar pressure | Description |
| --- | --- | --- | --- |
| Easier real yields, softer dollar | Lower or easing | Lower or easing | Conditions are less restrictive through real rates and global dollar pressure. |
| Easier real yields, firmer dollar | Lower or easing | Higher or firming | Domestic real-rate pressure is easing while global dollar pressure remains a constraint. |
| Tighter real yields, softer dollar | Higher or firming | Lower or easing | Real-rate pressure is restrictive while dollar pressure is less restrictive. |
| Tighter real yields, firmer dollar | Higher or firming | Higher or firming | Real-rate and dollar channels both describe tighter financial conditions. |

### Yield Drivers

Yield driver labels summarize whether the observed rate move is primarily associated with nominal Treasury yields, real yields, inflation compensation, or curve shape.

| Driver | Definition |
| --- | --- |
| Nominal rate pressure | Treasury yield levels or recent Treasury yield changes are the dominant observed rate input. |
| Real-yield pressure | TIPS real-yield levels or recent real-yield changes are the dominant observed restrictive input. |
| Inflation-compensation pressure | Breakeven or forward inflation-compensation inputs are the dominant observed rate-context input. |
| Curve pressure | 2-year, 10-year, 20-year, or 30-year curve relationships are the dominant observed rate-context input. |
| Mixed yield drivers | No single active rate input dominates the observed rate context. |

### Checklist Items

Checklist items summarize whether important descriptive conditions are aligned, mixed, missing, or candidate-only.

| Checklist item | Definition |
| --- | --- |
| Volatility pressure | Active volatility inputs describe calm, neutral, or stressed market volatility context. |
| Credit pressure | Active credit spread and financial-conditions inputs describe easing, neutral, or tightening credit context. |
| Liquidity pressure | Active balance-sheet, reverse-repo, Treasury-account, and funding inputs describe supportive, neutral, or restrictive liquidity context. |
| Rate pressure | Active nominal-rate, real-yield, breakeven, and curve inputs describe easing, neutral, or restrictive rate context. |
| Dollar pressure | Active broad-dollar and currency inputs describe softer, neutral, or firmer dollar context. |
| Commodity impulse | Active commodity inputs describe easing, neutral, or firming inflation-impulse context. |
| Positioning crowding | Active CFTC positioning inputs describe underexposure, neutral exposure, or crowding context. |
| Source readiness | Candidate-only inputs are separated from active inputs until source review is complete. |

### Tactical VIX Proxy Caveat

When VIX futures data is not active, the tactical page uses VIX9D, VIX, VIX3M, VIX9D/VIX, and VIX/VIX3M as a proxy for near-term event pressure and contango/backwardation-like stress. This proxy is not the same as a tradable VIX futures curve.

Put/call categories, VX futures readiness, event calendar families, PMIs, SLOOS, term premium, Treasury supply, valuation, and earnings-revision families remain candidate source gates until terms, access, cadence, attribution, automation, and redistribution review is complete. They do not enter active scoring before that review.

### Fragility / Shock Risk View

PR 3 adds a dedicated Fragility / Shock Risk view and a generated shock-risk snapshot. The snapshot is built from active no-secret inputs plus source-readiness gaps for candidate inputs whose terms are not yet reviewed.

The view is descriptive. It separates active volatility, credit, liquidity, rate, dollar, and positioning inputs from candidate MOVE and SKEW rows. MOVE is treated as candidate Treasury bond-volatility context until source review is complete. SKEW is treated as a candidate tail-risk input, not as a replacement for VIX.

Mismatch warnings describe conflicts between active inputs. For example, low VIX with tighter credit, weaker liquidity, firmer dollar, or restrictive rate pressure can show that equity volatility is not confirming other stress channels. If reviewed MOVE data later becomes active, high MOVE with low VIX would describe bond-volatility pressure that may not be visible in equity volatility.

### Confirmation Matrix

The confirmation matrix groups active inputs by whether they confirm, conflict with, or do not materially affect the current descriptive label.

| Matrix state | Definition |
| --- | --- |
| Confirming | The input's current percentile, change, or bucket score points in the same direction as the displayed regime label. |
| Diverging | The input's current percentile, change, or bucket score points against the displayed regime label. |
| Neutral | The input is near its neutral band or contributes little directional pressure. |
| Missing or stale | The expected active input is unavailable, too stale for its cadence, or emitted as a neutral fallback. |
| Candidate-only | The input is useful for future context but does not affect scores, labels, or checklist states before source review. |

### Historical Regime Replay

PR 5 adds `public/data/derived/regime_replay.json`. The replay file groups historical observations into the same broad TIPS x dollar framework used elsewhere in the app:

| Scenario | Matching rule |
| --- | --- |
| Tightening / risk-off | 10Y real yield rises, broad dollar rises, and credit or VIX-curve pressure rises over the lookback window. |
| Strong risk-on | 10Y real yield falls, broad dollar falls, and credit and VIX-curve pressure are contained over the lookback window. |
| Bonds-first / safe haven | 10Y real yield falls while the broad dollar rises over the lookback window. |
| Reallocation / rotation | 10Y real yield rises while the broad dollar does not confirm broad stress over the lookback window. |

The current lookback is 20 matched observations across `real_yield_10y`, `broad_dollar`, `high_yield_oas`, `vix_vix3m_ratio`, and `us10y`. Occurrence rows show the matched date and observed 20-observation changes. The replay file intentionally does not include asset forward-return summaries, hit rates, or model projections.

### Score Attribution History

PR 5 adds `public/data/derived/score_history.json`. The score history keeps recent generated observations for the three score families and a `latest_attribution` block copied from the current score summary:

| Field | Meaning |
| --- | --- |
| `observations` | Stored generated score snapshots for Market Weather, Macro Climate, and Fragility. |
| `latest_attribution.recent_changes` | Current generated explanations for what changed in that score block. |
| `latest_attribution.top_supports` | Current generated supportive contributors. |
| `latest_attribution.top_risks` | Current generated risk contributors. |

The UI uses this file to explain why scores changed from the prior stored snapshot when one exists. The stored history is explanatory context only.

Market Weather and Macro Climate use these broad displayed labels:

| Score range | Interpretation |
| --- | --- |
| `<= -50` | Stressed |
| `-50` to `-20` | Fragile |
| `-20` to `20` | Neutral |
| `>= 20` | Supportive |

Fragility uses separate labels so the direction remains clear:

| Score range | Fragility interpretation |
| --- | --- |
| `<= -50` | High Fragility |
| `-50` to `-20` | Elevated Fragility |
| `-20` to `20` | Moderate |
| `>= 20` | Low Fragility |

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

Each generated series includes source metadata, observation dates, summary values, and percentile context where applicable. The status output distinguishes raw data age from expected release cadence.

Daily series use short calendar-day freshness buffers with normal non-trading-day tolerance. Weekly series use expected weekly cadence plus buffer. Monthly and quarterly series are evaluated against their observation period and expected release window, so a first-of-month observation is not automatically stale before the next release is expected.

Derived series expose their own generated status and observation dates. Their dependency methods should be read when interpreting lagged inputs.

## Confidence

Each score includes a confidence value from `0` to `1`. The overall data-quality block decomposes confidence into:

- Coverage confidence: active expected series are present and have usable observations.
- Freshness confidence: active series are fresh or within expected release lag.
- Model confidence: buckets have enough breadth and are not overly dependent on one proxy.
- Source confidence: important domains are not blocked by candidate, unavailable, restricted, or unresolved source status.

Overall confidence is a weighted blend of those components. Confidence is a data-quality indicator, not a probability that the score is predictive.
