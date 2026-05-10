import { describe, expect, it } from "vitest";
import {
  formatIsoDate,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatSignedScore
} from "./chartFormatters";

describe("chart formatters", () => {
  it("formatPercent rounds to the requested fraction digits", () => {
    expect(formatPercent(12.345, 1)).toBe("12.3%");
    expect(formatPercent(12.345, 2)).toBe("12.35%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formatPercent returns em dash for non-finite values", () => {
    expect(formatPercent(Number.NaN)).toBe("—");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("formatSignedScore prepends a plus sign for positive values", () => {
    expect(formatSignedScore(33.34)).toBe("+33.3");
    expect(formatSignedScore(-33.34)).toBe("-33.3");
    expect(formatSignedScore(0)).toBe("0.0");
  });

  it("formatNumber formats with grouping and the requested fraction digits", () => {
    expect(formatNumber(1234567)).toMatch(/1.234.567|1,234,567/);
    expect(formatNumber(12.345, 1)).toMatch(/12.3/);
  });

  it("formatNumber returns em dash for non-finite values", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
  });

  it("formatIsoDate returns a YYYY-MM-DD string", () => {
    expect(formatIsoDate("2026-05-07")).toBe("2026-05-07");
    expect(formatIsoDate(new Date("2026-05-07T12:00:00Z"))).toBe("2026-05-07");
  });

  it("formatIsoDate falls back to the input when the date is invalid", () => {
    expect(formatIsoDate("not-a-date")).toBe("not-a-date");
  });

  it("formatShortDate produces a short month-day label", () => {
    const formatted = formatShortDate("2026-05-07T00:00:00Z");
    expect(formatted).toMatch(/May/);
    expect(formatted).toMatch(/[67]/);
  });
});
