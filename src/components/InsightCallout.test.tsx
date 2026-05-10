import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import InsightCallout from "./InsightCallout";

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
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("InsightCallout", () => {
  it("renders the message text", () => {
    const c = render(<InsightCallout message="Term structure is in mild backwardation." />);
    expect(c.textContent).toContain("Term structure is in mild backwardation.");
  });

  it("renders without a state badge when state is undefined", () => {
    const c = render(<InsightCallout message="Calm reading." />);
    expect(c.querySelector(".chart-state-badge")).toBeNull();
  });

  it("renders an inline ChartStateBadge when state is provided", () => {
    const c = render(<InsightCallout state="risk" message="Front-end VIX above 30." />);
    const badge = c.querySelector(".chart-state-badge");
    expect(badge).not.toBeNull();
    expect(badge?.classList.contains("chart-state-badge--risk")).toBe(true);
  });

  it("renders the caveat when provided", () => {
    const c = render(
      <InsightCallout
        message="Real yield is decomposing in line with breakeven."
        caveat="Five trading days stale — refresh expected by tomorrow."
      />
    );
    expect(c.textContent).toContain("Five trading days stale — refresh expected by tomorrow.");
  });

  it("does not render a caveat element when caveat is absent", () => {
    const c = render(<InsightCallout message="Calm reading." />);
    expect(c.querySelector(".insight-callout__caveat")).toBeNull();
  });

  it("places the caveat after the message in the DOM order", () => {
    const c = render(
      <InsightCallout message="Front-loaded vol pricing." caveat="One observation incomplete." />
    );
    const message = c.querySelector(".insight-callout__message");
    const caveat = c.querySelector(".insight-callout__caveat");
    expect(message).not.toBeNull();
    expect(caveat).not.toBeNull();
    // compareDocumentPosition: 4 means caveat follows message.
    const relation = message!.compareDocumentPosition(caveat!);
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the badge inline next to the message header when both provided", () => {
    const c = render(
      <InsightCallout state="watch" message="Yield curve flattening near 2s10s zero." />
    );
    const badge = c.querySelector(".chart-state-badge");
    const headerEl = c.querySelector(".insight-callout__header");
    expect(badge).not.toBeNull();
    expect(headerEl).not.toBeNull();
    // Badge sits inside the header row.
    expect(headerEl?.contains(badge!)).toBe(true);
  });
});
