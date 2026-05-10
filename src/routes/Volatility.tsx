import { useEffect, useState } from "react";
import type { CandidateSourceItem } from "../components/CandidateSourcePanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import MultiSeriesChart, { type MultiSeriesChartSeries } from "../components/MultiSeriesChart";
import PageInsightHero from "../components/PageInsightHero";
import PercentileBandChart from "../components/PercentileBandChart";
import RouteDataFooter from "../components/RouteDataFooter";
import SourceNote from "../components/SourceNote";
import TimeSeriesChart from "../components/TimeSeriesChart";
import VixCurveTermStructureChart from "../components/charts/VixCurveTermStructureChart";
import VixFuturesReadinessPanel from "../components/VixFuturesReadinessPanel";
import VixRatioHistoryChart from "../components/charts/VixRatioHistoryChart";
import VolatilityHiddenStressChart from "../components/charts/VolatilityHiddenStressChart";
import { loadCatalog, loadDataStatus, loadSeries, loadVolatilityDashboard } from "../lib/data";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  SeriesCatalogEntry,
  TimeSeriesFile,
  VolatilityDashboardFile
} from "../lib/types";
import { loadRouteDerivedSeries } from "./routeSeries";

const volatilitySeriesIds = ["vix", "vvix", "vix9d", "vix3m"];
const volatilityDerivedIds = ["vix9d_vix_ratio", "vix_vix3m_ratio"];
const vxCandidateIds = ["vx1", "vx2", "vx3", "vx4", "vx5", "vx6", "vx7", "vx8"];
const volatilityStatusIds = [...volatilitySeriesIds, ...volatilityDerivedIds, ...vxCandidateIds];
const volatilityChartLines = [
  { id: "vix9d", name: "VIX9D", color: "#b76f2b" },
  { id: "vix", name: "VIX", color: "#2f6f73" },
  { id: "vix3m", name: "VIX3M", color: "#31516b" },
  { id: "vvix", name: "VVIX", color: "#7a4f9a" }
] as const;

interface RouteState {
  catalog: SeriesCatalogEntry[];
  derived: DerivedSeriesFile[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
  volDashboard: VolatilityDashboardFile | null;
}

function volatilityDerivedEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "volatility",
    frequency: series.frequency,
    higher_is: "contextual",
    id: series.series_id,
    max_stale_days: 7,
    name: series.series_id === "vix9d_vix_ratio" ? "VIX9D / VIX" : "VIX / VIX3M",
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units
  };
}

function toChartSeries(series: TimeSeriesFile[]): MultiSeriesChartSeries[] {
  return volatilityChartLines.reduce<MultiSeriesChartSeries[]>((chartSeries, line) => {
    const item = series.find((candidate) => candidate.series_id === line.id);
    if (!item?.observations.length) return chartSeries;

    chartSeries.push({
      ...line,
      data: item.observations.map((observation) => ({
        date: observation.date,
        value: observation.value
      }))
    });
    return chartSeries;
  }, []);
}

function latestValue(series: TimeSeriesFile[], seriesId: string) {
  const item = series.find((candidate) => candidate.series_id === seriesId);
  const latestObservation = item?.observations[item.observations.length - 1];
  return item?.summary?.latest_value ?? latestObservation?.value ?? null;
}

function termStructureNotes(series: TimeSeriesFile[]) {
  const vix9d = latestValue(series, "vix9d");
  const vix = latestValue(series, "vix");
  const vix3m = latestValue(series, "vix3m");
  const notes = [
    "VIX3M > VIX: normal / contango-like proxy.",
    "VIX > VIX3M: stress / backwardation-like proxy.",
    "VIX9D > VIX: near-term event-risk pressure."
  ];

  if (typeof vix === "number" && typeof vix3m === "number") {
    notes.push(
      vix3m > vix
        ? "Current read: VIX3M is above VIX."
        : "Current read: VIX is at or above VIX3M."
    );
  }

  if (typeof vix9d === "number" && typeof vix === "number" && vix9d > vix) {
    notes.push("Current read: VIX9D is above VIX.");
  }

  return notes;
}

function fallbackCandidateStatus(entry?: SeriesCatalogEntry) {
  return entry?.access_status ?? entry?.score_status ?? "source_review_required";
}

function candidateItems(
  catalog: SeriesCatalogEntry[],
  status: DataStatusFile,
  ids: string[]
): CandidateSourceItem[] {
  return ids.map((id) => {
    const entry = catalog.find((candidate) => candidate.id === id);
    const statusRow = status.series[id];

    return {
      id,
      label: entry?.name ?? id,
      note: statusRow?.message ?? entry?.notes ?? "Source review required.",
      status: statusRow?.status ?? fallbackCandidateStatus(entry)
    };
  });
}

export default function Volatility() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVolatility() {
      try {
        const [catalog, status, volDashboard] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          loadVolatilityDashboard()
        ]);
        const [series, derived] = await Promise.all([
          Promise.all(volatilitySeriesIds.map((seriesId) => loadSeries(seriesId))),
          loadRouteDerivedSeries(volatilityDerivedIds, [], status, {
            allowMissing: new Set(volatilityDerivedIds)
          })
        ]);
        if (active) setData({ catalog, derived, series, status, volDashboard });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load volatility data.");
      }
    }

    void loadVolatility();

    return () => {
      active = false;
    };
  }, []);

  const vix = data?.series.find((series) => series.series_id === "vix");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Volatility</p>
        <h2>VIX state</h2>
        <p>Delayed Cboe volatility term-structure history with percentile context.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="volatility" />
          {/* SLOT:volatility_primary_chart */}
          {data.volDashboard ? (
            <VixCurveTermStructureChart
              data={data.volDashboard.latest_curve}
              thresholds={data.volDashboard.thresholds}
            />
          ) : (
            <p className="data-loading" role="status">
              Interactive volatility view loading…
            </p>
          )}
          {/* SLOT:volatility_secondary_charts */}
          {data.volDashboard ? (
            <>
              <VixRatioHistoryChart
                data={data.volDashboard.ratio_history}
                thresholds={data.volDashboard.thresholds}
              />
              <VolatilityHiddenStressChart
                data={data.volDashboard.hidden_stress}
                thresholds={data.volDashboard.thresholds}
              />
            </>
          ) : null}
          <InterpretationPanel
            label="Cboe volatility curve"
            summary="Spot VIX, very-short-dated VIX9D, 3-month VIX3M, and VVIX describe equity volatility level, curve shape, and volatility-of-volatility."
            supports={["Lower or contained VIX and VVIX can support risk appetite."]}
            risks={["Elevated front-end volatility or an inverted VIX curve can indicate near-term stress."]}
            notes={["Ratios are derived from matched public Cboe volatility observations."]}
          />
          <InterpretationPanel
            label="VIX term-structure proxy"
            notes={termStructureNotes(data.series)}
            summary="VIX9D, VIX, VIX3M, and VVIX show near-term pressure, spot implied volatility, three-month implied volatility, and volatility-of-volatility."
          />
          <section className="metric-grid" aria-label="Volatility metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
            {data.derived.map((series) => (
              <MetricCard catalogEntry={volatilityDerivedEntry(series)} key={series.series_id} series={series} />
            ))}
          </section>
          {vix ? (
            <>
              <div className="detail-grid">
                <PercentileBandChart percentile={vix.summary?.percentile_252d} />
                <SourceNote catalogEntry={data.catalog.find((entry) => entry.id === "vix")} series={vix} />
              </div>
              <TimeSeriesChart catalogEntry={data.catalog.find((entry) => entry.id === "vix")} series={vix} />
            </>
          ) : null}
          <MultiSeriesChart series={toChartSeries(data.series)} title="VIX term-structure proxy" units="index" />
          <RouteDataFooter route="volatility">
            <VixFuturesReadinessPanel
              items={candidateItems(data.catalog, data.status, vxCandidateIds)}
              title="VX futures curve"
            />
            <DataStatusTable seriesIds={volatilityStatusIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
