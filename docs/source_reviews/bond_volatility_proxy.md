# Bond Volatility Proxy Source Review

## Candidate Use

Treasury bond volatility proxy derived from realized changes in public Treasury yield series. This is not MOVE and not an implied volatility index.

## Review Answers

Source owner: Derived internally from Federal Reserve/FRED Treasury-yield series.
Official page / documentation reviewed: FRED 10-Year Treasury Constant Maturity Rate https://fred.stlouisfed.org/series/DGS10 and Federal Reserve H.15 Selected Interest Rates https://www.federalreserve.gov/releases/h15/.
Data format: Existing FRED graph CSV/static ingestion path or reviewed FRED/Fed download, then derived realized-volatility calculation.
Historical availability: Historical Treasury-yield observations are available through active FRED/Fed paths, with calculation window chosen by the later implementation PR.
Automated download allowed: Compatible with the existing reviewed Treasury-yield source path after documenting the derived calculation; not a legal determination for any new endpoint.
Static JSON redistribution allowed: Likely compatible for a derived realized-volatility proxy with Treasury-yield attribution; not a legal determination.
Attribution requirement: Attribute FRED/Federal Reserve Treasury-yield series and disclose the internal realized-volatility calculation.
API key required: No additional key expected if using the existing FRED graph CSV Treasury-yield path.
Can it be used in browser: No; the browser should consume generated static JSON and display the proxy label.
Can it be used in GitHub Actions ingestion: Yes, after the derived calculation and input series are documented.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: Derived realized Treasury-yield volatility proxy from Federal Reserve/FRED yield data; not MOVE.
Citation text to show on website: Derived realized Treasury-yield volatility proxy from Federal Reserve/FRED yield data; not MOVE.
Notes / unresolved questions: Define the yield tenor, lookback window, annualization, missing-data handling, and direction before active scoring. Do not label this as MOVE or compare it as an implied-volatility index without a methodology note.

## Decision

Public-data proxy candidate that can avoid licensed MOVE dependencies. Keep non-scoring until calculation methodology is implemented and tested.
