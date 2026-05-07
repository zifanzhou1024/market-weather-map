# Horizon Regime Program Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Each PR plan is independently testable and should be completed, verified, and reviewed before the next PR starts.

**Goal:** Provide a continuous multi-PR implementation path for the full horizon/regime product direction: tactical trading weather, strategic macro climate, fragility shock risk, source-gated data expansion, historical replay, and user watchlists.

**Architecture:** Keep the no-backend static site. All active data must be fetched or derived in Python and published as static JSON. React routes may render candidate/source-gap panels for unreviewed data, but unreviewed sources must not affect scores, labels, or active signals.

**Tech Stack:** Python 3.11, pytest, static JSON under `public/data`; React 19, TypeScript, React Router 7, Recharts 3, Vitest/jsdom.

---

## Continuous PR Sequence

Execute in this order:

1. [PR 1: Horizon IA + Active-Data Regime Map](./2026-05-07-horizon-regime-decision-system.md)  
   Builds the core decision architecture from existing active data.
2. [PR 2: Tactical Options + Event Risk Depth](./2026-05-07-pr2-tactical-options-event-risk.md)  
   Adds source-gated options sentiment, VIX futures readiness, and event-risk UI without assuming redistribution rights.
3. [PR 3: Fragility Shock Risk](./2026-05-07-pr3-fragility-shock-risk.md)  
   Adds MOVE/SKEW source gates, shock-risk panels, and mismatch warnings.
4. [PR 4: Strategic Macro Completeness](./2026-05-07-pr4-strategic-macro-completeness.md)  
   Adds active public housing and consumer-cycle data, plus candidate gates for valuation, PMIs/SLOOS, term premium, and Treasury supply.
5. [PR 5: Historical Regime Replay](./2026-05-07-pr5-regime-replay-research.md)  
   Adds descriptive historical regime replay, score history, and research caveats.
6. [PR 6: Watchlist + Threshold System](./2026-05-07-pr6-watchlist-thresholds.md)  
   Adds browser-local watchlists and threshold monitoring without backend notifications.

---

## Agent Dispatch Rules

- Assign one task or one PR section to a subagent at a time.
- Require the subagent to edit files directly, run the listed tests, and report changed paths.
- Do not let a subagent activate any `terms_review_needed` source. Activation requires a prior source-governance change that sets the provider and series to `free_public` with notes.
- Do not let a subagent add browser-side provider calls, API keys, secrets, backend routes, databases, real-time feeds, forecasts, or trade recommendations.
- After each PR, run the full final verification block from that PR before starting the next PR.

---

## Source Governance Invariants

These rules apply to every PR:

- `free_public`: can be active when it is no-secret, automatable, source-referenced, and appropriate for static JSON publication.
- `terms_review_needed`: can appear in docs, catalog, status tables, and candidate panels, but cannot be fetched or scored.
- `restricted`: cannot be fetched or redistributed by this project.
- `unavailable`: can be documented and displayed as a gap, but cannot be scored.

Candidate inputs from the original audit that remain gated until review:

- Cboe/OCC put-call categories.
- Cboe SKEW.
- VIX futures curve.
- ICE BofA MOVE.
- NY Fed ACM term premium.
- PMIs and SLOOS transformation/redistribution.
- Valuation datasets such as CAPE, forward P/E, ERP, and earnings revisions.
- Treasury auction and issuance datasets unless a compliant public endpoint is documented.
- ETF/index return histories for SPY/TLT/GLD replay unless a compliant public source is documented.

---

## Program-Level Verification

After all PRs are complete, run:

```bash
python -m pytest tests/python -v
npm run test
npm run build
python -m scripts.update_data
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
rg -n "buy|sell|short|entry|target|stop loss|recommendation" src docs README.md
git status --short
```

Expected:

- Python tests pass.
- Vitest tests pass.
- TypeScript build passes.
- Data workflow succeeds.
- User-facing copy contains no trade advice language introduced by these PRs.
- `.idea/` remains untracked and unstaged unless the user explicitly asks otherwise.

