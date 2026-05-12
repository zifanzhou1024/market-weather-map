/**
 * D4: FocusBlock placement tests for RegimeMap route.
 *
 * These tests verify the conditional rendering of FocusBlock based on the
 * sections array in page_insights.json. The route renders FocusBlock only
 * when a section with id="regime_drivers" is present in the loaded page
 * insights; otherwise it is absent.
 *
 * Fixtures used:
 *   regime_map_complete.json  — sections includes regime_drivers (all optional fields)
 *   regime_map_minimal.json   — sections includes regime_drivers (min fields only)
 *
 * Mock data approach: vi.mock("../../lib/data") intercepts all data loading.
 * All heavy async loaders return minimal stubs so the route can mount.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegimeMap from "../RegimeMap";
import regimeMapComplete from "../../__fixtures__/page_insights/regime_map_complete.json";
import regimeMapMinimal from "../../__fixtures__/page_insights/regime_map_minimal.json";
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
  loadPageInsights: vi.fn(),
  loadRegimeDashboard: vi.fn(),
  loadRegimeSnapshot: vi.fn(),
  loadScoreSummary: vi.fn()
}));

import {
  loadPageInsights,
  loadRegimeDashboard,
  loadRegimeSnapshot,
  loadScoreSummary
} from "../../lib/data";

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

function minimalRegimeSnapshot() {
  return {
    date: "2026-05-11",
    generated_at_utc: "2026-05-11T00:00:00Z",
    regime: {
      label: "Risk-on easing",
      tips_direction: "down",
      dollar_direction: "down",
      nominal_yield_direction: "down",
      yield_driver: "real_yield"
    },
    yield_decomposition: [
      {
        date: "2026-05-10",
        nominal_10y: 4.3,
        real_yield_10y: 2.1,
        breakeven_10y: 2.2
      }
    ],
    confirmations: [],
    checklist: []
  };
}

function minimalScoreSummary() {
  return {
    generated_at_utc: "2026-05-11T00:00:00Z",
    data_quality: { score: 1.0, missing_count: 0, stale_count: 0, notes: [] },
    scores: {
      market_weather: {
        score: 50,
        label: "mixed",
        top_risks: [],
        top_supports: []
      },
      fragility: {
        score: 30,
        label: "calm",
        top_risks: [],
        top_supports: []
      }
    }
  };
}

function setupDataMocks() {
  vi.mocked(loadRegimeDashboard).mockResolvedValue(null);
  vi.mocked(loadRegimeSnapshot).mockResolvedValue(minimalRegimeSnapshot() as never);
  vi.mocked(loadScoreSummary).mockResolvedValue(minimalScoreSummary() as never);
}

describe("RegimeMap route — FocusBlock placement (D4)", () => {
  it("renders FocusBlock when sections includes regime_drivers", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(regimeMapComplete as PageInsightsFile);

    const container = render(<RegimeMap />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();

    expect(container.textContent).toContain(
      "Which macro quadrant best describes current cross-asset dynamics?"
    );
    expect(container.textContent).toContain(
      "The 20-day window sits in risk-on easing"
    );
  });

  it("renders FocusBlock from minimal fixture (only required fields)", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(regimeMapMinimal as PageInsightsFile);

    const container = render(<RegimeMap />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();
    expect(container.textContent).toContain(
      "Which macro quadrant best describes current cross-asset dynamics?"
    );
  });

  it("does NOT render FocusBlock when loadPageInsights resolves null", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(null);

    const container = render(<RegimeMap />);
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
        regime_map: {
          title: "Regime Map",
          state: "mixed",
          why_it_matters: "Macro regime quadrant context.",
          confidence: 0.85,
          freshness_notes: []
          // sections intentionally absent
        }
      }
    };
    vi.mocked(loadPageInsights).mockResolvedValue(fileWithoutSections);

    const container = render(<RegimeMap />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when sections exist but no entry matches regime_drivers", async () => {
    setupDataMocks();
    const fileWithWrongId: PageInsightsFile = {
      generated_at_utc: "2026-05-11T00:00:00Z",
      date: "2026-05-11",
      method_version: "1.0.0",
      routes: {
        regime_map: {
          title: "Regime Map",
          state: "mixed",
          why_it_matters: "Macro regime quadrant context.",
          confidence: 0.85,
          freshness_notes: [],
          sections: [
            {
              id: "rates_pressure", // wrong id — should not match regime_drivers
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

    const container = render(<RegimeMap />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when loadPageInsights rejects", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockRejectedValue(new Error("network error"));

    const container = render(<RegimeMap />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });
});
