import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import PercentileBand from "./PercentileBand";

let container: HTMLDivElement;

beforeEach(() => {
  // @ts-expect-error -- vitest test environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

function renderIn(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return root;
}

describe("PercentileBand", () => {
  test("renders an SVG bar with a vertical tick at the percentile position", () => {
    renderIn(<PercentileBand percentile={78} direction="risk" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const tick = container.querySelector("line");
    expect(tick).not.toBeNull();
    const x = parseFloat(tick?.getAttribute("x1") ?? "0");
    // 78% of full width — assert in [0, fullWidth]; specific value depends on width default
    expect(x).toBeGreaterThan(0);
  });

  test("renders an n/a placeholder when percentile is null (cell-height stable)", () => {
    renderIn(<PercentileBand percentile={null} direction="risk" />);
    // Should not be empty; placeholder text or muted bar
    expect(container.textContent?.toLowerCase()).toContain("n/a");
  });

  test("clamps percentile to [0, 100]", () => {
    renderIn(<PercentileBand percentile={150} direction="risk" />);
    const tick = container.querySelector("line");
    const x = parseFloat(tick?.getAttribute("x1") ?? "0");
    // Should be at the rightmost edge — assert against default 100 width
    expect(x).toBeLessThanOrEqual(100);
    expect(x).toBeGreaterThan(0);
  });

  test("accessible label includes percentile and 5y context", () => {
    renderIn(<PercentileBand percentile={42} direction="risk" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toMatch(/42.*5y/i);
  });

  test("supports a custom window-days label for non-5y windows", () => {
    renderIn(<PercentileBand percentile={42} direction="risk" windowDays={252} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toMatch(/42.*1y/i);
  });

  test("direction='support' inverts the color encoding", () => {
    // Smoke check that the prop is honored; the visual tint goes through a CSS class
    renderIn(<PercentileBand percentile={20} direction="support" />);
    const wrapper = container.firstChild as HTMLElement | null;
    expect(wrapper?.className).toMatch(/support/);
  });
});
