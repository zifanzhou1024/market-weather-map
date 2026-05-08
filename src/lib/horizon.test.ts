import { describe, expect, it } from "vitest";
import {
  classifyNearTermEventVol,
  classifyVixProxy,
  countSourceGaps,
  firstText,
  scoreLabel
} from "./horizon";

describe("horizon helpers", () => {
  it("classifies VIX proxy curve states", () => {
    expect(classifyVixProxy(21, 20).label).toBe("Backwardation-like stress");
    expect(classifyVixProxy(18, 20).label).toBe("Contango-like calm");
    expect(classifyVixProxy(19.8, 20).label).toBe("Flat / transition");
  });

  it("classifies near-term event-vol pressure", () => {
    expect(classifyNearTermEventVol(22, 20).label).toBe("Elevated near-term event risk");
    expect(classifyNearTermEventVol(18, 20).label).toBe("Near-term vol discounted");
    expect(classifyNearTermEventVol(20, 20).label).toBe("Balanced near-term vol");
  });

  it("handles unavailable numeric inputs", () => {
    expect(classifyVixProxy(null, 20).label).toBe("Unavailable");
    expect(classifyNearTermEventVol(20, undefined).label).toBe("Unavailable");
  });

  it("summarizes text and source gaps defensively", () => {
    expect(firstText(["A", "B"], "Fallback")).toBe("A");
    expect(firstText(["   ", "  Trimmed value  "], "Fallback")).toBe("Trimmed value");
    expect(firstText([], "Fallback")).toBe("Fallback");
    expect(scoreLabel({ score: 12.3, label: "Mixed" })).toBe("Mixed 12.3");
    expect(countSourceGaps([{ status: "terms_review_needed" }, { status: "ok" }])).toBe(1);
  });
});
