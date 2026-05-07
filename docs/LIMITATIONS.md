# Limitations

- Data is delayed and depends on each provider's publication schedule.
- Public endpoints can change, become unavailable, rate-limit requests, or alter CSV format without notice.
- FRED graph CSV access is used because it requires no secrets; the current project behavior does not rely on authenticated FRED API keys.
- GitHub Pages serves a static build. The browser reads generated JSON and does not fetch live provider data.
- GitHub Actions ingestion must run before deployment for the site to include new data.
- The weather score is explanatory and descriptive, not predictive.
- Phase 3 scores are descriptive summaries of observed data, not causal models.
- Score confidence reflects data freshness and coverage. It does not measure forecast accuracy.
- The dashboard is not financial advice, does not provide trade recommendations, and should not be used as the basis for investment, trading, or risk decisions.
- PR 1 horizon-regime labels use active no-secret generated data only.
- Active labels, scores, and checklists do not include candidate sources before source review is complete.
- PR 3 shock-risk output is descriptive. It summarizes active inputs and source-readiness gaps; it does not provide forecasts, instructions, or decision guidance.

## Source Limitations

- AAII and NAAIM are deferred terms-reviewed candidates, not active Phase 2 inputs.
- CFTC positioning is weekly, delayed, and futures-specific. It should be read as positioning context, not a complete sentiment model.
- Crop prices come from monthly FRED series, not live futures curves.
- VIX9D, VIX, and VIX3M ratios are public volatility-term proxies. They are not a tradable VIX futures curve.
- Put/call categories, VIX futures, and event calendar panels are source-readiness displays only until terms, access, cadence, automation, attribution, and redistribution rules are reviewed.
- VIX futures, put/call ratios, SKEW, MOVE, valuation, PMIs/SLOOS, Treasury supply, event calendars, and similar candidates do not affect scores, labels, or checklists before access terms, automation constraints, attribution, and redistribution rules are reviewed.
- Candidate MOVE rows describe Treasury bond-volatility source gaps only. If reviewed data later becomes active, high MOVE with low VIX would describe bond-volatility pressure that may not be visible in equity volatility.
- Candidate SKEW rows describe tail-risk source gaps only. SKEW is a tail-risk candidate and not a replacement for VIX.

## Source Access And Review

- Active `free_public` inputs can still fail because public pages, CSV files, filenames, or rate-limit behavior can change without notice.
- `terms_review_needed` sources are documented candidates only. They are not active scoring inputs until access, automation, attribution, and redistribution terms are reviewed.
- `restricted` sources are paid, gated, license-restricted, or otherwise not suitable for static public redistribution under current terms.
- `unavailable` sources cannot currently be fetched or redistributed by the no-secret static workflow.
- Candidate survey, flow, volatility, and term-premium sources can create coverage gaps. Those gaps should reduce score confidence rather than be silently filled with proxies.
- Public macro series can be revised after initial publication, so historical scores may change when source data is refreshed.
- Mismatch warnings are descriptive conflicts between active inputs. They do not imply a resolved direction when volatility, credit, liquidity, rate, dollar, or positioning channels disagree.

## Score Confidence Limitations

- Confidence is a data-quality indicator, not a probability that a market outcome will occur.
- A high-confidence score can still be wrong as an interpretation of market risk because the model is intentionally simple and descriptive.
- A low-confidence score can still contain useful context, but it should be read with the missing or stale source notes.
- Score builders emit all weighted bucket keys. Missing or stale coverage may enter as `0.0` neutral fallback values and lower confidence, so users should read confidence reasons and source status alongside headline values.
- Release-aware freshness reduces false stale flags for monthly and quarterly data, but it still depends on configured cadence assumptions.
- Expected release-window notes mean the source may be behaving normally; they do not mean the latest economic observation is current in a real-time sense.
- Confidence decomposition makes stale, missing, candidate, and thin-model inputs visible, but it does not turn descriptive scores into forecasts.
- Historical replay, valuation features, and watchlists are later-phase work and are not part of PR 1 horizon-regime scoring.
