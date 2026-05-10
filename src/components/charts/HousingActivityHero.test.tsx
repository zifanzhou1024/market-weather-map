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

import HousingActivityHero from "./HousingActivityHero";
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

function buildMonthly(seriesId: string, base: number, units: string): TimeSeriesFile {
  // 60 monthly observations (5 years).
  const observations: TimeSeriesFile["observations"] = [];
  let year = 2021;
  let month = 1;
  for (let i = 0; i < 60; i += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-01`;
    observations.push({
      date,
      percentile_252d: 50,
      value: base + 25 * Math.sin(i / 6)
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
    units,
    observations
  };
}

function buildWeekly(seriesId: string, base: number, units: string): TimeSeriesFile {
  // 260 weekly observations (5 years).
  const start = new Date("2021-01-04").getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const observations: TimeSeriesFile["observations"] = [];
  for (let i = 0; i < 260; i += 1) {
    const date = new Date(start + i * oneWeek).toISOString().slice(0, 10);
    observations.push({
      date,
      percentile_252d: 50,
      value: base + 0.5 * Math.sin(i / 12)
    });
  }
  return {
    series_id: seriesId,
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "FRED",
    source_url: `https://fred.stlouisfed.org/${seriesId}`,
    frequency: "weekly",
    units,
    observations
  };
}

const housingStartsFixture = buildMonthly("housing_starts", 1500, "thousands_saar");
const buildingPermitsFixture = buildMonthly("building_permits", 1450, "thousands_saar");
const mortgageRate30yFixture = buildWeekly("mortgage_rate_30y", 6.5, "percent");

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("HousingActivityHero", () => {
  it("wraps the chart in InteractiveChartShell with the housing activity title", () => {
    const c = render(
      <HousingActivityHero
        housingStarts={housingStartsFixture}
        buildingPermits={buildingPermitsFixture}
        mortgageRate30y={mortgageRate30yFixture}
      />
    );
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent?.toLowerCase() ?? "").toContain("housing");
  });

  it("renders three series: housing starts, building permits, and 30Y mortgage rate", () => {
    render(
      <HousingActivityHero
        housingStarts={housingStartsFixture}
        buildingPermits={buildingPermitsFixture}
        mortgageRate30y={mortgageRate30yFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      type: string;
      yAxisIndex?: number;
      data: unknown[];
    }>;
    expect(series.length).toBe(3);
    const names = series.map((s) => s.name);
    expect(names).toContain("Housing starts");
    expect(names).toContain("Building permits");
    expect(names).toContain("30Y mortgage rate");
  });

  it("uses a dual-axis configuration with units thousands on the left and percent on the right", () => {
    render(
      <HousingActivityHero
        housingStarts={housingStartsFixture}
        buildingPermits={buildingPermitsFixture}
        mortgageRate30y={mortgageRate30yFixture}
      />
    );
    const option = lastOption();
    const yAxis = option?.yAxis as Array<{ type: string; name?: string }>;
    expect(Array.isArray(yAxis)).toBe(true);
    expect(yAxis.length).toBe(2);
    const leftName = (yAxis[0].name ?? "").toLowerCase();
    const rightName = (yAxis[1].name ?? "").toLowerCase();
    expect(leftName).toMatch(/thousand|unit|annual/);
    expect(rightName).toMatch(/%|mortgage|rate/);
  });

  it("attaches starts and permits to the left axis and mortgage rate to the right axis", () => {
    render(
      <HousingActivityHero
        housingStarts={housingStartsFixture}
        buildingPermits={buildingPermitsFixture}
        mortgageRate30y={mortgageRate30yFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; yAxisIndex?: number }>;
    const starts = series.find((s) => s.name === "Housing starts");
    const permits = series.find((s) => s.name === "Building permits");
    const mortgage = series.find((s) => s.name === "30Y mortgage rate");
    expect(starts?.yAxisIndex ?? 0).toBe(0);
    expect(permits?.yAxisIndex ?? 0).toBe(0);
    expect(mortgage?.yAxisIndex).toBe(1);
  });

  it("renders both a left-axis Long-run mid markLine and a right-axis multi-year average markLine", () => {
    render(
      <HousingActivityHero
        housingStarts={housingStartsFixture}
        buildingPermits={buildingPermitsFixture}
        mortgageRate30y={mortgageRate30yFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      markLine?: {
        data: Array<{ yAxis?: number; name?: string }>;
        label?: { formatter?: string };
      };
    }>;
    const seriesWithMark = series.filter((s) => s.markLine);
    expect(seriesWithMark.length).toBeGreaterThanOrEqual(2);
    const labels = seriesWithMark
      .map((s) =>
        (s.markLine?.label?.formatter ?? s.markLine?.data?.[0]?.name ?? "").toLowerCase()
      )
      .filter(Boolean);
    expect(labels.some((l) => l.includes("long-run mid"))).toBe(true);
    expect(labels.some((l) => l.includes("recent multi-year average"))).toBe(true);
  });

  it("uses a time x-axis", () => {
    render(
      <HousingActivityHero
        housingStarts={housingStartsFixture}
        buildingPermits={buildingPermitsFixture}
        mortgageRate30y={mortgageRate30yFixture}
      />
    );
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string };
    expect(xAxis.type).toBe("time");
  });

  it("defaults to 1Y range and switches when a range preset changes", () => {
    const c = render(
      <HousingActivityHero
        housingStarts={housingStartsFixture}
        buildingPermits={buildingPermitsFixture}
        mortgageRate30y={mortgageRate30yFixture}
      />
    );
    const initial = lastOption();
    const initialSeries = initial?.series as Array<{ name: string; data: unknown[] }>;
    const initialMortgageLength =
      initialSeries.find((s) => s.name === "30Y mortgage rate")?.data.length ?? 0;
    expect(initialMortgageLength).toBeGreaterThan(0);
    expect(initialMortgageLength).toBeLessThan(mortgageRate30yFixture.observations.length);

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });
    const after = lastOption();
    const afterSeries = after?.series as Array<{ name: string; data: unknown[] }>;
    const afterMortgageLength =
      afterSeries.find((s) => s.name === "30Y mortgage rate")?.data.length ?? 0;
    expect(afterMortgageLength).toBeGreaterThanOrEqual(initialMortgageLength);
  });

  it("renders an empty state when every observation set is empty", () => {
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
      <HousingActivityHero
        housingStarts={empty("housing_starts")}
        buildingPermits={empty("building_permits")}
        mortgageRate30y={empty("mortgage_rate_30y")}
      />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(c.textContent?.toLowerCase() ?? "").toContain(
      "housing and mortgage history is not currently active."
    );
  });
});
