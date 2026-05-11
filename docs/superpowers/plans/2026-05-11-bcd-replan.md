# Phase B/C/D replan — master

**Status:** plan-of-record for executing the data-source-expansion + focus-pattern initiative after Phase A merged (PR #34, commit `db86fe6`) and the access-status cleanup landed (PR #35, commit `4b035d7`).

**Supersedes:** PR boundaries (only) in chunks 4-8 of [`2026-05-10-data-source-and-focus-pattern-expansion.md`](2026-05-10-data-source-and-focus-pattern-expansion.md). Per-task details — file paths, expected line counts, fetch endpoints, regex patterns, command transcripts, fixture JSON shapes — remain authoritative in the original plan.

**Why replan:** the original chunks bundled 6-9 tasks per PR. Phase A's 13-task / 25-commit PR was at the upper edge of reviewability; downstream phases should ship smaller. Splitting into 17 smaller PRs also lets a Claude session execute one PR at a time via subagent-driven-development without juggling multiple worktrees in parallel.

---

## Plan layout

This master doc is intentionally short. Per-PR detail lives in three sibling docs:

| Doc | Covers | PR count |
|---|---|---|
| [Phase B PRs](2026-05-11-phase-b-prs.md) | Official sources + Cboe + sentiment candidates | 8 |
| [Phase C PRs](2026-05-11-phase-c-prs.md) | TradingView authenticated candidates | 4 |
| [Phase D PRs](2026-05-11-phase-d-prs.md) | FocusBlock component + section catalog + placements | 4 |
| (this doc, below) | Phase QA — final verification gate | 1 |

Total: **17 PRs.**

---

## Dependency graph

```
   Phase A merged (PR #34)
   Cleanup    merged (PR #35)
            │
            ▼
   ┌────────┬────────┬────────┐
   B1       B2       B3       B4         (Phase B-official; independent)
   B5       B6       B7       B8         (Phase B-other; independent)
   │
   ▼
   C1 TV scaffolding
   │
   ▼
   ┌────────┬────────┐
   C2       C3       C4                  (Phase C; parallel after C1)

   D1 (foundation)    D2 (data layer)   (D1 + D2 parallel)
            │
            ▼
   ┌────────┬────────┐
   D3       D4                           (Phase D placements; parallel after D1+D2)

   QA   (only after all 16 above merge)
```

---

## Dispatch cadence — single-flight per Claude session

**Default: one PR at a time, sequential.** Subagent-driven-development inside a single Claude session is most reliable when only one worktree is in flight. Multiple PRs in parallel require either separate sessions or careful worktree juggling — keep it simple.

**Exception — when 2 PRs is safe:** two PRs that touch entirely disjoint files (e.g. B1 BEA + B5 Cboe put/call) can run from separate worktrees if you want to speed things up. The verification gate runs independently per worktree.

### Recommended phase ordering

1. **Phase B-official** (B1 → B2 → B4 → B3). Sequence chosen so the simplest fetcher (B1 BEA, single FRED CSV) proves the pattern first. See [Phase B doc](2026-05-11-phase-b-prs.md) for rationale.
2. **Phase B-Cboe** (B5 → B6). Both candidate-only; ingest pattern already proven in Phase B-official.
3. **Phase B-sentiment** (B7 → B8). Same ingest pattern as Cboe.
4. **Phase C** (C1 → C2 → C3 → C4). C1 is scaffolding-only; C2-C4 each add one TV fetcher.
5. **Phase D** (D1 + D2 then D3 → D4). D1 and D2 are foundation work that can interleave; D3-D4 are mechanical placements.
6. **Phase QA** (single PR). Runs only after the 16 PRs above merge.

This sequencing assumes single-flight. If you want parallelism, the dependency graph above tells you what's safe to overlap.

---

## Standard verification gate

Every PR runs the same gate before opening:

```bash
.venv/bin/python -m pytest tests/python -v
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
.venv/bin/python -m scripts.validate.validate_candidate_isolation
npm test
npm run build
```

For PRs that add ingest scripts, also run `.venv/bin/python -m scripts.update_data` if you have network access; otherwise CI exercises it on push.

---

## Worktree bootstrap pattern

```bash
git fetch origin main
git worktree add .worktrees/<name> -b <branch-from-doc> origin/main
cd .worktrees/<name>
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm install   # only if the PR touches frontend files
```

When a dependency PR hasn't merged yet (C2 depends on C1; D3/D4 depend on D1+D2), base off that branch's tip instead of `main`. Rebase onto post-merge `main` before opening the PR.

---

## Subagent-driven-development cadence per PR

Each PR has 2-5 tasks. Most are lighter-SDD candidates (one implementer + one combined reviewer per task — see Phase A's A11 for the pattern). Use full SDD (implementer + spec reviewer + quality reviewer) only when a PR touches:

- the gating contract (`scripts/shared/access_status.py`),
- the validators (`scripts/validate/...`),
- or the build transforms (`scripts/transform/build_signal_priority.py`, `build_page_insights.py`).

The Phase B/C/D PRs as scoped here mostly touch ingest scripts and catalog entries — those are lighter-SDD.

---

## Cross-PR consistency notes

- **`MODULES_INGEST_PHASE_B_OFFICIAL` / `MODULES_INGEST_PHASE_B_CBOE` / `MODULES_INGEST_PHASE_C` / `MODULES_TRANSFORM_PHASE_B`** in [scripts/update_data.py](../../../scripts/update_data.py) were created empty during A6 specifically to absorb appends without merge conflicts. Each PR appends one module to its corresponding list.
- **`CANDIDATE_SERIES_PHASE_A`** in [scripts/shared/catalog.py](../../../scripts/shared/catalog.py) already contains 12 candidate entries (Cboe put/call, VX, NAAIM, AAII). Phase B5/B6/B7/B8 PRs only add the fetcher and confirm the entry exists — they do NOT add new catalog entries.
- **`access_status` governance** — every new active-class series (Phase B-official only) must pass `access_status="free_public_active"` to `governance()`. Every new candidate-class series gets `"free_public_candidate"`, `"terms_review_needed"`, or `"authenticated_candidate"` as appropriate. The derivation table in [scripts/shared/access_status.py](../../../scripts/shared/access_status.py) is the single source of truth.

---

## Phase QA — single PR (final verification gate)

### PR QA: Phase QA verification + report

- **Branch:** `feat/qa-final-gate`
- **Worktree:** `.worktrees/qa-final`
- **Bundles:** [QA1-QA7](2026-05-10-data-source-and-focus-pattern-expansion.md#chunk-8-phase-qa--handoff) from the original plan.
- **Verification:** every gate green against post-merge `main`; verification report committed; CLAUDE.md gating note updated to reflect the post-Phase-B/C governance state.
- **Deps:** all 16 PRs above merged to `main`.
- **PR title:** `chore(qa): phase B/C/D verification gate + report`

The QA PR is small in code surface — it's mostly a verification report and one CLAUDE.md edit. The work that matters happened in the 16 PRs above; QA is the audit.

---

## Original plan reference

For full per-task implementation detail — file paths, fetch endpoints, regex patterns, expected line counts, command transcripts, fixture JSON shapes — see [`2026-05-10-data-source-and-focus-pattern-expansion.md`](2026-05-10-data-source-and-focus-pattern-expansion.md). The 17 PR docs here change ONLY how those tasks group into PRs.
