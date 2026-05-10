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

import InflationSpreadHero from "./InflationSpreadHero";
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

function monthIso(year: number, month: number): string {
  const m = String(month).padStart(2, "0");
  return `${year}-${m}-01`;
}

function buildCpiIndex(seriesId: string, base: number): TimeSeriesFile {
  // Build 60 monthly CPI index observations (5 years) so YoY drops the first 12
  // but leaves a healthy multi-year trail to filter with `1Y` and `3Y` presets.
  const observations: TimeSeriesFile["observations"] = [];
  let year = 2021;
  let month = 1;
  for (let i = 0; i < 60; i += 1) {
    // Index drift of roughly 3% annualised: base * (1 + 0.0025) per month.
    const value = base * (1 + 0.0025 * i);
    observations.push({ date: monthIso(year, month), percentile_252d: 50, value });
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
    units: "index",
    observations
  };
}

function buildPercentSeries(seriesId: string, base: number): TimeSeriesFile {
  // Daily breakeven / forward inflation series in percent. ~ 800 daily points.
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const observations: TimeSeriesFile["observations"] = [];
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    observations.push({
      date,
      value: base + 0.2 * Math.sin(i / 25),
      percentile_252d: 50
    });
  }
  return {
    series_id: seriesId,
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "FRED",
    source_url: `https://fred.stlouisfed.org/${seriesId}`,
    frequency: "daily",
    units: "percent",
    observations
  };
}

const headlineCpiFixture = buildCpiIndex("headline_cpi", 290);
const coreCpiFixture = buildCpiIndex("core_cpi", 300);
const breakevenFixture = buildPercentSeries("breakeven_10y", 2.3);
const forwardFixture = buildPercentSeries("forward_inflation_5y5y", 2.4);

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("InflationSpreadHero", () => {
  it("wraps the chart in InteractiveChartShell with a realized vs market-implied inflation title", () => {
    const c = render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={breakevenFixture}
        forwardInflation5y5y={forwardFixture}
      />
    );
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    const text = (c.textContent ?? "").toLowerCase();
    expect(text).toContain("realized");
    expect(text).toContain("inflation");
  });

  it("renders the four configured series when all inputs are active", () => {
    render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={breakevenFixture}
        forwardInflation5y5y={forwardFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    const names = series.map((s) => s.name);
    expect(names).toContain("Headline CPI (YoY %)");
    expect(names).toContain("Core CPI (YoY %)");
    expect(names).toContain("10Y breakeven");
    expect(names).toContain("5y5y forward inflation");
    // All four should have at least one data point with the 1Y default.
    series.forEach((s) => expect(s.data.length).toBeGreaterThan(0));
  });

  it("uses a single value axis named in percent YoY", () => {
    render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={breakevenFixture}
        forwardInflation5y5y={forwardFixture}
      />
    );
    const option = lastOption();
    const yAxis = option?.yAxis as { type: string; name?: string };
    expect(Array.isArray(yAxis)).toBe(false);
    expect(yAxis.type).toBe("value");
    expect((yAxis.name ?? "").toLowerCase()).toContain("%");
  });

  it("uses a time x-axis", () => {
    render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={breakevenFixture}
        forwardInflation5y5y={forwardFixture}
      />
    );
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string };
    expect(xAxis.type).toBe("time");
  });

  it("renders a Fed long-run goal markLine at 2.0", () => {
    render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={breakevenFixture}
        forwardInflation5y5y={forwardFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      markLine?: { data: Array<{ yAxis?: number; name?: string }>; label?: { formatter?: string } };
    }>;
    const seriesWithMark = series.find((s) => s.markLine);
    expect(seriesWithMark).toBeDefined();
    const data = seriesWithMark!.markLine!.data;
    expect(data.some((d) => d.yAxis === 2.0)).toBe(true);
    const labelText =
      seriesWithMark!.markLine!.label?.formatter ??
      (data[0] as { name?: string }).name ??
      "";
    expect(labelText.toLowerCase()).toContain("fed");
  });

  it("computes YoY from monthly CPI index values and drops the first 12 observations", () => {
    render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={breakevenFixture}
        forwardInflation5y5y={forwardFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; data: Array<[string, number]> }>;
    // 60 months in fixture; after dropping first 12, 48 YoY observations remain.
    // With 1Y default preset over the latest date in CPI (60th month), only
    // observations within 365 days of that latest YoY date pass.
    const headlineSeries = series.find((s) => s.name === "Headline CPI (YoY %)");
    expect(headlineSeries).toBeDefined();
    expect(headlineSeries!.data.length).toBeGreaterThan(0);
    expect(headlineSeries!.data.length).toBeLessThanOrEqual(48);
    // Each entry should be a finite percent value (positive given monotonic
    // upward fixture).
    headlineSeries!.data.forEach(([, v]) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    });
  });

  it("defaults to 1Y range and switches when a range preset changes", () => {
    const c = render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={breakevenFixture}
        forwardInflation5y5y={forwardFixture}
      />
    );
    const initialOption = lastOption();
    const initialSeries = initialOption?.series as Array<{ name: string; data: unknown[] }>;
    const initialLength =
      initialSeries.find((s) => s.name === "10Y breakeven")?.data.length ?? 0;
    expect(initialLength).toBeGreaterThan(0);
    expect(initialLength).toBeLessThan(breakevenFixture.observations.length);

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });

    const after = lastOption();
    const afterSeries = after?.series as Array<{ name: string; data: unknown[] }>;
    const afterLength =
      afterSeries.find((s) => s.name === "10Y breakeven")?.data.length ?? 0;
    expect(afterLength).toBeGreaterThanOrEqual(initialLength);
  });

  it("omits empty series rather than showing zero-length lines", () => {
    const empty: TimeSeriesFile = {
      ...breakevenFixture,
      series_id: "breakeven_10y",
      observations: []
    };
    render(
      <InflationSpreadHero
        headlineCpi={headlineCpiFixture}
        coreCpi={coreCpiFixture}
        breakeven10y={empty}
        forwardInflation5y5y={forwardFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; data: unknown[] }>;
    const names = series.map((s) => s.name);
    expect(names).not.toContain("10Y breakeven");
  });

  it("renders an empty state when every observation set is empty", () => {
    const empty = (seriesId: string): TimeSeriesFile => ({
      series_id: seriesId,
      generated_at_utc: "",
      source: "",
      source_url: "",
      frequency: "monthly",
      units: "",
      observations: []
    });
    const c = render(
      <InflationSpreadHero
        headlineCpi={empty("headline_cpi")}
        coreCpi={empty("core_cpi")}
        breakeven10y={empty("breakeven_10y")}
        forwardInflation5y5y={empty("forward_inflation_5y5y")}
      />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(c.textContent?.toLowerCase() ?? "").toContain(
      "inflation and breakeven history is not currently active."
    );
  });
});
