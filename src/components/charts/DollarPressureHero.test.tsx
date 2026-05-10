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

import DollarPressureHero from "./DollarPressureHero";
import type { TimeSeriesFile } from "../../lib/types";

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
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

function buildBroadDollar(): TimeSeriesFile {
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const observations = [] as TimeSeriesFile["observations"];
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    const level = 115 + 5 * Math.sin(i / 30);
    const percentile = 30 + 40 * Math.cos(i / 50);
    observations.push({
      date,
      value: level,
      percentile_252d: Math.max(0, Math.min(100, percentile))
    });
  }
  return {
    series_id: "broad_dollar",
    generated_at_utc: "2026-05-01T00:00:00Z",
    source: "ICE BofA",
    source_url: "https://fred.stlouisfed.org/series/DTWEXBGS",
    frequency: "daily",
    units: "index",
    observations,
    summary: {
      latest_date: "2026-05-01",
      latest_value: 118.39,
      change_1d: 0.1,
      change_1w: -0.2,
      change_1m: 0.5,
      change_3m: 1.4,
      change_12m: -1.2,
      percentile_252d: 11.51
    }
  };
}

const broadDollarFixture = buildBroadDollar();

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("DollarPressureHero", () => {
  it("wraps the chart in InteractiveChartShell with the dollar pressure title", () => {
    const c = render(<DollarPressureHero broadDollar={broadDollarFixture} />);
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent?.toLowerCase()).toContain("dollar");
  });

  it("renders broad-dollar level and FX-pressure percentile series", () => {
    render(<DollarPressureHero broadDollar={broadDollarFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    const names = series.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes("broad dollar") || n.includes("level"))).toBe(true);
    expect(names.some((n) => n.includes("percentile") || n.includes("pressure"))).toBe(true);
    // Both series should have data.
    series.forEach((s) => expect(s.data.length).toBeGreaterThan(0));
  });

  it("renders a dual-axis configuration with left index axis and right percentile axis", () => {
    render(<DollarPressureHero broadDollar={broadDollarFixture} />);
    const option = lastOption();
    const yAxis = option?.yAxis as Array<{ type: string; name?: string }>;
    expect(Array.isArray(yAxis)).toBe(true);
    expect(yAxis.length).toBe(2);
    const leftName = (yAxis[0].name ?? "").toLowerCase();
    const rightName = (yAxis[1].name ?? "").toLowerCase();
    expect(leftName).toMatch(/index|dollar|level/);
    expect(rightName).toMatch(/percentile|pressure/);
  });

  it("defaults to 1Y range and switches when a range preset changes", () => {
    const c = render(<DollarPressureHero broadDollar={broadDollarFixture} />);
    const initialOption = lastOption();
    const initialSeries = initialOption?.series as Array<{ name: string; data: unknown[] }>;
    const initialLength = initialSeries[0].data.length;
    expect(initialLength).toBeGreaterThan(0);
    expect(initialLength).toBeLessThan(broadDollarFixture.observations.length);

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });

    const after = lastOption();
    const afterSeries = after?.series as Array<{ name: string; data: unknown[] }>;
    expect(afterSeries[0].data.length).toBeGreaterThanOrEqual(initialLength);
  });

  it("renders an empty state when broad-dollar observations are empty", () => {
    const empty: TimeSeriesFile = {
      ...broadDollarFixture,
      observations: []
    };
    const c = render(<DollarPressureHero broadDollar={empty} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("uses a time x-axis", () => {
    render(<DollarPressureHero broadDollar={broadDollarFixture} />);
    const option = lastOption();
    const xAxis = option?.xAxis;
    const xSpec = Array.isArray(xAxis) ? (xAxis[0] as { type: string }) : (xAxis as { type: string });
    expect(xSpec.type).toBe("time");
  });
});
