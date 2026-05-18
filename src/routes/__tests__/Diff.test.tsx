/**
 * /diff route tests.
 *
 * Verifies the route renders the loading state, picks up data once mocked
 * loaders resolve, respects ?window=, swaps the URL on tab click, sorts
 * vital signs by absolute delta in the active window, and toggles the
 * delta-percent column on Mode.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Diff from "../Diff";
import { ModeProvider } from "../../lib/mode";
import type { DiffFile, DiffRow, DiffWindowKey } from "../../lib/types";

vi.mock("../../lib/data", () => ({
  loadDiff: vi.fn()
}));

import { loadDiff } from "../../lib/data";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | undefined;

function row(
  id: string,
  opts: Partial<DiffRow> & {
    deltas?: Partial<Record<DiffWindowKey, { value: number | null; delta: number | null; deltaPct?: number | null }>>;
  }
): DiffRow {
  const { deltas = {}, ...rest } = opts;
  const defaultDeltas: Record<DiffWindowKey, { value: number | null; delta: number | null; deltaPct?: number | null }> = {
    "1d": { value: 1.0, delta: 0.1 },
    "7d": { value: 0.5, delta: 0.6 },
    "30d": { value: null, delta: null }
  };
  const merged: Record<DiffWindowKey, { value: number | null; delta: number | null; deltaPct?: number | null }> = {
    ...defaultDeltas,
    ...deltas
  };
  return {
    id,
    label: id.replace(/_/g, " "),
    direction: "risk",
    primary_unit: "%",
    primary_decimals: 2,
    current_value: 1.5,
    current_date: "2026-05-15",
    windows: {
      "1d": {
        value: merged["1d"].value,
        date: merged["1d"].value === null ? null : "2026-05-14",
        delta: merged["1d"].delta,
        delta_pct: merged["1d"].deltaPct ?? 0.5
      },
      "7d": {
        value: merged["7d"].value,
        date: merged["7d"].value === null ? null : "2026-05-08",
        delta: merged["7d"].delta,
        delta_pct: merged["7d"].deltaPct ?? 12.0
      },
      "30d": {
        value: merged["30d"].value,
        date: merged["30d"].value === null ? null : "2026-04-15",
        delta: merged["30d"].delta,
        delta_pct: merged["30d"].deltaPct ?? null
      }
    },
    freshness_status: "ok",
    frequency: "daily",
    ...rest
  };
}

function makeFixture(): DiffFile {
  return {
    generated_at_utc: "2026-05-17T16:13:45Z",
    date: "2026-05-15",
    method_version: "phase-f-diff-v1",
    composite_scores: [
      row("market_weather", { direction: "neutral" }),
      row("macro_climate", { direction: "neutral" }),
      row("fragility", { direction: "neutral" })
    ],
    vital_signs: [
      // Three vitals with distinct 1d deltas: vix=2.1, hy=0.5, real_yields=0.01
      row("vix_complex", {
        direction: "risk",
        deltas: {
          "1d": { value: 14.2, delta: 2.1 },
          "7d": { value: 13.0, delta: 3.3 },
          "30d": { value: 12.0, delta: 4.3 }
        }
      }),
      row("credit_spreads", {
        direction: "risk",
        deltas: {
          "1d": { value: 300.0, delta: 0.5 },
          "7d": { value: 280.0, delta: 20.5 },
          "30d": { value: 250.0, delta: 50.5 }
        }
      }),
      row("real_yields", {
        direction: "support",
        deltas: {
          "1d": { value: 1.98, delta: 0.01 },
          "7d": { value: 1.95, delta: 0.04 },
          "30d": { value: 1.5, delta: 0.49 }
        }
      })
    ]
  };
}

async function flush() {
  for (let i = 0; i < 30; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

function renderDiff(initialPath: string, initialMode: "brief" | "detail" = "detail") {
  container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <ModeProvider initialMode={initialMode}>
          <Diff />
        </ModeProvider>
      </MemoryRouter>
    );
  });
}

beforeEach(() => {
  vi.mocked(loadDiff).mockResolvedValue(makeFixture());
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe("Diff route", () => {
  test("renders loading state before data arrives", () => {
    vi.mocked(loadDiff).mockReturnValue(new Promise(() => {})); // never resolves
    renderDiff("/diff");
    expect(container.querySelector("[data-testid='diff-loading']")).not.toBeNull();
  });

  test("renders 3 composite rows and 3 vital rows when data loaded", async () => {
    renderDiff("/diff");
    await flush();
    const compositeTable = container.querySelector("[data-testid='diff-table-composite']");
    const vitalsTable = container.querySelector("[data-testid='diff-table-vitals']");
    expect(compositeTable).not.toBeNull();
    expect(vitalsTable).not.toBeNull();
    expect(compositeTable!.querySelectorAll("tbody tr").length).toBe(3);
    expect(vitalsTable!.querySelectorAll("tbody tr").length).toBe(3);
  });

  test("default window is 7d (the cockpit mix of cadences makes 1d mostly empty)", async () => {
    renderDiff("/diff");
    await flush();
    const tab1d = container.querySelector("[data-testid='diff-window-tab-1d']");
    const tab7d = container.querySelector("[data-testid='diff-window-tab-7d']");
    expect(tab7d?.className).toContain("channel-tab--active");
    expect(tab1d?.className).not.toContain("channel-tab--active");
    expect(tab7d?.getAttribute("aria-current")).toBe("page");
  });

  test("?window=1d still works (user-initiated drill into yesterday's moves)", async () => {
    renderDiff("/diff?window=1d");
    await flush();
    expect(
      container.querySelector("[data-testid='diff-window-tab-1d']")?.className
    ).toContain("channel-tab--active");
    // vix 1d delta = 2.1 should be shown
    const vixDelta = container.querySelector("[data-testid='diff-row-vix_complex-delta']");
    expect(vixDelta?.textContent).toContain("2.10");
  });

  test("?window=7d activates the 7d tab and shows 7d window data", async () => {
    renderDiff("/diff?window=7d");
    await flush();
    expect(
      container.querySelector("[data-testid='diff-window-tab-7d']")?.className
    ).toContain("channel-tab--active");
    // vix 7d delta = 3.3 should be shown
    const vixDelta = container.querySelector("[data-testid='diff-row-vix_complex-delta']");
    expect(vixDelta?.textContent).toContain("3.30");
  });

  test("invalid ?window= falls back to the 7d default", async () => {
    renderDiff("/diff?window=garbage");
    await flush();
    expect(
      container.querySelector("[data-testid='diff-window-tab-7d']")?.className
    ).toContain("channel-tab--active");
  });

  test("vital signs sorted by absolute delta in active window", async () => {
    renderDiff("/diff?window=30d");
    await flush();
    const rows = container.querySelectorAll(
      "[data-testid='diff-table-vitals'] tbody tr"
    );
    const ids = Array.from(rows).map((r) => r.getAttribute("data-testid"));
    // 30d deltas: credit_spreads=50.5, vix=4.3, real_yields=0.49
    expect(ids).toEqual([
      "diff-row-credit_spreads",
      "diff-row-vix_complex",
      "diff-row-real_yields"
    ]);
  });

  test("composite rows preserve canonical order (not sorted by delta)", async () => {
    renderDiff("/diff");
    await flush();
    const rows = container.querySelectorAll(
      "[data-testid='diff-table-composite'] tbody tr"
    );
    const ids = Array.from(rows).map((r) => r.getAttribute("data-testid"));
    expect(ids).toEqual([
      "diff-row-market_weather",
      "diff-row-macro_climate",
      "diff-row-fragility"
    ]);
  });

  test("brief mode hides delta-percent column", async () => {
    renderDiff("/diff", "brief");
    await flush();
    const headers = Array.from(
      container.querySelectorAll("[data-testid='diff-table-vitals'] thead th")
    ).map((th) => th.textContent ?? "");
    // 5 columns in brief: Signal, Now, Then, Δ, Freshness
    expect(headers.length).toBe(5);
    expect(headers.some((t) => t.includes("Δ%"))).toBe(false);
    // No data cell with the delta-pct testid should exist
    expect(
      container.querySelector("[data-testid='diff-row-vix_complex-delta-pct']")
    ).toBeNull();
  });

  test("detail mode shows delta-percent column", async () => {
    renderDiff("/diff", "detail");
    await flush();
    const headers = Array.from(
      container.querySelectorAll("[data-testid='diff-table-vitals'] thead th")
    ).map((th) => th.textContent ?? "");
    expect(headers.length).toBe(6);
    expect(headers.some((t) => t.includes("Δ%"))).toBe(true);
    expect(
      container.querySelector("[data-testid='diff-row-vix_complex-delta-pct']")
    ).not.toBeNull();
  });

  test("positive delta renders with up tone, negative with down tone, null with na tone", async () => {
    // Override fixture to include explicit positive/negative/null deltas in 1d.
    vi.mocked(loadDiff).mockResolvedValue({
      generated_at_utc: "2026-05-17T16:13:45Z",
      date: "2026-05-15",
      method_version: "phase-f-diff-v1",
      composite_scores: [
        row("market_weather", { direction: "neutral" }),
        row("macro_climate", { direction: "neutral" }),
        row("fragility", { direction: "neutral" })
      ],
      vital_signs: [
        row("up_signal", {
          direction: "risk",
          deltas: { "1d": { value: 14.2, delta: 2.1 } }
        }),
        row("down_signal", {
          direction: "support",
          deltas: { "1d": { value: 14.2, delta: -2.1 } }
        }),
        row("na_signal", {
          direction: "risk",
          freshness_status: "unavailable",
          deltas: { "1d": { value: null, delta: null } }
        })
      ]
    });
    // Explicit ?window=1d because the override sets only 1d deltas (the
    // default window is 7d post-polish).
    renderDiff("/diff?window=1d");
    await flush();
    const up = container
      .querySelector("[data-testid='diff-row-up_signal-delta']")
      ?.className;
    const down = container
      .querySelector("[data-testid='diff-row-down_signal-delta']")
      ?.className;
    const na = container
      .querySelector("[data-testid='diff-row-na_signal-delta']")
      ?.className;
    expect(up).toContain("diff-cell--delta--up");
    expect(down).toContain("diff-cell--delta--down");
    expect(na).toContain("diff-cell--delta--na");
  });

  test("window tab click updates the URL search param", async () => {
    renderDiff("/diff");
    await flush();
    // Default is 7d, so click 1d to verify the URL/state update path.
    const tab1d = container.querySelector<HTMLButtonElement>(
      "[data-testid='diff-window-tab-1d']"
    );
    expect(tab1d).not.toBeNull();
    await act(async () => {
      tab1d!.click();
    });
    expect(
      container.querySelector("[data-testid='diff-window-tab-1d']")?.className
    ).toContain("channel-tab--active");
    expect(
      container.querySelector("[data-testid='diff-window-tab-7d']")?.className
    ).not.toContain("channel-tab--active");
  });

  test("unavailable rows render em-dash for missing window value", async () => {
    vi.mocked(loadDiff).mockResolvedValue({
      generated_at_utc: "2026-05-17T16:13:45Z",
      date: "2026-05-15",
      method_version: "phase-f-diff-v1",
      composite_scores: [
        row("market_weather", { direction: "neutral" }),
        row("macro_climate", { direction: "neutral" }),
        row("fragility", { direction: "neutral" })
      ],
      vital_signs: [
        {
          id: "missing_signal",
          label: "Missing Signal",
          direction: "risk",
          primary_unit: "%",
          primary_decimals: 2,
          current_value: null,
          current_date: null,
          freshness_status: "unavailable",
          frequency: "monthly",
          windows: {
            "1d": { value: null, date: null, delta: null, delta_pct: null },
            "7d": { value: null, date: null, delta: null, delta_pct: null },
            "30d": { value: null, date: null, delta: null, delta_pct: null }
          }
        }
      ]
    });
    renderDiff("/diff");
    await flush();
    const tr = container.querySelector("[data-testid='diff-row-missing_signal']");
    expect(tr).not.toBeNull();
    const delta = container.querySelector(
      "[data-testid='diff-row-missing_signal-delta']"
    );
    expect(delta?.textContent).toBe("—");
  });

  test("cadence pill renders per row with the row's frequency", async () => {
    // Mix the three cadences a user would actually see in the cockpit:
    // daily (VIX), weekly (Initial Claims), monthly (Nonfarm Payrolls).
    vi.mocked(loadDiff).mockResolvedValue({
      generated_at_utc: "2026-05-17T16:13:45Z",
      date: "2026-05-15",
      method_version: "phase-f-diff-v1",
      composite_scores: [
        row("market_weather", { direction: "neutral" }),
        row("macro_climate", { direction: "neutral" }),
        row("fragility", { direction: "neutral" })
      ],
      vital_signs: [
        row("vix_complex", { frequency: "daily" }),
        row("labor_claims", { frequency: "weekly" }),
        row("payrolls", { frequency: "monthly" })
      ]
    });
    renderDiff("/diff");
    await flush();
    const vix = container.querySelector(
      "[data-testid='diff-row-vix_complex-cadence']"
    );
    const claims = container.querySelector(
      "[data-testid='diff-row-labor_claims-cadence']"
    );
    const payrolls = container.querySelector(
      "[data-testid='diff-row-payrolls-cadence']"
    );
    expect(vix?.textContent).toBe("daily");
    expect(claims?.textContent).toBe("weekly");
    expect(payrolls?.textContent).toBe("monthly");
    expect(vix?.className).toContain("diff-cadence--daily");
    expect(claims?.className).toContain("diff-cadence--weekly");
    expect(payrolls?.className).toContain("diff-cadence--monthly");
  });

  test("cadence pill wraps the cadence word in a glossary tooltip", async () => {
    vi.mocked(loadDiff).mockResolvedValue({
      generated_at_utc: "2026-05-17T16:13:45Z",
      date: "2026-05-15",
      method_version: "phase-f-diff-v1",
      composite_scores: [
        row("market_weather", { direction: "neutral" }),
        row("macro_climate", { direction: "neutral" }),
        row("fragility", { direction: "neutral" })
      ],
      vital_signs: [row("labor_claims", { frequency: "weekly" })]
    });
    renderDiff("/diff");
    await flush();
    const cadence = container.querySelector(
      "[data-testid='diff-row-labor_claims-cadence']"
    );
    // GlossaryTerm renders an <abbr title=...> when the term is defined.
    const abbr = cadence?.querySelector("abbr");
    expect(abbr).not.toBeNull();
    expect(abbr?.getAttribute("title")).toBe(
      "Series updates once per week."
    );
  });

  test("composite-score rows also carry a cadence pill (daily)", async () => {
    renderDiff("/diff");
    await flush();
    const composite = container.querySelector(
      "[data-testid='diff-row-market_weather-cadence']"
    );
    expect(composite?.textContent).toBe("daily");
  });
});
