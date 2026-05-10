import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import RouteDataFooter from "./RouteDataFooter";

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

describe("RouteDataFooter", () => {
  it("renders the 'Data and sources' heading", () => {
    const container = render(<RouteDataFooter />);
    expect(container.textContent).toContain("Data and sources");
    expect(container.querySelector(".route-data-footer__heading")).not.toBeNull();
  });

  it("renders a visual separator above the heading", () => {
    const container = render(<RouteDataFooter />);
    expect(container.querySelector(".route-data-footer__separator")).not.toBeNull();
  });

  it("renders the footer with the documented top-level class", () => {
    const container = render(<RouteDataFooter />);
    expect(container.querySelector(".route-data-footer")).not.toBeNull();
  });

  it("renders children inside the panels region after the heading", () => {
    const container = render(
      <RouteDataFooter route="rates">
        <div data-testid="data-gap">DataGapPanel placeholder</div>
        <div data-testid="data-status">DataStatusTable placeholder</div>
      </RouteDataFooter>
    );
    expect(container.querySelector("[data-testid='data-gap']")).not.toBeNull();
    expect(container.querySelector("[data-testid='data-status']")).not.toBeNull();
  });

  it("renders children inside the panels container so default panel styling applies", () => {
    const container = render(
      <RouteDataFooter>
        <div data-testid="child-1">Panel A</div>
      </RouteDataFooter>
    );
    const panels = container.querySelector(".route-data-footer__panels");
    expect(panels).not.toBeNull();
    expect(panels!.querySelector("[data-testid='child-1']")).not.toBeNull();
  });

  it("renders heading -> separator -> panels in DOM order", () => {
    const container = render(
      <RouteDataFooter>
        <div data-testid="child">child</div>
      </RouteDataFooter>
    );
    const footer = container.querySelector(".route-data-footer")!;
    // Collect class-tagged children only — text nodes don't matter for order.
    const taggedChildren = Array.from(footer.children).map((el) => el.className);
    // separator first, then heading, then panels.
    const separatorIdx = taggedChildren.findIndex((c) => c.includes("route-data-footer__separator"));
    const headingIdx = taggedChildren.findIndex((c) => c.includes("route-data-footer__heading"));
    const panelsIdx = taggedChildren.findIndex((c) => c.includes("route-data-footer__panels"));
    expect(separatorIdx).toBe(0);
    expect(headingIdx).toBe(1);
    expect(panelsIdx).toBe(2);
  });

  it("includes the route name in aria-label when route is provided", () => {
    const container = render(<RouteDataFooter route="volatility" />);
    const footer = container.querySelector(".route-data-footer") as HTMLElement;
    expect(footer.getAttribute("aria-label")).toContain("volatility");
  });

  it("renders without children when none are provided (no crash)", () => {
    const container = render(<RouteDataFooter />);
    expect(container.querySelector(".route-data-footer__panels")).not.toBeNull();
  });
});
