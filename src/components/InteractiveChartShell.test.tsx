import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import InteractiveChartShell from "./InteractiveChartShell";

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

describe("InteractiveChartShell", () => {
  it("renders the title", () => {
    const c = render(
      <InteractiveChartShell title="VIX curve proxy" ariaLabel="VIX curve proxy chart">
        <div data-testid="chart-body">child</div>
      </InteractiveChartShell>
    );
    expect(c.textContent).toContain("VIX curve proxy");
  });

  it("renders children inside the body slot", () => {
    const c = render(
      <InteractiveChartShell title="Yield decomposition" ariaLabel="Yield decomposition chart">
        <div data-testid="chart-body">child content</div>
      </InteractiveChartShell>
    );
    expect(c.querySelector('[data-testid="chart-body"]')).not.toBeNull();
    expect(c.textContent).toContain("child content");
  });

  it("renders ChartStateBadge when state is provided", () => {
    const c = render(
      <InteractiveChartShell title="Hidden stress" ariaLabel="Hidden stress chart" state="risk">
        <div />
      </InteractiveChartShell>
    );
    const badge = c.querySelector(".chart-state-badge");
    expect(badge).not.toBeNull();
    expect(badge?.classList.contains("chart-state-badge--risk")).toBe(true);
  });

  it("does not render ChartStateBadge when state is undefined", () => {
    const c = render(
      <InteractiveChartShell title="Hidden stress" ariaLabel="Hidden stress chart">
        <div />
      </InteractiveChartShell>
    );
    expect(c.querySelector(".chart-state-badge")).toBeNull();
  });

  it("renders ChartRangeControls when both range and onRangeChange are provided", () => {
    const c = render(
      <InteractiveChartShell
        title="VIX ratio"
        ariaLabel="VIX ratio chart"
        range="1Y"
        onRangeChange={() => undefined}
      >
        <div />
      </InteractiveChartShell>
    );
    expect(c.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it("does not render ChartRangeControls when range is omitted", () => {
    const c = render(
      <InteractiveChartShell title="VIX ratio" ariaLabel="VIX ratio chart">
        <div />
      </InteractiveChartShell>
    );
    expect(c.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it("does not render ChartRangeControls when onRangeChange is omitted", () => {
    const c = render(
      <InteractiveChartShell title="VIX ratio" ariaLabel="VIX ratio chart" range="1Y">
        <div />
      </InteractiveChartShell>
    );
    expect(c.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it("calls onRangeChange when the inner range control fires", () => {
    const onRangeChange = vi.fn();
    const c = render(
      <InteractiveChartShell
        title="VIX ratio"
        ariaLabel="VIX ratio chart"
        range="1Y"
        onRangeChange={onRangeChange}
      >
        <div />
      </InteractiveChartShell>
    );
    const threeMonth = Array.from(c.querySelectorAll('[role="radio"]')).find(
      (b) => b.textContent === "3M"
    ) as HTMLButtonElement;
    act(() => {
      threeMonth.click();
    });
    expect(onRangeChange).toHaveBeenCalledWith("3M");
  });

  it("renders an insight node when insight is a string", () => {
    const c = render(
      <InteractiveChartShell
        title="Hidden stress"
        ariaLabel="Hidden stress chart"
        insight="Vol-of-vol percentile is leading VIX upward."
      >
        <div />
      </InteractiveChartShell>
    );
    expect(c.textContent).toContain("Vol-of-vol percentile is leading VIX upward.");
    // Default string-wrap renders an InsightCallout container.
    expect(c.querySelector(".insight-callout")).not.toBeNull();
  });

  it("renders a custom insight node when insight is a ReactNode", () => {
    const c = render(
      <InteractiveChartShell
        title="Hidden stress"
        ariaLabel="Hidden stress chart"
        insight={<div data-testid="custom-insight">custom insight node</div>}
      >
        <div />
      </InteractiveChartShell>
    );
    expect(c.querySelector('[data-testid="custom-insight"]')).not.toBeNull();
    expect(c.textContent).toContain("custom insight node");
  });

  it("does not render an insight container when insight is undefined", () => {
    const c = render(
      <InteractiveChartShell title="Hidden stress" ariaLabel="Hidden stress chart">
        <div />
      </InteractiveChartShell>
    );
    expect(c.querySelector(".insight-callout")).toBeNull();
  });

  it("places aria-label on the outer container", () => {
    const c = render(
      <InteractiveChartShell title="Hidden stress" ariaLabel="Hidden stress chart">
        <div />
      </InteractiveChartShell>
    );
    const outer = c.querySelector(".interactive-chart-shell");
    expect(outer?.getAttribute("aria-label")).toBe("Hidden stress chart");
  });

  it("uses role=region for screen-reader landmarks", () => {
    const c = render(
      <InteractiveChartShell title="Hidden stress" ariaLabel="Hidden stress chart">
        <div />
      </InteractiveChartShell>
    );
    const outer = c.querySelector(".interactive-chart-shell");
    expect(outer?.getAttribute("role")).toBe("region");
  });

  it("renders without crashing when children is null", () => {
    const c = render(
      <InteractiveChartShell title="Hidden stress" ariaLabel="Hidden stress chart">
        {null}
      </InteractiveChartShell>
    );
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent).toContain("Hidden stress");
  });

  it("renders title, range, state, and insight together when all provided", () => {
    const onRangeChange = vi.fn();
    const c = render(
      <InteractiveChartShell
        title="Hidden stress"
        ariaLabel="Hidden stress chart"
        state="watch"
        range="6M"
        onRangeChange={onRangeChange}
        insight="VVIX percentile leading VIX."
      >
        <div data-testid="chart" />
      </InteractiveChartShell>
    );
    expect(c.querySelector(".chart-state-badge--watch")).not.toBeNull();
    expect(c.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(c.querySelector(".insight-callout")).not.toBeNull();
    expect(c.querySelector('[data-testid="chart"]')).not.toBeNull();
  });
});
