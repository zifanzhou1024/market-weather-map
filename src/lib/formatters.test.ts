import { describe, expect, it } from "vitest";
import { formatNumber, formatPercentile, formatSigned, statusLabel } from "./formatters";

describe("formatters", () => {
  it("formats numeric values with fixed precision", () => {
    expect(formatNumber(4.268, 2)).toBe("4.27");
  });

  it("formats unavailable numbers as N/A", () => {
    expect(formatNumber(null)).toBe("N/A");
    expect(formatPercentile(undefined)).toBe("N/A");
  });

  it("formats signed values with a plus sign for positive changes", () => {
    expect(formatSigned(0.125, 2)).toBe("+0.13");
    expect(formatSigned(-0.125, 2)).toBe("-0.13");
  });

  it("maps machine status to readable labels", () => {
    expect(statusLabel("partial")).toBe("Partial");
  });
});
