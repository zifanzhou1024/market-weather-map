import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import HorizonImpactMatrix from "./HorizonImpactMatrix";
import OverviewDecisionCard from "./OverviewDecisionCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;

function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    container,
    getByText(text: string) {
      const match = Array.from(container.querySelectorAll("*")).find((element) => element.textContent === text);
      if (!match) throw new Error(`Unable to find text: ${text}`);
      return match;
    },
    queryByText(text: string) {
      return Array.from(container.querySelectorAll("*")).find((element) => element.textContent === text) ?? null;
    }
  };
}

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("horizon display components", () => {
  it("renders overview decision card with source gaps", () => {
    const container = render(
      <MemoryRouter>
        <OverviewDecisionCard
          horizon="1 day to 4 weeks"
          label="Mixed"
          risk="Credit widening"
          sourceGapCount={3}
          support="VIX contained"
          title="Short-Term Market Reaction"
          to="/short-term"
        />
      </MemoryRouter>
    );

    expect(container.getByText("Short-Term Market Reaction")).toBeTruthy();
    expect(container.getByText("3 source gaps or candidate rows visible.")).toBeTruthy();
    expect(container.container.querySelector('a[aria-label="Open Short-Term Market Reaction view"]')).toBeTruthy();
  });

  it("omits source gap copy when no source gap count is provided", () => {
    const container = render(
      <MemoryRouter>
        <OverviewDecisionCard
          horizon="3 months to several years"
          label="Goldilocks"
          risk="Inflation momentum remains sticky"
          support="Growth breadth improved"
          title="Long-Term Macro / Allocation Climate"
          to="/long-term"
        />
      </MemoryRouter>
    );

    expect(container.getByText("Long-Term Macro / Allocation Climate")).toBeTruthy();
    expect(container.queryByText("0 source gaps or candidate rows visible.")).toBeNull();
  });

  it("renders zero source gap copy when an explicit zero count is provided", () => {
    const container = render(
      <MemoryRouter>
        <OverviewDecisionCard
          horizon="1 day to 4 weeks"
          label="Mixed"
          risk="Credit widening"
          sourceGapCount={0}
          support="VIX contained"
          title="Short-Term Market Reaction"
          to="/short-term"
        />
      </MemoryRouter>
    );

    expect(container.getByText("0 source gaps or candidate rows visible.")).toBeTruthy();
  });

  it("renders singular source gap copy", () => {
    const container = render(
      <MemoryRouter>
        <OverviewDecisionCard
          horizon="1 day to 4 weeks"
          label="Mixed"
          risk="Credit widening"
          sourceGapCount={1}
          support="VIX contained"
          title="Short-Term Market Reaction"
          to="/short-term"
        />
      </MemoryRouter>
    );

    expect(container.getByText("1 source gap or candidate row visible.")).toBeTruthy();
  });

  it("renders horizon impact matrix rows", () => {
    const container = render(<HorizonImpactMatrix />);

    expect(container.getByText("VIX / VIX curve")).toBeTruthy();
    expect(container.getByText("Treasury supply / term premium")).toBeTruthy();
  });
});
