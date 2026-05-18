// src/components/__tests__/LanguageToggle.test.tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LanguageToggle from "../LanguageToggle";
import { LocaleProvider } from "../../lib/i18n";

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

function byLabel(c: HTMLElement, label: string): HTMLButtonElement {
  const el = c.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement | null;
  if (!el) throw new Error(`No element with aria-label="${label}"`);
  return el;
}

describe("LanguageToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("marks active locale aria-pressed", () => {
    const c = render(<LocaleProvider initialLocale="en"><LanguageToggle /></LocaleProvider>);
    expect(byLabel(c, "English").getAttribute("aria-pressed")).toBe("true");
    expect(byLabel(c, "简体中文").getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking zh updates active state", () => {
    const c = render(<LocaleProvider initialLocale="en"><LanguageToggle /></LocaleProvider>);
    act(() => {
      byLabel(c, "简体中文").click();
    });
    expect(byLabel(c, "简体中文").getAttribute("aria-pressed")).toBe("true");
  });
});
