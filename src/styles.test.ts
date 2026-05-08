/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const styles = readFileSync("src/styles.css", "utf8");

function cssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(styles.matchAll(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, "gs")))
    .map((match) => match.groups?.body ?? "")
    .join("\n");
}

describe("layout stylesheet contracts", () => {
  it("keeps score card content pinned instead of stretching confidence pills", () => {
    expect(cssRule(".score-card")).toContain("align-content: start");
    expect(cssRule(".score-confidence")).toContain("display: inline-flex");
    expect(cssRule(".score-confidence")).toContain("align-self: start");
    expect(cssRule(".score-confidence")).toContain("justify-self: start");
  });

  it("keeps quadrant labels clear of chart axes", () => {
    expect(cssRule(".quadrant-label")).toContain("background:");
    expect(cssRule(".quadrant-label--top-left")).toContain("left: 78px");
    expect(cssRule(".quadrant-label--bottom-left")).toContain("left: 78px");
  });
});
