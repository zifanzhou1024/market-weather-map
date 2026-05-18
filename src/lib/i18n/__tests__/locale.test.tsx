// src/lib/i18n/__tests__/locale.test.tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocaleProvider, useLocale, setLocale, resolveLocale } from "../locale";

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

function Probe() {
  const locale = useLocale();
  return <span data-testid="locale">{locale}</span>;
}

describe("locale resolution", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("defaults to en", () => {
    expect(resolveLocale()).toBe("en");
  });

  it("URL ?lang=zh wins over default", () => {
    window.history.replaceState({}, "", "/?lang=zh");
    expect(resolveLocale()).toBe("zh");
  });

  it("URL wins over localStorage", () => {
    window.localStorage.setItem("mwm.locale", "en");
    window.history.replaceState({}, "", "/?lang=zh");
    expect(resolveLocale()).toBe("zh");
  });

  it("localStorage wins over default", () => {
    window.localStorage.setItem("mwm.locale", "zh");
    expect(resolveLocale()).toBe("zh");
  });

  it("ignores invalid values", () => {
    window.history.replaceState({}, "", "/?lang=fr");
    window.localStorage.setItem("mwm.locale", "es");
    expect(resolveLocale()).toBe("en");
  });

  it("setLocale dispatches event consumed by LocaleProvider", () => {
    const container = render(<LocaleProvider><Probe /></LocaleProvider>);
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("en");
    act(() => setLocale("zh"));
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("zh");
  });

  it("sets document.documentElement.lang", () => {
    render(<LocaleProvider initialLocale="zh"><Probe /></LocaleProvider>);
    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
