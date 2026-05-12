/**
 * D3: FocusBlock placement tests for Rates route.
 *
 * These tests verify the conditional rendering of FocusBlock based on the
 * sections array in page_insights.json. The route renders FocusBlock only
 * when a section with id="rates_pressure" is present in the loaded page
 * insights; otherwise it is absent.
 *
 * Fixtures used:
 *   rates_complete.json  — sections includes rates_pressure (all optional fields)
 *   rates_minimal.json   — sections includes rates_pressure (min fields only)
 *
 * Mock data approach: vi.mock("../../lib/data") intercepts all data loading.
 * All heavy async loaders return minimal stubs so the route can mount.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Rates from "../Rates";
import ratesComplete from "../../__fixtures__/page_insights/rates_complete.json";
import ratesMinimal from "../../__fixtures__/page_insights/rates_minimal.json";
import type { PageInsightsFile } from "../../lib/types";

// Stub echarts modular imports — jsdom has no canvas.
vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn()
  })),
  use: vi.fn()
}));
vi.mock("echarts/charts", () => ({
  LineChart: {},
  BarChart: {},
  HeatmapChart: {},
  ScatterChart: {}
}));
vi.mock("echarts/components", () => ({
  TitleComponent: {},
  TooltipComponent: {},
  GridComponent: {},
  LegendComponent: {},
  MarkLineComponent: {},
  MarkAreaComponent: {},
  DataZoomComponent: {},
  VisualMapComponent: {}
}));
vi.mock("echarts/renderers", () => ({
  CanvasRenderer: {}
}));

vi.mock("../../lib/data", () => ({
  loadCatalog: vi.fn(),
  loadDataStatus: vi.fn(),
  loadDerivedSeries: vi.fn(),
  loadPageInsights: vi.fn(),
  loadRatesDashboard: vi.fn(),
  loadRegimeSnapshot: vi.fn()
}));

// routeSeries helpers used by Rates.
vi.mock("../routeSeries", () => ({
  hasObservations: vi.fn(() => false),
  loadRouteSeries: vi.fn()
}));

import {
  loadCatalog,
  loadDataStatus,
  loadDerivedSeries,
  loadPageInsights,
  loadRatesDashboard,
  loadRegimeSnapshot
} from "../../lib/data";
import { loadRouteSeries } from "../routeSeries";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

async function flushPromises() {
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function minimalDerivedFile(seriesId: string) {
  return {
    depends_on: [],
    frequency: "daily",
    generated_at_utc: "2026-05-11T00:00:00Z",
    method: `${seriesId} test fixture.`,
    observations: [{ date: "2026-05-11", value: 0.42, percentile_252d: 55 }],
    series_id: seriesId,
    source: "Derived",
    source_url: "https://example.com",
    summary: {
      change_1d: null,
      change_1m: null,
      change_1w: null,
      latest_date: "2026-05-11",
      latest_value: 0.42,
      percentile_252d: 55
    },
    units: "percentage points"
  };
}

function minimalRegimeSnapshot() {
  return {
    date: "2026-05-11",
    generated_at_utc: "2026-05-11T00:00:00Z",
    regime: {
      tips_direction: "up",
      nominal_yield_direction: "up",
      yield_driver: "real_yield"
    },
    yield_decomposition: [
      {
        date: "2026-05-10",
        nominal_10y: 4.3,
        real_yield_10y: 2.1,
        breakeven_10y: 2.2
      },
      {
        date: "2026-05-11",
        nominal_10y: 4.4,
        real_yield_10y: 2.2,
        breakeven_10y: 2.2
      }
    ]
  };
}

function setupDataMocks() {
  vi.mocked(loadCatalog).mockResolvedValue([] as never);
  vi.mocked(loadDataStatus).mockResolvedValue({
    generated_at_utc: "2026-05-11T00:00:00Z",
    series: {},
    updates: []
  } as never);
  vi.mocked(loadRouteSeries).mockResolvedValue([]);
  vi.mocked(loadDerivedSeries).mockResolvedValue(minimalDerivedFile("us10y_minus_us2y") as never);
  vi.mocked(loadRatesDashboard).mockResolvedValue(null);
  vi.mocked(loadRegimeSnapshot).mockResolvedValue(minimalRegimeSnapshot() as never);
}

describe("Rates route — FocusBlock placement (D3)", () => {
  it("renders FocusBlock when sections includes rates_pressure", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(ratesComplete as PageInsightsFile);

    const container = render(<Rates />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();

    // Check the section data flows through correctly
    expect(container.textContent).toContain(
      "Is the move in yields demand-driven or inflation-driven?"
    );
    expect(container.textContent).toContain(
      "predominantly real-yield driven"
    );
  });

  it("renders FocusBlock from minimal fixture (only required fields)", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(ratesMinimal as PageInsightsFile);

    const container = render(<Rates />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();
    expect(container.textContent).toContain(
      "Is the move in yields demand-driven or inflation-driven?"
    );
  });

  it("does NOT render FocusBlock when loadPageInsights resolves null", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(null);

    const container = render(<Rates />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when sections array is absent from route insight", async () => {
    setupDataMocks();
    const fileWithoutSections: PageInsightsFile = {
      generated_at_utc: "2026-05-11T00:00:00Z",
      date: "2026-05-11",
      method_version: "1.0.0",
      routes: {
        rates: {
          title: "Rates",
          state: "risk",
          why_it_matters: "Yields are rising.",
          confidence: 0.85,
          freshness_notes: []
          // sections intentionally absent
        }
      }
    };
    vi.mocked(loadPageInsights).mockResolvedValue(fileWithoutSections);

    const container = render(<Rates />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when sections exist but no entry matches rates_pressure", async () => {
    setupDataMocks();
    const fileWithWrongId: PageInsightsFile = {
      generated_at_utc: "2026-05-11T00:00:00Z",
      date: "2026-05-11",
      method_version: "1.0.0",
      routes: {
        rates: {
          title: "Rates",
          state: "risk",
          why_it_matters: "Yields are rising.",
          confidence: 0.85,
          freshness_notes: [],
          sections: [
            {
              id: "volatility_complex", // wrong id — should not match rates_pressure
              eyebrow: "Wrong section",
              question: "Wrong question?",
              answer: "Wrong answer.",
              freshness_status: "ok"
            }
          ]
        }
      }
    };
    vi.mocked(loadPageInsights).mockResolvedValue(fileWithWrongId);

    const container = render(<Rates />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when loadPageInsights rejects", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockRejectedValue(new Error("network error"));

    const container = render(<Rates />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });
});
