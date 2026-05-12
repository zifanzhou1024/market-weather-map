/**
 * D4: FocusBlock placement tests for TacticalTradingWeather route.
 *
 * These tests verify the conditional rendering of FocusBlock based on the
 * sections array in page_insights.json. The route renders FocusBlock only
 * when a section with id="tactical_stress_board" is present under the
 * "fragility" route key in the loaded page insights; otherwise it is absent.
 *
 * Fixtures used:
 *   tactical_complete.json  — sections includes tactical_stress_board (all optional fields)
 *   tactical_minimal.json   — sections includes tactical_stress_board (min fields only)
 *
 * Mock data approach: vi.mock("../../lib/data") intercepts all data loading.
 * All heavy async loaders return minimal stubs so the route can mount.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import TacticalTradingWeather from "../TacticalTradingWeather";
import tacticalComplete from "../../__fixtures__/page_insights/tactical_complete.json";
import tacticalMinimal from "../../__fixtures__/page_insights/tactical_minimal.json";
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
  loadMacroCalendar: vi.fn(),
  loadPageInsights: vi.fn(),
  loadRegimeSnapshot: vi.fn(),
  loadScoreSummary: vi.fn(),
  loadSignalPriority: vi.fn(),
  loadVolatilityDashboard: vi.fn()
}));

// routeSeries helpers used by TacticalTradingWeather.
vi.mock("../routeSeries", () => ({
  loadRouteDerivedSeries: vi.fn(),
  loadRouteSeries: vi.fn()
}));

import {
  loadCatalog,
  loadDataStatus,
  loadMacroCalendar,
  loadPageInsights,
  loadRegimeSnapshot,
  loadScoreSummary,
  loadSignalPriority,
  loadVolatilityDashboard
} from "../../lib/data";
import { loadRouteDerivedSeries, loadRouteSeries } from "../routeSeries";

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
      label: "Mixed",
      tips_direction: "flat",
      dollar_direction: "flat",
      nominal_yield_direction: "flat",
      yield_driver: "real_yield"
    },
    yield_decomposition: [
      {
        date: "2026-05-11",
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

function minimalMacroCalendar() {
  return {
    generated_at_utc: "2026-05-11T00:00:00Z",
    events: []
  };
}

function setupDataMocks() {
  vi.mocked(loadCatalog).mockResolvedValue([] as never);
  vi.mocked(loadDataStatus).mockResolvedValue({
    generated_at_utc: "2026-05-11T00:00:00Z",
    series: {},
    updates: []
  } as never);
  vi.mocked(loadRegimeSnapshot).mockResolvedValue(minimalRegimeSnapshot() as never);
  vi.mocked(loadScoreSummary).mockResolvedValue(minimalScoreSummary() as never);
  vi.mocked(loadSignalPriority).mockResolvedValue(null as never);
  vi.mocked(loadMacroCalendar).mockResolvedValue(minimalMacroCalendar() as never);
  vi.mocked(loadVolatilityDashboard).mockResolvedValue(null);
  vi.mocked(loadRouteSeries).mockResolvedValue([]);
  vi.mocked(loadRouteDerivedSeries).mockResolvedValue([]);
}

describe("TacticalTradingWeather route — FocusBlock placement (D4)", () => {
  it("renders FocusBlock when sections includes tactical_stress_board", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(tacticalComplete as PageInsightsFile);

    const container = render(<TacticalTradingWeather />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();

    expect(container.textContent).toContain(
      "Where is near-term stress concentrating across credit, vol, and liquidity?"
    );
    expect(container.textContent).toContain(
      "HY credit spreads are widening"
    );
  });

  it("renders FocusBlock from minimal fixture (only required fields)", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(tacticalMinimal as PageInsightsFile);

    const container = render(<TacticalTradingWeather />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();
    expect(container.textContent).toContain(
      "Where is near-term stress concentrating across credit, vol, and liquidity?"
    );
  });

  it("does NOT render FocusBlock when loadPageInsights resolves null", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(null);

    const container = render(<TacticalTradingWeather />);
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
        fragility: {
          title: "Tactical Stress Board",
          state: "watch",
          why_it_matters: "Tactical stress signals track immediate risk posture.",
          confidence: 0.88,
          freshness_notes: []
          // sections intentionally absent
        }
      }
    };
    vi.mocked(loadPageInsights).mockResolvedValue(fileWithoutSections);

    const container = render(<TacticalTradingWeather />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when sections exist but no entry matches tactical_stress_board", async () => {
    setupDataMocks();
    const fileWithWrongId: PageInsightsFile = {
      generated_at_utc: "2026-05-11T00:00:00Z",
      date: "2026-05-11",
      method_version: "1.0.0",
      routes: {
        fragility: {
          title: "Tactical Stress Board",
          state: "watch",
          why_it_matters: "Tactical stress signals track immediate risk posture.",
          confidence: 0.88,
          freshness_notes: [],
          sections: [
            {
              id: "regime_drivers", // wrong id — should not match tactical_stress_board
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

    const container = render(<TacticalTradingWeather />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when loadPageInsights rejects", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockRejectedValue(new Error("network error"));

    const container = render(<TacticalTradingWeather />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });
});
