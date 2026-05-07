# PR 6 Watchlist And Threshold System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-local watchlist and threshold system so users can monitor selected indicators without adding a backend, accounts, email, or push notifications.

**Architecture:** Store user selections in `localStorage`. Evaluate thresholds against already-loaded static JSON in the browser. Do not send user data anywhere and do not schedule background checks outside the loaded page.

**Tech Stack:** React TypeScript, localStorage, Vitest/jsdom, existing static data loaders.

---

## File Structure

Create:

- `src/lib/watchlist.ts`: localStorage schema, validation, threshold evaluation.
- `src/components/WatchlistTable.tsx`: selected indicators and current states.
- `src/components/ThresholdEditor.tsx`: add/edit threshold controls.
- `src/components/ThresholdStatusBadge.tsx`: status label.
- `src/routes/Watchlist.tsx`: watchlist route.

Modify:

- `src/lib/types.ts`: watchlist types.
- `src/App.tsx`, `src/components/AppLayout.tsx`: add `/watchlist`.
- `src/components/data-components.test.tsx`: component tests.
- `src/routes/data-routes.test.tsx`: route tests.
- `src/styles.css`: focused watchlist styles.
- `docs/LIMITATIONS.md`, `README.md`: document browser-local behavior.

---

## Task 1: Add Watchlist Domain Helpers

**Files:**

- Create: `src/lib/watchlist.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/formatters.test.ts` or create `src/lib/watchlist.test.ts`

- [ ] **Step 1: Write tests**

Create `src/lib/watchlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  evaluateThreshold,
  sanitizeWatchlist,
  defaultWatchlist
} from "./watchlist";

describe("watchlist helpers", () => {
  it("evaluates above and below thresholds", () => {
    expect(evaluateThreshold({ operator: "above", value: 20 }, 22)).toBe("triggered");
    expect(evaluateThreshold({ operator: "above", value: 20 }, 18)).toBe("clear");
    expect(evaluateThreshold({ operator: "below", value: 4 }, 3.5)).toBe("triggered");
  });

  it("returns unavailable when current value is missing", () => {
    expect(evaluateThreshold({ operator: "above", value: 20 }, null)).toBe("unavailable");
  });

  it("sanitizes invalid stored watchlists", () => {
    const sanitized = sanitizeWatchlist({ items: [{ seriesId: "../bad", threshold: { operator: "above", value: "x" } }] });
    expect(sanitized.items).toEqual([]);
  });

  it("ships with sensible default watchlist items", () => {
    expect(defaultWatchlist.items.map((item) => item.seriesId)).toEqual([
      "vix",
      "real_yield_10y",
      "broad_dollar",
      "high_yield_oas",
      "vix_vix3m_ratio"
    ]);
  });
});
```

- [ ] **Step 2: Implement types**

In `src/lib/types.ts`, add:

```ts
export type ThresholdOperator = "above" | "below";
export type ThresholdState = "triggered" | "clear" | "unavailable";

export interface WatchlistThreshold {
  operator: ThresholdOperator;
  value: number;
}

export interface WatchlistItem {
  seriesId: string;
  label?: string;
  threshold: WatchlistThreshold;
}

export interface WatchlistConfig {
  version: 1;
  items: WatchlistItem[];
}
```

- [ ] **Step 3: Implement helpers**

`src/lib/watchlist.ts`:

```ts
import type { ThresholdState, WatchlistConfig, WatchlistThreshold } from "./types";

const seriesIdPattern = /^[a-z0-9_]+$/;

export const watchlistStorageKey = "market-weather-map.watchlist.v1";

export const defaultWatchlist: WatchlistConfig = {
  version: 1,
  items: [
    { seriesId: "vix", label: "VIX", threshold: { operator: "above", value: 25 } },
    { seriesId: "real_yield_10y", label: "10Y real yield", threshold: { operator: "above", value: 2.25 } },
    { seriesId: "broad_dollar", label: "Broad dollar", threshold: { operator: "above", value: 125 } },
    { seriesId: "high_yield_oas", label: "HY OAS", threshold: { operator: "above", value: 5 } },
    { seriesId: "vix_vix3m_ratio", label: "VIX / VIX3M", threshold: { operator: "above", value: 1 } }
  ]
};

export function evaluateThreshold(threshold: WatchlistThreshold, currentValue: number | null): ThresholdState {
  if (currentValue === null || !Number.isFinite(currentValue)) return "unavailable";
  if (threshold.operator === "above") return currentValue > threshold.value ? "triggered" : "clear";
  return currentValue < threshold.value ? "triggered" : "clear";
}

export function sanitizeWatchlist(value: unknown): WatchlistConfig {
  if (!value || typeof value !== "object" || !Array.isArray((value as WatchlistConfig).items)) {
    return defaultWatchlist;
  }
  const items = (value as WatchlistConfig).items.filter((item) => {
    return (
      item &&
      typeof item.seriesId === "string" &&
      seriesIdPattern.test(item.seriesId) &&
      item.threshold &&
      (item.threshold.operator === "above" || item.threshold.operator === "below") &&
      typeof item.threshold.value === "number" &&
      Number.isFinite(item.threshold.value)
    );
  });
  return { version: 1, items };
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- src/lib/watchlist.test.ts
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/lib/watchlist.ts src/lib/watchlist.test.ts src/lib/types.ts
git commit -m "feat: add watchlist threshold helpers"
```

---

## Task 2: Add Watchlist UI Components

**Files:**

- Create: `src/components/WatchlistTable.tsx`
- Create: `src/components/ThresholdEditor.tsx`
- Create: `src/components/ThresholdStatusBadge.tsx`
- Modify: `src/components/data-components.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write tests**

Add tests:

- `ThresholdStatusBadge` renders Triggered, Clear, and Unavailable.
- `WatchlistTable` renders current value and threshold.
- `ThresholdEditor` calls `onChange` with a sanitized numeric threshold.

- [ ] **Step 2: Implement components**

`ThresholdStatusBadge`:

```tsx
import type { ThresholdState } from "../lib/types";

export default function ThresholdStatusBadge({ state }: { state: ThresholdState }) {
  const label = state === "triggered" ? "Triggered" : state === "clear" ? "Clear" : "Unavailable";
  return <span className={`status-pill threshold-${state}`}>{label}</span>;
}
```

`WatchlistTable` props:

```ts
{
  rows: Array<{
    seriesId: string;
    label: string;
    currentValue: number | null;
    units: string;
    thresholdLabel: string;
    state: ThresholdState;
  }>;
}
```

`ThresholdEditor` must use regular form controls and labels. It should not use network calls.

- [ ] **Step 3: Verify**

Run:

```bash
npm run test -- src/components/data-components.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/components/WatchlistTable.tsx src/components/ThresholdEditor.tsx src/components/ThresholdStatusBadge.tsx src/components/data-components.test.tsx src/styles.css
git commit -m "feat: add watchlist components"
```

---

## Task 3: Add Watchlist Route

**Files:**

- Create: `src/routes/Watchlist.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/routes/data-routes.test.tsx`

- [ ] **Step 1: Write route test**

Add:

```tsx
it("renders browser-local watchlist route", async () => {
  mockStaticFetch(routeFetchFiles());

  const container = render(
    <MemoryRouter initialEntries={["/watchlist"]}>
      <App />
    </MemoryRouter>
  );

  await waitForContent(container, "Watchlist");
  expect(container.textContent).toContain("Browser-local thresholds");
  expect(container.textContent).toContain("VIX");
});
```

- [ ] **Step 2: Implement route**

`Watchlist.tsx`:

- Loads catalog and status.
- Loads series/derived files listed in sanitized watchlist.
- Reads and writes localStorage key `market-weather-map.watchlist.v1`.
- Renders `WatchlistTable`.
- Renders `ThresholdEditor`.
- Shows this text: "Thresholds are stored in this browser only."

Do not add notifications, background timers, accounts, or server persistence.

- [ ] **Step 3: Verify**

Run:

```bash
npm run test -- src/routes/data-routes.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/routes/Watchlist.tsx src/App.tsx src/components/AppLayout.tsx src/routes/data-routes.test.tsx
git commit -m "feat: add browser-local watchlist route"
```

---

## Task 4: Document Watchlist Limits

**Files:**

- Modify: `README.md`
- Modify: `docs/LIMITATIONS.md`

- [ ] **Step 1: Add documentation**

Document:

- settings stay in browser localStorage
- no account sync
- no email/push alerts
- no background monitoring while the page is closed
- thresholds are descriptive monitoring aids, not recommendations

- [ ] **Step 2: Verify**

Run:

```bash
rg -n "buy|sell|short|entry|target|stop loss|recommendation" README.md docs src
npm run build
```

Expected: no new advice-language matches from this PR.

Commit:

```bash
git add README.md docs/LIMITATIONS.md
git commit -m "docs: document watchlist limits"
```

---

## Final Verification

Run:

```bash
python -m pytest tests/python -v
npm run test
npm run build
python -m scripts.update_data
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
git status --short
```

Expected: all tests pass; `/watchlist` works from static data and localStorage only.

