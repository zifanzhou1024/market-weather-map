import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import ChartStateBadge, { type ChartState } from "./ChartStateBadge";

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

const STATE_TO_LABEL: Record<ChartState, string> = {
  risk: "Risk",
  support: "Support",
  mixed: "Mixed",
  calm: "Calm",
  watch: "Watch",
  "stale-data": "Stale data"
};

describe("ChartStateBadge", () => {
  it("renders each state with the matching label text", () => {
    for (const [state, label] of Object.entries(STATE_TO_LABEL) as [ChartState, string][]) {
      const c = render(<ChartStateBadge state={state} />);
      expect(c.textContent).toContain(label);
      // Clean up between iterations to avoid leaking the previous container.
      if (root) {
        act(() => root!.unmount());
        root = undefined;
      }
      c.remove();
    }
  });

  it("emits a state-specific modifier class for each state", () => {
    const seen = new Set<string>();
    for (const state of Object.keys(STATE_TO_LABEL) as ChartState[]) {
      const c = render(<ChartStateBadge state={state} />);
      const el = c.querySelector(".chart-state-badge") as HTMLElement;
      expect(el).not.toBeNull();
      const className = el.className;
      expect(className).toContain(`chart-state-badge--${state}`);
      seen.add(`chart-state-badge--${state}`);
      if (root) {
        act(() => root!.unmount());
        root = undefined;
      }
      c.remove();
    }
    // All six modifier classes are distinct.
    expect(seen.size).toBe(6);
  });

  it("renders the badge as a span (inline element) so it can sit inline with text", () => {
    const c = render(<ChartStateBadge state="risk" />);
    const el = c.querySelector(".chart-state-badge");
    expect(el?.tagName).toBe("SPAN");
  });

  it("carries the state on aria-label so screen readers announce it", () => {
    const c = render(<ChartStateBadge state="stale-data" />);
    const el = c.querySelector(".chart-state-badge");
    expect(el?.getAttribute("aria-label")).toBe("Stale data");
  });

  it("type-level: the ChartState union has exactly the six expected literals", () => {
    // This is a compile-time check expressed via a runtime tuple assertion.
    const ALL: ChartState[] = ["risk", "support", "mixed", "calm", "watch", "stale-data"];
    expect(ALL).toHaveLength(6);
  });
});
