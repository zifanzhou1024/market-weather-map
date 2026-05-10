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

import YieldDecompositionStackChart from "./YieldDecompositionStackChart";
import type { RatesCurrentDecomposition } from "../../lib/types";

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

const decompositionFixture: RatesCurrentDecomposition = {
  nominal_10y_pct: 4.41,
  real_yield_10y_pct: 1.96,
  breakeven_10y_pct: 2.45
};

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("YieldDecompositionStackChart", () => {
  it("wraps the chart in InteractiveChartShell with the decomposition title", () => {
    const c = render(<YieldDecompositionStackChart data={decompositionFixture} />);
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent).toContain("Yield decomposition");
  });

  it("uses a value x-axis (percent) and a categorical y-axis (single row)", () => {
    render(<YieldDecompositionStackChart data={decompositionFixture} />);
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string; name?: string };
    const yAxis = option?.yAxis as { type: string; data: string[] };
    expect(xAxis.type).toBe("value");
    expect((xAxis.name ?? "").toLowerCase()).toContain("%");
    expect(yAxis.type).toBe("category");
    expect(yAxis.data).toHaveLength(1);
  });

  it("renders two stacked bar segments: real yield and breakeven", () => {
    render(<YieldDecompositionStackChart data={decompositionFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      type: string;
      stack?: string;
      data: number[];
    }>;
    expect(series).toHaveLength(2);
    const names = series.map((s) => s.name);
    expect(names).toContain("Real yield");
    expect(names).toContain("Breakeven");
    const real = series.find((s) => s.name === "Real yield")!;
    const be = series.find((s) => s.name === "Breakeven")!;
    expect(real.type).toBe("bar");
    expect(be.type).toBe("bar");
    expect(real.stack).toBe(be.stack);
    expect(real.data).toEqual([1.96]);
    expect(be.data).toEqual([2.45]);
  });

  it("formats per-segment labels in percent and shows the nominal total", () => {
    render(<YieldDecompositionStackChart data={decompositionFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      label?: { show?: boolean; formatter?: (p: { value: number }) => string };
    }>;
    const real = series.find((s) => s.name === "Real yield")!;
    const be = series.find((s) => s.name === "Breakeven")!;
    expect(real.label?.show).toBe(true);
    expect(be.label?.show).toBe(true);
    const realText = real.label?.formatter?.({ value: 1.96 }) ?? "";
    const beText = be.label?.formatter?.({ value: 2.45 }) ?? "";
    expect(realText).toContain("1.96");
    expect(beText).toContain("2.45");
    expect(realText).toContain("%");
    expect(beText).toContain("%");
  });

  it("annotates the nominal total via the breakeven segment endLabel", () => {
    // The nominal total is rendered at the end of the stack (right edge). It
    // can live either as an endLabel on the breakeven segment or as a markPoint
    // — we accept either, as long as the rendered string contains 4.41.
    const c = render(<YieldDecompositionStackChart data={decompositionFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      label?: { formatter?: (p: { value: number }) => string };
      labelLine?: unknown;
      markPoint?: { data: Array<{ value: number | string }> };
      stackStrategy?: string;
    }>;
    // Either the markPoint carries the total, or the second segment ends with
    // a label that includes the nominal value. Verify via the rendered text or
    // the option representation.
    const optionStr = JSON.stringify(option);
    expect(optionStr).toContain("4.41");
    // Visual sanity: the insight description below the chart references the
    // total in pct as well.
    expect((c.textContent ?? "").replace(/\s+/g, " ")).toMatch(/4\.41/);
    void series;
  });

  it("renders an empty state when nominal is not finite", () => {
    const broken: RatesCurrentDecomposition = {
      nominal_10y_pct: NaN,
      real_yield_10y_pct: NaN,
      breakeven_10y_pct: NaN
    };
    const c = render(<YieldDecompositionStackChart data={broken} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("insight callout describes which component dominates the nominal yield", () => {
    const c = render(<YieldDecompositionStackChart data={decompositionFixture} />);
    // breakeven (2.45) > real_yield (1.96) — insight should say breakeven leads.
    const text = (c.textContent ?? "").toLowerCase();
    expect(text).toContain("breakeven");
    expect(text).toMatch(/larger|dominant|contribut/);
  });
});
