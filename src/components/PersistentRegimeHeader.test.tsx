import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import PersistentRegimeHeader from "./PersistentRegimeHeader";
import sampleCockpit from "../__fixtures__/cockpit/today.json";

let container: HTMLDivElement;

beforeEach(() => {
  // @ts-expect-error -- vitest test environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  document.body.removeChild(container);
});

function renderHeader(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => root.render(node));
  return root;
}

describe("PersistentRegimeHeader", () => {
  test("renders regime label + dot + as-of date when cockpit data is provided", () => {
    renderHeader(<PersistentRegimeHeader cockpit={sampleCockpit as any} />);
    expect(container.textContent).toContain(sampleCockpit.regime.label);
    expect(container.querySelector(".persistent-regime-header__dot")).not.toBeNull();
    // As-of date appears somewhere (full or in tooltip)
    const html = container.innerHTML;
    expect(html.includes(sampleCockpit.date) || html.includes("As of")).toBe(true);
  });

  test("renders Brief|Detail toggle button", () => {
    renderHeader(<PersistentRegimeHeader cockpit={sampleCockpit as any} />);
    const toggle = container.querySelector(".persistent-regime-header__mode-toggle");
    expect(toggle).not.toBeNull();
    // Should mention both options or current state
    expect(toggle?.textContent?.toLowerCase()).toMatch(/brief|detail/);
  });

  test("renders loading skeleton when cockpit is null", () => {
    renderHeader(<PersistentRegimeHeader cockpit={null} />);
    const header = container.querySelector(".persistent-regime-header");
    expect(header).not.toBeNull();
    expect(container.textContent?.toLowerCase()).toMatch(/loading|—/);
  });

  test("regime dot class encodes tone", () => {
    renderHeader(<PersistentRegimeHeader cockpit={sampleCockpit as any} />);
    const dot = container.querySelector(".persistent-regime-header__dot");
    expect(dot?.className).toMatch(/--neutral|--positive|--negative/);
  });

  test("composite risk score is rendered when fragility composite exists", () => {
    renderHeader(<PersistentRegimeHeader cockpit={sampleCockpit as any} />);
    const fragility = sampleCockpit.composite_scores.find((s: any) => s.id === "fragility");
    if (fragility?.value !== null && fragility?.value !== undefined) {
      expect(container.textContent).toContain(fragility.value.toFixed(1));
    }
  });

  test("is keyboard-focusable via the toggle button", () => {
    renderHeader(<PersistentRegimeHeader cockpit={sampleCockpit as any} />);
    const toggle = container.querySelector("button.persistent-regime-header__mode-toggle");
    expect(toggle).not.toBeNull();
    expect((toggle as HTMLButtonElement)?.tabIndex).not.toBe(-1);
  });
});
