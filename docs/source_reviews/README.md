# Source Reviews

These files document source-governance decisions for candidate market, macro, event, and confirmation inputs. This is a static public dashboard, and source reviews are implementation governance records, not legal advice.

## Status Taxonomy

| Status | Meaning |
| --- | --- |
| `free_public` | Appears eligible for the planned static-dashboard implementation after documented constraints are met; not a legal determination. Attribution requirements must be honored, and API keys or other secrets must not be exposed to the browser. |
| `terms_review_needed` | Candidate source needs a terms, access, attribution, redistribution, or automation review before use. |
| `restricted` | Candidate source has restrictions that prevent current static dashboard use. |
| `unavailable` | Candidate source is not currently available for the planned dashboard workflow. |

## Secret Handling

Allowed secret names:

`FRED_API_KEY`
`BLS_API_KEY`
`BEA_API_KEY`
`EIA_API_KEY`
`CENSUS_API_KEY`

Literal key values must never be committed, logged, written to static JSON, bundled in frontend output, or sent to the browser. Secrets may only be used in server-side or GitHub Actions ingestion contexts that keep values out of generated static artifacts.

## Review Template

```md
# Source Review: <source name>

Source owner:
Official page / documentation reviewed:
Data format:
Historical availability:
Automated download allowed:
Static JSON redistribution allowed:
Attribution requirement:
API key required:
Can it be used in browser:
Can it be used in GitHub Actions ingestion:
Can it affect active scores now:
Recommended catalog status:
Recommended score status:
Citation text:
Notes / unresolved questions:
```

## Scoring Rule

Candidate sources cannot affect active scores, regime labels, checklist states, or confidence until a review classifies the source as usable and a later implementation PR changes ingestion/scoring.
