import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import DriverBarList, { type Driver } from "./DriverBarList";

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

function mkDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: overrides.id ?? "vix-curve-stress",
    label: overrides.label ?? "VIX front-month elevated",
    priority: overrides.priority ?? 50,
    direction: overrides.direction ?? "risk",
    why_it_matters: overrides.why_it_matters ?? "Front-month vol above the 90th percentile.",
    freshness_status: overrides.freshness_status ?? "ok",
    confidence: overrides.confidence ?? 0.8
  };
}

describe("DriverBarList", () => {
  it("renders one row per driver", () => {
    const items: Driver[] = [
      mkDriver({ id: "a", label: "A" }),
      mkDriver({ id: "b", label: "B", direction: "support" }),
      mkDriver({ id: "c", label: "C", direction: "neutral" })
    ];
    const c = render(<DriverBarList items={items} />);
    const rows = c.querySelectorAll(".driver-bar-list__row");
    expect(rows).toHaveLength(3);
  });

  it("renders an empty-state hint when items is empty", () => {
    const c = render(<DriverBarList items={[]} />);
    expect(c.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(c.querySelector(".driver-bar-list__empty")).not.toBeNull();
  });

  it("truncates to top-N by priority when `max` is provided", () => {
    const items: Driver[] = [
      mkDriver({ id: "low", label: "Low", priority: 10 }),
      mkDriver({ id: "mid", label: "Mid", priority: 50 }),
      mkDriver({ id: "high", label: "High", priority: 90 })
    ];
    const c = render(<DriverBarList items={items} max={2} />);
    const labels = Array.from(c.querySelectorAll(".driver-bar-list__label")).map(
      (el) => el.textContent
    );
    // Highest two retained, ordered highest-first.
    expect(labels).toEqual(["High", "Mid"]);
  });

  it("scales bar width by priority relative to the highest in the list", () => {
    const items: Driver[] = [
      mkDriver({ id: "top", label: "Top", priority: 80 }),
      mkDriver({ id: "half", label: "Half", priority: 40 })
    ];
    const c = render(<DriverBarList items={items} />);
    const bars = c.querySelectorAll(".driver-bar-list__bar");
    expect(bars).toHaveLength(2);
    const topWidth = (bars[0] as HTMLElement).style.width;
    const halfWidth = (bars[1] as HTMLElement).style.width;
    expect(topWidth).toBe("100%");
    expect(halfWidth).toBe("50%");
  });

  it("applies a direction-specific modifier class to each bar", () => {
    const items: Driver[] = [
      mkDriver({ id: "r", label: "R", direction: "risk" }),
      mkDriver({ id: "s", label: "S", direction: "support" }),
      mkDriver({ id: "n", label: "N", direction: "neutral" })
    ];
    const c = render(<DriverBarList items={items} />);
    const bars = c.querySelectorAll(".driver-bar-list__bar");
    expect((bars[0] as HTMLElement).className).toContain("driver-bar-list__bar--risk");
    expect((bars[1] as HTMLElement).className).toContain("driver-bar-list__bar--support");
    expect((bars[2] as HTMLElement).className).toContain("driver-bar-list__bar--neutral");
  });

  it("composes the tooltip text from why_it_matters, freshness_status, and confidence", () => {
    const driver = mkDriver({
      why_it_matters: "Bond MOVE proxy above its 5-year 80th percentile.",
      freshness_status: "stale",
      confidence: 0.62
    });
    const c = render(<DriverBarList items={[driver]} />);
    const row = c.querySelector(".driver-bar-list__row") as HTMLElement;
    const title = row.getAttribute("title") ?? "";
    expect(title).toContain("Bond MOVE proxy above its 5-year 80th percentile.");
    expect(title).toContain("stale");
    expect(title).toContain("0.62");
  });

  it("renders rows ordered by priority descending even without `max`", () => {
    const items: Driver[] = [
      mkDriver({ id: "lo", label: "Lo", priority: 20 }),
      mkDriver({ id: "hi", label: "Hi", priority: 95 }),
      mkDriver({ id: "mid", label: "Mid", priority: 50 })
    ];
    const c = render(<DriverBarList items={items} />);
    const labels = Array.from(c.querySelectorAll(".driver-bar-list__label")).map(
      (el) => el.textContent
    );
    expect(labels).toEqual(["Hi", "Mid", "Lo"]);
  });

  it("renders a zero-priority bar with width 0 and data-has-priority=false (no residual min-width)", () => {
    const items: Driver[] = [
      mkDriver({ id: "max", label: "Max", priority: 50 }),
      mkDriver({ id: "zero", label: "Zero", priority: 0 })
    ];
    const c = render(<DriverBarList items={items} />);
    const bars = c.querySelectorAll(".driver-bar-list__bar");
    expect(bars).toHaveLength(2);
    const zeroBar = bars[1] as HTMLElement;
    expect(zeroBar.style.width).toBe("0%");
    expect(zeroBar.getAttribute("data-has-priority")).toBe("false");
  });

  it("flags positive-priority bars with data-has-priority=true so the 4% min-width fallback applies", () => {
    const items: Driver[] = [
      mkDriver({ id: "tiny", label: "Tiny", priority: 1 }),
      mkDriver({ id: "big", label: "Big", priority: 100 })
    ];
    const c = render(<DriverBarList items={items} />);
    const bars = c.querySelectorAll(".driver-bar-list__bar");
    // Find the bar belonging to the priority-1 row (not 100%).
    const tinyBar = Array.from(bars).find(
      (b) => (b as HTMLElement).style.width !== "100%"
    ) as HTMLElement;
    expect(tinyBar.getAttribute("data-has-priority")).toBe("true");
  });
});
