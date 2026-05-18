// src/lib/i18n/__tests__/t.test.tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "../locale";
import { useT, type TOpts } from "../t";

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

function Probe({ k, opts }: { k: string; opts?: TOpts }) {
  const { t } = useT();
  return <span data-testid="out">{t(k, opts)}</span>;
}

function readOut(c: HTMLElement): string | null | undefined {
  return c.querySelector('[data-testid="out"]')?.textContent;
}

describe("useT", () => {
  it("returns English string under en", () => {
    const c = render(<LocaleProvider initialLocale="en"><Probe k="nav.overview" /></LocaleProvider>);
    expect(readOut(c)).toBe("Overview");
  });

  it("returns Chinese string under zh", () => {
    const c = render(<LocaleProvider initialLocale="zh"><Probe k="nav.overview" /></LocaleProvider>);
    expect(readOut(c)).toBe("总览");
  });

  it("withOriginal renders zh (Original)", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <Probe k="signals.vix" opts={{ withOriginal: true }} />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("波动率指数 (VIX)");
  });

  it("withOriginal under en returns just Original", () => {
    const c = render(
      <LocaleProvider initialLocale="en">
        <Probe k="signals.vix" opts={{ withOriginal: true }} />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("VIX");
  });

  it("var substitution", () => {
    const c = render(
      <LocaleProvider initialLocale="en">
        <Probe k="chrome.switchTo" opts={{ vars: { mode: "Detail" } }} />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("Switch to Detail mode");
  });

  it("missing key returns the key", () => {
    const c = render(<LocaleProvider initialLocale="en"><Probe k="nope.missing" /></LocaleProvider>);
    expect(readOut(c)).toBe("nope.missing");
  });

  it("unknown signal key returns the bare key", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <Probe k="signals.notReal" opts={{ withOriginal: true }} />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("notReal");
  });
});
