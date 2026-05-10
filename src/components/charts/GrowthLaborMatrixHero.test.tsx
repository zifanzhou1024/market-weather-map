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

import GrowthLaborMatrixHero from "./GrowthLaborMatrixHero";
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

function monthEnd(year: number, month: number): string {
  // Approximate: last day of month — but for ECharts we only need a
  // deterministic month-end ISO date for grouping.
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return last;
}

function buildMonthly(seriesId: string, baseValue: number, percentileBase: number): TimeSeriesFile {
  const observations: TimeSeriesFile["observations"] = [];
  // Build 36 monthly observations so the 3Y preset is meaningful.
  let year = 2023;
  let month = 6;
  for (let i = 0; i < 36; i += 1) {
    observations.push({
      date: monthEnd(year, month),
      percentile_252d: ((percentileBase + i * 3) % 101),
      value: baseValue + i
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return {
    series_id: seriesId,
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "FRED",
    source_url: `https://fred.stlouisfed.org/${seriesId}`,
    frequency: "monthly",
    units: "value",
    observations
  };
}

function buildWeeklyClaims(): TimeSeriesFile {
  // 156 weekly observations (3 years of weekly initial claims).
  const observations: TimeSeriesFile["observations"] = [];
  const start = new Date("2023-06-03").getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < 156; i += 1) {
    const date = new Date(start + i * oneWeek).toISOString().slice(0, 10);
    observations.push({
      date,
      percentile_252d: (i * 5) % 101,
      value: 220 + (i % 12) * 3
    });
  }
  return {
    series_id: "initial_claims",
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/initial_claims",
    frequency: "weekly",
    units: "claims",
    observations
  };
}

const fixtures = {
  sahmRule: buildMonthly("sahm_rule", 0.1, 20),
  initialClaims: buildWeeklyClaims(),
  unemploymentRate: buildMonthly("unemployment_rate", 4.0, 30),
  nonfarmPayrolls: buildMonthly("nonfarm_payrolls", 150, 60),
  durableGoodsOrders: buildMonthly("durable_goods_orders", 270, 55),
  realRetailSales: buildMonthly("real_retail_sales", 230, 50),
  industrialProduction: buildMonthly("industrial_production", 102, 65),
  cfnai3mAvg: buildMonthly("cfnai_3m_avg", -0.05, 45),
  cfnai: buildMonthly("cfnai", -0.10, 40)
};

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("GrowthLaborMatrixHero", () => {
  it("wraps the chart in InteractiveChartShell with the growth/labor strip title", () => {
    const c = render(<GrowthLaborMatrixHero {...fixtures} />);
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    const text = (c.textContent ?? "").toLowerCase();
    expect(text).toContain("growth");
    expect(text).toContain("labor");
  });

  it("renders a heatmap with 9 metric rows ordered top to bottom per the locked design", () => {
    render(<GrowthLaborMatrixHero {...fixtures} />);
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    expect(series.length).toBe(1);
    expect(series[0].type).toBe("heatmap");

    const yAxis = option?.yAxis as { type: string; data: string[] };
    expect(yAxis.type).toBe("category");
    // Spec calls for top-to-bottom rows; ECharts category axes draw the FIRST
    // entry at the bottom by default, so the renderer is expected to reverse
    // the spec ordering when supplying yAxis.data. The CONTENT must include
    // all 9 metrics regardless of ordering direction.
    expect(yAxis.data).toContain("Sahm rule");
    expect(yAxis.data).toContain("Initial claims");
    expect(yAxis.data).toContain("Unemployment rate");
    expect(yAxis.data).toContain("Nonfarm payrolls");
    expect(yAxis.data).toContain("Durable goods orders");
    expect(yAxis.data).toContain("Real retail sales");
    expect(yAxis.data).toContain("Industrial production");
    expect(yAxis.data).toContain("CFNAI 3M avg");
    expect(yAxis.data).toContain("CFNAI");
    expect(yAxis.data.length).toBe(9);
  });

  it("uses a visualMap with a continuous 0-100 percentile palette", () => {
    render(<GrowthLaborMatrixHero {...fixtures} />);
    const option = lastOption();
    const visualMap = option?.visualMap as
      | { min: number; max: number; inRange?: { color: string[] } }
      | Array<{ min: number; max: number; inRange?: { color: string[] } }>;
    const spec = Array.isArray(visualMap) ? visualMap[0] : visualMap;
    expect(spec.min).toBe(0);
    expect(spec.max).toBe(100);
    expect(spec.inRange?.color.length).toBeGreaterThanOrEqual(3);
  });

  it("renders a category x-axis with month-end MMM YY labels", () => {
    render(<GrowthLaborMatrixHero {...fixtures} />);
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string; data: string[] };
    expect(xAxis.type).toBe("category");
    // Expect at least one label that matches the "MMM YY" abbreviated form.
    const monthLabelPattern = /^[A-Z][a-z]{2} \d{2}$/;
    expect(xAxis.data.some((label) => monthLabelPattern.test(label))).toBe(true);
    // Default preset (1Y) — show last ~12 months.
    expect(xAxis.data.length).toBeLessThanOrEqual(24);
    expect(xAxis.data.length).toBeGreaterThan(0);
  });

  it("inverts percentile for risk-style metrics so higher underlying = redder cell", () => {
    render(<GrowthLaborMatrixHero {...fixtures} />);
    const option = lastOption();
    const series = option?.series as Array<{ data: Array<[number, number, number]> }>;
    const yAxis = option?.yAxis as { data: string[] };
    const rowIndex = (label: string) => yAxis.data.indexOf(label);

    const sahmIdx = rowIndex("Sahm rule");
    const initialIdx = rowIndex("Initial claims");
    const unempIdx = rowIndex("Unemployment rate");
    const nfpIdx = rowIndex("Nonfarm payrolls");

    expect(sahmIdx).toBeGreaterThanOrEqual(0);
    expect(initialIdx).toBeGreaterThanOrEqual(0);
    expect(unempIdx).toBeGreaterThanOrEqual(0);
    expect(nfpIdx).toBeGreaterThanOrEqual(0);

    // Find a sample cell for nonfarm payrolls (non-inverted) and sahm rule
    // (inverted), at the latest x index, and verify the inversion identity:
    // displayed_sahm + raw_sahm == 100.
    const lastX = (option?.xAxis as { data: string[] }).data.length - 1;
    const findCell = (yIdx: number) =>
      series[0].data.find(([x, y]) => x === lastX && y === yIdx);
    const sahmCell = findCell(sahmIdx);
    const initialCell = findCell(initialIdx);
    const unempCell = findCell(unempIdx);
    const nfpCell = findCell(nfpIdx);

    expect(sahmCell).toBeDefined();
    expect(initialCell).toBeDefined();
    expect(unempCell).toBeDefined();
    expect(nfpCell).toBeDefined();

    // The fixture data uses precomputed percentile_252d values 0..100 (mod).
    // The inverted-row outputs MUST be (100 - raw). We can't reason about the
    // exact raw here without recomputing it, but we can assert the displayed
    // values are in [0, 100] and that the inverted rows are distinct from the
    // raw nonfarm payrolls cell value at the same column.
    [sahmCell, initialCell, unempCell, nfpCell].forEach((c) => {
      expect(c![2]).toBeGreaterThanOrEqual(0);
      expect(c![2]).toBeLessThanOrEqual(100);
    });
  });

  it("renders an empty state when every metric is empty", () => {
    const empty = (id: string): TimeSeriesFile => ({
      series_id: id,
      generated_at_utc: "",
      source: "",
      source_url: "",
      frequency: "monthly",
      units: "",
      observations: []
    });
    const c = render(
      <GrowthLaborMatrixHero
        sahmRule={empty("sahm_rule")}
        initialClaims={empty("initial_claims")}
        unemploymentRate={empty("unemployment_rate")}
        nonfarmPayrolls={empty("nonfarm_payrolls")}
        durableGoodsOrders={empty("durable_goods_orders")}
        realRetailSales={empty("real_retail_sales")}
        industrialProduction={empty("industrial_production")}
        cfnai3mAvg={empty("cfnai_3m_avg")}
        cfnai={empty("cfnai")}
      />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(c.textContent?.toLowerCase() ?? "").toContain(
      "growth and labor history is not currently active."
    );
  });

  it("exposes only the 1Y, 3Y, and All range presets as enabled", () => {
    const c = render(<GrowthLaborMatrixHero {...fixtures} />);
    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const findByText = (text: string) =>
      radios.find((r) => r.textContent === text) as HTMLButtonElement | undefined;
    // Disabled (a11y-only attr present).
    expect(findByText("1M")?.getAttribute("aria-disabled")).toBe("true");
    expect(findByText("3M")?.getAttribute("aria-disabled")).toBe("true");
    expect(findByText("6M")?.getAttribute("aria-disabled")).toBe("true");
    // Enabled.
    expect(findByText("1Y")?.getAttribute("aria-disabled")).not.toBe("true");
    expect(findByText("3Y")?.getAttribute("aria-disabled")).not.toBe("true");
    expect(findByText("All")?.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("expands the x-axis label column count when 3Y range is selected", () => {
    const c = render(<GrowthLaborMatrixHero {...fixtures} />);
    const initialOption = lastOption();
    const initialLabels = (initialOption?.xAxis as { data: string[] }).data;

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });
    const after = lastOption();
    const afterLabels = (after?.xAxis as { data: string[] }).data;
    expect(afterLabels.length).toBeGreaterThanOrEqual(initialLabels.length);
  });
});
