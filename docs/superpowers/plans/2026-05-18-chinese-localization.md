# Simplified Chinese Localization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Simplified Chinese mode toggle for market-weather-map. UI chrome, prose, glossary, and curated index labels translate via a pure client-side i18n dictionary. Curated indices render as `中文 (Original)` when zh is active.

**Architecture:** New `src/lib/i18n/` module mirroring the existing `useMode()` pattern (URL > localStorage > default). Single bundled `zh.ts` dictionary; type-driven key validation. A `<LocaleProvider>` wraps the app; `useT()` returns `t(key, opts?)`. Dynamic FocusBlock narrative fields (Python f-strings) stay English under zh by design — they wrap in `<span lang="en">` so screen readers and font fallback behave correctly.

**Tech Stack:** Vite + React 19 + TypeScript 6, React Router 7. No new dependencies. Static GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-05-18-simplified-chinese-localization-design.md` (read this first if context is missing).

---

## Chunk 1: i18n foundation

### Task 1: Create the i18n module skeleton

**Files:**
- Create: `src/lib/i18n/locale.tsx`
- Create: `src/lib/i18n/en.ts`
- Create: `src/lib/i18n/zh.ts`
- Create: `src/lib/i18n/signals.ts`
- Create: `src/lib/i18n/t.ts`
- Create: `src/lib/i18n/index.ts`

- [ ] **Step 1: Write `en.ts` — the source of truth for the key shape**

```ts
// src/lib/i18n/en.ts
export const en = {
  nav: {
    overview: "Overview",
    shortTerm: "Short-Term",
    longTerm: "Long-Term",
    fragility: "Fragility",
    channels: "Channels",
    history: "History",
    more: "More",
    diff: "Diff",
    calendar: "Calendar",
    methodology: "Methodology",
  },
  chrome: {
    mastheadTitle: "Market Weather Map",
    eyebrow: "Delayed public data",
    briefMode: "Brief",
    detailMode: "Detail",
    switchTo: "Switch to {{mode}} mode",
    keyboardShortcuts: "Keyboard shortcuts",
    asOfPrefix: "As of",
    loading: "Loading...",
    loadFailed: "Failed to load",
    languageToggle: "Switch language",
    english: "EN",
    chinese: "中",
  },
  regime: {
    riskOn: "Risk-On",
    riskOff: "Risk-Off",
    neutral: "Neutral",
    stress: "Stress",
    fragility: "Fragility",
    regimeLabel: "Regime",
  },
  readings: {
    stretched: "stretched",
    neutral: "neutral",
    tight: "tight",
    wide: "wide",
    rich: "rich",
    cheap: "cheap",
    rising: "rising",
    falling: "falling",
    flat: "flat",
    normal: "normal",
  },
  dataQuality: {
    title: "Data quality",
    tierHigh: "High",
    tierMedium: "Medium",
    tierLow: "Low",
    tierThin: "Thin",
    coverage: "Coverage",
    freshness: "Freshness",
    model: "Model",
    sourceMix: "Source mix",
    aggregate: "Aggregate",
  },
  cadence: {
    daily: "daily",
    weekly: "weekly",
    monthly: "monthly",
    quarterly: "quarterly",
  },
  focus: {
    // section.id → eyebrow + question (the static FocusBlock fields)
    volatility: {
      eyebrow: "Volatility complex",
      question: "What is volatility telling us?",
    },
    rates: {
      eyebrow: "Rates and curve",
      question: "Where is the rates story?",
    },
    regime_map: {
      eyebrow: "Regime map",
      question: "What regime are we in?",
    },
    sentiment: {
      eyebrow: "Sentiment and positioning",
      question: "What is sentiment doing?",
    },
    tactical: {
      eyebrow: "Tactical lens",
      question: "What does the tactical setup look like?",
    },
  },
  routes: {
    overviewHeading: "Overview",
    overviewSubtitle: "What matters today",
    shortTermHeading: "Short-Term Market Reaction",
    longTermHeading: "Long-Term Macro / Allocation Climate",
    fragilityHeading: "Fragility & Shock Risk",
    channelsHeading: "Cross-Asset Channels",
    historyHeading: "Historical Regime Replay",
    diffHeading: "Day-over-day Diff",
    calendarHeading: "Event Calendar",
    methodologyHeading: "Methodology",
  },
  shortcuts: {
    goOverview: "Overview",
    goShortTerm: "Short-Term",
    goLongTerm: "Long-Term",
    goFragility: "Fragility",
    goChannels: "Channels",
    goHistory: "History",
    goDiff: "Diff",
    goCalendar: "Calendar",
    toggleMode: "Toggle Brief/Detail",
    toggleLanguage: "Toggle language",
    showHelp: "Show this help",
  },
} as const;

export type En = typeof en;
export type EnKeys = En;  // re-exported for the t() typing
```

- [ ] **Step 2: Write `zh.ts` with matching shape**

```ts
// src/lib/i18n/zh.ts
import type { En } from "./en";

export const zh: En = {
  nav: {
    overview: "总览",
    shortTerm: "短期",
    longTerm: "长期",
    fragility: "脆弱度",
    channels: "渠道",
    history: "历史",
    more: "更多",
    diff: "对比",
    calendar: "日历",
    methodology: "方法论",
  },
  chrome: {
    mastheadTitle: "市场天气盘",
    eyebrow: "延迟公开数据",
    briefMode: "简版",
    detailMode: "详情",
    switchTo: "切换至 {{mode}}",
    keyboardShortcuts: "键盘快捷键",
    asOfPrefix: "数据截至",
    loading: "加载中...",
    loadFailed: "加载失败",
    languageToggle: "切换语言",
    english: "EN",
    chinese: "中",
  },
  regime: {
    riskOn: "风险偏好",
    riskOff: "避险",
    neutral: "中性",
    stress: "压力",
    fragility: "脆弱度",
    regimeLabel: "市场状态",
  },
  readings: {
    stretched: "拉伸高位",
    neutral: "中性",
    tight: "偏紧",
    wide: "走阔",
    rich: "估值偏高",
    cheap: "估值偏低",
    rising: "上升",
    falling: "下降",
    flat: "持平",
    normal: "正常",
  },
  dataQuality: {
    title: "数据质量",
    tierHigh: "高",
    tierMedium: "中",
    tierLow: "低",
    tierThin: "稀疏",
    coverage: "覆盖度",
    freshness: "新鲜度",
    model: "模型完备度",
    sourceMix: "源构成",
    aggregate: "综合",
  },
  cadence: {
    daily: "日频",
    weekly: "周频",
    monthly: "月频",
    quarterly: "季频",
  },
  focus: {
    volatility: {
      eyebrow: "波动率综合",
      question: "波动率在告诉我们什么?",
    },
    rates: {
      eyebrow: "利率与曲线",
      question: "利率叙事在哪里?",
    },
    regime_map: {
      eyebrow: "市场状态图",
      question: "我们处于什么市场状态?",
    },
    sentiment: {
      eyebrow: "情绪与持仓",
      question: "情绪在做什么?",
    },
    tactical: {
      eyebrow: "战术视角",
      question: "战术格局如何?",
    },
  },
  routes: {
    overviewHeading: "总览",
    overviewSubtitle: "今天什么最重要",
    shortTermHeading: "短期市场反应",
    longTermHeading: "长期宏观 / 配置环境",
    fragilityHeading: "脆弱度与冲击风险",
    channelsHeading: "跨资产传导渠道",
    historyHeading: "历史市场状态回放",
    diffHeading: "每日差异对比",
    calendarHeading: "事件日历",
    methodologyHeading: "方法论",
  },
  shortcuts: {
    goOverview: "总览",
    goShortTerm: "短期",
    goLongTerm: "长期",
    goFragility: "脆弱度",
    goChannels: "渠道",
    goHistory: "历史",
    goDiff: "对比",
    goCalendar: "日历",
    toggleMode: "切换简版 / 详情",
    toggleLanguage: "切换语言",
    showHelp: "显示本帮助",
  },
};
```

- [ ] **Step 3: Write `signals.ts` — curated names with parenthetical**

```ts
// src/lib/i18n/signals.ts
export interface SignalName {
  zh: string;
  original: string;
}

export const SIGNAL_NAMES: Record<string, SignalName> = {
  vix: { zh: "波动率指数", original: "VIX" },
  vix9d: { zh: "9日波动率指数", original: "VIX9D" },
  vix3m: { zh: "3月期波动率指数", original: "VIX3M" },
  vvix: { zh: "波动率的波动率", original: "VVIX" },
  move: { zh: "MOVE 债券波动率指数", original: "MOVE" },
  skew: { zh: "偏度指数", original: "SKEW" },
  hyOas: { zh: "高收益债期权调整利差", original: "HY OAS" },
  igOas: { zh: "投资级期权调整利差", original: "IG OAS" },
  treasury10y: { zh: "10年期美债收益率", original: "US 10Y" },
  treasury2y: { zh: "2年期美债收益率", original: "US 2Y" },
  curve10y2y: { zh: "10年减2年期限利差", original: "10Y−2Y" },
  realYield10y: { zh: "10年期实际收益率", original: "10Y Real Yield" },
  breakeven10y: { zh: "10年期通胀盈亏平衡", original: "10Y Breakeven" },
  termPremium10y: { zh: "10年期期限溢价", original: "10Y Term Premium" },
  netLiquidity: { zh: "净流动性", original: "Net Liquidity" },
  broadUsd: { zh: "广义美元指数", original: "Broad USD" },
  wtiCrude: { zh: "WTI 原油", original: "WTI Crude" },
  coreCpiYoY: { zh: "核心 CPI 同比", original: "Core CPI YoY" },
  corePce: { zh: "核心 PCE", original: "Core PCE" },
  initialClaims: { zh: "初次申请失业金人数", original: "Initial Claims" },
  nonfarmPayrolls: { zh: "非农就业", original: "Nonfarm Payrolls" },
  sp500LevMoney: { zh: "标普500杠杆资金净持仓", original: "SP500 Lev-Money" },
  sofr: { zh: "担保隔夜融资利率", original: "SOFR" },
  acm: { zh: "ACM 模型", original: "ACM" },
};

/**
 * Map cockpit signal IDs (from cockpit_whitelist.py) to SIGNAL_NAMES keys.
 * Cockpit JSON uses snake_case ids; SIGNAL_NAMES uses camelCase. This indirection
 * keeps the Python-emitted IDs decoupled from frontend i18n keys.
 */
export const COCKPIT_ID_TO_SIGNAL_KEY: Record<string, string> = {
  vix: "vix",
  vix_complex: "vix",
  high_yield_oas: "hyOas",
  credit_spreads: "hyOas",  // legacy alias
  investment_grade_oas: "igOas",
  ig_spreads: "igOas",
  term_premium: "termPremium10y",
  real_yields: "realYield10y",
  yield_curve: "curve10y2y",
  net_liquidity: "netLiquidity",
  broad_dollar: "broadUsd",
  wti_crude: "wtiCrude",
  core_cpi: "coreCpiYoY",
  inflation: "coreCpiYoY",  // legacy alias
  core_pce: "corePce",
  initial_claims: "initialClaims",
  labor_claims: "initialClaims",  // legacy alias
  nonfarm_payrolls: "nonfarmPayrolls",
  payrolls: "nonfarmPayrolls",  // legacy alias
};
```

- [ ] **Step 4: Write `locale.tsx` — LocaleProvider mirroring ModeProvider**

```tsx
// src/lib/i18n/locale.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Locale = "en" | "zh";

const STORAGE_KEY = "mwm.locale";
const VALID_LOCALES: ReadonlySet<string> = new Set(["en", "zh"]);

function readUrlLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("lang");
  return raw && VALID_LOCALES.has(raw) ? (raw as Locale) : null;
}

function readStorageLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && VALID_LOCALES.has(raw) ? (raw as Locale) : null;
  } catch {
    return null;
  }
}

export function resolveLocale(): Locale {
  return readUrlLocale() ?? readStorageLocale() ?? "en";
}

export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore localStorage failures
  }
  const url = new URL(window.location.href);
  url.searchParams.set("lang", locale);
  window.history.replaceState({}, "", url.toString());
  window.dispatchEvent(new CustomEvent("mwm:locale-change"));
}

const LocaleContext = createContext<Locale>("en");

interface LocaleProviderProps {
  initialLocale?: Locale;
  children: ReactNode;
}

export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) return initialLocale;
    if (typeof window === "undefined") return "en";
    return resolveLocale();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => setLocaleState(resolveLocale());
    window.addEventListener("mwm:locale-change", onChange);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("mwm:locale-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
```

- [ ] **Step 5: Write `t.ts` — the translation hook**

```ts
// src/lib/i18n/t.ts
import { useLocale } from "./locale";
import { en } from "./en";
import { zh } from "./zh";
import { SIGNAL_NAMES, COCKPIT_ID_TO_SIGNAL_KEY } from "./signals";

type Dict = typeof en;

const warnedKeys = new Set<string>();

function lookupDeep(dict: any, parts: string[]): string | undefined {
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function applyVars(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

export interface TOpts {
  withOriginal?: boolean;
  vars?: Record<string, string | number>;
}

export interface UseT {
  t: (key: string, opts?: TOpts) => string;
  locale: "en" | "zh";
}

export function useT(): UseT {
  const locale = useLocale();
  const dict: Dict = locale === "zh" ? zh : en;

  const t = (key: string, opts?: TOpts): string => {
    // signals.<key> — special path that respects withOriginal
    if (key.startsWith("signals.")) {
      const sigKey = key.slice("signals.".length);
      const sig = SIGNAL_NAMES[sigKey];
      if (!sig) {
        if (import.meta.env.DEV && !warnedKeys.has(key)) {
          warnedKeys.add(key);
          // eslint-disable-next-line no-console
          console.warn(`[i18n] unknown signal key: ${sigKey}`);
        }
        return sigKey;
      }
      if (locale === "zh") {
        return opts?.withOriginal ? `${sig.zh} (${sig.original})` : sig.zh;
      }
      return sig.original;
    }

    const parts = key.split(".");
    let val = lookupDeep(dict, parts);

    if (val === undefined && locale !== "en") {
      val = lookupDeep(en, parts);
      if (import.meta.env.DEV && val !== undefined && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing zh translation for "${key}" — falling back to en`);
      }
    }

    if (val === undefined) {
      if (import.meta.env.DEV && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] unknown key: ${key}`);
      }
      return key;
    }

    return applyVars(val, opts?.vars);
  };

  return { t, locale };
}

export { SIGNAL_NAMES, COCKPIT_ID_TO_SIGNAL_KEY };
```

- [ ] **Step 6: Write `index.ts` — barrel export**

```ts
// src/lib/i18n/index.ts
export { LocaleProvider, useLocale, setLocale, resolveLocale } from "./locale";
export type { Locale } from "./locale";
export { useT } from "./t";
export type { TOpts, UseT } from "./t";
export { SIGNAL_NAMES, COCKPIT_ID_TO_SIGNAL_KEY } from "./signals";
export type { SignalName } from "./signals";
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n/
git commit -m "feat(i18n): add locale provider + en/zh dictionaries + useT hook"
```

### Task 2: Tests for locale + useT

**Files:**
- Create: `src/lib/i18n/__tests__/locale.test.tsx`
- Create: `src/lib/i18n/__tests__/t.test.tsx`

- [ ] **Step 1: Locale precedence test**

```tsx
// src/lib/i18n/__tests__/locale.test.tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LocaleProvider, useLocale, setLocale, resolveLocale } from "../locale";

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
    render(<LocaleProvider><Probe /></LocaleProvider>);
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    act(() => setLocale("zh"));
    expect(screen.getByTestId("locale")).toHaveTextContent("zh");
  });

  it("sets document.documentElement.lang", () => {
    render(<LocaleProvider initialLocale="zh"><Probe /></LocaleProvider>);
    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
```

- [ ] **Step 2: useT test**

```tsx
// src/lib/i18n/__tests__/t.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "../locale";
import { useT } from "../t";

function Probe({ k, opts }: { k: string; opts?: any }) {
  const { t } = useT();
  return <span data-testid="out">{t(k, opts)}</span>;
}

describe("useT", () => {
  it("returns English string under en", () => {
    render(<LocaleProvider initialLocale="en"><Probe k="nav.overview" /></LocaleProvider>);
    expect(screen.getByTestId("out")).toHaveTextContent("Overview");
  });

  it("returns Chinese string under zh", () => {
    render(<LocaleProvider initialLocale="zh"><Probe k="nav.overview" /></LocaleProvider>);
    expect(screen.getByTestId("out")).toHaveTextContent("总览");
  });

  it("withOriginal renders zh (Original)", () => {
    render(
      <LocaleProvider initialLocale="zh">
        <Probe k="signals.vix" opts={{ withOriginal: true }} />
      </LocaleProvider>
    );
    expect(screen.getByTestId("out")).toHaveTextContent("波动率指数 (VIX)");
  });

  it("withOriginal under en returns just Original", () => {
    render(
      <LocaleProvider initialLocale="en">
        <Probe k="signals.vix" opts={{ withOriginal: true }} />
      </LocaleProvider>
    );
    expect(screen.getByTestId("out")).toHaveTextContent("VIX");
  });

  it("var substitution", () => {
    render(
      <LocaleProvider initialLocale="en">
        <Probe k="chrome.switchTo" opts={{ vars: { mode: "Detail" } }} />
      </LocaleProvider>
    );
    expect(screen.getByTestId("out")).toHaveTextContent("Switch to Detail mode");
  });

  it("missing key returns the key", () => {
    render(<LocaleProvider initialLocale="en"><Probe k="nope.missing" /></LocaleProvider>);
    expect(screen.getByTestId("out")).toHaveTextContent("nope.missing");
  });

  it("unknown signal key returns the bare key", () => {
    render(
      <LocaleProvider initialLocale="zh">
        <Probe k="signals.notReal" opts={{ withOriginal: true }} />
      </LocaleProvider>
    );
    expect(screen.getByTestId("out")).toHaveTextContent("notReal");
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/lib/i18n
git add src/lib/i18n/__tests__/
git commit -m "test(i18n): cover locale precedence + useT translation + parenthetical"
```

### Task 3: LanguageToggle component

**Files:**
- Create: `src/components/LanguageToggle.tsx`
- Create: `src/components/__tests__/LanguageToggle.test.tsx`
- Modify: `src/styles.css` (add `.language-toggle` styles)

- [ ] **Step 1: Write the component**

```tsx
// src/components/LanguageToggle.tsx
import { useLocale, setLocale, useT } from "../lib/i18n";

export default function LanguageToggle() {
  const locale = useLocale();
  const { t } = useT();
  const other = locale === "en" ? "zh" : "en";

  return (
    <div
      className="language-toggle"
      role="group"
      aria-label={t("chrome.languageToggle")}
    >
      <button
        type="button"
        className={`language-toggle__option ${locale === "en" ? "is-active" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label="English"
      >
        EN
      </button>
      <span className="language-toggle__divider" aria-hidden="true">|</span>
      <button
        type="button"
        className={`language-toggle__option ${locale === "zh" ? "is-active" : ""}`}
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
        aria-label="简体中文"
      >
        中
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS in `src/styles.css` (append at the end of the persistent regime header block)**

```css
.language-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;  /* Right-anchor the right cluster; mode-toggle keeps margin-left:0 */
  border: 1px solid #d4d6cd;
  border-radius: 6px;
  padding: 2px 4px;
  background: #fff;
  font-size: 0.78rem;
}

.language-toggle__option {
  background: transparent;
  border: 0;
  padding: 2px 6px;
  border-radius: 4px;
  color: #6f7160;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  line-height: 1;
}

.language-toggle__option.is-active {
  background: #1f2937;
  color: #fff;
}

.language-toggle__option:hover:not(.is-active) {
  color: #1f2937;
}

.language-toggle__divider {
  color: #d4d6cd;
}

.persistent-regime-header__mode-toggle {
  margin-left: 0;  /* margin-left:auto moves to the language-toggle wrapper */
}
```

(Locate the existing `.persistent-regime-header__mode-toggle { margin-left: auto; ... }` rule from the sticky-fix and change `margin-left` to `0`. The new `.language-toggle` carries the right-anchor.)

- [ ] **Step 3: Component test**

```tsx
// src/components/__tests__/LanguageToggle.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LanguageToggle from "../LanguageToggle";
import { LocaleProvider } from "../../lib/i18n";

describe("LanguageToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("marks active locale aria-pressed", () => {
    render(<LocaleProvider initialLocale="en"><LanguageToggle /></LocaleProvider>);
    expect(screen.getByLabelText("English")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("简体中文")).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking zh updates active state", () => {
    render(<LocaleProvider initialLocale="en"><LanguageToggle /></LocaleProvider>);
    fireEvent.click(screen.getByLabelText("简体中文"));
    expect(screen.getByLabelText("简体中文")).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/components/__tests__/LanguageToggle
git add src/components/LanguageToggle.tsx src/components/__tests__/LanguageToggle.test.tsx src/styles.css
git commit -m "feat(i18n): LanguageToggle component with EN | 中 pill"
```

---

## Chunk 2: Wire into chrome

### Task 4: AppLayout — LocaleProvider wrap + nav translation

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/components/AppLayout.test.tsx` (if assertions break)

- [ ] **Step 1: Wrap the layout in `<LocaleProvider>` and translate nav labels**

In `src/components/AppLayout.tsx`:

1. Add imports:
```tsx
import { LocaleProvider, useT } from "../lib/i18n";
```

2. Split `AppLayout` into an outer component that provides locale and an inner that consumes it:

```tsx
export default function AppLayout() {
  return (
    <LocaleProvider>
      <AppLayoutInner />
    </LocaleProvider>
  );
}

function AppLayoutInner() {
  const { t } = useT();
  // ... existing useState + useEffect code ...

  const localizedNavItems = [
    { to: "/", label: t("nav.overview"), end: true, ariaLabel: t("nav.overview") },
    { to: "/short-term", label: t("nav.shortTerm"), ariaLabel: t("routes.shortTermHeading") },
    { to: "/long-term", label: t("nav.longTerm"), ariaLabel: t("routes.longTermHeading") },
    { to: "/fragility", label: t("nav.fragility") },
    { to: "/channels", label: t("nav.channels") },
    { to: "/history", label: t("nav.history") },
  ];
  const localizedMoreItems = [
    { to: "/diff", label: t("nav.diff") },
    { to: "/calendar", label: t("nav.calendar") },
    { to: "/methodology", label: t("nav.methodology") },
  ];

  return (
    <div className="app">
      <PersistentRegimeHeader cockpit={cockpit} />
      <header className={`site-header${isScrolled ? " site-header--scrolled" : ""}`}>
        <div className="site-header__masthead">
          <p className="eyebrow">{t("chrome.eyebrow")}</p>
          <h1>{t("chrome.mastheadTitle")}</h1>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          {localizedNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.ariaLabel}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              end={item.end}
            >
              {item.label}
            </NavLink>
          ))}
          <details className="site-nav__more">
            <summary className="nav-link">{t("nav.more")}</summary>
            <div className="site-nav__more-menu">
              {localizedMoreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </details>
        </nav>
      </header>
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
      <KeyboardShortcutsHelp open={showHelp} onClose={closeHelp} />
    </div>
  );
}
```

3. Remove the top-level `navItems` and `moreItems` consts (or leave them as the en-only routes table — they are not consumed any more if the inner uses localized arrays).

- [ ] **Step 2: Verify tests**

```bash
npm test -- src/components/AppLayout
```

Update test assertions if any string-match the old hardcoded labels. Preferred update: assert on `to` attribute rather than label text, or wrap test renders in `<LocaleProvider initialLocale="en">` and continue asserting "Overview", etc.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppLayout.tsx src/components/AppLayout.test.tsx
git commit -m "feat(i18n): translate AppLayout chrome + nav labels"
```

### Task 5: PersistentRegimeHeader — toggle + translation

**Files:**
- Modify: `src/components/PersistentRegimeHeader.tsx`
- Modify: `src/components/__tests__/PersistentRegimeHeader.test.tsx`
- Modify: `src/lib/regime.ts` (add zh label map) OR pass through useT in the header

- [ ] **Step 1: Add LanguageToggle + translate static labels**

```tsx
// src/components/PersistentRegimeHeader.tsx
import { useEffect, useState } from "react";
import type { CockpitFile, CockpitCompositeScore } from "../lib/types";
import { useMode, setMode } from "../lib/mode";
import { useT } from "../lib/i18n";
import LanguageToggle from "./LanguageToggle";

interface Props { cockpit: CockpitFile | null }

const SCROLL_THIN_THRESHOLD_PX = 80;

// Map the cockpit.regime.label (English from Python) to the i18n key.
const REGIME_LABEL_KEYS: Record<string, string> = {
  "Risk-On": "regime.riskOn",
  "Risk-Off": "regime.riskOff",
  "Neutral": "regime.neutral",
  "Stress": "regime.stress",
};

function findFragility(scores: CockpitCompositeScore[]) {
  return scores.find((s) => s.id === "fragility");
}

export default function PersistentRegimeHeader({ cockpit }: Props) {
  const mode = useMode();
  const { t } = useT();
  const [isThin, setIsThin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setIsThin(window.scrollY > SCROLL_THIN_THRESHOLD_PX);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (cockpit === null) {
    return (
      <header
        className="persistent-regime-header persistent-regime-header--loading"
        aria-busy="true"
        aria-label={t("chrome.loading")}
      >
        <span className="persistent-regime-header__placeholder">— {t("chrome.loading")} —</span>
      </header>
    );
  }

  const fragility = findFragility(cockpit.composite_scores);
  const risk =
    fragility?.value !== null && fragility?.value !== undefined
      ? fragility.value.toFixed(1)
      : null;
  const toneClass = `persistent-regime-header__dot--${cockpit.regime.tone}`;
  const otherMode = mode === "brief" ? "detail" : "brief";
  const regimeKey = REGIME_LABEL_KEYS[cockpit.regime.label];
  const regimeText = regimeKey ? t(regimeKey) : cockpit.regime.label;

  return (
    <header
      className={`persistent-regime-header ${isThin ? "persistent-regime-header--thin" : ""}`.trim()}
      aria-label={t("regime.regimeLabel")}
    >
      <div className="persistent-regime-header__regime">
        <span className={`persistent-regime-header__dot ${toneClass}`} title={`${t("chrome.asOfPrefix")} ${cockpit.date}`} aria-hidden="true" />
        <span className="persistent-regime-header__regime-label">{regimeText}</span>
      </div>

      {risk !== null && (
        <div className="persistent-regime-header__risk" aria-label={t("regime.fragility")}>
          <span className="persistent-regime-header__risk-label">{t("regime.fragility")}</span>
          <span className="persistent-regime-header__risk-value">{risk}</span>
        </div>
      )}

      <div className="persistent-regime-header__date" title={`${t("chrome.asOfPrefix")} ${cockpit.date}`}>
        {t("chrome.asOfPrefix")} {cockpit.date}
      </div>

      <LanguageToggle />

      <button
        type="button"
        className="persistent-regime-header__mode-toggle"
        onClick={() => setMode(otherMode)}
        aria-label={t("chrome.switchTo", { vars: { mode: otherMode === "brief" ? t("chrome.briefMode") : t("chrome.detailMode") } })}
      >
        {mode === "brief" ? t("chrome.briefMode") : t("chrome.detailMode")}
      </button>

      <button
        type="button"
        className="persistent-regime-header__shortcuts-button"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
        aria-label={t("chrome.keyboardShortcuts")}
        title={`${t("chrome.keyboardShortcuts")} (?)`}
      >
        ?
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Wrap tests in `<LocaleProvider>` if any assert on labels**

```bash
npm test -- src/components/__tests__/PersistentRegimeHeader
```

Fix assertions that previously expected "Fragility" — they still pass under en. If any test wants zh, wrap in `<LocaleProvider initialLocale="zh">`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PersistentRegimeHeader.tsx src/components/__tests__/PersistentRegimeHeader.test.tsx
git commit -m "feat(i18n): translate PersistentRegimeHeader + add LanguageToggle"
```

### Task 6: `g l` shortcut + help dialog

**Files:**
- Modify: `src/lib/keyboardShortcuts.ts`
- Modify: `src/components/KeyboardShortcutsHelp.tsx`

- [ ] **Step 1: Add `g l` binding**

In `src/lib/keyboardShortcuts.ts`, find the `useKeyboardShortcuts` hook and the `g` prefix handler. Add a branch for `l`:

```ts
import { useLocale, setLocale } from "./i18n";
// ... existing imports

// Inside the keyboard handler where other `g <letter>` cases live:
case "l": {
  // Toggle locale: en <-> zh
  const current = resolveLocale();  // import from "./i18n"
  setLocale(current === "en" ? "zh" : "en");
  setPendingG(false);
  e.preventDefault();
  return;
}
```

If `resolveLocale` is preferred to keep the hook pure, import it from the i18n barrel. Otherwise, read `useLocale()` at the hook top.

- [ ] **Step 2: Translate help dialog**

In `src/components/KeyboardShortcutsHelp.tsx`, use `useT()` to render shortcut descriptions:

```tsx
import { useT } from "../lib/i18n";

const { t } = useT();

// Use t("shortcuts.goOverview") etc. for each row's description.
// Add the new row:
// { keys: "g l", description: t("shortcuts.toggleLanguage") }
```

- [ ] **Step 3: Add test for the new binding**

```ts
// In src/lib/__tests__/keyboardShortcuts.test.ts (or similar)
it("g l toggles locale", () => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  // ... render the hook host ...
  fireEvent.keyDown(window, { key: "g" });
  fireEvent.keyDown(window, { key: "l" });
  expect(resolveLocale()).toBe("zh");
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- keyboardShortcuts
git add src/lib/keyboardShortcuts.ts src/components/KeyboardShortcutsHelp.tsx src/lib/__tests__/keyboardShortcuts.test.ts
git commit -m "feat(i18n): g l shortcut + translate KeyboardShortcutsHelp"
```

---

## Chunk 3: Cockpit + glossary

### Task 7: Glossary `zh` fields + signature change

**Files:**
- Modify: `src/lib/glossary.ts`
- Modify: `src/components/GlossaryTerm.tsx`
- Modify: `src/lib/__tests__/glossary.test.ts` (if exists; else create)

- [ ] **Step 1: Change `GLOSSARY` to `{ en, zh }` per-entry shape**

```ts
// src/lib/glossary.ts
import type { Locale } from "./i18n";

export interface GlossaryEntry {
  en: string;
  zh: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  VIX: {
    en: "Cboe Volatility Index — 30-day implied S&P 500 volatility from option prices.",
    zh: "芝加哥期权交易所波动率指数 — 由期权价格隐含的标普500未来30天波动率。",
  },
  VIX9D: {
    en: "Cboe 9-day implied S&P 500 volatility (front of the volatility curve).",
    zh: "芝加哥期权交易所9日波动率指数 (波动率曲线前端)。",
  },
  VIX3M: {
    en: "Cboe 3-month implied S&P 500 volatility (longer-dated volatility benchmark).",
    zh: "芝加哥期权交易所3月期波动率指数 (较长期波动率基准)。",
  },
  VVIX: {
    en: "Volatility of VIX — how much VIX itself is fluctuating (vol-of-vol).",
    zh: "VIX 自身的波动率 — 衡量 VIX 本身的波动程度 (波动率的波动率)。",
  },
  "10Y Real Yield": {
    en: "10-year TIPS yield — nominal yield minus inflation expectations.",
    zh: "10年期通胀保值国债收益率 — 名义收益率减通胀预期。",
  },
  "10Y Breakeven": {
    en: "10Y nominal yield minus 10Y real yield — implied 10-year inflation expectation.",
    zh: "10年期名义收益率减实际收益率 — 隐含的10年期通胀预期。",
  },
  "10Y Term Premium": {
    en: "Compensation investors demand for holding long-dated bonds vs rolling short ones (ACM model).",
    zh: "投资者持有长期债券相对滚动短债所要求的补偿 (ACM 模型)。",
  },
  ACM: {
    en: "Adrian-Crump-Moench model — NY Fed's decomposition of the yield curve into expectations + term premium.",
    zh: "Adrian-Crump-Moench 模型 — 纽约联储将收益率曲线分解为预期成分与期限溢价。",
  },
  "10Y−2Y": {
    en: "10-year minus 2-year Treasury yield spread — a recession-signal canonical curve measure.",
    zh: "10年期减2年期美国国债利差 — 经典的衰退信号曲线指标。",
  },
  "US 10Y": {
    en: "10-year US Treasury constant maturity yield (FRED DGS10).",
    zh: "10年期美国国债不变期限收益率 (FRED DGS10)。",
  },
  "US 2Y": {
    en: "2-year US Treasury constant maturity yield (FRED DGS2).",
    zh: "2年期美国国债不变期限收益率 (FRED DGS2)。",
  },
  SOFR: {
    en: "Secured Overnight Financing Rate — the post-LIBOR US short-term reference rate.",
    zh: "担保隔夜融资利率 — 后 LIBOR 时代的美国短期参考利率。",
  },
  "HY OAS": {
    en: "High-yield corporate bond option-adjusted spread — risk premium over Treasuries.",
    zh: "高收益企业债期权调整利差 — 相对美国国债的风险溢价。",
  },
  "IG OAS": {
    en: "Investment-grade corporate bond option-adjusted spread.",
    zh: "投资级企业债期权调整利差。",
  },
  OAS: {
    en: "Option-adjusted spread — yield premium of a bond over the matched-tenor Treasury, adjusted for embedded options.",
    zh: "期权调整利差 — 债券相对同期限美国国债的收益率溢价,经嵌入式期权调整。",
  },
  "HY−IG": {
    en: "Spread between high-yield and investment-grade OAS — credit-quality dispersion gauge.",
    zh: "高收益与投资级期权调整利差之间的差值 — 信用质量分散度指标。",
  },
  "Core CPI YoY": {
    en: "Year-over-year change in the Consumer Price Index excluding food and energy.",
    zh: "剔除食品和能源后的消费者价格指数同比变化。",
  },
  "Core PCE": {
    en: "Personal Consumption Expenditures price index excluding food and energy — Fed's preferred inflation gauge.",
    zh: "剔除食品和能源的个人消费支出价格指数 — 美联储首选通胀指标。",
  },
  "Initial Claims": {
    en: "Weekly count of new US unemployment-insurance applications — the fastest labor pulse.",
    zh: "美国每周新增失业保险申请人数 — 最快的就业脉冲指标。",
  },
  "Nonfarm Payrolls": {
    en: "Monthly count of US payroll jobs excluding farms — BLS Employment Situation headline.",
    zh: "美国剔除农业部门的每月就业人数 — 劳工统计局就业状况报告标题数据。",
  },
  "Net Liquidity": {
    en: "Fed balance sheet minus Treasury General Account minus reverse repo — funding backdrop for risk assets.",
    zh: "美联储资产负债表减财政部一般账户减逆回购 — 风险资产的资金面背景。",
  },
  "Broad USD": {
    en: "Trade-weighted broad dollar index (FRED DTWEXBGS) — global dollar pressure measure.",
    zh: "贸易加权广义美元指数 (FRED DTWEXBGS) — 全球美元压力指标。",
  },
  "WTI Crude": {
    en: "West Texas Intermediate crude oil price — US benchmark.",
    zh: "西德州中级原油价格 — 美国基准原油。",
  },
  "SP500 Lev-Money": {
    en: "CFTC Commitment of Traders leveraged-money net positioning in S&P 500 futures.",
    zh: "美国商品期货交易委员会持仓报告中标普500期货杠杆资金净持仓。",
  },
  CFTC: {
    en: "Commodity Futures Trading Commission — publisher of weekly Commitments of Traders positioning reports.",
    zh: "美国商品期货交易委员会 — 每周持仓报告的发布机构。",
  },
  MOVE: {
    en: "ICE BofA MOVE Index — implied volatility of US Treasury options. Currently gated; see source review.",
    zh: "ICE 美银 MOVE 指数 — 美国国债期权的隐含波动率。目前受限,详见源审查。",
  },
  SKEW: {
    en: "Cboe SKEW Index — tail-risk pricing in S&P options beyond at-the-money implied vol. Currently gated.",
    zh: "芝加哥期权交易所偏度指数 — 标普期权中超出平值隐含波动率的尾部风险定价。目前受限。",
  },
  SLOOS: {
    en: "Fed Senior Loan Officer Opinion Survey — quarterly bank-lending standards.",
    zh: "美联储高级贷款官员意见调查 — 季度银行信贷标准。",
  },
  bp: { en: "Basis point — 1/100th of one percent (0.01%).", zh: "基点 — 百分之一的百分之一 (0.01%)。" },
  pp: { en: "Percentage point — absolute difference between two percentages.", zh: "百分点 — 两个百分比之间的绝对差值。" },
  "% YoY": { en: "Percent year-over-year — value compared to 12 months ago.", zh: "同比百分比 — 相对12个月前的数值变化。" },
  "k m/m": { en: "Thousands, month-over-month change.", zh: "千人,环比变化。" },
  "m/m": { en: "Month-over-month change.", zh: "环比变化。" },
  "Δ7d": { en: "Change vs the most recent observation at least 7 calendar days ago.", zh: "相对最近至少7个自然日前观测值的变化。" },
  "Δ1m": { en: "Change vs the most recent observation at least 30 calendar days ago.", zh: "相对最近至少30个自然日前观测值的变化。" },
  pct: { en: "Percentile — rank of the current value within its historical distribution.", zh: "百分位 — 当前值在历史分布中的排名。" },
  pctile: { en: "Percentile.", zh: "百分位。" },
  daily: { en: "Series updates once per business day.", zh: "数据每个工作日更新一次。" },
  weekly: { en: "Series updates once per week.", zh: "数据每周更新一次。" },
  monthly: { en: "Series updates once per month.", zh: "数据每月更新一次。" },
  quarterly: { en: "Series updates once per quarter.", zh: "数据每季度更新一次。" },
  "data quality": {
    en: "How much the dashboard trusts today's read - combines coverage, freshness, model breadth, and source gating.",
    zh: "本仪表盘对今日读数的信任程度 — 综合覆盖度、新鲜度、模型完备度和源准入。",
  },
  coverage: {
    en: "Fraction of expected market and macro series successfully fetched, importance-weighted.",
    zh: "按重要性加权后,成功获取的预期市场与宏观数据序列的比例。",
  },
  freshness: {
    en: "How recent the active series are vs their expected release cadence, on a linear ramp.",
    zh: "活跃数据序列相对其预期发布节奏的新鲜程度,采用线性递减。",
  },
  model: {
    en: "Fraction of score-model buckets that received at least one active signal today.",
    zh: "今天至少收到一个活跃信号的评分模型分桶比例。",
  },
  "confidence aggregate": {
    en: "Geometric mean of coverage, freshness, model, and source - overall trust in today's read.",
    zh: "覆盖度、新鲜度、模型完备度和源准入的几何均值 — 对今日读数的总体信任。",
  },
};

export function lookupGlossary(term: string, locale: Locale = "en"): string | undefined {
  const entry = GLOSSARY[term];
  if (!entry) return undefined;
  return locale === "zh" ? entry.zh : entry.en;
}
```

- [ ] **Step 2: Update `GlossaryTerm.tsx` to pass locale into lookup**

```tsx
// src/components/GlossaryTerm.tsx
import { useT } from "../lib/i18n";
import { lookupGlossary } from "../lib/glossary";
import type { ReactNode } from "react";

interface Props {
  term: string;
  children: ReactNode;
}

export default function GlossaryTerm({ term, children }: Props) {
  const { locale } = useT();
  const def = lookupGlossary(term, locale);
  if (!def) return <>{children}</>;
  return <abbr title={def}>{children}</abbr>;
}
```

- [ ] **Step 3: Test**

```ts
// src/lib/__tests__/glossary.test.ts (extend or create)
import { describe, it, expect } from "vitest";
import { lookupGlossary } from "../glossary";

describe("lookupGlossary", () => {
  it("returns en by default", () => {
    expect(lookupGlossary("VIX")).toMatch(/Cboe Volatility Index/);
  });

  it("returns zh under zh locale", () => {
    expect(lookupGlossary("VIX", "zh")).toMatch(/波动率指数/);
  });

  it("returns undefined for unknown terms", () => {
    expect(lookupGlossary("notReal")).toBeUndefined();
  });

  it("every glossary entry has both en and zh", () => {
    const { GLOSSARY } = require("../glossary");
    for (const [key, entry] of Object.entries(GLOSSARY) as any) {
      expect(entry.en, `${key}.en`).toBeTruthy();
      expect(entry.zh, `${key}.zh`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- glossary
git add src/lib/glossary.ts src/components/GlossaryTerm.tsx src/lib/__tests__/glossary.test.ts
git commit -m "feat(i18n): glossary entries gain zh field; lookupGlossary accepts locale"
```

### Task 8: CockpitCell labels + readings

**Files:**
- Modify: `src/components/CockpitCell.tsx`
- Modify: `src/components/__tests__/CockpitCell.test.tsx` if assertions break

- [ ] **Step 1: Translate cell labels via SIGNAL_NAMES**

In `CockpitCell.tsx`:

```tsx
import { useT, COCKPIT_ID_TO_SIGNAL_KEY } from "../lib/i18n";

// Inside the component, derive the label:
const { t } = useT();
const signalKey = COCKPIT_ID_TO_SIGNAL_KEY[signal.id];
const displayLabel = signalKey
  ? t(`signals.${signalKey}`, { withOriginal: true })
  : signal.display_label;  // fallback to Python-emitted label
```

Replace `{signal.display_label}` with `{displayLabel}` wherever the cell's primary label is rendered. Keep the `GlossaryTerm` wrapping intact — it now uses the canonical English term as the lookup key (pass `signal.display_label` to GlossaryTerm as the `term` prop, with `displayLabel` as children).

```tsx
<GlossaryTerm term={signal.display_label}>
  {displayLabel}
</GlossaryTerm>
```

- [ ] **Step 2: Translate categorical readings**

Find where the cell renders a categorical reading word (`stretched`, `tight`, etc.). The value comes from `signal.reading` (string). Translate:

```tsx
const READING_KEYS: Record<string, string> = {
  stretched: "readings.stretched",
  neutral: "readings.neutral",
  tight: "readings.tight",
  wide: "readings.wide",
  rich: "readings.rich",
  cheap: "readings.cheap",
  rising: "readings.rising",
  falling: "readings.falling",
  flat: "readings.flat",
  normal: "readings.normal",
};

const readingText = signal.reading && READING_KEYS[signal.reading]
  ? t(READING_KEYS[signal.reading])
  : signal.reading;
```

Use `readingText` wherever the bare reading word is rendered.

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/components/__tests__/CockpitCell
git add src/components/CockpitCell.tsx src/components/__tests__/CockpitCell.test.tsx
git commit -m "feat(i18n): translate cockpit cell labels + categorical readings"
```

### Task 9: DataQualityBanner translation

**Files:**
- Modify: `src/components/DataQualityBanner.tsx`
- Modify: `src/components/DataQualityBanner.test.tsx`

- [ ] **Step 1: Translate the title, tier pill, and breakdown labels**

In `DataQualityBanner.tsx`:

```tsx
import { useT } from "../lib/i18n";

const { t } = useT();

const TIER_KEYS: Record<string, string> = {
  high: "dataQuality.tierHigh",
  medium: "dataQuality.tierMedium",
  low: "dataQuality.tierLow",
  thin: "dataQuality.tierThin",
};

// Title:
<h3>{t("dataQuality.title")}</h3>

// Tier pill:
<span className={`tier-pill tier-pill--${tier}`}>
  {t(TIER_KEYS[tier])}
</span>

// Breakdown rows:
<dt>{t("dataQuality.coverage")}</dt>
<dt>{t("dataQuality.freshness")}</dt>
<dt>{t("dataQuality.model")}</dt>
<dt>{t("dataQuality.sourceMix")}</dt>
<dt>{t("dataQuality.aggregate")}</dt>
```

- [ ] **Step 2: Run + commit**

```bash
npm test -- DataQualityBanner
git add src/components/DataQualityBanner.tsx src/components/DataQualityBanner.test.tsx
git commit -m "feat(i18n): translate DataQualityBanner tier + breakdown labels"
```

---

## Chunk 4: Routes + FocusBlock

### Task 10: FocusBlock static fields + each route heading

**Files:**
- Modify: `src/components/FocusBlock.tsx`
- Modify: All route TSX files in `src/routes/`

- [ ] **Step 1: FocusBlock — translate eyebrow + question via section.id**

```tsx
// src/components/FocusBlock.tsx
import { useT } from "../lib/i18n";

const { t, locale } = useT();

// section.id keys: "volatility" | "rates" | "regime_map" | "sentiment" | "tactical"
const eyebrow = t(`focus.${section.id}.eyebrow`);
const question = t(`focus.${section.id}.question`);

// Dynamic narrative fields stay in English regardless of locale:
<p lang="en" className="focus-block__answer">{section.answer}</p>
<p lang="en" className="focus-block__why">{section.why}</p>
{/* Same for risk, support, caveat — wrap in <span lang="en"> or <p lang="en"> */}
```

(If the eyebrow lookup returns the bare key, fall back to `section.eyebrow` from the JSON to preserve graceful degradation.)

```tsx
const eyebrowText = t(`focus.${section.id}.eyebrow`);
const eyebrow = eyebrowText.startsWith("focus.") ? section.eyebrow : eyebrowText;
```

- [ ] **Step 2: Each route — translate heading + subtitle**

For each of `src/routes/Overview.tsx`, `TacticalTradingWeather.tsx`, `LongTermMacroClimate.tsx`, `FragilityShockRisk.tsx`, `Channels.tsx`, `History.tsx`, `Diff.tsx`, `Calendar.tsx`, `Methodology.tsx`:

```tsx
import { useT } from "../lib/i18n";

const { t } = useT();

// Replace hardcoded heading with t("routes.<routeName>Heading")
<h2>{t("routes.overviewHeading")}</h2>
```

Routes that have a body paragraph or subtitle: add a route-specific key to `en.ts` and `zh.ts` and use it. If a route has long-form descriptive copy that's not yet keyed, leave it English and add a TODO comment with the proposed key. We are not gating this PR on translating long-form route copy.

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/routes
git add src/components/FocusBlock.tsx src/routes/
git commit -m "feat(i18n): translate FocusBlock static fields + each route heading"
```

### Task 11: Diff cadence pills + Calendar columns + Methodology TSX

**Files:**
- Modify: `src/routes/Diff.tsx`
- Modify: `src/routes/Calendar.tsx`
- Modify: `src/routes/Methodology.tsx`

- [ ] **Step 1: Diff cadence pills**

In `Diff.tsx`, find where the cadence pill text renders ("daily", "weekly", "monthly", "quarterly"). Replace with:

```tsx
const CADENCE_KEYS: Record<string, string> = {
  daily: "cadence.daily",
  weekly: "cadence.weekly",
  monthly: "cadence.monthly",
  quarterly: "cadence.quarterly",
};

const cadenceText = t(CADENCE_KEYS[row.cadence] ?? "cadence.daily");
```

Add an empty-state copy key (`en.ts` + `zh.ts`):
```ts
diff: { empty: "No series updated in this window.", emptyZh: "本时间窗内没有数据序列更新。" }
```
Use `t("diff.empty")` for the empty-state.

- [ ] **Step 2: Calendar — translate column headings + event-type labels**

```tsx
// columns
<th>{t("calendar.colDate")}</th>
<th>{t("calendar.colTime")}</th>
<th>{t("calendar.colEvent")}</th>
<th>{t("calendar.colImpact")}</th>

// event-type labels (impact levels)
// Add to en.ts / zh.ts:
calendar: {
  colDate: "Date", colTime: "Time", colEvent: "Event", colImpact: "Impact",
  impactHigh: "High", impactMedium: "Medium", impactLow: "Low",
}
```

- [ ] **Step 3: Methodology — translate section headings**

The page has multiple section headings. Add `methodology.headingX` keys for each in en.ts + zh.ts and apply. Long-form prose remains English (Tier 3).

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/routes
git add src/routes/Diff.tsx src/routes/Calendar.tsx src/routes/Methodology.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(i18n): translate Diff cadence pills, Calendar columns, Methodology headings"
```

---

## Chunk 5: Polish + verify

### Task 12: Visual smoke + bundle check + full gate + PR

- [ ] **Step 1: Start dev server, capture screenshots at en + zh**

```bash
cd /Users/sakura/WebstormProjects/market-weather-map/.worktrees/chinese-i18n
npm run dev -- --port 5207 > /tmp/zh-dev.log 2>&1 &
DEV_PID=$!
sleep 4

agent-browser set viewport 1440 900
agent-browser open http://localhost:5207/
agent-browser wait --load networkidle
agent-browser screenshot /tmp/zh-overview-en-desktop.png

agent-browser open http://localhost:5207/?lang=zh
agent-browser wait --load networkidle
agent-browser screenshot /tmp/zh-overview-zh-desktop.png

agent-browser set viewport 375 812
agent-browser open http://localhost:5207/?lang=zh
agent-browser wait --load networkidle
agent-browser screenshot /tmp/zh-overview-zh-mobile.png

agent-browser open http://localhost:5207/diff?lang=zh
agent-browser wait --load networkidle
agent-browser screenshot /tmp/zh-diff-zh.png

agent-browser open http://localhost:5207/methodology?lang=zh
agent-browser wait --load networkidle
agent-browser screenshot /tmp/zh-methodology-zh.png

kill $DEV_PID 2>/dev/null
```

Verify each screenshot for overflow / wrapping / placement issues.

- [ ] **Step 2: Bundle size delta**

```bash
npm run build 2>&1 | tail -15
ls -la dist/assets/index-*.js
```

Confirm gzip delta on the main chunk ≤ +60 KB. If exceeded, split zh dictionary into a dynamic import.

- [ ] **Step 3: Full verification gate**

```bash
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt 2>&1 | tail -3

npm test 2>&1 | tail -10
npm run build 2>&1 | tail -5
.venv/bin/python -m pytest tests/python -q 2>&1 | tail -5
.venv/bin/python -m scripts.validate.validate_schema 2>&1 | tail -3
.venv/bin/python -m scripts.validate.validate_freshness 2>&1 | tail -3
```

All must pass. Side-effect data refresh from `npm test` → restore with `git checkout -- public/data/derived/`.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/chinese-localization
gh pr create --title "feat(i18n): add Simplified Chinese localization with EN | 中 toggle" --body "$(cat <<'EOF'
## Summary
Static client-side i18n. Toggle in the persistent regime header switches the UI between English and Simplified Chinese. Curated indices render as `中文 (Original)`. Dynamic FocusBlock narrative stays English (Tier 3 — requires Python pipeline change deferred to follow-up).

## What translates
- Nav + chrome (masthead, eyebrow, Brief/Detail, ?, asOf)
- PersistentRegimeHeader (regime labels, fragility, language toggle, mode toggle)
- Cockpit cell labels (via `SIGNAL_NAMES`) + categorical readings
- Glossary `<abbr title>` tooltips
- DataQualityBanner (tier pill + breakdown labels)
- FocusBlock eyebrow + question (static fields)
- Each route heading; Diff cadence pills; Calendar columns; Methodology section headings
- Keyboard shortcuts dialog

## What doesn't translate (by design)
- Numeric values, dates (Latin/Arabic numerals preserved)
- Tickers / FRED IDs / provider names
- FocusBlock dynamic narrative (`answer`, `why`, `risk`, `support`, `caveat`) — Python f-strings with numeric interpolation; would require pipeline change. These wrap in `<span lang="en">` under zh for proper rendering.
- Long-form route copy beyond headings — separate Tier 2 PR planned.

## Toggle
- UI button: `[EN | 中]` pill in PersistentRegimeHeader
- Keyboard: `g l`
- URL: `?lang=zh` shareable; persists via localStorage; precedence URL > storage > default
- `document.documentElement.lang` updates for CJK font fallback + a11y

## Test plan
- [x] `npm test` — full suite
- [x] `python -m pytest tests/python`
- [x] `npm run build`
- [x] Bundle size delta ≤ +60 KB gz on main chunk
- [x] Visual smoke at 1440x900 and 375x812 for /overview, /diff, /methodology

## Spec + plan
- Spec: `docs/superpowers/specs/2026-05-18-simplified-chinese-localization-design.md`
- Plan: `docs/superpowers/plans/2026-05-18-chinese-localization.md`

EOF
)"
```

---

## Notes for executors

- Each task's commit message and code is the same one the implementer should produce — don't paraphrase.
- If a route renders no translatable strings yet (rare), add a `lang="en"` wrapper around the page body so screen readers handle it correctly under zh mode.
- Glossary keys are canonical English labels — do NOT change keys to zh.
- FocusBlock dynamic narrative under zh: wrap in `<span lang="en">` so CJK font fallback doesn't pick up Latin paragraphs.
- The cockpit cell label uses the canonical English (`signal.display_label`) for the `term` prop on `GlossaryTerm`, while children (the visible text) is the `withOriginal` result.
- When in doubt, fall back to English. The TS type for `t()` keys catches typos; runtime fallback catches missing zh entries.
