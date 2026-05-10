import { describe, expect, it } from "vitest";
import { buildTimeWindow, type RangePreset } from "./buildTimeWindow";

type Point = { date: string; value: number };

function mkSeries(dates: string[]): Point[] {
  return dates.map((date, idx) => ({ date, value: idx }));
}

describe("buildTimeWindow", () => {
  it("returns the full series when preset is All", () => {
    const series = mkSeries(["2024-01-01", "2024-06-01", "2025-01-01", "2026-01-01"]);
    expect(buildTimeWindow(series, "All")).toEqual(series);
  });

  it("returns empty when input is empty for any preset", () => {
    const presets: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
    for (const p of presets) {
      expect(buildTimeWindow([], p)).toEqual([]);
    }
  });

  it("filters to last ~30 days for 1M preset relative to the latest date", () => {
    // latest is 2026-01-31; 1M should keep dates >= 2026-01-01 (30 days back inclusive)
    const series = mkSeries([
      "2025-11-01",
      "2025-12-15",
      "2026-01-01",
      "2026-01-15",
      "2026-01-31"
    ]);
    const result = buildTimeWindow(series, "1M");
    expect(result.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-01-15",
      "2026-01-31"
    ]);
  });

  it("filters to last ~90 days for 3M preset", () => {
    const series = mkSeries([
      "2025-06-01",
      "2025-09-01", // 2026-01-31 minus 90d = 2025-11-02; this should be filtered out
      "2025-11-15",
      "2026-01-31"
    ]);
    const result = buildTimeWindow(series, "3M");
    expect(result.map((p) => p.date)).toEqual(["2025-11-15", "2026-01-31"]);
  });

  it("filters to last ~365 days for 1Y preset", () => {
    const series = mkSeries([
      "2024-06-01",
      "2025-02-01",
      "2025-06-01",
      "2026-01-31"
    ]);
    const result = buildTimeWindow(series, "1Y");
    // 2026-01-31 minus 365d = 2025-01-31
    expect(result.map((p) => p.date)).toEqual([
      "2025-02-01",
      "2025-06-01",
      "2026-01-31"
    ]);
  });

  it("filters to last ~3*365 days for 3Y preset", () => {
    const series = mkSeries([
      "2020-01-01",
      "2022-06-01",
      "2024-06-01",
      "2026-01-31"
    ]);
    const result = buildTimeWindow(series, "3Y");
    // 2026-01-31 minus 3*365 = 2023-02-01 (approximately)
    expect(result.map((p) => p.date)).toEqual([
      "2024-06-01",
      "2026-01-31"
    ]);
  });

  it("sorts non-monotonic input by date before filtering", () => {
    const series: Point[] = [
      { date: "2026-01-15", value: 2 },
      { date: "2025-12-01", value: 0 },
      { date: "2026-01-31", value: 3 },
      { date: "2026-01-01", value: 1 }
    ];
    const result = buildTimeWindow(series, "1M");
    // Latest is 2026-01-31; window keeps >= 2026-01-01
    expect(result.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-01-15",
      "2026-01-31"
    ]);
  });

  it("returns a single-element array when the series has only one date and preset is non-All", () => {
    const series = mkSeries(["2026-01-15"]);
    expect(buildTimeWindow(series, "1M")).toEqual(series);
  });
});
