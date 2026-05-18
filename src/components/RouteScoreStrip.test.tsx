import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import RouteScoreStrip from "./RouteScoreStrip";
import sampleCockpit from "../__fixtures__/cockpit/today.json";

const marketWeather = sampleCockpit.composite_scores[0];

let container: HTMLDivElement;

beforeEach(() => {
  // @ts-expect-error
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => { document.body.removeChild(container); });

function renderStrip(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => root.render(node));
  return root;
}

describe("RouteScoreStrip", () => {
  test("renders label, value, regime_label, and sparkline in detail mode", () => {
    renderStrip(<RouteScoreStrip composite={marketWeather as any} mode="detail" />);
    expect(container.textContent).toContain("Market Weather");
    expect(container.textContent).toContain(marketWeather.value!.toFixed(1));
    expect(container.textContent).toContain(marketWeather.regime_label);
    expect(container.querySelector("polyline")).not.toBeNull(); // sparkline
  });

  test("renders percentile band primitive", () => {
    renderStrip(<RouteScoreStrip composite={marketWeather as any} mode="detail" />);
    expect(container.querySelector(".percentile-band")).not.toBeNull();
  });

  test("detail mode shows Δ7d when delta_7d is non-null", () => {
    renderStrip(<RouteScoreStrip composite={marketWeather as any} mode="detail" />);
    if (marketWeather.delta_7d !== null && marketWeather.delta_7d !== undefined) {
      expect(container.textContent).toContain("Δ7d");
    }
  });

  test("brief mode hides Δ7d", () => {
    renderStrip(<RouteScoreStrip composite={marketWeather as any} mode="brief" />);
    expect(container.textContent).not.toContain("Δ7d");
  });

  test("does NOT render driver-list bloat (no Supports/Risks lists)", () => {
    renderStrip(<RouteScoreStrip composite={marketWeather as any} mode="detail" />);
    expect(container.textContent?.match(/Supports/i)).toBeNull();
    expect(container.textContent?.match(/Risks/i)).toBeNull();
  });

  test("handles null value gracefully (renders em-dash)", () => {
    const empty = { ...marketWeather, value: null };
    renderStrip(<RouteScoreStrip composite={empty as any} mode="detail" />);
    expect(container.textContent).toContain("—");
  });

  test("renders an aria-label on the section", () => {
    renderStrip(<RouteScoreStrip composite={marketWeather as any} mode="detail" />);
    const section = container.querySelector(".route-score-strip");
    expect(section?.getAttribute("aria-label")).toContain("Market Weather");
  });
});
