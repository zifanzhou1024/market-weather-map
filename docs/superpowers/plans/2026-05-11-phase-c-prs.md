# Phase C PRs (4)

**Parent doc:** [2026-05-11-bcd-replan.md](2026-05-11-bcd-replan.md) — start there for the dependency graph, dispatch cadence, worktree bootstrap, and standard verification gate.

**Per-task detail:** [2026-05-10-data-source-and-focus-pattern-expansion.md](2026-05-10-data-source-and-focus-pattern-expansion.md) — chunk 6 (tasks C1-C9). Every PR section below links to the specific tasks; do NOT duplicate per-task detail here.

**Phase C scope:** TradingView authenticated candidates (MOVE, put/call, VX curve) written to `public/data/candidates/`. Secrets via GitHub Actions env only — never logged, never committed.

**Hard dependency:** **C1 must merge before C2/C3/C4.** C1 lands the secret scaffolding + isolation test BEFORE any fetcher tries to use the credential. Inverts the natural "code+test together" cadence; gives stronger safety.

---

## PR C1: TradingView scaffolding (no fetcher)

- **Branch:** `feat/c1-tradingview-scaffolding`
- **Worktree:** `.worktrees/c1-tv-scaffolding`
- **Bundles:**
  - C1 — write `docs/source_reviews/tradingview.md`
  - C2 — add secret helpers to `scripts/shared/config.py` (read-only access to `TRADINGVIEW_USERNAME` / `TRADINGVIEW_PASSWORD` env vars; raise if missing in production; allow override for tests)
  - C3 — add `tvdatafeed` (or equivalent TradingView client) to `requirements.txt`
  - C7 — `tests/python/test_secrets_isolation.py`: allowlist test (no `TRADINGVIEW_*` string in committed source other than the secret helper itself) + value-leak test (runtime check with a fake env value)
  - C8 — extend `.github/workflows/update-data.yml` env block to inject `TRADINGVIEW_USERNAME` / `TRADINGVIEW_PASSWORD` from GitHub secrets
- **Demo-able output:** no new JSON files (no fetcher yet). The secret-isolation test passes against an empty fetcher set — proves the guard is in place before any fetcher can leak.
- **Original-plan refs:** [C1](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c1-write-source-review-doc), [C2](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c2-add-scriptssharedconfigpy-secret-helpers), [C3](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c3-update-requirementstxt), [C7](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c7-add-testspythontest_secrets_isolationpy), [C8](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c8-update-githubworkflowsupdate-datayml-env-block)
- **PR title:** `feat(c1-tv): add TradingView secret scaffolding`
- **Note:** the PR body should explain WHY this PR has no fetcher (defense-in-depth, ship the guard first). Reviewer should run `tests/python/test_secrets_isolation.py` against the PR diff and confirm it would catch a credential leak from any future fetcher.

---

## PR C2: TradingView MOVE candidate

- **Branch:** `feat/c2-tradingview-move`
- **Worktree:** `.worktrees/c2-tv-move`
- **Bundles:**
  - C4 — add `tradingview_move_candidate` to `CANDIDATE_SERIES_PHASE_A` (or a new `TRADINGVIEW_CANDIDATE_SERIES` list; whichever the implementer prefers — split makes the diff smaller). `access_status="authenticated_candidate"`, `requires_secret=True`.
  - C5 — `scripts/ingest/fetch_tradingview_move.py` + test (mock the TV client; verify the JSON shape; no live network in tests)
  - Append `scripts.ingest.fetch_tradingview_move` to `MODULES_INGEST_PHASE_C`
- **Demo-able output:** new `tradingview_move_candidate.json` in `candidates/`. Secrets-isolation test must still pass with the fetcher present.
- **Original-plan refs:** [C4 MOVE row](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c4-add-catalog-entries-for-3-tv-candidates), [C5](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c5-implement-fetch_tradingview_movepy)
- **Deps:** **C1 must be merged first.** Base the worktree off C1's branch tip if C1 is still in review; rebase onto post-merge `main` before opening.
- **PR title:** `feat(c2-tv-move): ingest TradingView MOVE candidate`

---

## PR C3: TradingView put/call candidate

- **Branch:** `feat/c3-tradingview-put-call`
- **Worktree:** `.worktrees/c3-tv-pc`
- **Bundles:**
  - C4 — `tradingview_put_call_candidate` catalog entry
  - C6 first half — `scripts/ingest/fetch_tradingview_put_call.py` + test
  - Append to `MODULES_INGEST_PHASE_C`
- **Demo-able output:** new `tradingview_put_call_candidate.json` in `candidates/`
- **Original-plan refs:** [C4 put/call row](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c4-add-catalog-entries-for-3-tv-candidates), [C6](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c6-implement-fetch_tradingview_put_callpy-and-fetch_tradingview_vx_curvepy)
- **Deps:** C1 merged.
- **PR title:** `feat(c3-tv-pc): ingest TradingView put/call candidate`

---

## PR C4: TradingView VX curve candidate

- **Branch:** `feat/c4-tradingview-vx`
- **Worktree:** `.worktrees/c4-tv-vx`
- **Bundles:**
  - C4 — `tradingview_vx_curve_candidate` catalog entry
  - C6 second half — `scripts/ingest/fetch_tradingview_vx_curve.py` + test
  - Append to `MODULES_INGEST_PHASE_C`
- **Demo-able output:** new `tradingview_vx_curve_candidate.json` in `candidates/`
- **Original-plan refs:** [C4 VX row](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c4-add-catalog-entries-for-3-tv-candidates), [C6](2026-05-10-data-source-and-focus-pattern-expansion.md#task-c6-implement-fetch_tradingview_put_callpy-and-fetch_tradingview_vx_curvepy)
- **Deps:** C1 merged. (C2/C3 NOT required — these 3 fetchers are independent of each other.)
- **PR title:** `feat(c4-tv-vx): ingest TradingView VX curve candidate`

---

## Recommended sequence

1. **C1 scaffolding** first. No code path uses the secret yet; the isolation test ships green against zero fetchers. Reviewer can scrutinize the guard in isolation.
2. **C2 MOVE** second. First real use of the secret. The most-watched of the three (MOVE is the gated source the dashboard most wants); pattern proof is highest-value here.
3. **C3 put/call** third. Reuses the C2 fetcher pattern; smaller surface.
4. **C4 VX curve** fourth. Same as C3.

If you want parallelism after C1 merges, C2/C3/C4 are independent — three worktrees can run from separate sessions. Single-flight default still recommended.

---

## TradingView-specific cross-cutting reminders

- **`requires_secret=True`** on every TV candidate entry. The derivation table in [scripts/shared/access_status.py](../../../scripts/shared/access_status.py) makes this automatic when `access_status="authenticated_candidate"`.
- **Secret values never reach the JSON output.** The fetcher reads the credential, opens a session, downloads the data, writes only the data to `candidates/`. The credential never appears in the output file. The value-leak test in `test_secrets_isolation.py` (shipped in C1) enforces this at runtime.
- **No emojis in source-review doc.**
- **Test fixtures** — mock the `tvdatafeed` client at the test boundary; do NOT hit live TradingView in tests. The fetcher's network call is a single `client.get_hist(...)` call (or similar) — patch that, return a fixture DataFrame, assert the output JSON shape.
- **CI runs the fetcher with real secrets** — GitHub Actions injects `TRADINGVIEW_USERNAME` / `TRADINGVIEW_PASSWORD` from repo secrets when running on `main` post-merge. Local runs without those env vars should fail gracefully (the safe-update path catches the failure; prior good JSON is preserved).
- **`public/data/candidates/` is the only allowed output destination** for any TV-derived file. The candidate-isolation validator enforces no leak into active outputs.
