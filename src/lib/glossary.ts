/**
 * Curated plain-English definitions for cockpit jargon.
 *
 * Design notes:
 * - Keys are case-sensitive — labels in cockpit.json render verbatim, so the
 *   keys must match the visible label exactly (including capitalization and
 *   non-ASCII characters like the minus sign in "10Y−2Y").
 * - Definitions are kept short (≤ 200 chars by guard test) so the native
 *   `<abbr title>` browser tooltip stays readable. The tooltip is the only
 *   surface for now; no popover library, no custom UI.
 * - Curated, not regex-matched. We wrap explicit labels at known sites
 *   (cockpit cell labels, unit suffixes, secondary value labels) — auto-
 *   wrapping arbitrary text risks false positives ("PCE" inside "PCE-based"
 *   etc.).
 * - Gated sources (MOVE, SKEW, SLOOS) get definitions so that if/when the
 *   labels surface in candidate panels the glossary is already in place.
 * - Each entry carries both `en` and `zh` strings so the `<abbr title>`
 *   tooltip switches with the active locale (see `GlossaryTerm`). Keys stay
 *   canonical English so cockpit JSON labels match without translation.
 */
import type { Locale } from "./i18n";

export interface GlossaryEntry {
  en: string;
  zh: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // Volatility complex
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

  // Rates / yields
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

  // Credit
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

  // Macro
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

  // Liquidity / FX / sentiment
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

  // Gated (acknowledge but mark as not-yet-shown)
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

  // Units / shorthand
  bp: { en: "Basis point — 1/100th of one percent (0.01%).", zh: "基点 — 百分之一的百分之一 (0.01%)。" },
  pp: { en: "Percentage point — absolute difference between two percentages.", zh: "百分点 — 两个百分比之间的绝对差值。" },
  "% YoY": { en: "Percent year-over-year — value compared to 12 months ago.", zh: "同比百分比 — 相对12个月前的数值变化。" },
  "k m/m": { en: "Thousands, month-over-month change.", zh: "千人,环比变化。" },
  "m/m": { en: "Month-over-month change.", zh: "环比变化。" },
  "Δ7d": { en: "Change vs the most recent observation at least 7 calendar days ago.", zh: "相对最近至少7个自然日前观测值的变化。" },
  "Δ1m": { en: "Change vs the most recent observation at least 30 calendar days ago.", zh: "相对最近至少30个自然日前观测值的变化。" },
  pct: { en: "Percentile — rank of the current value within its historical distribution.", zh: "百分位 — 当前值在历史分布中的排名。" },
  pctile: { en: "Percentile.", zh: "百分位。" },

  // Cadence pills — used by the /diff route to explain why some windows
  // show null deltas (e.g. weekly series in the 1d window).
  daily: { en: "Series updates once per business day.", zh: "数据每个工作日更新一次。" },
  weekly: { en: "Series updates once per week.", zh: "数据每周更新一次。" },
  monthly: { en: "Series updates once per month.", zh: "数据每月更新一次。" },
  quarterly: { en: "Series updates once per quarter.", zh: "数据每季度更新一次。" },

  // Data quality banner — categorical tier pill + expand details.
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

/**
 * Look up a glossary definition by exact key.
 *
 * Case-sensitive on purpose — labels in the cockpit JSON render verbatim, so
 * keys are written to match the visible label exactly. Returns `undefined`
 * when the term is not in the glossary so callers can fall through to
 * rendering the bare label. The optional `locale` defaults to `"en"` so
 * existing callers continue to compile without change.
 */
export function lookupGlossary(term: string, locale: Locale = "en"): string | undefined {
  const entry = GLOSSARY[term];
  if (!entry) return undefined;
  return locale === "zh" ? entry.zh : entry.en;
}
