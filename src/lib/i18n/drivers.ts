// src/lib/i18n/drivers.ts
//
// Translation lookup for Python-emitted driver titles and sub-component
// labels shown in the Overview "TOP ACTIVE WARNINGS / SUPPORTS" lists, in
// the PageInsightHero primary slots, and on Shock-risk / MissingSignal
// surfaces.
//
// Per the i18n tier policy:
//   - Tier 1: static UI chrome (translated via en/zh dictionaries).
//   - Tier 2: short Python-emitted categorical labels (translated via
//     `tCategorical(group, value)` and this driver-title map).
//   - Tier 3: long Python-emitted narrative prose (best-effort template
//     matcher in `narrative.ts`).
//
// This file covers Tier 2 driver titles. Add an entry when a new Python
// `driver.title` / `signal.label` string ships through `signal_priority.json`
// or `page_insights.json`. Unknown keys fall back to the raw English string
// (handled by `tDriver()` in `t.ts`).

export const DRIVER_TITLE_TRANSLATIONS: Record<string, string> = {
  // Top-level signal labels from signal_priority.json.
  "10Y real yields": "10年期实际收益率",
  "Inflation pressure": "通胀压力",
  "S&P 500 positioning": "标普500持仓",
  "Commodities inflation impulse": "大宗商品通胀脉冲",
  "Commodity inflation impulse": "大宗商品通胀脉冲",
  "Net liquidity": "净流动性",
  "VIX / VVIX complex": "VIX / VVIX 复合波动率",
  "Credit spreads": "信用利差",
  "Labor cycle": "就业周期",
  "Broad dollar": "广义美元",
  "Growth breadth": "增长广度",
  "Consumer balance sheet": "消费者资产负债表",
  "VIX curve state": "VIX 曲线状态",
  // Candidate / gated driver labels surfaced in readiness panels.
  "MOVE Index (bond volatility)": "MOVE 指数 (债券波动率)",
  "S&P 500 benchmark (SPX)": "标普500基准 (SPX)",
  "Cboe SKEW": "Cboe 偏度指数",
  "Put/call ratio (total)": "看跌看涨比 (总)",
  "Put/call ratio (SPXW / 0DTE)": "看跌看涨比 (SPXW / 0DTE)",
  "VX futures curve": "VX 期货曲线",
  // Other Python-emitted driver / channel names used in readiness UI.
  "Bond-vol proxy (not MOVE)": "债券波动率代理 (非 MOVE)",
  "Bond-volatility proxy (NOT MOVE)": "债券波动率代理 (非 MOVE)",
  "Liquidity drain": "流动性流失",
  "Dollar spike": "美元飙升",
  "Positioning crowding": "持仓拥挤",
  "Credit widening": "信用走阔",
  "Vol term-structure": "波动率期限结构",
  // Sub-component breakouts shown under the Net liquidity driver
  // (driver.components[].label) and as external-research link labels.
  "Fed assets": "联储资产",
  "Treasury General Account": "财政部一般账户",
  "Reverse repo": "逆回购",
  "Treasury General Account (TGA)": "财政部一般账户 (TGA)",
  // External-research link labels worth localizing. Brand-name shorthand
  // (Cboe, FRED, MacroMicro, NY Fed, etc.) is intentionally left untouched
  // since Mainland press also surfaces those names in Roman characters.
  "Announcements": "公告",
  "Federal Reserve": "美联储",
  // PageInsight route titles (routeInsight.title).
  "Volatility": "波动率",
  "Rates": "利率",
  "Credit": "信用",
  "Liquidity": "流动性",
  "Dollar / Global": "美元 / 全球",
  "Commodities": "大宗商品",
  "Inflation": "通胀",
  "Growth": "增长",
  "Housing": "住房",
  "Sentiment": "情绪",
  "Fragility / shock risk": "脆弱度 / 冲击风险",
  "Tactical trading weather": "战术交易天气",
  "Regime map": "市场状态图",
};
