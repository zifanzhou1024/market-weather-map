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
    // section.id → eyebrow + question (the static FocusBlock fields).
    // Keys mirror the SectionId union in src/lib/types.ts. When a key is
    // absent or t() returns the bare key, FocusBlock falls back to the
    // section.eyebrow / section.question from public/data JSON.
    volatility_complex: {
      eyebrow: "Volatility complex",
      question: "What is volatility telling us?",
    },
    rates_pressure: {
      eyebrow: "Rates and curve",
      question: "Where is the rates story?",
    },
    regime_drivers: {
      eyebrow: "Regime drivers",
      question: "What regime are we in?",
    },
    positioning_vs_candidate_sentiment: {
      eyebrow: "Sentiment and positioning",
      question: "What is sentiment doing?",
    },
    tactical_stress_board: {
      eyebrow: "Tactical lens",
      question: "What does the tactical setup look like?",
    },
    liquidity_funding: {
      eyebrow: "Liquidity and funding",
      question: "What is the liquidity backdrop?",
    },
    credit_dispersion: {
      eyebrow: "Credit dispersion",
      question: "What are credit spreads saying?",
    },
    dollar_pressure: {
      eyebrow: "Dollar pressure",
      question: "What is the dollar doing?",
    },
    commodity_impulse: {
      eyebrow: "Commodity impulse",
      question: "What is the commodity inflation impulse?",
    },
    growth_breadth: {
      eyebrow: "Growth breadth",
      question: "What does growth breadth show?",
    },
    housing_pulse: {
      eyebrow: "Housing pulse",
      question: "What does the housing cycle show?",
    },
    inflation_dispersion: {
      eyebrow: "Inflation dispersion",
      question: "What is inflation dispersion telling us?",
    },
  },
  routes: {
    overviewHeading: "Overview",
    overviewSubtitle: "What matters today",
    shortTermHeading: "Short-Term Market Reaction",
    longTermHeading: "Long-Term Macro / Allocation Climate",
    fragilityHeading: "Fragility / Shock Risk",
    channelsHeading: "Channels",
    historyHeading: "History",
    diffHeading: "Diff",
    calendarHeading: "Macro Calendar",
    methodologyHeading: "How the map works",
  },
  shortcuts: {
    groupNavigation: "Navigation",
    groupView: "View",
    groupHelp: "Help",
    goOverview: "Overview",
    goShortTerm: "Short-Term",
    goLongTerm: "Long-Term",
    goFragility: "Fragility",
    goChannels: "Channels",
    goHistory: "History",
    goDiff: "Diff",
    goCalendar: "Calendar",
    goMethodology: "Methodology",
    toggleMode: "Toggle Brief / Detail mode",
    toggleLanguage: "Toggle language (EN / 中)",
    showHelp: "Toggle this overlay",
    closeHelp: "Close overlay / cancel g prefix",
    closeAria: "Close keyboard shortcuts help",
    footerPrefix: "Press",
    footerSuffix: "anytime to toggle this overlay.",
  },
} as const;

// Widen the literal types from `as const` to plain strings so zh.ts (with
// different string values) can satisfy the same shape via `const zh: En = {...}`.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type En = Widen<typeof en>;
export type EnKeys = En;  // re-exported for the t() typing
