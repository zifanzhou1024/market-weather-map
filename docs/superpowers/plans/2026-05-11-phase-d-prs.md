# Phase D PRs (4)

**Parent doc:** [2026-05-11-bcd-replan.md](2026-05-11-bcd-replan.md) — start there for the dependency graph, dispatch cadence, worktree bootstrap, and standard verification gate.

**Per-task detail:** [2026-05-10-data-source-and-focus-pattern-expansion.md](2026-05-10-data-source-and-focus-pattern-expansion.md) — chunk 7 (tasks D1-D8). Every PR section below links to the specific tasks; do NOT duplicate per-task detail here.

**Phase D scope:** `FocusBlock` component + `SECTION_CATALOG` data layer + 5 route placements wrapping existing route content with "question → answer" framing.

**Dependencies:** D1 and D2 are independent (parallel-safe). D3 and D4 each require BOTH D1 and D2 merged. D3 and D4 are independent of each other.

---

## PR D1: FocusBlock foundation (component only)

- **Branch:** `feat/d1-focusblock-foundation`
- **Worktree:** `.worktrees/d1-fb-foundation`
- **Bundles:**
  - D1 — add `SectionId` and `SectionInsight` TypeScript types to `src/lib/types.ts`
  - D2 — create `src/components/FocusBlock.tsx` + `src/components/__tests__/FocusBlock.test.tsx`
  - D6 — create `src/__fixtures__/page_insights/` vitest fixtures (sample `page_insights.json` shapes with a `sections` array)
- **Demo-able output:** new component lives in the codebase. Vitest renders FocusBlock in isolation against the fixtures. **No route consumes it yet** — that's intentional; reviewers can focus on the component contract.
- **Original-plan refs:** [D1](2026-05-10-data-source-and-focus-pattern-expansion.md#task-d1-add-sectionid-and-sectioninsight-types), [D2](2026-05-10-data-source-and-focus-pattern-expansion.md#task-d2-create-srccomponentsfocusblocktsx--test), [D6](2026-05-10-data-source-and-focus-pattern-expansion.md#task-d6-create-vitest-fixtures-at-src__fixtures__page_insights)
- **Deps:** none.
- **PR title:** `feat(d1-fb): add FocusBlock component foundation`

---

## PR D2: SECTION_CATALOG data layer

- **Branch:** `feat/d2-section-catalog`
- **Worktree:** `.worktrees/d2-section-cat`
- **Bundles:**
  - D3 — extend `scripts/transform/build_page_insights.py` with `SECTION_CATALOG`: per-route list of sections (each with `section_id`, `question`, `answer_signal_ids`, body text). Build pipeline projects per-route `sections` array into `page_insights.json`.
  - D4 — extend `scripts/validate/validate_schema.py` with a `SectionId` enum check; every `section_id` in `page_insights.json` must be in the catalog.
  - D7 — `tests/python/test_page_insights_duplicate_reads.py`: assert no two sections on the same route reference the same `signal_id` (prevents the "same chart with two different question framings" UX bug).
- **Demo-able output:** regenerated `page_insights.json` carries a new `sections` array per route. Frontend doesn't yet consume it (that's D3/D4).
- **Original-plan refs:** [D3](2026-05-10-data-source-and-focus-pattern-expansion.md#task-d3-extend-build_page_insightspy-with-section_catalog), [D4](2026-05-10-data-source-and-focus-pattern-expansion.md#task-d4-extend-validate_schemapy-with-sectionid-enum-check), [D7](2026-05-10-data-source-and-focus-pattern-expansion.md#task-d7-create-testspythontest_page_insights_duplicate_readspy)
- **Deps:** none (parallel-safe with D1).
- **PR title:** `feat(d2-section): add SECTION_CATALOG to page_insights`

---

## PR D3: FocusBlock placements — wave 1 (Volatility + Rates)

- **Branch:** `feat/d3-fb-placements-wave1`
- **Worktree:** `.worktrees/d3-placements-1`
- **Bundles:**
  - D5 partial — wire `FocusBlock` into Volatility and Rates routes. Each route reads its `sections` array from `page_insights.json` and renders a `FocusBlock` per section above the existing chart content.
- **Demo-able output:** dev-server smoke on `/volatility` and `/rates` shows the FocusBlock with question-answer framing above the existing charts.
- **Original-plan refs:** [D5](2026-05-10-data-source-and-focus-pattern-expansion.md#task-d5-insert-5-focusblock-placements-in-routes) — Volatility + Rates route sub-sections.
- **Deps:** **D1 and D2 BOTH merged.** D3 consumes the component (D1) and the data (D2).
- **PR title:** `feat(d3-fb): place FocusBlock in Volatility + Rates routes`
- **Note:** the PR body should include screenshots of both routes (before/after FocusBlock) so reviewers can sanity-check the visual hierarchy.

---

## PR D4: FocusBlock placements — wave 2 (RegimeMap + Sentiment + Tactical)

- **Branch:** `feat/d4-fb-placements-wave2`
- **Worktree:** `.worktrees/d4-placements-2`
- **Bundles:**
  - D5 partial — wire `FocusBlock` into RegimeMap, Sentiment, and Tactical routes.
- **Demo-able output:** dev-server smoke on `/regime-map`, `/sentiment`, `/tactical`.
- **Original-plan refs:** D5 RegimeMap + Sentiment + Tactical sub-sections.
- **Deps:** D1 and D2 merged. D3 NOT required — different routes; D3 and D4 are parallel-safe.
- **PR title:** `feat(d4-fb): place FocusBlock in RegimeMap + Sentiment + Tactical routes`
- **Note:** also include screenshots in PR body.

---

## Recommended sequence

1. **D1 foundation** first. Component lands in isolation; reviewers focus on the FocusBlock contract (props, accessibility, responsive behavior, story matrix).
2. **D2 data layer** second (or parallel to D1 if you have two worktrees). Backend ships the `sections` array; isolation validator passes; duplicate-reads test passes.
3. **D3 wave 1** third. First two route placements — Volatility and Rates. These are the highest-traffic routes; placement quality here sets the bar.
4. **D4 wave 2** fourth. Remaining three routes; mechanical once D3's pattern is reviewed and approved.

If single-flight: D1 → D2 → D3 → D4. If you want one overlap: D1 + D2 in parallel (the only safe overlap in Phase D), then D3 → D4 sequential.

---

## FocusBlock-specific cross-cutting reminders

- **Component first, placements second.** D1 ships a component with NO route consumers — that's the point. Reviewers can scrutinize the component's contract (props, accessibility, responsive layout, dark mode, story matrix) without route noise.
- **Data layer ships separately.** D2 changes only `build_page_insights.py` and the validator; frontend code does NOT consume `sections` yet. The regenerated JSON is forwards-compatible: routes that ignore `sections` keep working.
- **No duplicate signal reads on a route.** D7's test prevents two sections from referencing the same `signal_id` on the same route. The "same chart under two questions" UX bug is real — guard at the data layer, not the component.
- **`SectionId` enum** is the single source of truth (`scripts/validate/validate_schema.py` enforces it; the TS type mirrors it in `src/lib/types.ts`). Adding a new section means editing both.
- **Accessibility** — FocusBlock has a question heading and an answer body. The heading should be a proper `<h3>` (or appropriate level given its place in the route's heading hierarchy), not a styled `<div>`. Test in axe / vitest-axe.
- **Visual smoke required** for D3 and D4 PRs — start the dev server (`npm run dev`), open each placed route in a browser, confirm the FocusBlock renders correctly above existing route content. Include screenshots in the PR body. UI changes can't be verified by tests alone.
- **No emojis in section question/answer text.** Plain English.
