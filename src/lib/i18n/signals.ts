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
  breakeven_10y: "breakeven10y",
  us10y: "treasury10y",
  us_10y: "treasury10y",  // safety alias
  us2y: "treasury2y",
  us_2y: "treasury2y",
  sp500_positioning: "sp500LevMoney",
  sp500_lev_money: "sp500LevMoney",
};
