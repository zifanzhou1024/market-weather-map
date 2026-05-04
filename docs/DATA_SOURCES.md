# Data Sources

Phase 1 uses active, no-secret public endpoints. The ingestion scripts run in GitHub Actions or locally and write static JSON files under `public/data`. The frontend reads those JSON files and does not call provider endpoints.

| Bucket | Series | Provider | Public endpoint | Frequency | Notes |
| --- | --- | --- | --- | --- | --- |
| Volatility | VIX | Cboe | `https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` | Daily | Cboe Volatility Index historical daily close. |
| Rates | DGS2 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2` | Daily | 2-Year Treasury Constant Maturity Rate. |
| Rates | DGS10 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10` | Daily | 10-Year Treasury Constant Maturity Rate. |
| Rates | DGS20 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS20` | Daily | 20-Year Treasury Constant Maturity Rate. |
| Rates | DGS30 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30` | Daily | 30-Year Treasury Constant Maturity Rate. |
| Liquidity | WALCL | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL` | Weekly | Federal Reserve total assets. |
| Liquidity | RRPONTSYD | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=RRPONTSYD` | Daily | Overnight reverse repurchase agreements. |
| Liquidity | WTREGEN | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WTREGEN` | Weekly | Treasury General Account balance. |
| Liquidity | SOFR | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR` | Daily | Secured Overnight Financing Rate. |
| Credit | STLFSI4 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=STLFSI4` | Weekly | St. Louis Fed Financial Stress Index. |
| Credit | NFCI | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=NFCI` | Weekly | Chicago Fed National Financial Conditions Index. |

## Phase 2 Sources

Phase 2 extends the same no-secret ingestion model with additional public FRED graph CSV endpoints and CFTC historical positioning reports.

| Bucket | Series | Provider | Public endpoint | Frequency | Notes |
| --- | --- | --- | --- | --- | --- |
| Commodities | DCOILWTICO | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO` | Daily | WTI crude oil spot price. |
| Commodities | DCOILBRENTEU | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU` | Daily | Brent crude oil spot price. |
| Commodities | PMAIZMTUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PMAIZMTUSDM` | Monthly | Global corn price. |
| Commodities | PWHEAMTUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PWHEAMTUSDM` | Monthly | Global wheat price. |
| Commodities | PSOYBUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSOYBUSDM` | Monthly | Global soybean price. |
| Sentiment | E-mini S&P 500 positioning | CFTC | `https://www.cftc.gov/files/dea/history/fut_fin_txt_2026.zip` | Weekly | Historical compressed text report for futures positioning. |

## Source Handling

- Cboe and FRED data are fetched by Python scripts, then normalized into static JSON.
- FRED graph CSV endpoints do not require API keys or secrets.
- CFTC positioning data is fetched from public historical compressed text files and transformed into static JSON.
- Data freshness is validated against each series' expected cadence and maximum stale-day threshold.
- The generated catalog and status files expose source URLs, expected frequencies, and freshness notes for the frontend.
