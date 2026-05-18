# Simplified Chinese Localization — Design

**Status:** Approved (2026-05-18)
**Author:** Sakura (with Claude assist)
**Scope:** Frontend-only. Static GitHub Pages, no Python pipeline changes.

## Goal

Let visitors switch the dashboard between English (default) and Simplified Chinese with a single click. UI chrome, prose, glossary, and curated index/term labels translate. Numeric values and raw provider identifiers stay unchanged. Special indices and jargon render as **`中文译名 (Original)`** when zh is active (e.g. `波动率指数 (VIX)`).

## Non-goals

- No translation of `public/data/*.json` payloads. Numeric values, dates, codes (FRED IDs, tickers) remain Latin/numeric.
- No Python pipeline changes. No new ingest/transform/validate step. No new GitHub Actions step.
- No additional languages beyond zh in this initiative. The dictionary shape supports adding `jp.ts` etc. later in a single follow-up PR.
- No translation service / runtime API. All copy is statically bundled.
- No translation of `docs/METHODOLOGY.md` or `docs/LIMITATIONS.md` as Markdown files. Their on-page renderings inside `Methodology.tsx` get localized strings; the source Markdown stays English.

## Architecture

### Pattern

Mirror the existing `useMode()` pattern in `src/lib/mode.tsx`:

```
src/lib/i18n/
  locale.tsx      # LocaleProvider, useLocale(), setLocale(), precedence resolver
  en.ts           # English dictionary (source of truth for the key shape)
  zh.ts           # Simplified Chinese dictionary (must match en's keys)
  t.ts            # useT() hook returning the t(key, opts?) function
  signals.ts      # Curated signal-name table with { zh, original } entries
  index.ts        # Re-exports
  __tests__/      # Vitest specs for precedence, parenthetical, fallback
```

### Locale resolution

Precedence (highest first):
1. URL param `?lang=en` or `?lang=zh`
2. `localStorage["mwm.locale"]`
3. Default `"en"`

No `navigator.language` auto-detect — the dashboard's authoring voice is English, and surprise switching is bad UX for a data dashboard.

The `LocaleProvider` mirrors `ModeProvider` precisely, including:
- A custom event `"mwm:locale-change"` dispatched by `setLocale()`, listened to by every mounted provider.
- A cross-tab `storage` event listener so a locale change in one tab propagates to others.
- Sets `document.documentElement.lang` to `"en"` or `"zh-CN"` in an effect — improves CJK font fallback and screen-reader pronunciation.

### Hook surface

```ts
type Locale = "en" | "zh";

function useLocale(): Locale;
function setLocale(locale: Locale): void;  // updates URL + localStorage, dispatches "mwm:locale-change"

function useT(): {
  t: (key: string, opts?: { withOriginal?: boolean; vars?: Record<string, string | number> }) => string;
  locale: Locale;
};
```

`t("nav.overview")` returns the matching string from the active dictionary. Falls back to the English entry when a key is missing in zh. Logs a `console.warn` once per missing key in dev (`import.meta.env.DEV`).

### The `withOriginal` parenthetical

For curated index/jargon labels (`src/lib/i18n/signals.ts`):

```ts
export const SIGNAL_NAMES: Record<string, { zh: string; original: string }> = {
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
};
```

`t("signals.vix", { withOriginal: true })` returns:
- `en`: `"VIX"`
- `zh`: `"波动率指数 (VIX)"`

`t("signals.vix")` (no `withOriginal`) returns:
- `en`: `"VIX"`
- `zh`: `"波动率指数"`

**Rule (simplified):** every cockpit cell label, FocusBlock eyebrow that names an index, and chart title that names an index uses `withOriginal: true`. We do not try to deduplicate within a card — readers benefit from seeing both names on every signal. Bare-form `t("signals.vix")` is reserved for places where the original would visibly duplicate content already on screen (e.g. a tooltip arrow already pointing at a labeled cell).

## Toggle UI

### Placement

Inside `PersistentRegimeHeader`, immediately before the existing Detail toggle:

```
[●Risk-On] [Fragility 0.62] [As of 2026-05-18] [EN | 中] [Detail] [?]
```

Segmented pill, ~50 px wide, same height as the adjacent buttons. The non-active side is the click target; the active side is inert.

### Keyboard

Add `g l` to `src/lib/keyboardShortcuts.ts` — toggles between en and zh. Lists in `KeyboardShortcutsHelp.tsx`:
- `g l` — Toggle language / 切换语言

### Mobile

In thin (scrolled) mode the toggle remains visible (regime header retains its action cluster). Help dialog text translates with the active locale.

## Translation surfaces

### Tier 1: must translate (acceptance gate)

1. **Nav + chrome** (`AppLayout.tsx`): masthead title, eyebrow, all nav labels (Overview, Short-Term, Long-Term, Fragility, Channels, History), More menu (Diff, Calendar, Methodology), Brief/Detail toggle, `?` button aria-label.
2. **PersistentRegimeHeader**: regime label (Risk-On / Risk-Off / Neutral / Stress → 风险偏好 / 避险 / 中性 / 压力), Fragility label, "As of" date prefix.
3. **Cockpit cells**: cell labels via `SIGNAL_NAMES` lookup (use `withOriginal: true`); categorical readings — distinct mappings, no collision: `stretched → 拉伸高位` (overextended), `tight → 偏紧` (narrowed/tight), `neutral → 中性`, `wide → 走阔`, `rich → 估值偏高`, `cheap → 估值偏低`, `rising → 上升`, `falling → 下降`, `flat → 持平`, `normal → 正常`.
4. **FocusBlock STATIC fields only** (`FocusBlock.tsx`): `eyebrow` + `question`. These are static templates in `SECTION_CATALOG` (e.g. `"What is volatility telling us?"`) and translate cleanly via a TS dictionary keyed by `section.id`. The dynamic narrative fields (`answer`, `why`, `risk`, `support`, `caveat`) interpolate numeric values from per-render Python branches — they are **explicitly NOT translated** in this initiative. See Tier-3 note below for why and what would be required to translate them later.
5. **Glossary tooltips** (`src/lib/glossary.ts` + `GlossaryTerm.tsx`): each entry gains a `zh` field holding the Chinese definition. **Glossary keys stay canonical English** (e.g. `"VIX"`, `"10Y Real Yield"`) — they are the lookup key, not display text. The visible text wrapped by `<abbr>` is whatever the caller passes (typically the original label or the `中文 (Original)` form). Only the tooltip `title` flips to zh. `lookupGlossary(term, locale)` returns the zh definition under zh, falling back to en if missing. Call sites pass the canonical English term, not the rendered display string.
6. **DataQualityBanner**: tier pill (`高 | 中 | 低 | 稀疏` for `high | medium | low | thin`), label "data quality" → "数据质量", expand summary copy.
7. **Keyboard shortcuts dialog**: all shortcut descriptions.
8. **RouteLoading + ErrorBoundary fallbacks**: "Loading…" → "加载中…", "Failed to load" → "加载失败".

### Tier 2: should translate (best-effort, ship in same PR)

1. **Methodology route copy** (`Methodology.tsx`): section headings + paragraphs in TSX. The underlying `docs/METHODOLOGY.md` stays English.
2. **Calendar route**: column headers, event-type labels.
3. **Diff route**: cadence pill text, empty-row copy, column headings.
4. **CandidateDiagnosticPanel + CandidateSourcePanel**: section headings only; raw source IDs stay Latin.
5. **DataGapPanel**: heading + descriptive copy.

### Tier 3: deferred (own follow-up if needed)

- **FocusBlock dynamic narrative** (`answer`, `why`, `risk`, `support`, `caveat`): these are Python-emitted f-strings with branch logic and numeric interpolation (e.g. `f"Real yields {direction} {abs(real_bps):+.0f} bps"`). Translating them properly requires `build_page_insights.py` to emit a stable `template_variant` key + a `vars: {...}` numeric payload, then TS templates do substitution. That is a Python-pipeline change and out of scope for this PR. These fields render English under zh, with an explicit `<span lang="en">` wrapper so they don't visually clash and so screen readers handle them correctly.
- Long-form copy inside one-off panels (HiddenStressMismatchPanel narrative, etc.) — keep English, schedule a separate copy-translation PR.
- Chart axis labels — Recharts axes already render numeric/date; titles stay English for now.
- Date format: `"As of 2026-05-18"` becomes `"数据截至 2026-05-18"` under zh (Latin numerals preserved). Full zh-CN date format (`2026年5月18日`) is deferred.

### What we do NOT translate (by design)

- Numeric values, dates (continue using `formatters.ts`; zh-CN uses the same Arabic-numeral conventions but with `年月日` if we localize date formatting later — out of scope here).
- Tickers / codes (VIX, MOVE, FRED IDs).
- Provider names (Cboe, ICE, NY Fed, BLS, FRED, Treasury.gov, Cleveland Fed).
- URLs / external links text — keep the provider's own wording.

## Data model + key taxonomy

```ts
// src/lib/i18n/en.ts (zh.ts mirrors this exactly)
export const en = {
  nav: { overview, shortTerm, longTerm, fragility, channels, history, more, diff, calendar, methodology },
  chrome: { mastheadTitle, eyebrow, briefMode, detailMode, switchTo, keyboardShortcuts, asOf, loading, loadFailed },
  regime: { riskOn, riskOff, neutral, stress, fragility, regimeLabel },
  readings: { stretched, neutral, tight, wide, rich, cheap, rising, falling, flat, normal },
  dataQuality: { title, tierHigh, tierMedium, tierLow, tierThin, coverage, freshness, model, sourceMix, aggregate },
  cadence: { daily, weekly, monthly, quarterly },
  focus: { /* section.id + template.id → { question, answer, whyItMatters } */ },
  routes: { overviewHeading, shortTermHeading, /* ... per-route copy */ },
  shortcuts: { /* one entry per binding */ },
} as const;
```

The TS type for `t()`'s key arg is derived from `en`'s shape so missing zh keys produce a compile error.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Terminology choices feel off to a native CN finance reader | Pull terminology from CN financial press conventions (财新, 第一财经). Ship list-of-terms as a separate diff for review. |
| Bundle bloat | zh dictionary ~25 KB gzipped. Acceptable. Re-evaluate if cumulative i18n exceeds 60 KB gz. |
| Print stylesheet truncation | Verify zh page renders within one A4 / Letter; add explicit `lang="zh"` on the body so the browser picks proper CJK fallback fonts. |
| Glossary key collisions | Glossary keys are exact-match strings — zh values added as a sibling field, so no collision. |
| FocusBlock prose drift | Templates live in two places (Python `SECTION_CATALOG`, TS `focus` dictionary). Add a unit test that asserts every active section.id has a zh entry. |

## Acceptance criteria

1. With `?lang=zh`, every Tier-1 surface listed above renders Simplified Chinese; refresh persists via localStorage.
2. Toggle button visible in `PersistentRegimeHeader` and reachable via `g l`.
3. Index labels listed in `SIGNAL_NAMES` render as `中文译名 (Original)` on first mention in each cockpit cell.
4. Glossary `<abbr title>` shows zh definition under zh mode.
5. Returning to en restores English with no stale zh strings on screen.
6. `npm test` + `npm run build` + `python -m pytest tests/python` all pass.
7. Bundle size delta within +60 KB gzipped on the main chunk (or split zh into a separate chunk if exceeded).
8. Methodology + Diff + Calendar render at zh without layout overflow at viewport 1440x900 and 375x812.
9. At viewport 375x812, every cockpit cell renders its `中文 (Original)` label without wrapping past 2 lines or overflowing the cell box. The longest zh names (e.g. `标普500杠杆资金净持仓 (SP500 Lev-Money)`) get smoke-checked manually.
10. FocusBlock dynamic narrative fields (`answer`, `why`, `risk`, `support`, `caveat`) render English under zh, wrapped in `<span lang="en">` so screen readers + CJK font fallback behave correctly. The static `eyebrow` + `question` fields render Chinese.

## Testing strategy

- **Unit**: `t()` precedence (URL > storage > default); parenthetical formatter; fallback to en when zh key missing; setLocale dispatches event.
- **Component**: `LanguageToggle` click cycles state; `PersistentRegimeHeader` renders the toggle.
- **Integration** (vitest + jsdom): mount `AppLayout` at zh, snapshot critical nav + cockpit labels.
- **Visual smoke** (agent-browser, manual gate): screenshot Overview + Short-Term + Diff at en and zh.
- **Type-level**: zh dictionary type asserts equality with en's keys.

## Rollout

Single PR — `feat/chinese-localization` branch. No feature flag. No staged rollout. Static page, low risk, simple revert path.

## File touches (preview)

**New (~7 files):**
- `src/lib/i18n/locale.tsx`, `en.ts`, `zh.ts`, `t.ts`, `signals.ts`, `index.ts`, plus tests
- `src/components/LanguageToggle.tsx` + test

**Modified (~20 files):**
- `src/components/AppLayout.tsx` — wrap in `<LocaleProvider>`, translate nav
- `src/components/PersistentRegimeHeader.tsx` — add toggle, translate labels
- `src/components/CockpitCell.tsx`, `FocusBlock.tsx`, `DataQualityBanner.tsx`, `KeyboardShortcutsHelp.tsx`, `RouteLoading.tsx`
- `src/lib/glossary.ts` — add `zh` field per entry; `lookupGlossary` accepts locale
- `src/lib/keyboardShortcuts.ts` — add `g l` binding
- Each route TSX: `src/routes/Overview.tsx`, `TacticalTradingWeather.tsx` (Short-Term), `LongTermMacroClimate.tsx`, `FragilityShockRisk.tsx`, `Channels.tsx`, `History.tsx`, `Diff.tsx`, `Calendar.tsx`, `Methodology.tsx`
- `src/lib/mode.tsx` is unchanged structurally — used as architectural reference only

**Not touched:**
- Any `scripts/` Python file
- Any `public/data/*.json` file
- `.github/workflows/*`
- Recharts/ECharts wrappers

## Open questions parked for follow-up

- Should the toggle persist as a URL share when copied? Currently yes — `?lang=zh` is appended on setLocale. Confirm during review.
- Should we localize the `lang` attribute on `<html>` for accessibility / CJK font fallback? Yes, set via `document.documentElement.lang` in `LocaleProvider` effect.
- Future: add `jp` / `kr` — would require a third dictionary file and a wider toggle. Out of scope here.
