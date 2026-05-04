# Limitations

- Data is delayed and depends on each provider's publication schedule.
- Public endpoints can change, become unavailable, rate-limit requests, or alter CSV format without notice.
- FRED graph CSV access is used because it requires no secrets; the current project behavior does not rely on authenticated FRED API keys.
- GitHub Pages serves a static build. The browser reads generated JSON and does not fetch live provider data.
- GitHub Actions ingestion must run before deployment for the site to include new data.
- The weather score is explanatory and descriptive, not predictive.
- Phase 3 scores are descriptive summaries of observed data, not causal models.
- Score confidence reflects data freshness and coverage. It does not measure forecast accuracy.
- The dashboard is not financial advice and should not be used as the sole basis for investment, trading, or risk decisions.

## Source Limitations

- AAII and NAAIM are deferred terms-reviewed candidates, not active Phase 2 inputs.
- CFTC positioning is weekly, delayed, and futures-specific. It should be read as positioning context, not a complete sentiment model.
- Crop prices come from monthly FRED series, not live futures curves.

## Source Access And Review

- Active `free_public` inputs can still fail because public pages, CSV files, filenames, or rate-limit behavior can change without notice.
- `terms_review_needed` sources are documented candidates only. They are not active scoring inputs until access, automation, attribution, and redistribution terms are reviewed.
- `restricted` sources are paid, gated, license-restricted, or otherwise not suitable for static public redistribution under current terms.
- `unavailable` sources cannot currently be fetched or redistributed by the no-secret static workflow.
- Candidate survey, flow, volatility, and term-premium sources can create coverage gaps. Those gaps should reduce score confidence rather than be silently filled with proxies.
- Public macro series can be revised after initial publication, so historical scores may change when source data is refreshed.

## Score Confidence Limitations

- Confidence is a data-quality indicator, not a probability that a market outcome will occur.
- A high-confidence score can still be wrong as an interpretation of market risk because the model is intentionally simple and descriptive.
- A low-confidence score can still contain useful context, but it should be read with the missing or stale source notes.
- Scores normalize across available buckets when some inputs are unavailable, so users should read the confidence reasons and source status alongside the headline values.
