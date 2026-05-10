# Regional Fed Survey Proxy Follow-up

## Scope

Add one official/public regional Federal Reserve survey proxy as a generated static candidate diagnostic:

- `philly_fed_mfg_general_activity`

The source is the Philadelphia Fed Manufacturing Business Outlook Survey current general activity diffusion index mirrored by FRED as `GACDFSA066MSFRBPHI`.

## Governance Boundary

This diagnostic is not ISM PMI or S&P Global PMI. It must be labeled as a regional Fed survey proxy.

It remains:

- `score_status: candidate`
- `access_status: free_public`
- generated static JSON only
- excluded from active scores, labels, checklist states, and confidence

## UI Placement

Show the diagnostic in Long-Term Macro / Allocation Climate through the existing generated official diagnostics panel.

## Deferred

- Multi-bank regional Fed survey composite
- ISM or S&P Global PMI activation
- Any scoring use of regional survey data
