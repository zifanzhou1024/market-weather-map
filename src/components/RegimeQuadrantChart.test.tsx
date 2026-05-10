import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setOption = vi.fn();
const resize = vi.fn();
const dispose = vi.fn();

vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({ setOption, resize, dispose })),
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

import RegimeQuadrantChart from "./RegimeQuadrantChart";
import type { RegimeDashboardFile, RegimeWindowPoint } from "../lib/types";

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

beforeEach(() => {
  setOption.mockClear();
  resize.mockClear();
  dispose.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => dashboardFixture
    }))
  );
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

function makeWindow(seed: number, count = 20): RegimeWindowPoint[] {
  const points: RegimeWindowPoint[] = [];
  const start = new Date("2026-04-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  for (let i = 0; i < count; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    points.push({
      date,
      real_yield_change_bps: Math.sin((i + seed) / 5) * 30,
      dollar_change_pct: Math.cos((i + seed) / 7) * 2,
      vix_percentile: ((i * 7 + seed) % 100),
      credit_change_bps: Math.sin(i / 3) * 40,
      fragility_score: 0.2,
      regime: i % 2 === 0 ? "risk_on_easing" : "rotation_reflation"
    });
  }
  return points;
}

const dashboardFixture: RegimeDashboardFile = {
  date: "2026-05-01",
  generated_at_utc: "2026-05-10T14:58:30Z",
  method_version: "phase8-pr1-regime-dashboard-v1",
  thresholds: {
    real_yield_neutral_bps: 5.0,
    dollar_neutral_pct: 0.5
  },
  windows: {
    "20D": makeWindow(1, 20),
    "60D": makeWindow(2, 60),
    "120D": makeWindow(3, 120)
  }
};

describe("RegimeQuadrantChart", () => {
  it("renders the chart with data from regime_dashboard.json (default 20D)", async () => {
    const c = render(<RegimeQuadrantChart />);
    await flush();
    expect(c.querySelector("[data-state='ready']")).not.toBeNull();
    const option = lastOption();
    expect(option).toBeDefined();
  });

  it("uses real-yield-change-bps on x and dollar-change-pct on y", async () => {
    render(<RegimeQuadrantChart />);
    await flush();
    const option = lastOption();
    const xAxis = option?.xAxis as { name?: string };
    const yAxis = option?.yAxis as { name?: string };
    const xName = String(xAxis?.name ?? "").toLowerCase();
    const yName = String(yAxis?.name ?? "").toLowerCase();
    expect(xName).toContain("real");
    expect(xName).toContain("yield");
    expect(yName).toContain("dollar");
  });

  it("switches window when a different range button is clicked", async () => {
    const c = render(<RegimeQuadrantChart />);
    await flush();
    const initialOption = lastOption();
    const scatterInitial = (initialOption?.series as Array<{ type: string; data: unknown[] }>).find(
      (s) => s.type === "scatter"
    );
    const initialLen = scatterInitial?.data.length ?? 0;
    expect(initialLen).toBe(20);

    const radios = Array.from(c.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    const sixtyD = radios.find((b) => b.textContent === "60D");
    expect(sixtyD).toBeDefined();
    act(() => {
      sixtyD!.click();
    });
    await flush();
    const afterOption = lastOption();
    const scatterAfter = (afterOption?.series as Array<{ type: string; data: unknown[] }>).find(
      (s) => s.type === "scatter"
    );
    expect(scatterAfter!.data.length).toBe(60);
  });

  it("emits a latest-point label using the latest observation's date", async () => {
    render(<RegimeQuadrantChart />);
    await flush();
    const option = lastOption();
    const series = option?.series as Array<{
      type: string;
      data: Array<{ value: number[]; label?: { show?: boolean; formatter?: string } }>;
    }>;
    const scatter = series.find((s) => s.type === "scatter");
    expect(scatter).toBeDefined();
    const labeled = scatter!.data.filter((d) => d.label?.show === true);
    expect(labeled).toHaveLength(1);
    const latestDate = dashboardFixture.windows["20D"][dashboardFixture.windows["20D"].length - 1].date;
    expect(labeled[0].label!.formatter ?? "").toContain(latestDate);
  });

  it("does NOT contain the misleading '20-observation change' literal", async () => {
    const c = render(<RegimeQuadrantChart />);
    await flush();
    expect(c.textContent).not.toContain("20-observation change");
  });

  it("renders a dynamic '{window} change' eyebrow that updates with the selected window", async () => {
    const c = render(<RegimeQuadrantChart />);
    await flush();
    const eyebrow = c.querySelector('[aria-label="Active lookback window"]');
    expect(eyebrow?.textContent).toBe("20D change");
    const radios = Array.from(c.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    const oneTwentyD = radios.find((b) => b.textContent === "120D");
    act(() => {
      oneTwentyD!.click();
    });
    await flush();
    const updatedEyebrow = c.querySelector('[aria-label="Active lookback window"]');
    expect(updatedEyebrow?.textContent).toBe("120D change");
  });

  it("renders all four descriptive quadrant meaning strings in the legend", async () => {
    const c = render(<RegimeQuadrantChart />);
    await flush();
    const text = c.textContent ?? "";
    expect(text.toLowerCase()).toContain("risk-on easing");
    expect(text.toLowerCase()).toContain("global tightening");
    expect(text.toLowerCase()).toContain("safe-haven");
    expect(text.toLowerCase()).toContain("rotation");
  });

  it("encodes vix_percentile via visualMap (color) and includes a connected trail line", async () => {
    render(<RegimeQuadrantChart />);
    await flush();
    const option = lastOption();
    const visualMap = option?.visualMap as
      | Array<{ dimension?: number; min?: number; max?: number }>
      | { dimension?: number };
    expect(visualMap).toBeDefined();
    const series = option?.series as Array<{ type: string }>;
    const types = series.map((s) => s.type);
    expect(types).toContain("scatter");
    expect(types).toContain("line");
  });

  it("renders an empty state when the dashboard returns no points in the default window", async () => {
    const emptyFixture: RegimeDashboardFile = {
      ...dashboardFixture,
      windows: { "20D": [], "60D": [], "120D": [] }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => emptyFixture
      }))
    );
    const c = render(<RegimeQuadrantChart />);
    await flush();
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("renders an empty state when regime_dashboard.json is missing (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({})
      }))
    );
    const c = render(<RegimeQuadrantChart />);
    await flush();
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
