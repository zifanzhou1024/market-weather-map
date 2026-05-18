/**
 * Task 4.4: Overview post-demote integration tests.
 *
 * Verifies the new three-tier shape:
 *   - MarketCockpit always renders (both modes)
 *   - TodaysNotable + ContextBlock only in Detail mode
 *   - Deleted-duplicate panels (OverviewDecisionCard, MarketBriefHeader,
 *     ScoreCard, HowToReadPanel, InterpretationPanel, SignalList,
 *     ConfidenceBreakdown) do NOT render anywhere on Overview.
 *
 * Data loading is mocked at the `lib/data` boundary to keep the test focused
 * on JSX/mode behavior. echarts is stubbed (heatmap renders under detail).
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Overview from "../Overview";
import { ModeProvider } from "../../lib/mode";
import cockpitFixture from "../../__fixtures__/cockpit/today.json";

// Stub echarts modular imports — jsdom has no canvas.
vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
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
  loadCockpit: vi.fn(),
  loadDataStatus: vi.fn(),
  loadScoreHistory: vi.fn(),
  loadScoreSummary: vi.fn(),
  loadSignalPriority: vi.fn()
}));

import {
  loadCockpit,
  loadDataStatus,
  loadScoreHistory,
  loadScoreSummary,
  loadSignalPriority
} from "../../lib/data";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function renderOverview(initialMode: "brief" | "detail") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(
      <MemoryRouter>
        <ModeProvider initialMode={initialMode}>
          <Overview />
        </ModeProvider>
      </MemoryRouter>
    );
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

function minimalScoreSummary() {
  return {
    generated_at_utc: "2026-05-17T00:00:00Z",
    date: "2026-05-17",
    method_version: "test",
    scores: {
      market_weather: {
        score: 0,
        label: "Mixed",
        top_supports: [],
        top_risks: [],
        recent_changes: []
      },
      macro_climate: {
        score: 0,
        label: "Mixed",
        top_supports: [],
        top_risks: [],
        recent_changes: []
      },
      fragility: {
        score: 0,
        label: "Mixed",
        top_supports: [],
        top_risks: [],
        recent_changes: []
      }
    },
    conflicting_signals: [],
    data_quality: {
      coverage_confidence: 0.9,
      freshness_confidence: 0.9,
      model_confidence: 0.9,
      source_confidence: 0.9,
      overall_confidence: 0.9,
      tier: "high",
      reasons: []
    }
  };
}

function minimalSignalPriority() {
  return {
    generated_at_utc: "2026-05-17T00:00:00Z",
    date: "2026-05-17",
    method_version: "test",
    overall_read: {
      short_term: { label: "Mixed", score: 0, confidence: 0.5 },
      long_term: { label: "Mixed", score: 0, confidence: 0.5 },
      fragility: { label: "Mixed", score: 0, confidence: 0.5 },
      regime: { label: "Mixed" }
    },
    top_warnings: [],
    top_supports: [],
    missing_high_value_signals: []
  };
}

function minimalScoreHistory() {
  return {
    generated_at_utc: "2026-05-17T00:00:00Z",
    method_version: "test",
    observations: [],
    latest_attribution: {
      market_weather: { recent_changes: [], top_risks: [], top_supports: [] },
      macro_climate: { recent_changes: [], top_risks: [], top_supports: [] },
      fragility: { recent_changes: [], top_risks: [], top_supports: [] }
    }
  };
}

function minimalDataStatus() {
  return {
    generated_at_utc: "2026-05-17T00:00:00Z",
    series: {},
    updates: []
  };
}

function setupDataMocks() {
  vi.mocked(loadCockpit).mockResolvedValue(cockpitFixture as never);
  vi.mocked(loadScoreSummary).mockResolvedValue(minimalScoreSummary() as never);
  vi.mocked(loadScoreHistory).mockResolvedValue(minimalScoreHistory() as never);
  vi.mocked(loadSignalPriority).mockResolvedValue(minimalSignalPriority() as never);
  vi.mocked(loadDataStatus).mockResolvedValue(minimalDataStatus() as never);
}

describe("Overview (post-demote)", () => {
  it("renders MarketCockpit in Detail mode", async () => {
    setupDataMocks();
    const container = renderOverview("detail");
    await flushPromises();
    expect(container.querySelector("[data-testid='market-cockpit']")).not.toBeNull();
  });

  it("renders MarketCockpit in Brief mode", async () => {
    setupDataMocks();
    const container = renderOverview("brief");
    await flushPromises();
    expect(container.querySelector("[data-testid='market-cockpit']")).not.toBeNull();
  });

  it("renders Today's Notable in Detail mode", async () => {
    setupDataMocks();
    const container = renderOverview("detail");
    await flushPromises();
    expect(container.querySelector("[data-testid='todays-notable']")).not.toBeNull();
  });

  it("hides Today's Notable in Brief mode", async () => {
    setupDataMocks();
    const container = renderOverview("brief");
    await flushPromises();
    expect(container.querySelector("[data-testid='todays-notable']")).toBeNull();
  });

  it("renders ContextBlock (collapsed details) in Detail mode", async () => {
    setupDataMocks();
    const container = renderOverview("detail");
    await flushPromises();
    const block = container.querySelector("details.context-block");
    expect(block).not.toBeNull();
    // ContextBlock starts collapsed by default.
    expect((block as HTMLDetailsElement).open).toBe(false);
  });

  it("hides ContextBlock in Brief mode", async () => {
    setupDataMocks();
    const container = renderOverview("brief");
    await flushPromises();
    expect(container.querySelector("details.context-block")).toBeNull();
  });

  it("does NOT render the deleted duplicate panels", async () => {
    setupDataMocks();
    const container = renderOverview("detail");
    await flushPromises();
    // HowToReadPanel
    expect(container.textContent).not.toContain("How to read this");
    // OverviewDecisionCard titles
    expect(container.textContent).not.toContain("Short-Term Market Reaction");
    expect(container.textContent).not.toContain("Long-Term Macro / Allocation Climate");
    expect(container.textContent).not.toContain("Fragility / Shock Risk");
    expect(container.textContent).not.toContain("TIPS x Dollar Regime Map");
    // InterpretationPanel + SignalList
    expect(container.textContent).not.toContain("What this page says");
    expect(container.textContent).not.toContain("Current regime read");
    // MarketBriefHeader
    expect(container.textContent).not.toContain("Market brief");
    // The decision-impact-labels section text
    expect(container.textContent).not.toContain("Short-Term Impact");
    expect(container.textContent).not.toContain("Long-Term Impact");
  });

  it("does NOT render the deleted duplicate panels in Brief mode either", async () => {
    setupDataMocks();
    const container = renderOverview("brief");
    await flushPromises();
    expect(container.textContent).not.toContain("How to read this");
    expect(container.textContent).not.toContain("Short-Term Market Reaction");
    expect(container.textContent).not.toContain("Market brief");
    expect(container.textContent).not.toContain("Current regime read");
  });
});
