import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import DataQualityBanner from "./DataQualityBanner";

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
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("DataQualityBanner", () => {
  it("renders an unavailable fallback for malformed data quality", () => {
    const container = render(<DataQualityBanner dataQuality={{ overall_confidence: Number.NaN, reasons: [] }} />);

    expect(container.textContent).toContain("Data quality unavailable");
    expect(container.textContent).toContain("Score-summary data quality is missing or malformed.");
  });

  it("labels high, mixed, and low data quality from overall confidence", () => {
    const high = render(<DataQualityBanner dataQuality={{ overall_confidence: 0.91, reasons: [] }} />);
    expect(high.textContent).toContain("High data quality");
    expect(high.textContent).toContain("0.91");

    act(() => root?.unmount());
    root = undefined;
    high.remove();

    const mixed = render(<DataQualityBanner dataQuality={{ overall_confidence: 0.72, reasons: [] }} />);
    expect(mixed.textContent).toContain("Mixed data quality");

    act(() => root?.unmount());
    root = undefined;
    mixed.remove();

    const low = render(<DataQualityBanner dataQuality={{ overall_confidence: 0.63, reasons: [] }} />);
    expect(low.textContent).toContain("Low data quality");
  });

  it("prioritizes source-quality caveats and limits the list to four reasons", () => {
    const container = render(
      <DataQualityBanner
        dataQuality={{
          overall_confidence: 0.76,
          reasons: [
            "General lower-priority note.",
            "Housing source is stale.",
            "Treasury/bond volatility source is not active.",
            "Options source remains under terms review.",
            "Candidate calendar source needs review.",
            "Another lower-priority note."
          ]
        }}
      />
    );

    const reasons = Array.from(container.querySelectorAll("li"), (item) => item.textContent);

    expect(reasons).toEqual([
      "Housing source is stale.",
      "Treasury/bond volatility source is not active.",
      "Options source remains under terms review.",
      "Candidate calendar source needs review."
    ]);
  });

  it("renders a no-caveats note when valid data quality has no reasons", () => {
    const container = render(<DataQualityBanner dataQuality={{ overall_confidence: 0.93, reasons: [] }} />);

    expect(container.textContent).toContain("No data-quality caveats in the current score summary.");
  });
});
