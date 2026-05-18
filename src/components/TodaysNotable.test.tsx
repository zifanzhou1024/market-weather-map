import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import TodaysNotable from "./TodaysNotable";

const sampleSignals = {
  generated_at_utc: "2026-05-17T00:00:00Z",
  date: "2026-05-17",
  method_version: "v1",
  overall_read: {
    short_term: { score: 0, confidence: 0.5 },
    long_term: { score: 0, confidence: 0.5 },
    fragility: { score: 0, confidence: 0.5 },
    regime: { label: "neutral" }
  },
  top_warnings: [
    {
      id: "inflation",
      label: "Inflation",
      group: "Macro",
      category: "macro",
      horizon: "long_term",
      importance: 5,
      severity: 100,
      priority: 495,
      direction: "risk",
      urgency: "slow",
      confidence: 0.99,
      freshness_status: "ok",
      source_status: "active",
      message: "Inflation pressure remains elevated.",
      why_it_matters: "..."
    }
  ],
  top_supports: [
    {
      id: "credit_spreads",
      label: "Credit spreads",
      group: "Credit",
      category: "credit",
      horizon: "both",
      importance: 5,
      severity: 73,
      priority: 359,
      direction: "support",
      urgency: "near_term",
      confidence: 0.99,
      freshness_status: "ok",
      source_status: "active",
      message: "Credit spread pressure is contained.",
      why_it_matters: "..."
    }
  ],
  missing_high_value_signals: []
};

const sampleHistory = {
  generated_at_utc: "2026-05-17T00:00:00Z",
  method_version: "v1",
  observations: [],
  latest_attribution: {
    market_weather: {
      recent_changes: ["Real yields elevated"],
      top_risks: [],
      top_supports: []
    },
    macro_climate: { recent_changes: [], top_risks: [], top_supports: [] },
    fragility: { recent_changes: [], top_risks: [], top_supports: [] }
  }
};

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

function renderBand(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => root.render(node));
  return root;
}

describe("TodaysNotable", () => {
  test("renders 3 columns: warnings, supports, what changed", () => {
    renderBand(
      <TodaysNotable
        signals={sampleSignals as any}
        history={sampleHistory as any}
      />
    );
    expect(
      container.querySelector("[data-testid='todays-notable']")
    ).not.toBeNull();
    expect(container.textContent).toContain("Inflation");
    expect(container.textContent).toContain("Credit spreads");
    expect(container.textContent).toContain("Real yields elevated");
  });

  test("renders TopSignalList components for warnings + supports", () => {
    renderBand(
      <TodaysNotable
        signals={sampleSignals as any}
        history={sampleHistory as any}
      />
    );
    const lists = container.querySelectorAll(".top-signal-list");
    expect(lists.length).toBeGreaterThanOrEqual(2);
  });

  test("handles null signals + history gracefully", () => {
    renderBand(<TodaysNotable signals={null} history={null} />);
    expect(
      container.querySelector("[data-testid='todays-notable']")
    ).not.toBeNull();
  });
});
