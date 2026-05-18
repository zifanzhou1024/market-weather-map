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

function baseQuality(overrides: Record<string, unknown> = {}) {
  return {
    coverage_confidence: 0.85,
    freshness_confidence: 0.82,
    model_confidence: 0.9,
    source_confidence: 0.6,
    overall_confidence: 0.78,
    tier: "medium",
    reasons: [],
    ...overrides
  };
}

describe("DataQualityBanner", () => {
  it("renders an unavailable fallback for malformed data quality", () => {
    const container = render(<DataQualityBanner dataQuality={{ overall_confidence: Number.NaN, tier: "high", reasons: [] }} />);

    expect(container.textContent).toContain("Data quality unavailable");
    expect(container.textContent).toContain("Score-summary data quality is missing or malformed.");
  });

  it("renders the tier pill text and tone class for a high-quality read", () => {
    const container = render(
      <DataQualityBanner dataQuality={baseQuality({ overall_confidence: 0.91, tier: "high" })} />
    );

    const tierEl = container.querySelector(".data-quality-banner__tier");
    expect(tierEl).not.toBeNull();
    expect(tierEl?.textContent).toContain("High data quality");
    expect(tierEl?.classList.contains("tone-positive")).toBe(true);
    expect(tierEl?.getAttribute("data-tier")).toBe("high");
    expect(container.textContent).toContain("aggregate 91%");
  });

  it("renders tone-warning for the low tier", () => {
    const container = render(
      <DataQualityBanner dataQuality={baseQuality({ overall_confidence: 0.5, tier: "low" })} />
    );

    const tierEl = container.querySelector(".data-quality-banner__tier");
    expect(tierEl?.textContent).toContain("Low data quality");
    expect(tierEl?.classList.contains("tone-warning")).toBe(true);
  });

  it("renders tone-negative for the thin tier", () => {
    const container = render(
      <DataQualityBanner dataQuality={baseQuality({ overall_confidence: 0.2, tier: "thin" })} />
    );

    const tierEl = container.querySelector(".data-quality-banner__tier");
    expect(tierEl?.textContent).toContain("Thin data quality");
    expect(tierEl?.classList.contains("tone-negative")).toBe(true);
  });

  it("falls back to deriving the tier from overall_confidence when tier is missing or invalid", () => {
    const container = render(
      <DataQualityBanner dataQuality={baseQuality({ tier: undefined, overall_confidence: 0.45 })} />
    );

    const tierEl = container.querySelector(".data-quality-banner__tier");
    expect(tierEl?.classList.contains("tone-warning")).toBe(true);
    expect(tierEl?.getAttribute("data-tier")).toBe("low");
  });

  it("renders the four component values inside the details disclosure", () => {
    const container = render(
      <DataQualityBanner
        dataQuality={baseQuality({
          coverage_confidence: 0.83,
          freshness_confidence: 0.94,
          model_confidence: 0.97,
          source_confidence: 0.58,
          overall_confidence: 0.85,
          tier: "high"
        })}
      />
    );

    const dl = container.querySelector(".data-quality-banner__components");
    expect(dl).not.toBeNull();
    const text = dl?.textContent ?? "";
    expect(text).toContain("Coverage");
    expect(text).toContain("83%");
    expect(text).toContain("Freshness");
    expect(text).toContain("94%");
    expect(text).toContain("Model");
    expect(text).toContain("97%");
    expect(text).toContain("Source");
    expect(text).toContain("58%");
  });

  it("renders reasons inside the details disclosure when present", () => {
    const container = render(
      <DataQualityBanner
        dataQuality={baseQuality({
          tier: "medium",
          overall_confidence: 0.72,
          reasons: [
            "High-importance stale series: broad_dollar.",
            "Bucket missing active inputs: treasury_bond_volatility."
          ]
        })}
      />
    );

    const reasons = Array.from(container.querySelectorAll(".data-quality-banner__reasons li"), (item) => item.textContent);
    expect(reasons).toEqual([
      "High-importance stale series: broad_dollar.",
      "Bucket missing active inputs: treasury_bond_volatility."
    ]);
  });

  it("renders a no-issues note when valid data quality has no reasons", () => {
    const container = render(
      <DataQualityBanner dataQuality={baseQuality({ tier: "high", overall_confidence: 0.93, reasons: [] })} />
    );

    expect(container.textContent).toContain("No active data-quality issues.");
  });
});
