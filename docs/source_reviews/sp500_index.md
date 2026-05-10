# S&P 500 Index Source Review

## Candidate Use

A daily S&P 500 (SPX) benchmark would let the dashboard compute SPX 1D / 1W / 1M returns, drawdown from an N-day high, 21-day realized volatility, and the VIX-minus-realized-volatility premium so the volatility complex has an equity-side counterparty. Today the project ships volatility (VIX, VVIX), credit (HY/IG/BBB OAS), rates, dollar, liquidity, and positioning, but no equity benchmark.

## Review Answers

Source owner: S&P Dow Jones Indices LLC (S&P DJI), an index licensor jointly owned by S&P Global and CME Group. FRED hosts the level series (`SP500`) under licence from S&P DJI and includes the copyright notice on the series page.

Official page / documentation reviewed:
- FRED series page <https://fred.stlouisfed.org/series/SP500>.
- FRED legal notice <https://fred.stlouisfed.org/legal/> ("Some series in FRED® are copyrighted by their respective owners and FRED® users are not granted permission to use such series for purposes not in compliance with copyright law. Permission to use these data must be obtained directly from the copyright owner.").
- S&P DJI terms of use, referenced from the FRED page copyright notice.

Data format: Daily index level (close) in points; CSV available via FRED's graph CSV endpoint at `https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500`. The format itself matches the other FRED daily series the project already ingests.

Historical availability: The CSV typically returns about ten years of daily history. Earlier history is available from S&P DJI direct, not FRED.

Automated download allowed: FRED does not block the graph CSV endpoint. However, the underlying terms come from S&P DJI, not FRED. The S&P DJI copyright notice on the FRED page reads "Copyright, 2025, S&P Dow Jones Indices LLC. Reproduction of S&P 500 in any form is prohibited except with the prior written permission of S&P Dow Jones Indices LLC ('S&P DJI')." On its face, this restricts re-publishing the level series in our generated static JSON, even though it does not restrict downloading the CSV for personal use. Not approved for automated download AND redistribution under the current terms.

Static JSON redistribution allowed: Not approved. Redistributing the SPX level series in `public/data/series/sp500_index.json` would re-publish a copyrighted index series without S&P DJI permission. The source-gating contract requires a documented redistribution permission before promotion.

Attribution requirement: If a later review approves use, attribute "S&P 500 ® is a registered trademark of S&P Dow Jones Indices LLC" and link the FRED page on every UI surface that displays the data. Attribution alone does not waive the redistribution restriction.

API key required: No, FRED's graph CSV endpoint does not require a key. The restriction is on redistribution, not access.

Can it be used in browser: No — even if redistribution were approved, the project does not fetch provider data from the browser. All ingestion runs in GitHub Actions or scripts/ingest/.

Can it be used in GitHub Actions ingestion: Not approved. The graph CSV endpoint accepts requests but the level series may not be redistributed in our generated static JSON without a separate S&P DJI agreement or a different licensing model (for example, a vendor that sublicenses redistribution rights).

Can it affect active scores now: No. SPX is candidate-only until terms are approved. Surface the gap rather than silently filling it with a proxy.

Recommended catalog status: `terms_review_needed`.

Recommended score status: `candidate`.

Citation text: "S&P 500 daily index level (FRED series `SP500`, copyright S&P Dow Jones Indices LLC). Candidate-only pending S&P DJI redistribution review."

Notes / unresolved questions:
- Confirm whether a self-hosted, non-commercial dashboard like this one qualifies for any S&P DJI personal-use exception that would permit static republication. The current default reading is "no — assume standard redistribution restrictions apply."
- Investigate vendor channels that sublicense SPX level data for static republishing (Yahoo Finance, Stooq, Cboe direct, Alpha Vantage, etc.). Each has its own terms and most restrict redistribution similarly.
- Consider non-restricted equity benchmarks (broad ETF NAVs with friendlier terms, market-cap-weighted custom baskets, sector ETF baskets) as substitutes if SPX itself stays gated.
- A separate review can revisit if/when an approved access path is identified. This document is intentionally conservative — promotion requires a follow-up source review with a documented approved channel, not a re-interpretation of these terms.

## Decision

Keep `sp500_index` candidate-only and source-gated. Do not ingest SPX level data into `public/data/series/`, do not promote SPX into active scores, regime labels, checklists, or confidence, and do not display SPX-derived metrics (returns, drawdown, realized vol, VIX-minus-realized premium) until a follow-up review documents an approved access and redistribution path.

In the meantime, surface the gap explicitly: add `sp500_index` to the signal-priority engine's missing-high-value-signal catalog so users see on the Overview and Tactical pages that the dashboard does not currently include an SPX benchmark and why.
