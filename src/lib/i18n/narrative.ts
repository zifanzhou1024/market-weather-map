// src/lib/i18n/narrative.ts
//
// Best-effort template matcher for Python-emitted driver narrative prose
// (`signal.message`, `signal.why_it_matters`, `routeInsight.why_it_matters`).
//
// Per the i18n tier policy this is Tier 3: full-sentence narrative localization
// would require Python pipeline changes. As a compromise the matcher recognizes
// 10-15 common emission templates that cover the majority of paragraphs in
// `signal_priority.json` and `page_insights.json`, returning a Chinese
// equivalent. Anything that doesn't match falls back to the raw English text;
// callers should render the fallback with `lang="en"` so screen readers and
// CSS hooks treat it as a foreign string.
//
// Add a new template here when:
//   1. The Python pipeline starts emitting a new common sentence structure.
//   2. The current English wording is stable enough that a regex with one or
//      two captured subjects produces an idiomatic Chinese translation.
//
// Caveat: template ordering matters — more specific patterns must precede
// looser catch-alls. Each pattern is `^…$` anchored.

export interface NarrativeTemplate {
  pattern: RegExp;
  zh: string;
}

// Exact-string overrides for short stock phrases that don't fit any template.
// Keep this list small — prefer template patterns where possible.
export const NARRATIVE_OVERRIDES: Record<string, string> = {
  "Candidate source requires access or terms review before scoring.":
    "该候选源需在评分前完成访问与条款审核。",
  "No top active warnings in the current snapshot.":
    "当前快照中没有首要活跃警告。",
  "No top active supports in the current snapshot.":
    "当前快照中没有首要活跃支撑。",
};

// Common subject translations used inside template substitutions. The matcher
// looks up the captured subject text here (case-insensitive trim); unknown
// subjects fall through as-is and the template still produces a working
// sentence (the English noun phrase will appear inline).
const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "real yields": "实际收益率",
  "10y real yields": "10年期实际收益率",
  "inflation pressure": "通胀压力",
  "inflation trajectory": "通胀走势",
  "credit spread pressure": "信用利差压力",
  "credit spreads": "信用利差",
  "labor cycle": "就业周期",
  "net liquidity": "净流动性",
  "volatility tail risk": "波动率尾部风险",
  "vix curve": "VIX 曲线",
  "the broad dollar backdrop": "广义美元背景",
  "broad dollar": "广义美元",
  "growth inputs": "增长指标",
  "growth conditions": "增长环境",
  "consumer balance-sheet stress": "消费者资产负债表压力",
  "leveraged-money s&p 500 positioning": "杠杆资金标普500持仓",
  "commodity inflation impulse": "大宗商品通胀脉冲",
  "commodity-driven inflation impulse": "大宗商品驱动的通胀脉冲",
  "implied equity volatility": "隐含股票波动率",
  "higher real yields": "实际收益率走高",
  "dollar moves": "美元波动",
  "crowded leveraged-money positioning": "杠杆资金持仓拥挤",
  "valuations": "估值",
  "valuation-sensitive assets": "估值敏感资产",
  "risk assets": "风险资产",
  "liquidity drains": "流动性流失",
  "consumer and production inputs": "消费与生产指标",
  "the broad dollar": "广义美元",
  "dollar backdrop": "美元背景",
  "the dollar backdrop": "美元背景",
  // Single-word subjects that appear when patterns capture only the noun
  // prefix (e.g. "Volatility tail risk is elevated." captures "Volatility").
  "inflation": "通胀",
  "volatility": "波动率",
  "commodity": "大宗商品",
  "dollar": "美元",
  "consumer": "消费者",
  "growth": "增长",
  "labor": "就业",
  "labor cycle data": "就业周期数据",
  "leveraged-money positioning": "杠杆资金持仓",
  // why-it-matters subjects.
  "fed policy expectations and real-yield direction": "美联储政策预期与实际收益率走向",
  "the strategic recession-risk and consumer-income read": "战略衰退风险与消费者收入读数",
  "near-term equity stress and dealer hedging pressure": "近期股票压力与做市商对冲压力",
  "acute near-term event risk and dealer-driven stress": "近期急性事件风险与做市商驱动的压力",
  "the funding backdrop for risk assets and dealer balance sheets": "风险资产与做市商资产负债表的资金面背景",
  "drawdowns when sentiment turns": "情绪反转时的回撤",
  "global liquidity and risk-off pressure across asset classes": "跨资产类别的全球流动性与避险压力",
  "the strategic backdrop for risk assets and recession risk": "风险资产与衰退风险的战略背景",
  "the strategic late-cycle and recession-risk read": "战略晚周期与衰退风险读数",
};

function translateSubject(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return subject;
  const direct = SUBJECT_TRANSLATIONS[trimmed.toLowerCase()];
  return direct ?? trimmed;
}

// Template patterns — most specific first. Each pattern uses one or two
// capture groups; `zh` may reference them via $1 / $2 (post-translation).
const TEMPLATES: NarrativeTemplate[] = [
  // "X are elevated and pressuring valuations."
  {
    pattern: /^(.+?) are elevated and pressuring valuations\.$/i,
    zh: "$1 处于高位,对估值形成压力。",
  },
  // "X is elevated and pressuring valuations."
  {
    pattern: /^(.+?) is elevated and pressuring valuations\.$/i,
    zh: "$1 处于高位,对估值形成压力。",
  },
  // "X remains elevated."
  {
    pattern: /^(.+?) remains elevated\.$/i,
    zh: "$1 持续处于高位。",
  },
  // "X are elevated."  (e.g. "Real yields are elevated.")
  {
    pattern: /^(.+?) are elevated\.$/i,
    zh: "$1 处于高位。",
  },
  // "X tail risk is elevated."
  {
    pattern: /^(.+?) tail risk is elevated\.$/i,
    zh: "$1 尾部风险升高。",
  },
  // "X is contango-proxy and calm."
  {
    pattern: /^(.+?) is contango-proxy and calm\.$/i,
    zh: "$1 呈升水代理,整体平静。",
  },
  // "X is draining."
  {
    pattern: /^(.+?) is draining\.$/i,
    zh: "$1 正在流失。",
  },
  // "X is easing."
  {
    pattern: /^(.+?) is easing\.$/i,
    zh: "$1 正在缓和。",
  },
  // "X is crowded."
  {
    pattern: /^(.+?) is crowded\.$/i,
    zh: "$1 拥挤。",
  },
  // "X is firm."
  {
    pattern: /^(.+?) is firm\.$/i,
    zh: "$1 表现稳健。",
  },
  // "X are firm."
  {
    pattern: /^(.+?) are firm\.$/i,
    zh: "$1 表现稳健。",
  },
  // "X is contained."
  {
    pattern: /^(.+?) is contained\.$/i,
    zh: "$1 处于受控状态。",
  },
  // "X are contained."
  {
    pattern: /^(.+?) are contained\.$/i,
    zh: "$1 处于受控状态。",
  },
  // "X are limited."  (e.g. "Liquidity drains are limited.")
  {
    pattern: /^(.+?) are limited\.$/i,
    zh: "$1 较为有限。",
  },
  // "X is limited."
  {
    pattern: /^(.+?) is limited\.$/i,
    zh: "$1 较为有限。",
  },
  // "X is elevated."  (must come AFTER the "elevated and pressuring" pattern)
  {
    pattern: /^(.+?) is elevated\.$/i,
    zh: "$1 处于高位。",
  },
  // "X are supportive."
  {
    pattern: /^(.+?) are supportive\.$/i,
    zh: "$1 偏支撑。",
  },
  // "X backdrop is easing." (more specific than X is easing)
  {
    pattern: /^(.+?) backdrop is easing\.$/i,
    zh: "$1 背景正在缓和。",
  },
  // "The X is easing." / "The X is draining." — strip leading "The " then
  // delegate to standard patterns. We special-case it inline to keep the
  // matcher flat.
  {
    pattern: /^The (.+?) is easing\.$/i,
    zh: "$1 正在缓和。",
  },
  {
    pattern: /^The (.+?) is draining\.$/i,
    zh: "$1 正在流失。",
  },
  {
    pattern: /^The (.+?) is elevated\.$/i,
    zh: "$1 处于高位。",
  },
  {
    pattern: /^The (.+?) backdrop is easing\.$/i,
    zh: "$1 背景正在缓和。",
  },

  // why_it_matters templates ---------------------------------------------
  // "Higher X tighten financial conditions and weigh on Y."
  {
    pattern: /^Higher (.+?) tighten financial conditions and weigh on (.+?)\.$/i,
    zh: "$1走高会收紧金融条件并压制 $2。",
  },
  // "X trajectory drives Y."
  {
    pattern: /^(.+?) trajectory drives (.+?)\.$/i,
    zh: "$1 走势驱动 $2。",
  },
  // "X drives Y."  (broader catch-all after specific drivers)
  {
    pattern: /^(.+?) drives (.+?)\.$/i,
    zh: "$1 驱动 $2。",
  },
  // "Crowded X amplifies drawdowns when sentiment turns."
  {
    pattern: /^Crowded (.+?) amplifies drawdowns when sentiment turns\.$/i,
    zh: "拥挤的 $1 在情绪反转时会放大回撤。",
  },
  // "X-driven inflation impulse pressures rates and discount-rate-sensitive assets."
  {
    pattern: /^(.+?)-driven inflation impulse pressures rates and discount-rate-sensitive assets\.$/i,
    zh: "$1 驱动的通胀脉冲对利率和贴现率敏感资产形成压力。",
  },
  // "X defines the funding backdrop for risk assets and dealer balance sheets."
  {
    pattern: /^(.+?) defines the funding backdrop for risk assets and dealer balance sheets\.$/i,
    zh: "$1 定义了风险资产与做市商资产负债表的资金面背景。",
  },
  // "X confirm whether stress is spreading beyond equities into corporate funding markets."
  {
    pattern: /^(.+?) confirm whether stress is spreading beyond equities into corporate funding markets\.$/i,
    zh: "$1 用于确认压力是否从股票市场扩散至企业融资市场。",
  },
  // "X data drives the strategic Y read."
  {
    pattern: /^(.+?) data drives the strategic (.+?) read\.$/i,
    zh: "$1 数据驱动战略 $2 读数。",
  },
  // "X moves transmit global liquidity and risk-off pressure across asset classes."
  {
    pattern: /^(.+?) moves transmit global liquidity and risk-off pressure across asset classes\.$/i,
    zh: "$1 的波动会跨资产类别传导全球流动性和避险压力。",
  },
  // "Broad X conditions set the strategic backdrop for risk assets and recession risk."
  {
    pattern: /^Broad (.+?) conditions set the strategic backdrop for risk assets and recession risk\.$/i,
    zh: "整体 $1 环境为风险资产与衰退风险提供战略背景。",
  },
  // "X fragility shapes the strategic late-cycle and recession-risk read."
  {
    pattern: /^(.+?) fragility shapes the strategic late-cycle and recession-risk read\.$/i,
    zh: "$1 脆弱性塑造战略晚周期与衰退风险读数。",
  },
  // "Implied equity volatility frames near-term equity stress and dealer hedging pressure."
  {
    pattern: /^Implied equity volatility frames near-term equity stress and dealer hedging pressure\.$/i,
    zh: "隐含股票波动率界定近期股票压力与做市商对冲压力。",
  },
  // "VIX curve backwardation flags acute near-term event risk and dealer-driven stress."
  {
    pattern: /^VIX curve backwardation flags acute near-term event risk and dealer-driven stress\.$/i,
    zh: "VIX 曲线倒挂提示近期急性事件风险与做市商驱动的压力。",
  },
];

/**
 * Best-effort narrative translator. Under `en` returns the input unchanged.
 * Under `zh`:
 *   1. Returns NARRATIVE_OVERRIDES[text] when present.
 *   2. Matches against TEMPLATES in order; on match, substitutes the
 *      captured subject(s) via SUBJECT_TRANSLATIONS and returns the zh
 *      template.
 *   3. Falls back to the input text (caller should render with `lang="en"`).
 *
 * The boolean second tuple element (`matched`) lets callers know whether
 * to wrap the rendered string in `<span lang="en">` for the unmatched case.
 */
export function tNarrative(
  text: string | null | undefined,
  locale: "en" | "zh"
): { text: string; matched: boolean } {
  if (text == null) return { text: "", matched: true };
  const trimmed = text.trim();
  if (!trimmed) return { text, matched: true };
  if (locale !== "zh") return { text, matched: true };

  const override = NARRATIVE_OVERRIDES[trimmed];
  if (override !== undefined) return { text: override, matched: true };

  for (const tmpl of TEMPLATES) {
    const match = trimmed.match(tmpl.pattern);
    if (!match) continue;
    let zhText = tmpl.zh;
    // Replace $1, $2 with translated capture groups.
    for (let i = 1; i < match.length; i += 1) {
      const captured = match[i] ?? "";
      const translated = translateSubject(captured);
      zhText = zhText.replace(new RegExp(`\\$${i}`, "g"), translated);
    }
    return { text: zhText, matched: true };
  }

  return { text, matched: false };
}
