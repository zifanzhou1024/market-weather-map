# Market Weather Map vNext Follow-Up Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the follow-up product polish after PR #14 by making data quality, source-gated inputs, regime confirmations, fragility hidden stress, and nav regressions clearer without adding new data ingestion or scoring.

**Architecture:** Keep the static GitHub Pages architecture intact. Add focused React components and tests that consume existing static JSON loader output; do not mutate generated data contracts except through existing types. Candidate rows remain display-only and cannot affect active scores, labels, checklist states, or confidence.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Vitest/jsdom, Recharts, Python pytest, static JSON in `public/data`.

---

## Required Context

Read first:

- `docs/superpowers/specs/2026-05-08-market-weather-map-vnext-follow-up-polish-design.md`

Implementation workspace:

- Worktree: `/Users/sakura/WebstormProjects/market-weather-map/.worktrees/vnext-polish-followup`
- Branch: `codex/vnext-polish-followup`
- Base: `origin/main` after PR #14 was merged

Baseline verification already run in this worktree:

- `npm install` passed.
- `npm run test` passed: 9 files, 130 tests.
- `/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python -q` passed: 186 tests.
- Default `/opt/homebrew/bin/python3` lacks pytest in this environment, so use the Python 3.12 path above for Python verification unless the environment changes.

## Non-Negotiable Constraints

- Do not add backend services, databases, browser-side API keys, live feeds, paid/authenticated frontend calls, or real-time trading data.
- Do not write trade recommendations, financial advice, forecasts, entries, targets, stop-loss language, or personalized guidance.
- Do not promote Cboe put/call, VX futures, MOVE, SKEW, valuation, term premium, Treasury supply, PMIs, SLOOS, earnings revisions, or fiscal/interest-expense rows into active scoring.
- Do not fetch candidate payload files from the frontend.
- Do not edit `.idea/` or `.superpowers/`.

## File Ownership Map

Task 1 owns:

- `src/routes/data-routes.test.tsx`

Task 2 owns:

- Create: `src/components/DataQualityBanner.tsx`
- Create: `src/components/DataQualityBanner.test.tsx`
- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/TacticalTradingWeather.tsx`
- Modify: `src/routes/LongTermMacroClimate.tsx`
- Modify: `src/routes/RegimeMap.tsx`
- Modify: `src/routes/FragilityShockRisk.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css`

Task 3 owns:

- Modify: `src/components/OptionsSentimentPanel.tsx`
- Modify: `src/components/StrategicSourceGapsPanel.tsx`
- Modify: `src/components/data-components.test.tsx`

Task 4 owns:

- Modify: `src/components/CrossAssetConfirmationMatrix.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/routes/RegimeMap.tsx`
- Modify: `src/routes/data-routes.test.tsx`

Task 5 owns:

- Create: `src/components/HiddenStressSummary.tsx`
- Create or modify: `src/components/HiddenStressSummary.test.tsx` or `src/components/data-components.test.tsx`
- Modify: `src/routes/FragilityShockRisk.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css`

Task 6 owns final verification only. It should avoid edits unless verification exposes a defect from Tasks 1-5.

## Chunk 1: Follow-Up Polish Implementation

### Task 1: Add Full Grouped-Nav Click Regression

**Purpose:** Existing tests verify canonical routes and grouped nav labels. Add a click-through regression so every grouped nav link proves it reaches a real page.

**Files:**

- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write the failing nav-click test**

Add this test near the existing grouped navigation route tests:

```tsx
it("routes every grouped navigation link to its page heading", async () => {
  mockStaticFetch(routeFetchFiles());

  const container = render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Overview");

  const navExpectations = [
    { label: "Overview", heading: "Overview" },
    { label: "Short-Term", heading: "Short-Term Market Reaction" },
    { label: "Long-Term", heading: "Long-Term Macro / Allocation Climate" },
    { label: "Fragility", heading: "Fragility / Shock Risk" },
    { label: "Regime Map", heading: "TIPS x Dollar Regime Map" },
    { label: "Replay", heading: "Historical Regime Replay" },
    { label: "Volatility", heading: "Volatility" },
    { label: "Rates", heading: "Rates & Yield Curve" },
    { label: "Liquidity", heading: "Liquidity" },
    { label: "Credit", heading: "Credit & Banking" },
    { label: "Dollar", heading: "Dollar & Global" },
    { label: "Commodities", heading: "Commodities" },
    { label: "Growth", heading: "Growth & Labor" },
    { label: "Housing", heading: "Housing" },
    { label: "Inflation", heading: "Inflation" },
    { label: "Positioning", heading: "Positioning" },
    { label: "Calendar", heading: "Macro Calendar" },
    { label: "Methodology", heading: "Methodology" }
  ];

  for (const expectation of navExpectations) {
    const link = Array.from(container.querySelectorAll("nav a")).find(
      (anchor) => anchor.textContent === expectation.label
    );
    expect(link, `Missing nav link ${expectation.label}`).toBeTruthy();

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitForContent(container, expectation.heading);
    expect(container.querySelector("h2")?.textContent).toBe(expectation.heading);
  }
});
```

- [ ] **Step 2: Run the targeted route test**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx --run
```

Expected before implementation changes: pass if existing routes are already correct. If it fails, fix only route/link issues exposed by the test.

- [ ] **Step 3: Commit**

```bash
git add src/routes/data-routes.test.tsx
git commit -m "test: cover grouped nav link routing"
```

### Task 2: Add DataQualityBanner to Primary Views

**Purpose:** Make high-level freshness/source quality visible on primary views without requiring the status table.

**Files:**

- Create: `src/components/DataQualityBanner.tsx`
- Create: `src/components/DataQualityBanner.test.tsx`
- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/TacticalTradingWeather.tsx`
- Modify: `src/routes/LongTermMacroClimate.tsx`
- Modify: `src/routes/RegimeMap.tsx`
- Modify: `src/routes/FragilityShockRisk.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Create `src/components/DataQualityBanner.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import DataQualityBanner from "./DataQualityBanner";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;

function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return container;
}

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("DataQualityBanner", () => {
  it("labels high data quality and prioritizes stale and inactive reasons", () => {
    const container = render(
      <DataQualityBanner
        dataQuality={{
          coverage_confidence: 1,
          freshness_confidence: 0.99,
          model_confidence: 1,
          source_confidence: 0.97,
          overall_confidence: 0.99,
          reasons: [
            "General model note.",
            "Treasury/bond volatility source is not active.",
            "consumer_debt_service_ratio is stale.",
            "credit_card_delinquency_rate is stale.",
            "household_debt_service_ratio is stale.",
            "Extra stale reason."
          ]
        }}
      />
    );

    expect(container.textContent).toContain("High data quality");
    expect(container.textContent).toContain("0.99");
    expect(container.textContent).toContain("Treasury/bond volatility source is not active.");
    expect(container.textContent).toContain("consumer_debt_service_ratio is stale.");
    expect(container.textContent).not.toContain("General model note.");
    expect(container.querySelectorAll("li")).toHaveLength(4);
  });

  it("handles no reasons and malformed data", () => {
    const noReasons = render(
      <DataQualityBanner
        dataQuality={{
          coverage_confidence: 1,
          freshness_confidence: 1,
          model_confidence: 1,
          source_confidence: 1,
          overall_confidence: 0.8,
          reasons: []
        }}
      />
    );
    expect(noReasons.textContent).toContain("Mixed data quality");
    expect(noReasons.textContent).toContain("No data-quality caveats in the current score summary.");

    const malformed = render(<DataQualityBanner dataQuality={null} />);
    expect(malformed.textContent).toContain("Data quality unavailable");
  });
});
```

Use this local render helper; do not add a shared test helper in this task.

- [ ] **Step 2: Run the failing component test**

```bash
npm run test -- src/components/DataQualityBanner.test.tsx --run
```

Expected: FAIL because `DataQualityBanner` does not exist.

- [ ] **Step 3: Implement DataQualityBanner**

Create `src/components/DataQualityBanner.tsx`:

```tsx
import { formatNumber } from "../lib/formatters";

interface DataQualityBannerProps {
  dataQuality?: unknown;
}

interface DataQualityLike {
  overall_confidence: number;
  reasons: string[];
}

const priorityPattern = /\b(stale|inactive|not active|unavailable|failed|source|terms|candidate|review)\b/i;

function toDataQuality(value: unknown): DataQualityLike | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { overall_confidence?: unknown; reasons?: unknown };
  if (typeof candidate.overall_confidence !== "number" || !Number.isFinite(candidate.overall_confidence)) {
    return null;
  }
  return {
    overall_confidence: candidate.overall_confidence,
    reasons: Array.isArray(candidate.reasons)
      ? candidate.reasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
      : []
  };
}

function qualityLabel(overallConfidence: number) {
  if (overallConfidence >= 0.9) return "High data quality";
  if (overallConfidence >= 0.7) return "Mixed data quality";
  return "Low data quality";
}

function prioritizedReasons(reasons: string[]) {
  const priority = reasons.filter((reason) => priorityPattern.test(reason));
  const fallback = reasons.filter((reason) => !priorityPattern.test(reason));
  return [...priority, ...fallback].slice(0, 4);
}

export default function DataQualityBanner({ dataQuality }: DataQualityBannerProps) {
  const parsed = toDataQuality(dataQuality);
  if (!parsed) {
    return (
      <section className="data-quality-banner" aria-label="Data quality">
        <div>
          <p className="eyebrow">Data quality</p>
          <h3>Data quality unavailable</h3>
        </div>
        <p className="score-note">The current score summary did not include a valid data-quality block.</p>
      </section>
    );
  }

  const reasons = prioritizedReasons(parsed.reasons);

  return (
    <section className="data-quality-banner" aria-label="Data quality">
      <div>
        <p className="eyebrow">Data quality</p>
        <h3>{qualityLabel(parsed.overall_confidence)}</h3>
        <p>Overall confidence {formatNumber(parsed.overall_confidence)}.</p>
      </div>
      {reasons.length > 0 ? (
        <ul>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">No data-quality caveats in the current score summary.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add banner styles**

Add compact styles to `src/styles.css` near the panel/status styles:

```css
.data-quality-banner {
  align-items: flex-start;
  background: #eef6f4;
  border: 1px solid #b7d8d0;
  border-radius: 8px;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(12rem, 0.7fr) minmax(0, 1.3fr);
  padding: 1rem;
}

.data-quality-banner h3 {
  margin: 0.15rem 0;
}

.data-quality-banner ul {
  margin: 0;
  padding-left: 1.1rem;
}
```

Add a responsive rule in the existing mobile section:

```css
.data-quality-banner {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 5: Render the banner on primary views**

Import `DataQualityBanner` and render it near the top of loaded content in:

- `src/routes/Overview.tsx`
- `src/routes/TacticalTradingWeather.tsx`
- `src/routes/LongTermMacroClimate.tsx`
- `src/routes/RegimeMap.tsx`
- `src/routes/FragilityShockRisk.tsx`

Use:

```tsx
<DataQualityBanner dataQuality={data.scoreSummary.data_quality} />
```

In Overview, replace the standalone `overview-data-quality-label` line if it becomes redundant, but keep `ConfidenceBreakdown` and `DataGapPanel`.

Do not add the banner to `HistoricalRegimeReplay.tsx`; it does not currently load `score_summary`, and the spec says to keep Replay unchanged in that case.

- [ ] **Step 6: Add route-level assertions**

In `src/routes/data-routes.test.tsx`, update primary view tests to assert the banner appears:

```tsx
expect(container.textContent).toContain("High data quality");
expect(container.textContent).toContain("Treasury/bond volatility source is not active.");
```

Ensure Overview, Short-Term, Long-Term, Regime Map, and Fragility each have at least one assertion in existing route tests.

- [ ] **Step 7: Run targeted tests**

```bash
npm run test -- src/components/DataQualityBanner.test.tsx src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/DataQualityBanner.tsx src/components/DataQualityBanner.test.tsx src/routes/Overview.tsx src/routes/TacticalTradingWeather.tsx src/routes/LongTermMacroClimate.tsx src/routes/RegimeMap.tsx src/routes/FragilityShockRisk.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: surface primary view data quality"
```

### Task 3: Strengthen Source-Gated Options and Strategic Gap Copy

**Purpose:** Make candidate-only put/call and long-term strategic gaps useful and honest without scoring them.

**Files:**

- Modify: `src/components/OptionsSentimentPanel.tsx`
- Modify: `src/components/StrategicSourceGapsPanel.tsx`
- Modify: `src/components/data-components.test.tsx`

- [ ] **Step 1: Write failing options panel assertions**

In `src/components/data-components.test.tsx`, update or add an `OptionsSentimentPanel` test:

```tsx
it("explains why options sentiment candidates are useful but inactive", () => {
  const container = render(<OptionsSentimentPanel items={candidateRows} />);
  const text = container.textContent ?? "";

  expect(text).toContain("Useful short-term sentiment context");
  expect(text).toContain("automated historical access");
  expect(text).toContain("static JSON redistribution");
  expect(text).toContain("cannot affect scores, regime labels, checklist states, or confidence");
  expect(text.indexOf("SPX + SPXW")).toBeLessThan(text.indexOf("Index put/call"));
});
```

Use the exact labels from existing fixtures if they differ; do not weaken the governance assertions.

- [ ] **Step 2: Write failing strategic source-gap assertions**

Add or update a `StrategicSourceGapsPanel` test:

```tsx
it("renders complete strategic source gaps with non-scoring governance copy", () => {
  const container = render(<StrategicSourceGapsPanel />);
  const text = container.textContent ?? "";

  [
    "PMIs",
    "SLOOS",
    "10Y term premium",
    "Treasury net issuance",
    "Auction tail",
    "Bid-to-cover",
    "CAPE",
    "Forward P/E",
    "Equity risk premium",
    "Earnings revision breadth",
    "Fiscal deficit / interest expense"
  ].forEach((label) => expect(text).toContain(label));

  expect(text).toContain("cannot affect scores until source review promotes it");
});
```

- [ ] **Step 3: Run the failing component slice**

```bash
npm run test -- src/components/data-components.test.tsx --run
```

Expected: FAIL until copy and rows are expanded.

- [ ] **Step 4: Update OptionsSentimentPanel**

Keep active series behavior. Add a `footer` to `CandidateSourcePanel`:

```tsx
const governanceFooter = (
  <div className="candidate-source-panel__footer">
    <p>
      Useful short-term sentiment context, but automated historical access and static JSON redistribution
      are not approved for these rows.
    </p>
    <p>
      Candidate-only options sentiment cannot affect scores, regime labels, checklist states, or confidence
      until source review promotes it.
    </p>
  </div>
);
```

Update `summary` to mention SPX/SPXW, index, equity, VIX, ETP, and total put/call.

- [ ] **Step 5: Expand StrategicSourceGapsPanel rows**

Replace the row constant with this exact set of objects. Each row must remain `terms_review_needed` and must include the non-scoring governance sentence.

```tsx
const strategicRows = [
  {
    label: "PMIs",
    status: "terms_review_needed",
    note: "Helps track business-cycle breadth before slower hard data updates; not active because source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "SLOOS",
    status: "terms_review_needed",
    note: "Helps track bank-lending standards and credit availability; not active because survey transformation and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "10Y term premium",
    status: "terms_review_needed",
    note: "Helps separate duration risk premium from expected-rate moves; not active because source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Treasury net issuance",
    status: "terms_review_needed",
    note: "Helps track supply pressure on duration markets; not active because fiscal-source automation and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Auction tail",
    status: "terms_review_needed",
    note: "Helps track demand weakness at Treasury auctions; not active because auction-data publication rules need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Bid-to-cover",
    status: "terms_review_needed",
    note: "Helps track auction demand depth; not active because auction-data publication rules need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "CAPE",
    status: "terms_review_needed",
    note: "Helps frame long-horizon valuation pressure; not active because valuation source access and redistribution need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Forward P/E",
    status: "terms_review_needed",
    note: "Helps frame earnings-adjusted valuation pressure; not active because forward-estimate source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Equity risk premium",
    status: "terms_review_needed",
    note: "Helps compare equity compensation against rates; not active because calculation inputs and source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Earnings revision breadth",
    status: "terms_review_needed",
    note: "Helps track analyst estimate momentum; not active because revision data source rights need review, so it cannot affect scores until source review promotes it."
  },
  {
    label: "Fiscal deficit / interest expense",
    status: "terms_review_needed",
    note: "Helps frame fiscal pressure and debt-service load over strategic horizons; not active because source timing and redistribution need review, so it cannot affect scores until source review promotes it."
  }
].map((row) => ({
  id: row.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  ...row
}));
```

- [ ] **Step 6: Run targeted tests**

```bash
npm run test -- src/components/data-components.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/OptionsSentimentPanel.tsx src/components/StrategicSourceGapsPanel.tsx src/components/data-components.test.tsx
git commit -m "feat: clarify source-gated sentiment and strategic gaps"
```

### Task 4: Add Candidate Confirmation Rows to Regime Map

**Purpose:** Show missing candidate confirmations beside active confirmations without changing regime data or confidence.

**Files:**

- Modify: `src/components/CrossAssetConfirmationMatrix.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/routes/RegimeMap.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write failing matrix tests**

In `src/components/data-components.test.tsx`, add tests for candidate rows and dedupe:

```tsx
it("renders candidate-only regime confirmations after active confirmations", () => {
  const container = render(
    <CrossAssetConfirmationMatrix
      items={[
        {
          id: "credit",
          label: "Credit",
          message: "Credit confirms the current regime.",
          status: "confirming"
        }
      ]}
      candidateItems={[
        {
          id: "move_index",
          label: "MOVE",
          message: "Bond-volatility confirmation remains source-gated.",
          status: "terms_review_needed"
        }
      ]}
    />
  );

  const text = container.textContent ?? "";
  expect(text).toContain("Credit");
  expect(text).toContain("MOVE");
  expect(text).toContain("Terms review needed");
  expect(text.indexOf("Credit")).toBeLessThan(text.indexOf("MOVE"));
});

it("dedupes candidate confirmations against active rows by id or label", () => {
  const container = render(
    <CrossAssetConfirmationMatrix
      items={[
        {
          id: "liquidity",
          label: "Liquidity",
          message: "Liquidity is active.",
          status: "mixed"
        }
      ]}
      candidateItems={[
        {
          id: "liquidity",
          label: "Liquidity",
          message: "Static liquidity candidate should be omitted.",
          status: "terms_review_needed"
        }
      ]}
    />
  );

  expect((container.textContent ?? "").match(/Liquidity/g)).toHaveLength(1);
});
```

- [ ] **Step 2: Run failing component tests**

```bash
npm run test -- src/components/data-components.test.tsx --run
```

Expected: FAIL because `candidateItems` is not supported.

- [ ] **Step 3: Implement candidateItems prop**

Update `CrossAssetConfirmationMatrix`:

```tsx
interface ConfirmationMatrixItem {
  id: string;
  label: string;
  message: string;
  status: string;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function statusText(status: string) {
  return status === "terms_review_needed" ? "Terms review needed" : formatStateLabel(status);
}
```

Props:

```tsx
{
  items,
  candidateItems = []
}: {
  items: RegimeSnapshotFile["confirmations"];
  candidateItems?: ConfirmationMatrixItem[];
}
```

Render active rows first, then candidate rows that do not match active row normalized id or label. Candidate rows should use a distinct class such as `confirmation-matrix__item candidate-only` and preserve `removeAdviceTerms`.

- [ ] **Step 4: Add static candidate rows in RegimeMap**

In `src/routes/RegimeMap.tsx`, define:

```tsx
const candidateConfirmationRows = [
  {
    id: "gold_xau",
    label: "Gold / XAU",
    message: "Precious-metal confirmation remains source-gated.",
    status: "terms_review_needed"
  },
  {
    id: "long_duration_bonds",
    label: "Long-duration bonds",
    message: "Long-bond confirmation remains display-only until source coverage is formalized.",
    status: "terms_review_needed"
  },
  {
    id: "vix_futures_curve",
    label: "VIX futures curve",
    message: "VX futures confirmation remains candidate-only; the active page uses VIX9D/VIX/VIX3M proxies.",
    status: "terms_review_needed"
  },
  {
    id: "put_call_ratios",
    label: "Put/call ratios",
    message: "Options sentiment remains candidate-only until Cboe source review is complete.",
    status: "terms_review_needed"
  },
  {
    id: "move_index",
    label: "MOVE",
    message: "Bond-volatility confirmation remains source-gated.",
    status: "terms_review_needed"
  },
  {
    id: "skew_index",
    label: "SKEW",
    message: "Equity tail-risk confirmation remains source-gated.",
    status: "terms_review_needed"
  },
  {
    id: "equity_breadth",
    label: "Equity breadth",
    message: "Breadth confirmation remains candidate-only until source governance approves it.",
    status: "terms_review_needed"
  },
  {
    id: "liquidity",
    label: "Liquidity",
    message: "Liquidity confirmation remains visible as a candidate row only if no active liquidity confirmation exists.",
    status: "terms_review_needed"
  }
];
```

Pass:

```tsx
<CrossAssetConfirmationMatrix
  candidateItems={candidateConfirmationRows}
  items={data.snapshot.confirmations}
/>
```

- [ ] **Step 5: Add route assertion**

In the Regime Map route test, assert:

```tsx
expect(container.textContent).toContain("Gold / XAU");
expect(container.textContent).toContain("MOVE");
expect(container.textContent).toContain("Terms review needed");
```

- [ ] **Step 6: Run targeted tests**

```bash
npm run test -- src/components/data-components.test.tsx src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/CrossAssetConfirmationMatrix.tsx src/components/data-components.test.tsx src/routes/RegimeMap.tsx src/routes/data-routes.test.tsx
git commit -m "feat: show candidate regime confirmations"
```

### Task 5: Add Fragility Hidden-Stress Summary and Severity Labels

**Purpose:** Make visible and gated shock-risk channels easier to scan without fabricating warnings.

**Files:**

- Create: `src/components/HiddenStressSummary.tsx`
- Create: `src/components/HiddenStressSummary.test.tsx`
- Modify: `src/routes/FragilityShockRisk.tsx`
- Modify: `src/routes/data-routes.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing HiddenStressSummary tests**

Create `src/components/HiddenStressSummary.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import HiddenStressSummary from "./HiddenStressSummary";
import type { ShockRiskSnapshotFile } from "../lib/types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;

function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return container;
}

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

const snapshot: ShockRiskSnapshotFile = {
  active_signals: [
    {
      change: 0.2,
      id: "hy_minus_ig_oas",
      label: "HY minus IG OAS",
      message: "Credit spread pressure is active.",
      score: 12,
      value: 3.1
    }
  ],
  date: "2026-05-07",
  generated_at_utc: "2026-05-08T00:00:00Z",
  label: "Mixed shock risk",
  method_version: "phase5-shock-risk-v1",
  mismatch_warnings: [
    {
      id: "credit_dollar_real_yield",
      label: "Low VIX with tightening pressure",
      message: "Credit, dollar, and real yields are all firmer."
    },
    {
      id: "liquidity_only",
      label: "Liquidity mismatch",
      message: "Liquidity is draining while volatility is calm."
    }
  ],
  score: 44,
  source_gaps: [
    {
      id: "move_index",
      label: "MOVE Index",
      message: "MOVE source remains gated.",
      status: "terms_review_needed"
    }
  ]
};

describe("HiddenStressSummary", () => {
  it("separates visible and gated stress channels with severity labels", () => {
    const container = render(<HiddenStressSummary shockSnapshot={snapshot} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Visible stress");
    expect(text).toContain("HY minus IG OAS");
    expect(text).toContain("Gated stress");
    expect(text).toContain("MOVE Index");
    expect(text).toContain("VIX futures curve");
    expect(text).toContain("Options sentiment");
    expect(text).toContain("High");
    expect(text).toContain("Medium");
  });

  it("does not fabricate mismatch warnings when none exist", () => {
    const container = render(
      <HiddenStressSummary shockSnapshot={{ ...snapshot, mismatch_warnings: [] }} />
    );

    expect(container.textContent).toContain("No mismatch warnings in the current shock-risk snapshot.");
  });
});
```

Use this local render helper; do not add a shared test helper in this task.

- [ ] **Step 2: Run failing tests**

```bash
npm run test -- src/components/HiddenStressSummary.test.tsx --run
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement HiddenStressSummary**

Create `src/components/HiddenStressSummary.tsx`:

```tsx
import type { ShockRiskMismatchWarning, ShockRiskSnapshotFile } from "../lib/types";

interface HiddenStressSummaryProps {
  shockSnapshot: ShockRiskSnapshotFile;
}

const defaultGatedStressRows = [
  { id: "move_index", label: "MOVE", note: "Bond-volatility stress remains source-gated." },
  { id: "skew_index", label: "SKEW", note: "Equity tail-risk stress remains source-gated." },
  { id: "vix_futures_curve", label: "VIX futures curve", note: "Tradable VX curve remains candidate-only." },
  { id: "options_sentiment", label: "Options sentiment", note: "Put/call ratios remain candidate-only." }
];

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function severityForWarning(warning: ShockRiskMismatchWarning) {
  const text = `${warning.label} ${warning.message}`.toLowerCase();
  const hasCredit = text.includes("credit");
  const hasDollar = text.includes("dollar");
  const hasRealYield = text.includes("real yield") || text.includes("real-yield");
  if (hasCredit && (hasDollar || hasRealYield)) return "High";
  if (hasCredit || hasDollar || hasRealYield || text.includes("liquidity")) return "Medium";
  return "Low";
}

export default function HiddenStressSummary({ shockSnapshot }: HiddenStressSummaryProps) {
  const activeSignals = safeArray<(typeof shockSnapshot.active_signals)[number]>(shockSnapshot.active_signals);
  const sourceGaps = safeArray<(typeof shockSnapshot.source_gaps)[number]>(shockSnapshot.source_gaps);
  const warnings = safeArray<ShockRiskMismatchWarning>(shockSnapshot.mismatch_warnings);
  const sourceGapIds = new Set(sourceGaps.map((gap) => gap.id));
  const gatedRows = [
    ...sourceGaps.map((gap) => ({ id: gap.id, label: gap.label, note: gap.message })),
    ...defaultGatedStressRows.filter((row) => !sourceGapIds.has(row.id))
  ];

  return (
    <section className="panel hidden-stress-summary">
      <div className="section-header">
        <div>
          <p className="eyebrow">Hidden stress</p>
          <h3>Visible vs gated stress</h3>
          <p>Visible rows come from active shock-risk data; gated rows show missing stress channels.</p>
        </div>
      </div>
      <div className="interpretation-grid">
        <section>
          <h4>Visible stress</h4>
          {activeSignals.length > 0 ? (
            <ul>
              {activeSignals.map((signal) => (
                <li key={signal.id}>{signal.label}: {signal.message}</li>
              ))}
            </ul>
          ) : (
            <p className="score-note">No active stress channels in the current shock-risk snapshot.</p>
          )}
        </section>
        <section>
          <h4>Gated stress</h4>
          <ul>
            {gatedRows.map((row) => (
              <li key={row.id}>{row.label}: {row.note}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4>Mismatch severity</h4>
          {warnings.length > 0 ? (
            <ul>
              {warnings.map((warning) => (
                <li key={warning.id}>
                  <strong>{severityForWarning(warning)}</strong>: {warning.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="score-note">No mismatch warnings in the current shock-risk snapshot.</p>
          )}
        </section>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render on Fragility page**

In `src/routes/FragilityShockRisk.tsx`:

```tsx
import HiddenStressSummary from "../components/HiddenStressSummary";
```

Render after `ShockRiskReadHeader` and before `InterpretationPanel`:

```tsx
<HiddenStressSummary shockSnapshot={data.shockSnapshot} />
```

- [ ] **Step 5: Add small styles if needed**

If list spacing is cramped, add:

```css
.hidden-stress-summary ul {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
}
```

- [ ] **Step 6: Add route assertions**

In the Fragility route test, assert:

```tsx
expect(container.textContent).toContain("Visible vs gated stress");
expect(container.textContent).toContain("Gated stress");
expect(container.textContent).toContain("Mismatch severity");
```

- [ ] **Step 7: Run targeted tests**

```bash
npm run test -- src/components/HiddenStressSummary.test.tsx src/routes/data-routes.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/HiddenStressSummary.tsx src/components/HiddenStressSummary.test.tsx src/routes/FragilityShockRisk.tsx src/routes/data-routes.test.tsx src/styles.css
git commit -m "feat: summarize fragility hidden stress"
```

## Chunk 2: Final Verification and Pull Request

### Task 6: Final Verification and Branch Review

**Purpose:** Verify the complete follow-up and catch integration issues before PR creation.

**Files:**

- No planned edits.

- [ ] **Step 1: Run frontend tests**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: PASS. The existing large-chunk Vite warning is acceptable unless new errors appear.

- [ ] **Step 3: Run Python tests using the available pytest interpreter**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python -v
```

Expected: PASS.

- [ ] **Step 4: Run static-data validators**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_schema
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_freshness
```

Expected: PASS.

- [ ] **Step 5: Check source governance**

Run:

```bash
git diff origin/main...HEAD -- src docs public | rg -n "buy|sell|entry|target|stop loss|recommendation|forecast|browser-side API|api key|secret" || true
```

Expected: no newly introduced advice/secret language except false positives such as policy text. Inspect any hits manually.

- [ ] **Step 6: Check worktree status and diff hygiene**

```bash
git status --short
git diff --check origin/main...HEAD
```

Expected: clean status after commits; no whitespace errors.

- [ ] **Step 7: Dispatch final code review**

Use a fresh subagent to review `origin/main...HEAD` for:

- candidate-source governance violations
- route/link regressions
- generated-data contract mismatches
- malformed-data crashes
- tests masking deployed behavior
- accidental advice/recommendation language

Fix any findings with a new commit and rerun affected verification.

- [ ] **Step 8: Push and create PR**

After final review approves:

```bash
git push -u origin codex/vnext-polish-followup
body_file="$(mktemp)"
printf '%s\n' \
  '## Summary' \
  '- Add a primary-view data-quality banner.' \
  '- Clarify source-gated options sentiment and strategic macro/allocation gaps.' \
  '- Show candidate-only regime confirmation rows without changing active scores.' \
  '- Add a Fragility hidden-stress summary with mismatch severity labels.' \
  '- Add grouped-navigation click regression coverage.' \
  '' \
  '## Verification' \
  '- npm run test' \
  '- npm run build' \
  '- /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python -v' \
  '- /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_schema' \
  '- /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_freshness' \
  '' \
  '## Governance' \
  'Candidate sources remain display-only and non-scoring. This PR does not add ingestion, backend services, browser-side API keys, live feeds, forecasts, or trade recommendations.' \
  > "$body_file"
gh pr create --draft --base main --head codex/vnext-polish-followup --title "[codex] polish vNext market weather operating system" --body-file "$body_file"
```
