import { useEffect, useState } from "react";
import DataGapPanel from "../components/DataGapPanel";
import DataQualityBanner from "../components/DataQualityBanner";
import DataStatusTable from "../components/DataStatusTable";
import HorizonScoreHeader from "../components/HorizonScoreHeader";
import InterpretationPanel from "../components/InterpretationPanel";
import MacroCyclePanel from "../components/MacroCyclePanel";
import MetricCard from "../components/MetricCard";
import ScoreCard from "../components/ScoreCard";
import StrategicSourceGapsPanel from "../components/StrategicSourceGapsPanel";
import YieldDecompositionChart from "../components/YieldDecompositionChart";
import {
  loadCatalog,
  loadDataStatus,
  loadRegimeSnapshot,
  loadScoreSummary
} from "../lib/data";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  RegimeSnapshotFile,
  ScoreSummaryFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../lib/types";
import { loadRouteDerivedSeries, loadRouteSeries } from "./routeSeries";

const macroGroups = [
  {
    ids: ["cfnai", "cfnai_3m_avg"],
    label: "Growth cycle",
    summary: "Activity breadth inputs describe the growth portion of the macro climate score."
  },
  {
    ids: ["real_retail_sales", "industrial_production", "durable_goods_orders"],
    label: "Consumer and production",
    summary: "Retail sales, industrial production, and durable goods describe the consumer-production bucket."
  },
  {
    ids: ["unemployment_rate", "initial_claims"],
    label: "Labor cycle",
    summary: "Unemployment and claims inputs describe labor-cycle pressure."
  },
  {
    ids: ["headline_cpi", "core_pce", "breakeven_10y"],
    label: "Inflation trend",
    summary: "Inflation and breakeven inputs describe price-pressure context."
  },
  {
    ids: ["housing_starts", "building_permits", "mortgage_rate_30y"],
    label: "Housing cycle",
    summary: "Starts, permits, and mortgage rates describe the housing portion of the strategic backdrop."
  },
  {
    ids: ["household_debt_service_ratio", "consumer_debt_service_ratio", "credit_card_delinquency_rate"],
    label: "Consumer balance sheet",
    summary: "Debt-service ratios and credit-card delinquencies describe household balance-sheet pressure."
  },
  {
    ids: ["high_yield_oas", "bbb_oas", "financial_conditions"],
    label: "Credit cycle",
    summary: "Credit spreads and financial conditions describe private-market stress."
  },
  {
    ids: ["fed_assets", "reserve_balances"],
    label: "Liquidity cycle",
    summary: "Balance-sheet liquidity and reserves describe funding-cycle context."
  }
] as const;

const ratesIds = ["real_yield_10y"];
const macroSeriesIds = [...macroGroups.flatMap((group) => group.ids), ...ratesIds];
const macroDerivedIds = ["net_liquidity"];
const macroStatusIds = [...macroSeriesIds, ...macroDerivedIds];

const macroCyclePanels = [
  {
    bucket: "growth",
    caveat: "Active public activity data only; PMI breadth remains source-gated until governance promotes a public endpoint.",
    risks: ["Weak activity breadth or production deterioration would pressure this panel."],
    supports: ["CFNAI and industrial production provide public growth-cycle context."],
    title: "Growth cycle"
  },
  {
    bucket: "labor",
    caveat: "Labor series update on mixed weekly and monthly schedules, so stale-release windows can affect the read.",
    risks: ["Rising unemployment or claims would add labor-cycle pressure."],
    supports: ["Unemployment and claims inputs provide public labor-cycle context."],
    title: "Labor cycle"
  },
  {
    bucket: "inflation",
    caveat: "Inflation data is release-lagged; breakevens provide market context but not a forecast.",
    risks: ["Sticky realized inflation or rising breakevens would pressure this panel."],
    supports: ["CPI, PCE, and breakevens describe active inflation trend context."],
    title: "Inflation trend"
  },
  {
    bucket: "consumer_production",
    caveat: "Monthly consumer and production series can be revised and may lag turning points.",
    risks: ["Weak retail sales, production, or durable-goods momentum would pressure this panel."],
    supports: ["Retail sales, industrial production, and durable goods describe public production-cycle context."],
    title: "Consumer and production"
  },
  {
    bucket: "housing",
    caveat: "Active public FRED housing data only; private housing-credit and affordability sources are not scored.",
    risks: ["Elevated mortgage rates can offset starts and permits strength."],
    supports: ["Housing starts and building permits describe active housing-cycle momentum."],
    title: "Housing cycle"
  },
  {
    bucket: "consumer_balance_sheet",
    caveat: "Quarterly debt-service and delinquency data can lag turning points in consumer stress.",
    risks: ["Higher debt-service ratios or credit-card delinquencies would pressure this panel."],
    supports: ["Household and consumer debt-service ratios describe public balance-sheet context."],
    title: "Consumer balance sheet"
  },
  {
    bucket: "real_yields",
    caveat: "Valuation, earnings revisions, and term-premium inputs remain candidate-only source gates.",
    risks: ["Higher real yields can add valuation pressure to the strategic backdrop."],
    supports: ["Real-yield easing would reduce valuation pressure in this panel."],
    title: "Real-rate valuation pressure"
  }
] as const;

interface RouteState {
  catalog: SeriesCatalogEntry[];
  netLiquidity: DerivedSeriesFile;
  scoreSummary: ScoreSummaryFile;
  series: TimeSeriesFile[];
  snapshot: RegimeSnapshotFile;
  status: DataStatusFile;
}

function netLiquidityCatalogEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "liquidity",
    frequency: series.frequency,
    higher_is: "supportive",
    id: series.series_id,
    max_stale_days: 14,
    name: "Net liquidity proxy",
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units
  };
}

export default function LongTermMacroClimate() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLongTermMacroClimate() {
      try {
        const [catalog, status, scoreSummary, snapshot] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          loadScoreSummary(),
          loadRegimeSnapshot()
        ]);
        const [series, [netLiquidity]] = await Promise.all([
          loadRouteSeries(macroSeriesIds, catalog, status),
          loadRouteDerivedSeries(macroDerivedIds, catalog, status, {
            allowMissing: new Set(macroDerivedIds)
          })
        ]);
        if (active) setData({ catalog, netLiquidity, scoreSummary, series, snapshot, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load macro climate.");
      }
    }

    void loadLongTermMacroClimate();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Strategic</p>
        <h2>Long-Term Macro / Allocation Climate</h2>
        <p>Macro Climate score, strategic bucket context, and yield-decomposition history.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <DataQualityBanner dataQuality={data.scoreSummary.data_quality} />
          <section className="score-grid" aria-label="Macro climate score">
            <ScoreCard score={data.scoreSummary.scores.macro_climate} title="Macro Climate" />
          </section>
          <HorizonScoreHeader
            eyebrow="Strategic read"
            facts={longTermFacts(data.scoreSummary)}
            risks={data.scoreSummary.scores.macro_climate.top_risks}
            score={data.scoreSummary.scores.macro_climate}
            summary="Slow macro data can influence allocation conditions over months or quarters, so this read emphasizes durable public-data pressure and support rather than trade timing."
            supports={data.scoreSummary.scores.macro_climate.top_supports}
            title="Current Long-Term Read"
          />
          <InterpretationPanel
            label="Strategic regime summary"
            notes={data.scoreSummary.scores.macro_climate.missing_or_stale_notes}
            risks={data.scoreSummary.scores.macro_climate.top_risks}
            summary={`Growth ${bucketScore(data.scoreSummary, "growth")}, labor ${bucketScore(
              data.scoreSummary,
              "labor"
            )}, inflation ${bucketScore(data.scoreSummary, "inflation")}, real-yield ${bucketScore(
              data.scoreSummary,
              "real_yields"
            )}.`}
            supports={data.scoreSummary.scores.macro_climate.top_supports}
          />
          <section className="route-stack" aria-labelledby="macro-bucket-grid-heading">
            <div className="section-header">
              <div>
                <p className="eyebrow">Strategic buckets</p>
                <h3 id="macro-bucket-grid-heading">Macro bucket grid</h3>
              </div>
            </div>
            <section className="macro-cycle-grid" aria-label="Strategic macro cycle panels">
              {macroCyclePanels.map((panel) => (
                <MacroCyclePanel
                  caveat={panel.caveat}
                  key={panel.title}
                  label={cycleLabel(bucketScoreValue(data.scoreSummary, panel.bucket))}
                  risks={panel.risks}
                  score={bucketScoreValue(data.scoreSummary, panel.bucket)}
                  supports={panel.supports}
                  title={panel.title}
                />
              ))}
            </section>
          </section>
          <StrategicSourceGapsPanel />
          <YieldDecompositionChart data={data.snapshot.yield_decomposition} />
          {macroGroups.map((group) => (
            <section className="route-stack" key={group.label}>
              <InterpretationPanel
                label={group.label}
                notes={["Strategic data can update at daily, weekly, or monthly frequencies."]}
                summary={group.summary}
                title="Macro panel"
              />
              <section className="metric-grid" aria-label={`${group.label} metrics`}>
                {group.ids.map((seriesId) => {
                  const series = data.series.find((item) => item.series_id === seriesId);
                  return series ? (
                    <MetricCard
                      catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                      key={series.series_id}
                      series={series}
                    />
                  ) : null;
                })}
                {group.label === "Liquidity cycle" ? (
                  <MetricCard catalogEntry={netLiquidityCatalogEntry(data.netLiquidity)} series={data.netLiquidity} />
                ) : null}
              </section>
            </section>
          ))}
          <section className="metric-grid" aria-label="Real-yield metrics">
            {ratesIds.map((seriesId) => {
              const series = data.series.find((item) => item.series_id === seriesId);
              return series ? (
                <MetricCard
                  catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                  key={series.series_id}
                  series={series}
                />
              ) : null;
            })}
          </section>
          <DataGapPanel seriesIds={macroStatusIds} status={data.status} />
          <DataStatusTable seriesIds={macroStatusIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}

function bucketScore(scoreSummary: ScoreSummaryFile, bucket: string) {
  const score = bucketScoreValue(scoreSummary, bucket);
  return typeof score === "number" && Number.isFinite(score) ? score.toFixed(1) : "N/A";
}

function bucketScoreValue(scoreSummary: ScoreSummaryFile, bucket: string) {
  return scoreSummary.scores.macro_climate.bucket_scores[bucket];
}

function longTermFacts(scoreSummary: ScoreSummaryFile) {
  const facts = [
    { label: "Growth", value: bucketScore(scoreSummary, "growth") },
    { label: "Labor", value: bucketScore(scoreSummary, "labor") },
    { label: "Inflation", value: bucketScore(scoreSummary, "inflation") },
    { label: "Real yields", value: bucketScore(scoreSummary, "real_yields") }
  ];
  const optionalBuckets = [
    { bucket: "credit_cycle", label: "Credit cycle" },
    { bucket: "liquidity_cycle", label: "Liquidity cycle" }
  ];

  optionalBuckets.forEach((item) => {
    const score = bucketScoreValue(scoreSummary, item.bucket);
    if (typeof score === "number" && Number.isFinite(score)) {
      facts.push({ label: item.label, value: score.toFixed(1) });
    }
  });

  return facts;
}

function cycleLabel(score: number | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "Not scored";
  if (score >= 15) return "Supportive";
  if (score <= -15) return "Pressure";
  return "Mixed";
}
