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

// ---- tDriver -------------------------------------------------------------

function DriverProbe({ title }: { title: string }) {
  const { tDriver } = useT();
  return <span data-testid="out">{tDriver(title)}</span>;
}

describe("useT.tDriver", () => {
  it("returns zh translation for known driver title under zh", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <DriverProbe title="10Y real yields" />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("10年期实际收益率");
  });

  it("returns original under en", () => {
    const c = render(
      <LocaleProvider initialLocale="en">
        <DriverProbe title="10Y real yields" />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("10Y real yields");
  });

  it("falls back to input for unknown title under zh", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <DriverProbe title="Some Unmapped Driver" />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("Some Unmapped Driver");
  });

  it("translates sub-component breakout labels", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <DriverProbe title="Treasury General Account" />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("财政部一般账户");
  });
});

// ---- tNarrative ----------------------------------------------------------

function NarrativeProbe({ text }: { text: string }) {
  const { tNarrative } = useT();
  const res = tNarrative(text);
  return (
    <span data-testid="out" data-matched={res.matched ? "true" : "false"}>
      {res.text}
    </span>
  );
}

describe("useT.tNarrative", () => {
  it("matches the `X is elevated.` template under zh", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <NarrativeProbe text="Inflation pressure is elevated." />
      </LocaleProvider>
    );
    const out = c.querySelector('[data-testid="out"]') as HTMLElement;
    expect(out.textContent).toBe("通胀压力 处于高位。");
    expect(out.dataset.matched).toBe("true");
  });

  it("translates the `Higher X tighten financial conditions and weigh on Y.` template", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <NarrativeProbe text="Higher real yields tighten financial conditions and weigh on valuation-sensitive assets." />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("实际收益率走高会收紧金融条件并压制 估值敏感资产。");
  });

  it("returns input unchanged under en", () => {
    const c = render(
      <LocaleProvider initialLocale="en">
        <NarrativeProbe text="Inflation pressure is elevated." />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("Inflation pressure is elevated.");
  });

  it("falls back to original text and reports matched=false for unknown phrase", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <NarrativeProbe text="Some completely unmapped sentence about nothing." />
      </LocaleProvider>
    );
    const out = c.querySelector('[data-testid="out"]') as HTMLElement;
    expect(out.textContent).toBe("Some completely unmapped sentence about nothing.");
    expect(out.dataset.matched).toBe("false");
  });

  it("uses the override map for fixed canned phrases", () => {
    const c = render(
      <LocaleProvider initialLocale="zh">
        <NarrativeProbe text="Candidate source requires access or terms review before scoring." />
      </LocaleProvider>
    );
    expect(readOut(c)).toBe("该候选源需在评分前完成访问与条款审核。");
  });
});
