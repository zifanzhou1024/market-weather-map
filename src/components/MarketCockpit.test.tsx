import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import MarketCockpit from "./MarketCockpit";
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

function renderRoot(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return root;
}

describe("MarketCockpit", () => {
  test("renders loading skeleton when data is null", () => {
    renderRoot(<MarketCockpit data={null} mode="detail" />);
    const cockpit = container.querySelector(".market-cockpit");
    expect(cockpit).not.toBeNull();
    expect(container.textContent?.toLowerCase()).toMatch(/loading|skeleton/);
  });

  test("renders 3 composite cells + N vital cells from sample data", () => {
    renderRoot(<MarketCockpit data={sample as any} mode="detail" />);
    expect(container.querySelectorAll(".composite-score-cell").length).toBe(3);
    expect(container.querySelectorAll(".cockpit-cell").length).toBe(
      sample.vital_signs.length,
    );
  });

  test("propagates mode prop to children", () => {
    renderRoot(<MarketCockpit data={sample as any} mode="brief" />);
    expect(container.querySelector(".cockpit-cell--brief")).not.toBeNull();
  });

  test("renders empty-state when vital_signs array is empty", () => {
    const empty = { ...sample, vital_signs: [] };
    renderRoot(<MarketCockpit data={empty as any} mode="detail" />);
    // CompositeScoresRow still renders; vital signs grid shows placeholder
    expect(container.querySelectorAll(".composite-score-cell").length).toBe(3);
    expect(container.textContent?.toLowerCase()).toMatch(
      /no vital signs|no signals/i,
    );
  });

  test("section has data-testid='market-cockpit' for Overview to locate", () => {
    renderRoot(<MarketCockpit data={sample as any} mode="detail" />);
    expect(
      container.querySelector("[data-testid='market-cockpit']"),
    ).not.toBeNull();
  });
});
