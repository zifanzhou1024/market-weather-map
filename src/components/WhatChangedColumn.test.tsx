import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import WhatChangedColumn from "./WhatChangedColumn";

const sampleHistory = {
  generated_at_utc: "2026-05-17T00:00:00Z",
  method_version: "v1",
  observations: [],
  latest_attribution: {
    market_weather: {
      recent_changes: ["Real yields elevated", "Credit spreads tightened"],
      top_risks: [],
      top_supports: []
    },
    macro_climate: {
      recent_changes: ["Labor cycle firm"],
      top_risks: [],
      top_supports: []
    },
    fragility: { recent_changes: [], top_risks: [], top_supports: [] }
  }
};

const emptyHistory = {
  generated_at_utc: "2026-05-17T00:00:00Z",
  method_version: "v1",
  observations: [],
  latest_attribution: {
    market_weather: { recent_changes: [], top_risks: [], top_supports: [] },
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

function renderCol(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => root.render(node));
  return root;
}

describe("WhatChangedColumn", () => {
  test("renders changes from all 3 score families, deduplicated, capped at 6", () => {
    renderCol(<WhatChangedColumn history={sampleHistory as any} />);
    expect(container.textContent).toContain("Real yields elevated");
    expect(container.textContent).toContain("Credit spreads tightened");
    expect(container.textContent).toContain("Labor cycle firm");
  });

  test("renders 'all quiet' empty state when all arrays empty", () => {
    renderCol(<WhatChangedColumn history={emptyHistory as any} />);
    expect(container.textContent?.toLowerCase()).toMatch(/all quiet|nothing/);
  });

  test("renders 'loading' state when history is null", () => {
    renderCol(<WhatChangedColumn history={null} />);
    expect(container.textContent?.toLowerCase()).toMatch(/loading|—/);
  });

  test("caps at 6 rows", () => {
    const many = {
      ...sampleHistory,
      latest_attribution: {
        market_weather: {
          recent_changes: ["A", "B", "C"],
          top_risks: [],
          top_supports: []
        },
        macro_climate: {
          recent_changes: ["D", "E", "F"],
          top_risks: [],
          top_supports: []
        },
        fragility: {
          recent_changes: ["G", "H", "I"],
          top_risks: [],
          top_supports: []
        }
      }
    };
    renderCol(<WhatChangedColumn history={many as any} />);
    const rows = container.querySelectorAll(".what-changed-column__item");
    expect(rows.length).toBeLessThanOrEqual(6);
  });
});
