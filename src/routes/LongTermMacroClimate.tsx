import { useEffect, useState } from "react";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import ScoreCard from "../components/ScoreCard";
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
    ids: ["cfnai", "industrial_production"],
    label: "Growth cycle",
    summary: "Activity breadth and production inputs describe the growth portion of the macro climate score."
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
        <h2>Long-Term Macro Climate</h2>
        <p>Macro Climate score, strategic bucket context, and yield-decomposition history.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <section className="score-grid" aria-label="Macro climate score">
            <ScoreCard score={data.scoreSummary.scores.macro_climate} title="Macro Climate" />
          </section>
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
  const score = scoreSummary.scores.macro_climate.bucket_scores[bucket];
  return typeof score === "number" && Number.isFinite(score) ? score.toFixed(1) : "N/A";
}
