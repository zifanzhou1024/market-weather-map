import { useEffect, useState } from "react";
import CandidateSourcePanel, { type CandidateSourceItem } from "../CandidateSourcePanel";
import DataStatusTable from "../DataStatusTable";
import FocusBlock from "../FocusBlock";
import InterpretationPanel from "../InterpretationPanel";
import MetricCard from "../MetricCard";
import MultiSeriesChart, { type MultiSeriesChartSeries } from "../MultiSeriesChart";
import PageInsightHero from "../PageInsightHero";
import PercentileBandChart from "../PercentileBandChart";
import RouteDataFooter from "../RouteDataFooter";
import SourceNote from "../SourceNote";
import TimeSeriesChart from "../TimeSeriesChart";
import VixCurveTermStructureChart from "../charts/VixCurveTermStructureChart";
import VixFuturesReadinessPanel from "../VixFuturesReadinessPanel";
import VixRatioHistoryChart from "../charts/VixRatioHistoryChart";
import VolatilityHiddenStressChart from "../charts/VolatilityHiddenStressChart";
import { applyCandidateDisplayOverride } from "../../lib/candidateDisplay";
import { loadCatalog, loadDataStatus, loadPageInsights, loadSeries, loadVolatilityDashboard } from "../../lib/data";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  PageInsightsFile,
  SeriesCatalogEntry,
  TimeSeriesFile,
  VolatilityDashboardFile
} from "../../lib/types";
import { loadRouteDerivedSeries } from "../../routes/routeSeries";

const volatilitySeriesIds = ["vix", "vvix", "vix9d", "vix3m"];
const volatilityDerivedIds = ["vix9d_vix_ratio", "vix_vix3m_ratio"];
const volatilityMissingSourceIds = [
  "move_index",
  "skew_index",
  "put_call_total",
  "put_call_spxw",
  "vx_futures_curve"
];
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
    units: series.units,
    access_status: "free_public_active",
    terms_status: "ok",
    score_status: "active",
    active_scoring_allowed: true,
    public_redistribution_allowed: true,
    requires_secret: false
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

    return applyCandidateDisplayOverride({
      id,
      label: entry?.name ?? id,
      note: statusRow?.message ?? entry?.notes ?? "Source review required.",
      status: statusRow?.status ?? fallbackCandidateStatus(entry)
    });
  });
}

export default function VolatilityTab() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageInsights, setPageInsights] = useState<PageInsightsFile | null>(null);

  useEffect(() => {
    let active = true;

    loadPageInsights()
      .then((result) => {
        if (active) setPageInsights(result);
      })
      .catch(() => {
        // pageInsights is optional — swallow errors; FocusBlock will not render
      });

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
    <section data-testid="volatility-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="volatility" />
          {(() => {
            const section = pageInsights?.routes?.volatility?.sections?.find(
              (s) => s.id === "volatility_complex"
            );
            return section ? (
              <FocusBlock
                variant="section"
                sectionId={section.id}
                eyebrow={section.eyebrow}
                question={section.question}
                answer={section.answer}
                why={section.why}
                risk={section.risk}
                support={section.support}
                caveat={section.caveat}
                freshnessStatus={section.freshness_status}
              />
            ) : null;
          })()}
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
            <CandidateSourcePanel
              eyebrow="External data links"
              items={candidateItems(data.catalog, data.status, volatilityMissingSourceIds)}
              summary="Important volatility and tail-risk inputs that remain gated or unimplemented are linked here for manual review."
              title="Missing volatility data links"
            />
            <VixFuturesReadinessPanel
              items={candidateItems(data.catalog, data.status, vxCandidateIds)}
              title="VX futures curve"
            />
            <DataStatusTable seriesIds={volatilityStatusIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </section>
  );
}
