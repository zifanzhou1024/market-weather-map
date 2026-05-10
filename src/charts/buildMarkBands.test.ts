import { describe, expect, it } from "vitest";
import { buildMarkBands, type ThresholdBand } from "./buildMarkBands";

describe("buildMarkBands", () => {
  it("returns an empty array when no bands are provided", () => {
    expect(buildMarkBands([])).toEqual([]);
  });

  it("emits one band entry per ThresholdBand", () => {
    const bands: ThresholdBand[] = [
      { label: "calm", min: 0, max: 10, color: "#dcf2e5" },
      { label: "watch", min: 10, max: 20, color: "#faedc8" },
      { label: "elevated", min: 20, max: 50, color: "#f4d6d6" }
    ];
    const result = buildMarkBands(bands);
    expect(result).toHaveLength(3);
  });

  it("emits a pair of corner objects per band with min as yAxis on the first corner and max on the second", () => {
    const result = buildMarkBands([
      { label: "calm", min: 0, max: 10, color: "#dcf2e5" }
    ]);
    // ECharts markArea.data is an array of 2-tuples where each tuple is two corner objects.
    expect(result[0]).toHaveLength(2);
    const [lower, upper] = result[0];
    expect(lower).toMatchObject({ yAxis: 0 });
    expect(upper).toMatchObject({ yAxis: 10 });
  });

  it("propagates the label to the band's name field", () => {
    const result = buildMarkBands([
      { label: "watch zone", min: 5, max: 15, color: "#faedc8" }
    ]);
    const [lower] = result[0];
    expect(lower.name).toBe("watch zone");
  });

  it("propagates the color to itemStyle.color on the first corner", () => {
    const result = buildMarkBands([
      { label: "calm", min: 0, max: 10, color: "#dcf2e5" }
    ]);
    const [lower] = result[0];
    expect(lower.itemStyle).toEqual({ color: "#dcf2e5" });
  });

  it("uses -Infinity when min is omitted (open-ended lower bound)", () => {
    const result = buildMarkBands([
      { label: "tail", max: 5, color: "#f4d6d6" }
    ]);
    const [lower, upper] = result[0];
    expect(lower.yAxis).toBe(-Infinity);
    expect(upper.yAxis).toBe(5);
  });

  it("uses +Infinity when max is omitted (open-ended upper bound)", () => {
    const result = buildMarkBands([
      { label: "elevated", min: 20, color: "#f4d6d6" }
    ]);
    const [lower, upper] = result[0];
    expect(lower.yAxis).toBe(20);
    expect(upper.yAxis).toBe(Infinity);
  });

  it("handles a band with neither min nor max as fully open (-Infinity to +Infinity)", () => {
    const result = buildMarkBands([{ label: "open", color: "#edf0e8" }]);
    const [lower, upper] = result[0];
    expect(lower.yAxis).toBe(-Infinity);
    expect(upper.yAxis).toBe(Infinity);
  });
});
