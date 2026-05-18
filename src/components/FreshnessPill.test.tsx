import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import FreshnessPill from "./FreshnessPill";

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

function renderIn(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return root;
}

describe("FreshnessPill", () => {
  test("ok status renders with tone-positive class", () => {
    renderIn(<FreshnessPill status="ok" asOf="2026-05-17" />);
    const pill = container.firstChild as HTMLElement | null;
    expect(pill).not.toBeNull();
    expect(pill?.className).toMatch(/tone-positive/);
    expect(pill?.className).toMatch(/freshness-pill--ok/);
  });

  test("stale status renders with tone-warning class", () => {
    renderIn(<FreshnessPill status="stale" asOf="2026-05-08" />);
    const pill = container.firstChild as HTMLElement | null;
    expect(pill).not.toBeNull();
    expect(pill?.className).toMatch(/tone-warning/);
    expect(pill?.className).toMatch(/freshness-pill--stale/);
  });

  test("unavailable status renders with tone-negative class", () => {
    renderIn(<FreshnessPill status="unavailable" asOf="2026-04-30" />);
    const pill = container.firstChild as HTMLElement | null;
    expect(pill).not.toBeNull();
    expect(pill?.className).toMatch(/tone-negative/);
    expect(pill?.className).toMatch(/freshness-pill--unavailable/);
  });

  test("as_of date appears in the title attribute", () => {
    renderIn(<FreshnessPill status="ok" asOf="2026-05-17" />);
    const pill = container.firstChild as HTMLElement | null;
    expect(pill?.getAttribute("title")).toContain("2026-05-17");
  });

  test("aria-label includes both status and date", () => {
    renderIn(<FreshnessPill status="stale" asOf="2026-05-08" />);
    const pill = container.firstChild as HTMLElement | null;
    const ariaLabel = pill?.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toMatch(/stale/i);
    expect(ariaLabel).toContain("2026-05-08");
  });

  test("appends custom className when provided", () => {
    renderIn(<FreshnessPill status="ok" asOf="2026-05-17" className="extra-class" />);
    const pill = container.firstChild as HTMLElement | null;
    expect(pill?.className).toMatch(/extra-class/);
  });
});
