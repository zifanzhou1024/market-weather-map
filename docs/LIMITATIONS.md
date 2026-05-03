# Limitations

- Data is delayed and depends on each provider's publication schedule.
- Public endpoints can change, become unavailable, rate-limit requests, or alter CSV format without notice.
- FRED graph CSV access is used because it requires no secrets; this project does not use authenticated FRED API keys in Phase 1.
- GitHub Pages serves a static build. The browser reads generated JSON and does not fetch live provider data.
- GitHub Actions ingestion must run before deployment for the site to include new data.
- The weather score is explanatory and descriptive, not predictive.
- The dashboard is not financial advice and should not be used as the sole basis for investment, trading, or risk decisions.
