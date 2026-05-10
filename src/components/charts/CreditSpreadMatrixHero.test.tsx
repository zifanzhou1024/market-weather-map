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

import CreditSpreadMatrixHero from "./CreditSpreadMatrixHero";
import type { DerivedSeriesFile, TimeSeriesFile } from "../../lib/types";

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

function buildSeries(seriesId: string, base: number): TimeSeriesFile {
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const observations = [] as TimeSeriesFile["observations"];
  // Roughly 800 daily points so the 1Y default window meaningfully filters.
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    observations.push({
      date,
      value: base + 0.4 * Math.sin(i / 25),
      percentile_252d: 50 + 20 * Math.cos(i / 30)
    });
  }
  return {
    series_id: seriesId,
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/",
    frequency: "daily",
    units: "percent",
    observations
  };
}

function buildDerived(): DerivedSeriesFile {
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const observations = [] as DerivedSeriesFile["observations"];
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    observations.push({
      date,
      value: 2 + 0.5 * Math.cos(i / 22),
      percentile_252d: 30 + 15 * Math.sin(i / 28)
    });
  }
  return {
    series_id: "hy_minus_ig_oas",
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/",
    frequency: "daily",
    units: "percentage_points",
    observations,
    depends_on: ["high_yield_oas", "investment_grade_oas"],
    method: "High yield OAS minus investment grade OAS",
    summary: {
      latest_date: "2026-05-07",
      latest_value: 2.0,
      change_1d: 0.03,
      change_1w: -0.02,
      change_1m: -0.11,
      change_3m: -0.09,
      change_12m: -0.47,
      percentile_252d: 14.68
    }
  };
}

const hyFixture = buildSeries("high_yield_oas", 2.9);
const igFixture = buildSeries("investment_grade_oas", 0.85);
const bbbFixture = buildSeries("bbb_oas", 1.1);
const hyIgFixture = buildDerived();

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("CreditSpreadMatrixHero", () => {
  it("wraps the chart in InteractiveChartShell with the credit matrix title", () => {
    const c = render(
      <CreditSpreadMatrixHero
        hyOas={hyFixture}
        igOas={igFixture}
        bbbOas={bbbFixture}
        hyMinusIgOas={hyIgFixture}
      />
    );
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent).toContain("Credit spread matrix");
  });

  it("renders three spread line series: HY, IG, and BBB OAS", () => {
    render(
      <CreditSpreadMatrixHero
        hyOas={hyFixture}
        igOas={igFixture}
        bbbOas={bbbFixture}
        hyMinusIgOas={hyIgFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    const names = series.map((s) => s.name);
    expect(names).toContain("HY OAS");
    expect(names).toContain("IG OAS");
    expect(names).toContain("BBB OAS");
    expect(series.filter((s) => s.type === "line").length).toBeGreaterThanOrEqual(3);
  });

  it("renders a markLine annotation derived from the HY-IG stress spine", () => {
    render(
      <CreditSpreadMatrixHero
        hyOas={hyFixture}
        igOas={igFixture}
        bbbOas={bbbFixture}
        hyMinusIgOas={hyIgFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      markLine?: { data: Array<{ yAxis?: number; name?: string }> };
    }>;
    // At least one series should carry a markLine for the HY-IG stress reference.
    const seriesWithMarkLine = series.filter((s) => s.markLine);
    expect(seriesWithMarkLine.length).toBeGreaterThan(0);
  });

  it("defaults to 1Y range and switches when a range preset changes", () => {
    const c = render(
      <CreditSpreadMatrixHero
        hyOas={hyFixture}
        igOas={igFixture}
        bbbOas={bbbFixture}
        hyMinusIgOas={hyIgFixture}
      />
    );
    const initialOption = lastOption();
    const initialSeries = initialOption?.series as Array<{ name: string; data: unknown[] }>;
    const initialLength = initialSeries.find((s) => s.name === "HY OAS")?.data.length ?? 0;
    expect(initialLength).toBeGreaterThan(0);
    expect(initialLength).toBeLessThan(hyFixture.observations.length);

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });
    const after = lastOption();
    const afterSeries = after?.series as Array<{ name: string; data: unknown[] }>;
    const afterLength = afterSeries.find((s) => s.name === "HY OAS")?.data.length ?? 0;
    expect(afterLength).toBeGreaterThanOrEqual(initialLength);
  });

  it("uses a time x-axis and a value y-axis named in percent", () => {
    render(
      <CreditSpreadMatrixHero
        hyOas={hyFixture}
        igOas={igFixture}
        bbbOas={bbbFixture}
        hyMinusIgOas={hyIgFixture}
      />
    );
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string };
    const yAxis = option?.yAxis as { type: string; name?: string };
    expect(xAxis.type).toBe("time");
    expect(yAxis.type).toBe("value");
    expect((yAxis.name ?? "").toLowerCase()).toContain("%");
  });

  it("renders an empty state when all spreads are empty", () => {
    const empty = (id: string): TimeSeriesFile => ({
      series_id: id,
      generated_at_utc: "",
      source: "",
      source_url: "",
      frequency: "daily",
      units: "percent",
      observations: []
    });
    const emptyDerived: DerivedSeriesFile = {
      ...buildDerived(),
      observations: []
    };
    const c = render(
      <CreditSpreadMatrixHero
        hyOas={empty("high_yield_oas")}
        igOas={empty("investment_grade_oas")}
        bbbOas={empty("bbb_oas")}
        hyMinusIgOas={emptyDerived}
      />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
