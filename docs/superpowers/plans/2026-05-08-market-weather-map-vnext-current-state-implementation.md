# Market Weather Map vNext Current-State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the still-missing vNext product-clarity work that turns the current static market dashboard into a horizon-based decision system.

**Architecture:** Preserve the existing static GitHub Pages model. React reads generated static JSON through `src/lib/data.ts`; Python generation and scoring remain unchanged unless a task explicitly proves a contract gap with a failing test. Candidate sources may be displayed as source-gated readiness rows, but cannot affect active scores, labels, checklist states, or confidence.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Recharts 3, Vitest/jsdom, Python 3.11, pytest, static JSON under `public/data`.

---

## Required Context

Read this spec before coding:

- `docs/superpowers/specs/2026-05-08-market-weather-map-vnext-current-state-design.md`

Treat these older docs as history, not as the active queue:

- `docs/superpowers/plans/2026-05-07-horizon-regime-decision-system.md`
- `docs/superpowers/plans/2026-05-07-horizon-regime-program-execution.md`
- `docs/superpowers/plans/2026-05-07-pr2-tactical-options-event-risk.md`
- `docs/superpowers/plans/2026-05-07-pr3-fragility-shock-risk.md`
- `docs/superpowers/plans/2026-05-07-pr4-strategic-macro-completeness.md`
- `docs/superpowers/plans/2026-05-07-pr5-regime-replay-research.md`

## Subagent Dispatch Order

Run tasks in order unless explicitly split by a lead agent. Task 7 can run in parallel with Tasks 1-6 because it only writes `docs/source_reviews/`. All UI tasks should be reviewed before starting the next UI task because they share route tests and layout CSS.

Do not let any worker edit `.idea/`, add browser-side data providers, add secrets, add a backend, or promote candidate sources.

## File Ownership Map

Task 1 owns:

- `src/App.tsx`
- `src/components/AppLayout.tsx`
- `src/styles.css`
- `src/routes/data-routes.test.tsx`

Task 2 owns:

- `src/lib/horizon.ts`
- `src/lib/horizon.test.ts`
- `src/components/HorizonScoreHeader.tsx`
- `src/components/OverviewDecisionCard.tsx`
- `src/components/HorizonImpactMatrix.tsx`
- `src/components/horizon-components.test.tsx`

Task 3 owns:

- `src/routes/Overview.tsx`
- `src/routes/data-routes.test.tsx`
- uses Task 2 components

Task 4 owns:

- `src/routes/TacticalTradingWeather.tsx`
- `src/components/VolatilityTermStructurePanel.tsx`
- `src/components/CreditPulsePanel.tsx`
- `src/components/DollarRealYieldPressurePanel.tsx`
- `src/components/LiquidityPulsePanel.tsx`
- `src/routes/data-routes.test.tsx`
- uses `src/lib/horizon.ts`

Task 5 owns:

- `src/routes/LongTermMacroClimate.tsx`
- `src/components/StrategicSourceGapsPanel.tsx`
- `src/routes/data-routes.test.tsx`

Task 6 owns:

- `src/routes/RegimeMap.tsx`
- `src/routes/FragilityShockRisk.tsx`
- `src/components/RegimeInterpretationPanel.tsx`
- `src/components/ShockRiskReadHeader.tsx`
- `src/routes/data-routes.test.tsx`

Task 7 owns:

- `docs/source_reviews/cboe_put_call.md`
- `docs/source_reviews/cboe_skew.md`
- `docs/source_reviews/ice_move.md`
- `docs/source_reviews/vix_futures_curve.md`
- `docs/source_reviews/ny_fed_acm_term_premium.md`

Task 8 owns final verification only and should avoid file edits unless verification exposes a small defect owned by the task it is fixing.

---

## Task 1: Group Navigation and Canonical Horizon Routes

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/styles.css`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write failing route and navigation tests**

Add test cases to `src/routes/data-routes.test.tsx` near the existing route tests:

```tsx
it("renders canonical short-term and long-term horizon routes", async () => {
  mockStaticFetch(routeFetchFiles());

  const shortTerm = render(
    <MemoryRouter initialEntries={["/short-term"]}>
      <App />
    </MemoryRouter>
  );
  await waitForContent(shortTerm, "Short-Term Market Reaction");

  shortTerm.unmount();

  const longTerm = render(
    <MemoryRouter initialEntries={["/long-term"]}>
      <App />
    </MemoryRouter>
  );
  await waitForContent(longTerm, "Long-Term Macro / Allocation Climate");
});

it("keeps tactical and macro-climate deep links compatible", async () => {
  mockStaticFetch(routeFetchFiles());

  const tactical = render(
    <MemoryRouter initialEntries={["/tactical"]}>
      <App />
    </MemoryRouter>
  );
  await waitForContent(tactical, "Short-Term Market Reaction");

  tactical.unmount();

  const macro = render(
    <MemoryRouter initialEntries={["/macro-climate"]}>
      <App />
    </MemoryRouter>
  );
  await waitForContent(macro, "Long-Term Macro / Allocation Climate");
});

it("renders grouped navigation with primary views before the data library", async () => {
  mockStaticFetch(routeFetchFiles());

  const container = render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Primary Views");
  const text = container.textContent ?? "";
  expect(text.indexOf("Primary Views")).toBeLessThan(text.indexOf("Data Library"));
  expect(text.indexOf("Data Library")).toBeLessThan(text.indexOf("Reference"));
  expect(text).toContain("Short-Term");
  expect(text).toContain("Long-Term");
});
```

- [ ] **Step 2: Run the failing test slice**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: FAIL because `/short-term`, `/long-term`, grouped nav labels, and renamed route headings are not implemented yet.

- [ ] **Step 3: Update routes**

Change `src/App.tsx` so canonical routes use `/short-term` and `/long-term`, while old deep links redirect:

```tsx
<Route path="/" element={<Overview />} />
<Route path="/short-term" element={<TacticalTradingWeather />} />
<Route path="/tactical" element={<Navigate to="/short-term" replace />} />
<Route path="/long-term" element={<LongTermMacroClimate />} />
<Route path="/macro-climate" element={<Navigate to="/long-term" replace />} />
<Route path="/fragility" element={<FragilityShockRisk />} />
<Route path="/regime-map" element={<RegimeMap />} />
<Route path="/replay" element={<HistoricalRegimeReplay />} />
```

Keep all existing data-library and reference routes.

- [ ] **Step 4: Replace flat nav with grouped sections**

Replace `navItems` in `src/components/AppLayout.tsx` with:

```tsx
const navSections = [
  {
    label: "Primary Views",
    items: [
      { to: "/", label: "Overview" },
      { to: "/short-term", label: "Short-Term", ariaLabel: "Short-Term Market Reaction" },
      { to: "/long-term", label: "Long-Term", ariaLabel: "Long-Term Macro / Allocation Climate" },
      { to: "/fragility", label: "Fragility" },
      { to: "/regime-map", label: "Regime Map" },
      { to: "/replay", label: "Replay", ariaLabel: "Historical Regime Replay" }
    ]
  },
  {
    label: "Data Library",
    items: [
      { to: "/volatility", label: "Volatility" },
      { to: "/rates", label: "Rates" },
      { to: "/liquidity", label: "Liquidity" },
      { to: "/credit", label: "Credit" },
      { to: "/dollar-global", label: "Dollar" },
      { to: "/commodities", label: "Commodities" },
      { to: "/growth", label: "Growth" },
      { to: "/housing", label: "Housing" },
      { to: "/inflation", label: "Inflation" },
      { to: "/sentiment", label: "Positioning" }
    ]
  },
  {
    label: "Reference",
    items: [
      { to: "/calendar", label: "Calendar" },
      { to: "/methodology", label: "Methodology" }
    ]
  }
];
```

Render each section with a visible section label and the existing `NavLink` behavior. Set `end={item.to === "/"}`.

- [ ] **Step 5: Add grouped nav CSS**

Add compact responsive styles to `src/styles.css`:

```css
.site-nav {
  align-items: stretch;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.nav-section {
  border-left: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding-left: 0.75rem;
}

.nav-section:first-child {
  border-left: 0;
  padding-left: 0;
}

.nav-section__label {
  color: var(--muted);
  flex-basis: 100%;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

Adjust the existing mobile `@media` block so `.nav-section` becomes full-width and no link text overflows.

- [ ] **Step 6: Rename route headings**

In `src/routes/TacticalTradingWeather.tsx`, change the visible heading to `Short-Term Market Reaction` and keep `Tactical Trading Weather` as the eyebrow or supporting text.

In `src/routes/LongTermMacroClimate.tsx`, change the visible heading to `Long-Term Macro / Allocation Climate`.

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/AppLayout.tsx src/styles.css src/routes/data-routes.test.tsx
git commit -m "feat: group horizon navigation"
```

---

## Task 2: Add Shared Horizon UI Helpers

**Files:**

- Create: `src/lib/horizon.ts`
- Create: `src/lib/horizon.test.ts`
- Create: `src/components/HorizonScoreHeader.tsx`
- Create: `src/components/OverviewDecisionCard.tsx`
- Create: `src/components/HorizonImpactMatrix.tsx`
- Create: `src/components/horizon-components.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write helper tests**

Create `src/lib/horizon.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  classifyNearTermEventVol,
  classifyVixProxy,
  countSourceGaps,
  firstText,
  scoreLabel
} from "./horizon";

describe("horizon helpers", () => {
  it("classifies VIX proxy curve states", () => {
    expect(classifyVixProxy(21, 20).label).toBe("Backwardation-like stress");
    expect(classifyVixProxy(18, 20).label).toBe("Contango-like calm");
    expect(classifyVixProxy(19.8, 20).label).toBe("Flat / transition");
  });

  it("classifies near-term event-vol pressure", () => {
    expect(classifyNearTermEventVol(22, 20).label).toBe("Elevated near-term event risk");
    expect(classifyNearTermEventVol(18, 20).label).toBe("Near-term vol discounted");
    expect(classifyNearTermEventVol(20, 20).label).toBe("Balanced near-term vol");
  });

  it("handles unavailable numeric inputs", () => {
    expect(classifyVixProxy(null, 20).label).toBe("Unavailable");
    expect(classifyNearTermEventVol(20, undefined).label).toBe("Unavailable");
  });

  it("summarizes text and source gaps defensively", () => {
    expect(firstText(["A", "B"], "Fallback")).toBe("A");
    expect(firstText([], "Fallback")).toBe("Fallback");
    expect(scoreLabel({ score: 12.3, label: "Mixed" })).toBe("Mixed 12.3");
    expect(countSourceGaps([{ status: "terms_review_needed" }, { status: "ok" }])).toBe(1);
  });
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
npm run test -- src/lib/horizon.test.ts --run
```

Expected: FAIL because `src/lib/horizon.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/horizon.ts`**

Create:

```ts
import type { DataStatus, ScoreBlock } from "./types";

export interface Classification {
  label: string;
  tone: "supportive" | "neutral" | "risk" | "unavailable";
  ratio: number | null;
}

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function classifyVixProxy(vix: number | null | undefined, vix3m: number | null | undefined): Classification {
  if (!finiteNumber(vix) || !finiteNumber(vix3m) || vix3m === 0) {
    return { label: "Unavailable", tone: "unavailable", ratio: null };
  }

  const ratio = vix / vix3m;
  if (ratio >= 1.03) return { label: "Backwardation-like stress", tone: "risk", ratio };
  if (ratio <= 0.97) return { label: "Contango-like calm", tone: "supportive", ratio };
  return { label: "Flat / transition", tone: "neutral", ratio };
}

export function classifyNearTermEventVol(
  vix9d: number | null | undefined,
  vix: number | null | undefined
): Classification {
  if (!finiteNumber(vix9d) || !finiteNumber(vix) || vix === 0) {
    return { label: "Unavailable", tone: "unavailable", ratio: null };
  }

  const ratio = vix9d / vix;
  if (ratio >= 1.08) return { label: "Elevated near-term event risk", tone: "risk", ratio };
  if (ratio <= 0.92) return { label: "Near-term vol discounted", tone: "supportive", ratio };
  return { label: "Balanced near-term vol", tone: "neutral", ratio };
}

export function firstText(items: string[] | undefined, fallback: string) {
  const first = Array.isArray(items) ? items.find((item) => item.trim().length > 0) : undefined;
  return first ?? fallback;
}

export function scoreLabel(score: Pick<ScoreBlock, "score" | "label">) {
  return `${score.label} ${score.score.toFixed(1)}`;
}

export function countSourceGaps(rows: Array<{ status?: DataStatus | string }> | undefined) {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => row.status && row.status !== "ok").length;
}
```

- [ ] **Step 4: Create shared display components**

Create `src/components/HorizonScoreHeader.tsx`:

```tsx
import ScoreCard from "./ScoreCard";
import SignalList from "./SignalList";
import type { ScoreBlock } from "../lib/types";

interface HorizonScoreHeaderProps {
  eyebrow: string;
  title: string;
  summary: string;
  score?: ScoreBlock;
  secondaryScore?: ScoreBlock;
  facts: Array<{ label: string; value: string }>;
  supports?: string[];
  risks?: string[];
}

export default function HorizonScoreHeader({
  eyebrow,
  facts,
  risks = [],
  score,
  secondaryScore,
  summary,
  supports = [],
  title
}: HorizonScoreHeaderProps) {
  return (
    <section className="panel horizon-header">
      <div className="section-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{summary}</p>
        </div>
      </div>
      <div className="horizon-header__facts">
        {facts.map((fact) => (
          <article className="metric-card" key={fact.label}>
            <p className="metric-source">{fact.label}</p>
            <strong>{fact.value}</strong>
          </article>
        ))}
      </div>
      {score || secondaryScore ? (
        <section className="score-grid" aria-label={`${title} score cards`}>
          {score ? <ScoreCard score={score} title={score.label.includes("Fragility") ? "Fragility" : "Primary score"} /> : null}
          {secondaryScore ? <ScoreCard score={secondaryScore} title="Fragility overlay" /> : null}
        </section>
      ) : null}
      <section className="detail-grid">
        <SignalList emptyText="No supports in the current score summary." items={supports.slice(0, 4)} title="Supports" />
        <SignalList emptyText="No risks in the current score summary." items={risks.slice(0, 4)} title="Risks" />
      </section>
    </section>
  );
}
```

Create `src/components/OverviewDecisionCard.tsx`:

```tsx
import { Link } from "react-router-dom";

interface OverviewDecisionCardProps {
  title: string;
  horizon: string;
  to: string;
  label: string;
  support: string;
  risk: string;
  sourceGapCount?: number;
}

export default function OverviewDecisionCard({
  horizon,
  label,
  risk,
  sourceGapCount = 0,
  support,
  title,
  to
}: OverviewDecisionCardProps) {
  return (
    <article className="decision-card">
      <div>
        <p className="eyebrow">{horizon}</p>
        <h3>{title}</h3>
        <strong>{label}</strong>
      </div>
      <p>Support: {support}</p>
      <p>Risk: {risk}</p>
      <p>{sourceGapCount} source gaps or candidate rows visible.</p>
      <Link className="decision-card__link" to={to}>
        Open view
      </Link>
    </article>
  );
}
```

Create `src/components/HorizonImpactMatrix.tsx` with a local row array for VIX, put/call, credit spreads, real yields, breakevens, dollar, net liquidity, CPI/FOMC/payrolls, labor trend, housing, consumer debt service, valuation/ERP, and Treasury supply/term premium.

- [ ] **Step 5: Add component tests**

Create `src/components/horizon-components.test.tsx`:

```tsx
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import HorizonImpactMatrix from "./HorizonImpactMatrix";
import OverviewDecisionCard from "./OverviewDecisionCard";

describe("horizon display components", () => {
  it("renders overview decision card with source gaps", () => {
    const container = render(
      <MemoryRouter>
        <OverviewDecisionCard
          horizon="1 day to 4 weeks"
          label="Mixed"
          risk="Credit widening"
          sourceGapCount={3}
          support="VIX contained"
          title="Short-Term Market Reaction"
          to="/short-term"
        />
      </MemoryRouter>
    );

    expect(container.getByText("Short-Term Market Reaction")).toBeTruthy();
    expect(container.getByText("3 source gaps or candidate rows visible.")).toBeTruthy();
  });

  it("renders horizon impact matrix rows", () => {
    const container = render(<HorizonImpactMatrix />);

    expect(container.getByText("VIX / VIX curve")).toBeTruthy();
    expect(container.getByText("Treasury supply / term premium")).toBeTruthy();
  });
});
```

- [ ] **Step 6: Add CSS for shared components**

Add:

```css
.decision-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.decision-card__link {
  color: var(--accent);
  font-weight: 700;
}

.horizon-header {
  display: grid;
  gap: 1rem;
}

.horizon-header__facts,
.horizon-impact-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm run test -- src/lib/horizon.test.ts src/components/horizon-components.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/horizon.ts src/lib/horizon.test.ts src/components/HorizonScoreHeader.tsx src/components/OverviewDecisionCard.tsx src/components/HorizonImpactMatrix.tsx src/components/horizon-components.test.tsx src/styles.css
git commit -m "feat: add shared horizon UI helpers"
```

---

## Task 3: Redesign Overview as Decision Hub

**Files:**

- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write failing Overview tests**

Add tests:

```tsx
it("renders overview as a horizon decision hub", async () => {
  mockStaticFetch(routeFetchFiles());

  const container = render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Short-Term Market Reaction");
  expect(container.textContent).toContain("Long-Term Macro / Allocation Climate");
  expect(container.textContent).toContain("Fragility / Shock Risk");
  expect(container.textContent).toContain("TIPS x Dollar Regime Map");
  expect(container.textContent).toContain("Short-Term Impact");
  expect(container.textContent).toContain("Long-Term Impact");
});

it("renders overview when score history is unavailable", async () => {
  mockStaticFetch(routeFetchFiles({ "/data/derived/score_history.json": undefined }));

  const container = render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Short-Term Market Reaction");
  expect(container.textContent).toContain("Data quality");
});
```

Use the existing mock helper pattern in `data-routes.test.tsx`; if the helper does not accept `undefined`, remove the score-history key from the mock files before installing fetch.

- [ ] **Step 2: Run failing Overview tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: FAIL because the decision cards and matrix are not rendered.

- [ ] **Step 3: Update Overview data load**

In `src/routes/Overview.tsx`, add `loadRegimeSnapshot()` and `loadShockRiskSnapshot()` to the import and state. Keep `loadScoreHistory().catch(() => null)`.

Extend `OverviewState`:

```ts
  regimeSnapshot: RegimeSnapshotFile;
  shockSnapshot: ShockRiskSnapshotFile;
```

Load them in the existing `Promise.all`.

- [ ] **Step 4: Render decision cards before the score grid**

Use `OverviewDecisionCard` and `HorizonImpactMatrix`. Build the cards from existing loaded data:

```tsx
<section className="decision-grid" aria-label="Decision views">
  <OverviewDecisionCard
    horizon="1 day to 4 weeks"
    label={scoreLabel(market)}
    risk={firstText(market.top_risks, "No top short-term risk in the current summary.")}
    sourceGapCount={countSourceGaps(data.shockSnapshot.source_gaps)}
    support={firstText(market.top_supports, "No top short-term support in the current summary.")}
    title="Short-Term Market Reaction"
    to="/short-term"
  />
  <OverviewDecisionCard
    horizon="3 months to several years"
    label={scoreLabel(macro)}
    risk={firstText(macro.top_risks, "No top long-term risk in the current summary.")}
    support={firstText(macro.top_supports, "No top long-term support in the current summary.")}
    title="Long-Term Macro / Allocation Climate"
    to="/long-term"
  />
  <OverviewDecisionCard
    horizon="Shock-risk overlay"
    label={`${data.shockSnapshot.label} ${data.shockSnapshot.score.toFixed(1)}`}
    risk={firstText(fragility.top_risks, "No top fragility risk in the current summary.")}
    sourceGapCount={countSourceGaps(data.shockSnapshot.source_gaps)}
    support={firstText(fragility.top_supports, "No top fragility support in the current summary.")}
    title="Fragility / Shock Risk"
    to="/fragility"
  />
  <OverviewDecisionCard
    horizon="Cross-asset regime"
    label={data.regimeSnapshot.regime.label}
    risk={firstText(conflictingSignals, "No conflicts in the current score summary.")}
    support={`Yield driver: ${data.regimeSnapshot.regime.yield_driver}`}
    title="TIPS x Dollar Regime Map"
    to="/regime-map"
  />
</section>
<HorizonImpactMatrix />
```

- [ ] **Step 5: Add Overview CSS**

Add:

```css
.decision-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}
```

- [ ] **Step 6: Run Overview tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/Overview.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: make overview a horizon decision hub"
```

---

## Task 4: Upgrade Short-Term Market Reaction Page

**Files:**

- Modify: `src/routes/TacticalTradingWeather.tsx`
- Create: `src/components/VolatilityTermStructurePanel.tsx`
- Create: `src/components/CreditPulsePanel.tsx`
- Create: `src/components/DollarRealYieldPressurePanel.tsx`
- Create: `src/components/LiquidityPulsePanel.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write failing Short-Term tests**

Add expectations to the `/short-term` route test:

```tsx
await waitForContent(container, "Short-Term Market Reaction");
expect(container.textContent).toContain("Current Tactical Read");
expect(container.textContent).toContain("Volatility term-structure");
expect(container.textContent).toContain("Credit pulse");
expect(container.textContent).toContain("Dollar + real-yield pressure");
expect(container.textContent).toContain("Liquidity pulse");
expect(container.textContent).toContain("Options sentiment");
expect(container.textContent).toContain("Event risk");
```

- [ ] **Step 2: Run failing Short-Term tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: FAIL because the new module headings are not present.

- [ ] **Step 3: Create VolatilityTermStructurePanel**

Create `src/components/VolatilityTermStructurePanel.tsx` that accepts loaded VIX, VIX9D, VIX3M, and chart series. Use `classifyVixProxy()` and `classifyNearTermEventVol()` from `src/lib/horizon.ts`. Render the current curve state, near-term event-vol state, and the existing `MultiSeriesChart`.

- [ ] **Step 4: Create pulse panels**

Create small panels that accept already loaded series arrays and render latest value/change summaries:

- `CreditPulsePanel`: `high_yield_oas`, `hy_minus_ig_oas`, and available credit rows.
- `DollarRealYieldPressurePanel`: `broad_dollar`, `real_yield_10y`, and regime snapshot yield driver.
- `LiquidityPulsePanel`: `net_liquidity` and any already available liquidity rows.

Each panel must use unavailable text when a row is not loaded instead of fetching new JSON.

- [ ] **Step 5: Update TacticalTradingWeather render order**

Render:

1. `HorizonScoreHeader` titled `Current Tactical Read`.
2. `SignalChecklist`.
3. `VolatilityTermStructurePanel`.
4. `CreditPulsePanel`.
5. `DollarRealYieldPressurePanel`.
6. `LiquidityPulsePanel`.
7. `OptionsSentimentPanel`.
8. `EventRiskPanel`.
9. `VixFuturesReadinessPanel`.
10. Data gaps and status.

Do not fetch candidate option or VX series as active series.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm run test -- src/lib/horizon.test.ts src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/TacticalTradingWeather.tsx src/components/VolatilityTermStructurePanel.tsx src/components/CreditPulsePanel.tsx src/components/DollarRealYieldPressurePanel.tsx src/components/LiquidityPulsePanel.tsx src/routes/data-routes.test.tsx
git commit -m "feat: clarify short-term market reaction"
```

---

## Task 5: Upgrade Long-Term Macro / Allocation Climate Page

**Files:**

- Modify: `src/routes/LongTermMacroClimate.tsx`
- Create: `src/components/StrategicSourceGapsPanel.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write failing Long-Term tests**

Add expectations:

```tsx
await waitForContent(container, "Long-Term Macro / Allocation Climate");
expect(container.textContent).toContain("Current Long-Term Read");
expect(container.textContent).toContain("Macro bucket grid");
expect(container.textContent).toContain("Strategic source gaps");
expect(container.textContent).toContain("PMIs");
expect(container.textContent).toContain("SLOOS");
expect(container.textContent).toContain("term premium");
expect(container.textContent).toContain("Treasury supply");
expect(container.textContent).toContain("valuation");
expect(container.textContent).toContain("earnings revisions");
```

- [ ] **Step 2: Run failing Long-Term tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: FAIL because the new top read and source-gap panel are not present.

- [ ] **Step 3: Create StrategicSourceGapsPanel**

Create `src/components/StrategicSourceGapsPanel.tsx` with fixed candidate rows:

```ts
const strategicRows = [
  { label: "PMIs", status: "terms_review_needed", note: "Strategic breadth input remains source-gated." },
  { label: "SLOOS", status: "terms_review_needed", note: "Bank lending survey transformation and redistribution remain under review." },
  { label: "Term premium", status: "terms_review_needed", note: "NY Fed ACM or equivalent source requires access review before scoring." },
  { label: "Treasury supply", status: "terms_review_needed", note: "Issuance and auction data require source-governed static publication rules." },
  { label: "Valuation", status: "terms_review_needed", note: "CAPE, forward P/E, ERP, and related valuation inputs remain candidate-only." },
  { label: "Earnings revisions", status: "terms_review_needed", note: "Analyst revision data remains candidate-only until a compliant source is approved." }
];
```

Render them with existing status-pill styling.

- [ ] **Step 4: Add Current Long-Term Read**

Use `HorizonScoreHeader` in `LongTermMacroClimate.tsx` with facts:

- Growth: bucket score.
- Labor: bucket score.
- Inflation: bucket score.
- Real yields: bucket score.
- Credit cycle: bucket score when available.
- Liquidity cycle: bucket score when available.

Use copy that says slow data can influence allocation conditions over months or quarters.

- [ ] **Step 5: Add macro bucket grid label**

Keep existing `MacroCyclePanel` rendering, but wrap it in a section with visible heading `Macro bucket grid`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/LongTermMacroClimate.tsx src/components/StrategicSourceGapsPanel.tsx src/routes/data-routes.test.tsx
git commit -m "feat: clarify long-term macro climate"
```

---

## Task 6: Add Regime and Fragility Interpretation Headers

**Files:**

- Modify: `src/routes/RegimeMap.tsx`
- Modify: `src/routes/FragilityShockRisk.tsx`
- Create: `src/components/RegimeInterpretationPanel.tsx`
- Create: `src/components/ShockRiskReadHeader.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write failing Regime and Fragility tests**

Add:

```tsx
it("renders regime interpretation and conflict context", async () => {
  mockStaticFetch(routeFetchFiles({ "/data/derived/regime_snapshot.json": regimeSnapshot }));

  const container = render(
    <MemoryRouter initialEntries={["/regime-map"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "TIPS x Dollar Regime Map");
  expect(container.textContent).toContain("What confirms it");
  expect(container.textContent).toContain("What conflicts with it");
  expect(container.textContent).toContain("What weakens confidence");
});

it("renders fragility active and candidate stress channel read", async () => {
  mockStaticFetch(routeFetchFiles());

  const container = render(
    <MemoryRouter initialEntries={["/fragility"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Current Shock-Risk Read");
  expect(container.textContent).toContain("Active stress channels");
  expect(container.textContent).toContain("Candidate stress channels");
  expect(container.textContent).toContain("MOVE");
  expect(container.textContent).toContain("SKEW");
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: FAIL because interpretation panels do not exist.

- [ ] **Step 3: Create RegimeInterpretationPanel**

Create a component that accepts `RegimeSnapshotFile` and `ScoreSummaryFile`. It renders:

- Current regime label.
- Yield driver.
- `What confirms it`: confirmations with status containing `confirm`.
- `What conflicts with it`: score-summary conflicts plus confirmations with status containing `diverg`.
- `What weakens confidence`: confirmations with status containing `missing`, `stale`, `candidate`, or `unavailable`.

Use defensive arrays so malformed snapshot rows render empty-state copy.

- [ ] **Step 4: Update RegimeMap data load**

Update `src/routes/RegimeMap.tsx` to load `loadScoreSummary()` along with `loadRegimeSnapshot()`, then render `RegimeInterpretationPanel` above the charts.

- [ ] **Step 5: Create ShockRiskReadHeader**

Create a component that accepts score summary, shock snapshot, and optional catalog/status. It renders:

- Fragility score and label.
- Active stress channel labels from `shockSnapshot.active_signals`.
- Candidate stress channel labels from `shockSnapshot.source_gaps`.
- Mismatch warning count.
- Source-gap count.

Use empty-state text for malformed arrays.

- [ ] **Step 6: Update FragilityShockRisk**

Render `ShockRiskReadHeader` before the existing `InterpretationPanel` and keep the existing dashboard, tail-risk panel, mismatch panel, gaps, and status.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/routes/RegimeMap.tsx src/routes/FragilityShockRisk.tsx src/components/RegimeInterpretationPanel.tsx src/components/ShockRiskReadHeader.tsx src/routes/data-routes.test.tsx
git commit -m "feat: explain regime and fragility context"
```

---

## Task 7: Add Source Review Documents

**Files:**

- Create: `docs/source_reviews/cboe_put_call.md`
- Create: `docs/source_reviews/cboe_skew.md`
- Create: `docs/source_reviews/ice_move.md`
- Create: `docs/source_reviews/vix_futures_curve.md`
- Create: `docs/source_reviews/ny_fed_acm_term_premium.md`

- [ ] **Step 1: Create the source review directory**

Run:

```bash
mkdir -p docs/source_reviews
```

- [ ] **Step 2: Add Cboe put/call review**

Create `docs/source_reviews/cboe_put_call.md`:

```md
# Cboe Put/Call Source Review

## Candidate Use

Display source-gated options sentiment rows for SPX, SPXW, index, equity, VIX, ETP, and total put/call categories.

## Review Answers

1. Historical data publicly accessible: Unknown for automated historical redistribution.
2. Automated download allowed: Not approved.
3. Static JSON redistribution allowed: Not approved.
4. Attribution required: Review required.
5. Delayed publication required: Review required.
6. Commercial use restricted: Review required.
7. Can the source be scored: No.
8. Current status: `terms_review_needed`.

## Decision

Keep Cboe put/call rows candidate-only. They may appear in readiness/source-gap UI but must not affect active scores, regime labels, checklist states, or confidence.
```

- [ ] **Step 3: Add the remaining source reviews**

Create the remaining four files with the same answer structure and these decisions:

- `docs/source_reviews/cboe_skew.md`: status `terms_review_needed`; use case is equity tail-risk confirmation.
- `docs/source_reviews/ice_move.md`: status `terms_review_needed`; use case is bond-volatility fragility.
- `docs/source_reviews/vix_futures_curve.md`: status `terms_review_needed`; use case is true VX term structure after review.
- `docs/source_reviews/ny_fed_acm_term_premium.md`: status `terms_review_needed`; use case is strategic term-premium decomposition.

Each file must explicitly say the source cannot be scored until review is complete.

- [ ] **Step 4: Verify no source was promoted**

Run:

```bash
rg -n "Current status: `free_public`|Can the source be scored: Yes" docs/source_reviews
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add docs/source_reviews
git commit -m "docs: add candidate source review records"
```

---

## Task 8: Final Verification and Review

**Files:**

- No planned edits.

- [ ] **Step 1: Run frontend tests**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run Python tests**

```bash
python -m pytest tests/python -v
```

Expected: PASS.

- [ ] **Step 4: Run data workflow validation**

```bash
python -m scripts.update_data
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

Expected: PASS. If dependencies are unavailable, capture the exact missing package or command failure in the handoff.

- [ ] **Step 5: Scan for advice language**

```bash
rg -n "buy|sell|short|entry|target|stop loss|recommendation" src docs README.md
```

Expected: no newly introduced trade-advice language. Existing historical docs can be reviewed case-by-case if they contain quoted constraints.

- [ ] **Step 6: Inspect git status**

```bash
git status --short
```

Expected: only intentional implementation files are changed, or the tree is clean after commits.

- [ ] **Step 7: Manual QA**

Open the app locally and verify:

1. Homepage shows decision cards before data-library detail.
2. Primary Views appears before Data Library.
3. `/short-term` renders the tactical read and all short-term modules.
4. `/tactical` lands on the short-term page.
5. `/long-term` renders the strategic read and source gaps.
6. `/macro-climate` lands on the long-term page.
7. Regime Map explains confirmations, conflicts, and confidence gaps.
8. Fragility separates active and candidate stress channels.
9. Candidate sources remain source-gated.

---

## Self-Review

- Spec coverage: Tasks cover navigation/routes, Overview decision hub, Short-Term page, Long-Term page, Regime Map, Fragility, source-review docs, and final verification.
- Completeness scan: the plan avoids unfinished markers and gives concrete file paths, commands, expected outcomes, and component responsibilities.
- Type consistency: route names, loader names, and existing component names match the current repo state described in the spec.
