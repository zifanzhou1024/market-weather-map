# Gold / XAU Source Review

## Candidate Use

Precious-metals and gold-miner context using gold benchmarks, spot gold proxies, or Nasdaq PHLX Gold/Silver Sector Index data after terms review.

## Review Answers

Source owner: LBMA and ICE Benchmark Administration for LBMA Gold Price; Nasdaq for the PHLX Gold/Silver Sector Index XAU.
Official page / documentation reviewed: LBMA Gold Price page https://www.lbma.org.uk/prices-and-data/lbma-gold-price, ICE Benchmark Administration licensing page https://www.ice.com/iba/licensing, and Nasdaq XAU overview https://indexes.nasdaq.com/Index/Overview/XAU.
Data format: Benchmark price publications, index factsheets/methodology, and licensed benchmark/index data products; no approved public static-ingestion format documented here.
Historical availability: LBMA/IBA and Nasdaq describe benchmark or index histories, but approved automated historical access and redistribution are unresolved.
Automated download allowed: Not approved; benchmark and index provider licensing terms must be reviewed before scheduled collection.
Static JSON redistribution allowed: Not approved; treat benchmark prices and Nasdaq XAU index values as provider-controlled data until redistribution rights are documented.
Attribution requirement: Attribute LBMA, ICE Benchmark Administration, Nasdaq, and the exact benchmark or index name if later approved.
API key required: No public project key is approved; benchmark or index access may require licensed credentials.
Can it be used in browser: No; do not fetch benchmark or index data directly from browser code.
Can it be used in GitHub Actions ingestion: No, not until access, automation, attribution, and redistribution are approved.
Can it affect active scores now: No
Recommended catalog status: restricted
Recommended score status: candidate
Citation text: Gold benchmark and Nasdaq XAU data are candidate-only inputs pending benchmark/index licensing and redistribution review.
Notes / unresolved questions: Decide whether a public macro proxy can replace benchmark/index data. Do not use third-party chart pages as a workaround for source-owner restrictions.

## Decision

Keep gold benchmark and XAU index sources restricted and non-active for the current static dashboard.
