import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import CompositeScoresRow from "./CompositeScoresRow";
import sample from "../__fixtures__/cockpit/today.json";

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

function renderRow(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return root;
}

describe("CompositeScoresRow", () => {
  test("renders all 3 composites in fixed order regardless of input order", () => {
    // Shuffle input so fragility comes first
    const shuffled = [...sample.composite_scores].reverse();
    renderRow(<CompositeScoresRow scores={shuffled as any} mode="detail" />);
    const labels = Array.from(container.querySelectorAll(".composite-score-cell__label"))
      .map((el) => el.textContent);
    expect(labels).toEqual(["Market Weather", "Macro Climate", "Fragility"]);
  });

  test("each cell shows label, value, regime_label, sparkline", () => {
    renderRow(<CompositeScoresRow scores={sample.composite_scores as any} mode="detail" />);
    expect(container.textContent).toContain("Market Weather");
    expect(container.textContent).toContain("Macro Climate");
    expect(container.textContent).toContain("Fragility");
    // Mixed appears as regime label for two of three
    expect(container.textContent).toContain("Mixed");
    expect(container.querySelectorAll("polyline").length).toBe(3);
  });

  test("detail mode shows delta_7d; brief hides it", () => {
    renderRow(<CompositeScoresRow scores={sample.composite_scores as any} mode="detail" />);
    expect(container.textContent).toContain("Δ7d");

    document.body.removeChild(container);
    container = document.createElement("div");
    document.body.appendChild(container);
    renderRow(<CompositeScoresRow scores={sample.composite_scores as any} mode="brief" />);
    expect(container.textContent).not.toContain("Δ7d");
  });

  test("renders gracefully when a composite has null value", () => {
    const withNull = sample.composite_scores.map((s, i) =>
      i === 0 ? { ...s, value: null } : s,
    );
    renderRow(<CompositeScoresRow scores={withNull as any} mode="detail" />);
    expect(container.textContent).toContain("Market Weather");
    // Should not crash; renders "—" placeholder for the null value.
    expect(container.textContent).toContain("—");
  });
});
