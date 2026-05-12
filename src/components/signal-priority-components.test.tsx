import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import TopSignalList from "./TopSignalList";
import type { SignalActiveEntry, SignalMissingEntry } from "../lib/types";

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
  return container;
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
});

const realYieldsWarning: SignalActiveEntry = {
  id: "real_yields",
  label: "10Y real yields",
  group: "Rates / Real-Yield Pressure",
  category: "rates",
  horizon: "both",
  importance: 5,
  severity: 33.34,
  priority: 167.0,
  direction: "risk",
  urgency: "near_term",
  confidence: 1.0,
  freshness_status: "ok",
  source_status: "active",
  message: "Real yields are elevated and pressuring valuations.",
  why_it_matters: "Higher real yields tighten financial conditions and weigh on valuation-sensitive assets.",
};

const consumerBalanceSheetSupport: SignalActiveEntry = {
  id: "consumer_balance_sheet",
  label: "Consumer balance sheet",
  group: "Consumer balance sheet",
  category: "macro",
  horizon: "long_term",
  importance: 4,
  severity: 39.53,
  priority: 126.5,
  direction: "support",
  urgency: "background",
  confidence: 0.99,
  freshness_status: "stale",
  source_status: "active",
  message: "Consumer balance-sheet stress is contained.",
  why_it_matters: "Consumer fragility shapes the strategic late-cycle and recession-risk read.",
};

const moveMissing: SignalMissingEntry = {
  id: "move_index",
  label: "MOVE Index (bond volatility)",
  group: "Volatility & tail risk",
  category: "volatility",
  horizon: "fragility",
  importance: 4,
  source_status: "terms_review_needed",
  message: "Candidate source requires access or terms review before scoring.",
  why_it_matters: "Bond-volatility moves can pressure markets even when equity volatility is calm.",
};

describe("TopSignalList", () => {
  it("renders empty state when there are no signals", () => {
    const container = render(
      <TopSignalList
        title="Top Active Warnings"
        emptyText="No active warnings right now."
        variant="warning"
        signals={[]}
      />
    );

    expect(container.textContent).toContain("Top Active Warnings");
    expect(container.textContent).toContain("No active warnings right now.");
    expect(container.querySelector("ol")).toBeNull();
  });

  it("renders active signal label, message, and why_it_matters", () => {
    const container = render(
      <TopSignalList
        title="Top Active Warnings"
        emptyText="No active warnings right now."
        variant="warning"
        signals={[realYieldsWarning]}
      />
    );

    expect(container.textContent).toContain("10Y real yields");
    expect(container.textContent).toContain("Real yields are elevated and pressuring valuations.");
    expect(container.textContent).toContain("Higher real yields tighten financial conditions");
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("surfaces stale freshness for signals built from stale inputs", () => {
    const container = render(
      <TopSignalList
        title="Top Active Supports"
        emptyText="None"
        variant="support"
        signals={[consumerBalanceSheetSupport]}
      />
    );

    expect(container.textContent).toContain("Consumer balance sheet");
    expect(container.textContent?.toLowerCase()).toContain("stale");
  });

  it("does not surface stale text for fresh signals", () => {
    const container = render(
      <TopSignalList
        title="Top Active Warnings"
        emptyText="None"
        variant="warning"
        signals={[realYieldsWarning]}
      />
    );

    expect(container.textContent?.toLowerCase()).not.toContain("stale");
  });

  it("renders missing signals with their source status and excludes severity meta", () => {
    const container = render(
      <TopSignalList
        title="Missing High-Value Signals"
        emptyText="No gated signals."
        variant="missing"
        signals={[moveMissing]}
      />
    );

    expect(container.textContent).toContain("MOVE Index (bond volatility)");
    expect(container.textContent).toContain("terms_review_needed");
    expect(container.textContent).toContain("Bond-volatility moves can pressure markets");
    // Missing entries should not pretend to have a numeric severity.
    expect(container.textContent).not.toContain("Severity ");
  });

  it("renders external research links for missing high-value signals", () => {
    const container = render(
      <TopSignalList
        title="Missing High-Value Signals"
        emptyText="No gated signals."
        variant="missing"
        signals={[moveMissing]}
      />
    );

    expect(
      container.querySelector("a[href='https://en.macromicro.me/charts/131635/us-treasury-move-index']")
    ).not.toBeNull();
    expect(container.querySelector("a[href='https://finance.yahoo.com/quote/%5EMOVE/']")).not.toBeNull();
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_blank");
    expect(container.querySelector("a")?.getAttribute("rel")).toBe("noreferrer");
  });

  it("preserves the order it is given (caller pre-sorts by priority)", () => {
    const container = render(
      <TopSignalList
        title="Top Active Warnings"
        emptyText="None"
        variant="warning"
        signals={[realYieldsWarning, consumerBalanceSheetSupport]}
      />
    );

    const labels = Array.from(container.querySelectorAll("li")).map((node) =>
      node.querySelector(".top-signal-list-item-label")?.textContent
    );
    expect(labels).toEqual(["10Y real yields", "Consumer balance sheet"]);
  });
});
