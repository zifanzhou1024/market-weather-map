export interface ExternalResearchLink {
  label: string;
  url: string;
}

const MOVE_LINKS: ExternalResearchLink[] = [
  { label: "MacroMicro chart", url: "https://en.macromicro.me/charts/131635/us-treasury-move-index" },
  { label: "MacroMicro series", url: "https://en.macromicro.me/series/17581/us-treasury-move-index" },
  { label: "Yahoo", url: "https://finance.yahoo.com/quote/%5EMOVE/" },
  {
    label: "ICE",
    url: "https://developer.ice.com/fixed-income-data-services/catalog/ice-data-indices-move-index"
  },
  { label: "TradingView", url: "https://www.tradingview.com/symbols/TVC-MOVE/" }
];

const SKEW_LINKS: ExternalResearchLink[] = [
  { label: "MacroMicro", url: "https://en.macromicro.me/series/4407/cboe-skew" },
  { label: "Yahoo", url: "https://finance.yahoo.com/quote/%5ESKEW/" },
  { label: "Cboe", url: "https://www.cboe.com/us/indices/dashboard/SKEW/" },
  { label: "TradingView", url: "https://www.tradingview.com/symbols/CBOE-SKEW/" }
];

const PUT_CALL_TOTAL_LINKS: ExternalResearchLink[] = [
  { label: "MacroMicro", url: "https://en.macromicro.me/series/1650/us-put-call-ratio-total" },
  { label: "Cboe", url: "https://www.cboe.com/us/options/market_statistics/daily/" },
  { label: "TradingView", url: "https://www.tradingview.com/symbols/USI-PCC/" }
];

const PUT_CALL_SPXW_LINKS: ExternalResearchLink[] = [
  { label: "MacroMicro index", url: "https://en.macromicro.me/series/1651/us-put-call-ratio-index" },
  { label: "Cboe", url: "https://www.cboe.com/us/options/market_statistics/daily/" },
  { label: "YCharts SPX", url: "https://ycharts.com/indicators/cboe_spx_put_call_ratio" },
  { label: "TradingView", url: "https://www.tradingview.com/symbols/USI-PCC/" }
];

const VX_FUTURES_LINKS: ExternalResearchLink[] = [
  {
    label: "MacroMicro",
    url: "https://en.macromicro.me/series/22520/sp500-vix-future-price-continuous-month-1"
  },
  { label: "Cboe product", url: "https://www.cboe.com/tradable_products/vix/vix_futures/" },
  { label: "Cboe settlement", url: "https://www.cboe.com/markets/us/futures/market-statistics/settlement/futures/daily/" },
  { label: "TradingView VX1", url: "https://www.tradingview.com/symbols/CBOE-VX1%21/" }
];

const NET_LIQUIDITY_LINKS: ExternalResearchLink[] = [
  { label: "Fed assets", url: "https://fred.stlouisfed.org/series/WALCL" },
  { label: "Treasury General Account", url: "https://fred.stlouisfed.org/series/WTREGEN" },
  { label: "Reverse repo", url: "https://fred.stlouisfed.org/series/RRPONTSYD" }
];

const STRATEGIC_LINKS: Record<string, ExternalResearchLink[]> = {
  aaii_sentiment_candidate: [
    {
      label: "MacroMicro",
      url: "https://en.macromicro.me/collections/34/us-stock-relative/116484/us-aaii-investor-sentiment-survey"
    },
    { label: "AAII", url: "https://sentiment.aaii.com/" }
  ],
  auction_tail: [
    { label: "TreasuryDirect", url: "https://treasurydirect.gov/auctions/results/" },
    {
      label: "Announcements",
      url: "https://www.treasurydirect.gov/auctions/announcements-data-results/"
    }
  ],
  bid_to_cover: [
    { label: "TreasuryDirect", url: "https://treasurydirect.gov/auctions/results/" },
    {
      label: "Announcements",
      url: "https://www.treasurydirect.gov/auctions/announcements-data-results/"
    }
  ],
  cape: [
    {
      label: "MacroMicro",
      url: "https://en.macromicro.me/collections/34/us-stock-relative/45614/sp500-shiller-cape-ratio"
    },
    { label: "Shiller", url: "https://shillerdata.com/" }
  ],
  cape_ratio: [
    {
      label: "MacroMicro",
      url: "https://en.macromicro.me/collections/34/us-stock-relative/45614/sp500-shiller-cape-ratio"
    },
    { label: "Shiller", url: "https://shillerdata.com/" }
  ],
  earnings_revision_breadth: [
    {
      label: "S&P Global",
      url: "https://www.spglobal.com/market-intelligence/en/solutions/products/market-intelligence-platform"
    },
    { label: "FactSet", url: "https://www.factset.com/" }
  ],
  equity_risk_premium: [
    {
      label: "Damodaran",
      url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/implpr.html"
    }
  ],
  fiscal_deficit_interest_expense: [
    { label: "FiscalData", url: "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/" },
    { label: "TreasuryDirect", url: "https://treasurydirect.gov/" }
  ],
  forward_pe: [
    { label: "MacroMicro", url: "https://en.macromicro.me/charts/27100/sp500-forward-pe-ratio" }
  ],
  naaim_exposure_candidate: [
    { label: "NAAIM", url: "https://naaim.org/programs/naaim-exposure-index/" }
  ],
  ny_fed_acm_term_premium: [
    { label: "NY Fed", url: "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs" }
  ],
  pmis: [
    {
      label: "ISM",
      url: "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/"
    }
  ],
  sloos_promotion: [
    { label: "Federal Reserve", url: "https://www.federalreserve.gov/data/sloos.htm" },
    {
      label: "FRED",
      url: "https://fred.stlouisfed.org/searchresults/?search_type=series&search=SLOOS"
    }
  ],
  sloos_scoring_promotion: [
    { label: "Federal Reserve", url: "https://www.federalreserve.gov/data/sloos.htm" },
    {
      label: "FRED",
      url: "https://fred.stlouisfed.org/searchresults/?search_type=series&search=SLOOS"
    }
  ],
  term_premium_acm: [
    { label: "NY Fed", url: "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs" }
  ],
  term_premium_acm_10y: [
    { label: "NY Fed", url: "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs" }
  ],
  treasury_net_issuance: [
    {
      label: "TreasuryDirect",
      url: "https://www.treasurydirect.gov/auctions/announcements-data-results/"
    },
    { label: "FiscalData", url: "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/" }
  ]
};

const LINK_MAP: Record<string, ExternalResearchLink[]> = {
  move_index: MOVE_LINKS,
  tradingview_move_candidate: MOVE_LINKS,
  skew_index: SKEW_LINKS,
  put_call_total: PUT_CALL_TOTAL_LINKS,
  put_call_total_candidate: PUT_CALL_TOTAL_LINKS,
  put_call_spxw: PUT_CALL_SPXW_LINKS,
  put_call_spxw_candidate: PUT_CALL_SPXW_LINKS,
  put_call_spx: PUT_CALL_SPXW_LINKS,
  put_call_index: PUT_CALL_SPXW_LINKS,
  put_call_equity: [
    { label: "MacroMicro", url: "https://en.macromicro.me/series/1640/us-put-call-ratio" },
    { label: "Cboe", url: "https://www.cboe.com/us/options/market_statistics/daily/" },
    { label: "TradingView", url: "https://www.tradingview.com/symbols/USI-PCC/" }
  ],
  put_call_vix: [
    { label: "Cboe", url: "https://www.cboe.com/us/options/market_statistics/daily/" },
    { label: "Yahoo VIX", url: "https://finance.yahoo.com/quote/%5EVIX/" },
    { label: "TradingView", url: "https://www.tradingview.com/symbols/USI-PCC/" }
  ],
  put_call_etp: PUT_CALL_TOTAL_LINKS,
  net_liquidity: NET_LIQUIDITY_LINKS,
  fed_assets: [{ label: "FRED", url: "https://fred.stlouisfed.org/series/WALCL" }],
  treasury_general_account: [{ label: "FRED", url: "https://fred.stlouisfed.org/series/WTREGEN" }],
  reverse_repo: [{ label: "FRED", url: "https://fred.stlouisfed.org/series/RRPONTSYD" }],
  vx_futures_curve: VX_FUTURES_LINKS,
  vix_futures_curve: VX_FUTURES_LINKS,
  vx1: VX_FUTURES_LINKS,
  vx2: [
    ...VX_FUTURES_LINKS.slice(0, 2),
    { label: "TradingView VX2", url: "https://www.tradingview.com/symbols/CBOE-VX2%21/" }
  ],
  vx3: [
    ...VX_FUTURES_LINKS.slice(0, 2),
    { label: "TradingView VX3", url: "https://www.tradingview.com/symbols/CBOE-VX3%21/" }
  ],
  vx4: VX_FUTURES_LINKS,
  vx5: VX_FUTURES_LINKS,
  vx6: VX_FUTURES_LINKS,
  vx7: VX_FUTURES_LINKS,
  vx8: VX_FUTURES_LINKS,
  ...STRATEGIC_LINKS
};

export function externalResearchLinksFor(id: string): readonly ExternalResearchLink[] {
  return LINK_MAP[id] ?? [];
}

export function mergeExternalResearchLinks(
  id: string,
  links?: readonly ExternalResearchLink[]
): readonly ExternalResearchLink[] {
  const merged: ExternalResearchLink[] = [];
  const seen = new Set<string>();
  for (const link of [...externalResearchLinksFor(id), ...(links ?? [])]) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    merged.push(link);
  }
  return merged;
}
