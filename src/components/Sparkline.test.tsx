import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import Sparkline from "./Sparkline";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("Sparkline", () => {
  it("renders an SVG polyline for the given points", () => {
    const c = render(<Sparkline points={[1, 2, 3, 4, 3, 2]} width={60} height={24} />);
    const poly = c.querySelector("polyline");
    expect(poly).not.toBeNull();
    expect(poly?.getAttribute("points")).toBeTruthy();
  });

  it("renders nothing when given fewer than 2 points", () => {
    const c = render(<Sparkline points={[]} />);
    expect(c.querySelector("polyline")).toBeNull();
    expect(c.querySelector("svg")).toBeNull();
  });

  it("renders nothing for a single point", () => {
    const c = render(<Sparkline points={[42]} />);
    expect(c.querySelector("polyline")).toBeNull();
    expect(c.querySelector("svg")).toBeNull();
  });

  it("scales values to fit the height (min at bottom, max at top)", () => {
    const c = render(<Sparkline points={[0, 10]} width={100} height={20} />);
    const points = c.querySelector("polyline")?.getAttribute("points") ?? "";
    const ys = points.split(" ").map(p => parseFloat(p.split(",")[1]));
    expect(ys.length).toBe(2);
    // min value (0) should be at bottom (y=height=20); max value (10) should be at top (y=0)
    expect(Math.max(...ys)).toBeCloseTo(20, 0);
    expect(Math.min(...ys)).toBeCloseTo(0, 0);
  });

  it("constant values render without NaN / Infinity from div-by-zero range", () => {
    const c = render(<Sparkline points={[5, 5, 5]} width={60} height={24} />);
    const points = c.querySelector("polyline")?.getAttribute("points") ?? "";
    expect(points).toBeTruthy();
    expect(points).not.toMatch(/NaN|Infinity/);
  });

  it("uses currentColor for the stroke so the parent controls tone", () => {
    const c = render(<Sparkline points={[1, 2, 3]} />);
    const poly = c.querySelector("polyline");
    expect(poly?.getAttribute("stroke")).toBe("currentColor");
    expect(poly?.getAttribute("fill")).toBe("none");
  });

  it("is marked aria-hidden since it is a decorative supplement to the numeric value", () => {
    const c = render(<Sparkline points={[1, 2, 3]} />);
    const svg = c.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies default 60x24 dimensions when none are supplied", () => {
    const c = render(<Sparkline points={[1, 2, 3]} />);
    const svg = c.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("60");
    expect(svg?.getAttribute("height")).toBe("24");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 60 24");
  });

  it("forwards className to the svg root for parent styling", () => {
    const c = render(<Sparkline points={[1, 2, 3]} className="cockpit-spark" />);
    const svg = c.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("cockpit-spark");
  });
});
