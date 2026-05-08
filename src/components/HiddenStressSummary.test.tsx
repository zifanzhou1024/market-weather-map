import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import HiddenStressSummary from "./HiddenStressSummary";
import type { ShockRiskSnapshotFile } from "../lib/types";

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

const shockSnapshot: ShockRiskSnapshotFile = {
  active_signals: [
    {
      change: 0.21,
      id: "hy_minus_ig_oas",
      label: "HY minus IG OAS",
      message: "Credit spread pressure is visible in the current snapshot.",
      score: -8.2,
      value: 2.35
    }
  ],
  date: "2026-05-06",
  generated_at_utc: "2026-05-07T17:57:48Z",
  label: "Mixed shock risk",
  method_version: "phase5-shock-risk-v1",
  mismatch_warnings: [
    {
      id: "credit_dollar_confirmation",
      label: "Credit and dollar confirmation",
      message: "Credit stress and dollar pressure are moving together."
    },
    {
      id: "liquidity_confirmation",
      label: "Liquidity confirmation",
      message: "Liquidity is not confirming the visible stress read."
    }
  ],
  score: 12.4,
  source_gaps: [
    {
      id: "move_index",
      label: "MOVE Index",
      message: "Candidate source requires access or terms review before scoring.",
      status: "terms_review_needed"
    }
  ]
};

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("HiddenStressSummary", () => {
  it("separates visible and gated stress and labels mismatch severity", () => {
    const container = render(<HiddenStressSummary shockSnapshot={shockSnapshot} />);

    expect(container.textContent).toContain("Visible stress");
    expect(container.textContent).toContain("HY minus IG OAS");
    expect(container.textContent).toContain("Gated stress");
    expect(container.textContent).toContain("MOVE Index");
    expect(container.textContent).toContain("VIX futures curve");
    expect(container.textContent).toContain("Options sentiment");
    expect(container.textContent).toContain("High");
    expect(container.textContent).toContain("Medium");
  });

  it("renders the no-warnings message when mismatch warnings are absent", () => {
    const container = render(<HiddenStressSummary shockSnapshot={{ ...shockSnapshot, mismatch_warnings: [] }} />);

    expect(container.textContent).toContain("No mismatch warnings in the current shock-risk snapshot.");
  });

  it("dedupes duplicate source-gap ids while preserving the first row", () => {
    const container = render(
      <HiddenStressSummary
        shockSnapshot={{
          ...shockSnapshot,
          source_gaps: [
            {
              id: "skew_index",
              label: "SKEW Index",
              message: "First SKEW source-gap message.",
              status: "terms_review_needed"
            },
            {
              id: "skew_index",
              label: "Duplicate SKEW Index",
              message: "Duplicate SKEW source-gap message.",
              status: "unavailable"
            }
          ]
        }}
      />
    );

    expect(container.textContent).toContain("First SKEW source-gap message.");
    expect(container.textContent).not.toContain("Duplicate SKEW Index");
    expect(container.textContent).not.toContain("Duplicate SKEW source-gap message.");
    expect(container.textContent).toContain("MOVE Index");
  });

  it("guards malformed rows and dedupes valid active, gated, and warning rows", () => {
    const malformedSnapshot = {
      ...shockSnapshot,
      active_signals: [
        null,
        {
          id: "valid_active",
          label: "Valid active stress",
          message: "First active signal message."
        },
        {
          id: "valid_active",
          label: "Duplicate active stress",
          message: "Duplicate active signal message."
        },
        { id: "blank_active", label: "", message: "Blank label active message." }
      ],
      mismatch_warnings: [
        undefined,
        {
          id: "valid_warning",
          label: "Valid warning",
          message: "Liquidity warning message."
        },
        {
          id: "valid_warning",
          label: "Duplicate warning",
          message: "Duplicate warning message."
        },
        { id: "missing_message", label: "Missing message" }
      ],
      source_gaps: [
        null,
        {
          id: "valid_gap",
          label: "Valid gated stress",
          message: "First gated stress message.",
          status: "restricted"
        },
        {
          id: "valid_gap",
          label: "Duplicate gated stress",
          message: "Duplicate gated stress message.",
          status: "unavailable"
        },
        {
          id: "invalid_status_gap",
          label: "Invalid status gated stress",
          message: "Invalid status gated stress message.",
          status: "unknown"
        },
        { id: "missing_label", message: "Missing label gated stress message.", status: "restricted" }
      ]
    } as unknown as ShockRiskSnapshotFile;

    const container = render(<HiddenStressSummary shockSnapshot={malformedSnapshot} />);

    expect(container.textContent).toContain("Valid active stress");
    expect(container.textContent).toContain("First active signal message.");
    expect(container.textContent).not.toContain("Duplicate active stress");
    expect(container.textContent).not.toContain("Duplicate active signal message.");
    expect(container.textContent).not.toContain("Blank label active message.");

    expect(container.textContent).toContain("Valid gated stress");
    expect(container.textContent).toContain("First gated stress message.");
    expect(container.textContent).not.toContain("Duplicate gated stress");
    expect(container.textContent).not.toContain("Duplicate gated stress message.");
    expect(container.textContent).not.toContain("Invalid status gated stress");
    expect(container.textContent).not.toContain("Invalid status gated stress message.");
    expect(container.textContent).not.toContain("Missing label gated stress message.");
    expect(container.textContent).toContain("MOVE Index");
    expect(container.textContent).toContain("VIX futures curve");

    expect(container.textContent).toContain("Valid warning");
    expect(container.textContent).toContain("Liquidity warning message.");
    expect(container.textContent).not.toContain("Duplicate warning");
    expect(container.textContent).not.toContain("Duplicate warning message.");
    expect(container.textContent).not.toContain("Missing message");
  });
});
