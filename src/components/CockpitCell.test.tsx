import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import CockpitCell from "./CockpitCell";
import sample from "../__fixtures__/cockpit/today.json";

// The fixture's rank-#1 vital sign (10Y Breakeven) — used as the canonical
// example across these tests so we exercise the same row in every mode.
const topSign = sample.vital_signs[0];

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

function renderCell(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return root;
}

describe("CockpitCell", () => {
  test("renders label, rank, primary value, sparkline, percentile, freshness pill in detail mode", () => {
    renderCell(<CockpitCell sign={topSign as any} mode="detail" />);
    expect(container.textContent).toContain(topSign.label);
    expect(container.textContent).toContain(`#${topSign.rank}`);
    expect(container.textContent).toMatch(
      new RegExp(topSign.primary_value.toFixed(topSign.primary_decimals).replace(".", "\\.")),
    );
    expect(container.querySelector("polyline")).not.toBeNull(); // sparkline
    expect(container.querySelector(".freshness-pill")).not.toBeNull();
    expect(container.querySelector(".percentile-band")).not.toBeNull();
  });

  test("detail mode shows delta_7d when non-null", () => {
    renderCell(<CockpitCell sign={topSign as any} mode="detail" />);
    if (topSign.delta_7d !== null) {
      expect(container.textContent).toContain("Δ7d");
    }
  });

  test("detail mode shows secondary_values labels", () => {
    renderCell(<CockpitCell sign={topSign as any} mode="detail" />);
    if (topSign.secondary_values.length > 0) {
      expect(container.textContent).toContain((topSign.secondary_values[0] as { label: string }).label);
    }
  });

  test("brief mode hides delta_7d and secondary_values", () => {
    renderCell(<CockpitCell sign={topSign as any} mode="brief" />);
    expect(container.textContent).not.toContain("Δ7d");
    if (topSign.secondary_values.length > 0) {
      expect(container.textContent).not.toContain((topSign.secondary_values[0] as { label: string }).label);
    }
  });

  test("brief mode still shows label, value, sparkline, percentile band, freshness", () => {
    renderCell(<CockpitCell sign={topSign as any} mode="brief" />);
    expect(container.textContent).toContain(topSign.label);
    expect(container.querySelector("polyline")).not.toBeNull();
    expect(container.querySelector(".freshness-pill")).not.toBeNull();
    expect(container.querySelector(".percentile-band")).not.toBeNull();
  });

  test("direction encoded as a CSS class on the article", () => {
    renderCell(<CockpitCell sign={topSign as any} mode="detail" />);
    const article = container.querySelector("article");
    expect(article?.className).toMatch(/cockpit-cell--risk|cockpit-cell--support|cockpit-cell--neutral/);
  });

  test("article is keyboard-focusable", () => {
    renderCell(<CockpitCell sign={topSign as any} mode="detail" />);
    const article = container.querySelector("article");
    expect(article?.tabIndex).toBe(0);
  });

  test("label wraps in <abbr> with glossary definition for known jargon", () => {
    // Integration check: the fixture's rank-#1 label is "10Y Breakeven",
    // which is in the curated glossary. Confirms the GlossaryTerm wrapper
    // is wired into the cell label and emits the native tooltip.
    renderCell(<CockpitCell sign={topSign as any} mode="detail" />);
    const labelAbbr = container.querySelector(".cockpit-cell__label abbr.glossary");
    expect(labelAbbr).not.toBeNull();
    expect(labelAbbr?.getAttribute("title")).toMatch(/inflation expectation/);
    expect(labelAbbr?.textContent).toBe(topSign.label);
  });

  test("label renders without <abbr> when the term is not in the glossary", () => {
    const unknownLabelSign = { ...topSign, label: "Not-A-Real-Term" };
    renderCell(<CockpitCell sign={unknownLabelSign as any} mode="detail" />);
    const labelAbbr = container.querySelector(".cockpit-cell__label abbr.glossary");
    expect(labelAbbr).toBeNull();
    expect(container.querySelector(".cockpit-cell__label")?.textContent).toBe("Not-A-Real-Term");
  });

  test("secondary values are formatted to 1 decimal (no raw float spill)", () => {
    // Regression: previously the secondary value rendered as
    // "3.2027589069747022% YoY" because the raw float was passed straight to JSX.
    const signWithSecondary = {
      ...topSign,
      secondary_values: [
        { label: "Core PCE", value: 3.2027589069747022, unit: "% YoY" },
      ],
    };
    renderCell(<CockpitCell sign={signWithSecondary as any} mode="detail" />);
    const secondary = container.querySelector(".cockpit-cell__secondary-value");
    expect(secondary).not.toBeNull();
    expect(secondary?.textContent).toContain("3.2");
    expect(secondary?.textContent).not.toContain("3.2027589069747022");
  });
});
