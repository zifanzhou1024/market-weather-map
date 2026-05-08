import { useEffect, useState } from "react";
import type { CandidateSourceItem } from "../components/CandidateSourcePanel";
import CrossAssetConfirmationMatrix from "../components/CrossAssetConfirmationMatrix";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import DriverAttributionPanel from "../components/DriverAttributionPanel";
import EventRiskPanel from "../components/EventRiskPanel";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import MultiSeriesChart, { type MultiSeriesChartSeries } from "../components/MultiSeriesChart";
import OptionsSentimentPanel from "../components/OptionsSentimentPanel";
import ScoreCard from "../components/ScoreCard";
import SignalChecklist from "../components/SignalChecklist";
import VixFuturesReadinessPanel from "../components/VixFuturesReadinessPanel";
import { formatNumber } from "../lib/formatters";
import {
  loadCatalog,
  loadDataStatus,
  loadRegimeSnapshot,
  loadScoreHistory,
  loadScoreSummary,
  loadShockRiskSnapshot
} from "../lib/data";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  RegimeSnapshotFile,
  ScoreHistoryFile,
  ScoreSummaryFile,
  ShockRiskSnapshotFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../lib/types";
import { loadRouteDerivedSeries, loadRouteSeries } from "./routeSeries";

const tacticalSeriesIds = [
  "vix",
  "vix9d",
  "vix3m",
  "vvix",
  "high_yield_oas",
  "broad_dollar",
  "real_yield_10y"
];
const tacticalDerivedIds = ["vix9d_vix_ratio", "vix_vix3m_ratio", "hy_minus_ig_oas", "net_liquidity"];
const optionCandidateIds = [
  "put_call_spxw",
  "put_call_spx",
  "put_call_index",
  "put_call_equity",
  "put_call_vix",
  "put_call_etp",
  "put_call_total"
];
const vxCandidateIds = ["vx1", "vx2", "vx3", "vx4", "vx5", "vx6", "vx7", "vx8"];
const eventCandidateIds = [
  "event_cpi",
  "event_fomc",
  "event_payrolls",
  "event_treasury_auction",
  "event_opex"
];
const tacticalStatusIds = [
  ...tacticalSeriesIds,
  ...tacticalDerivedIds,
  ...optionCandidateIds,
  ...eventCandidateIds,
  ...vxCandidateIds
];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  derived: DerivedSeriesFile[];
  scoreHistory: ScoreHistoryFile | null;
  scoreSummary: ScoreSummaryFile;
  series: TimeSeriesFile[];
  shockSnapshot: ShockRiskSnapshotFile;
  snapshot: RegimeSnapshotFile;
  status: DataStatusFile;
}

const chartColors = ["#2f6f73", "#31516b", "#b76f2b", "#7a5b92"];

function derivedCatalogEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  const names: Record<string, string> = {
    hy_minus_ig_oas: "HY minus IG OAS",
    net_liquidity: "Net liquidity proxy",
    vix9d_vix_ratio: "VIX9D / VIX",
    vix_vix3m_ratio: "VIX / VIX3M"
  };
  const categories: Record<string, SeriesCatalogEntry["category"]> = {
    hy_minus_ig_oas: "credit",
    net_liquidity: "liquidity",
    vix9d_vix_ratio: "volatility",
    vix_vix3m_ratio: "volatility"
  };

  return {
    category: categories[series.series_id] ?? "volatility",
    frequency: series.frequency,
    higher_is: "contextual",
    id: series.series_id,
    max_stale_days: series.frequency === "weekly" ? 14 : 7,
    name: names[series.series_id] ?? series.series_id,
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units
  };
}

function toChartSeries(series: TimeSeriesFile[]): MultiSeriesChartSeries[] {
  return series
    .filter((item) => ["vix", "vix9d", "vix3m", "vvix"].includes(item.series_id) && item.observations.length)
    .map((item, index) => ({
      color: chartColors[index % chartColors.length],
      data: item.observations.map((observation) => ({ date: observation.date, value: observation.value })),
      id: item.series_id,
      name: item.series_id.toUpperCase()
    }));
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

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export default function TacticalTradingWeather() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTacticalTradingWeather() {
      try {
        const [catalog, status, scoreSummary, scoreHistory, snapshot, shockSnapshot] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          loadScoreSummary(),
          loadScoreHistory().catch(() => null),
          loadRegimeSnapshot(),
          loadShockRiskSnapshot()
        ]);
        const [series, derived] = await Promise.all([
          loadRouteSeries(tacticalSeriesIds, catalog, status),
          loadRouteDerivedSeries(tacticalDerivedIds, catalog, status, {
            allowMissing: new Set(tacticalDerivedIds)
          })
        ]);
        if (active) {
          setData({ catalog, derived, scoreHistory, scoreSummary, series, shockSnapshot, snapshot, status });
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load tactical trading weather.");
        }
      }
    }

    void loadTacticalTradingWeather();

    return () => {
      active = false;
    };
  }, []);

  const shockSourceGaps = data
    ? safeArray<ShockRiskSnapshotFile["source_gaps"][number]>(data.shockSnapshot.source_gaps)
    : [];
  const shockMismatchWarnings = data
    ? safeArray<ShockRiskSnapshotFile["mismatch_warnings"][number]>(data.shockSnapshot.mismatch_warnings)
    : [];

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Tactical Trading Weather</p>
        <h2>Short-Term Market Reaction</h2>
        <p>Current regime, volatility curve, credit, dollar, real-yield, and liquidity inputs.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <InterpretationPanel
            label={data.snapshot.regime.label}
            notes={data.scoreSummary.conflicting_signals}
            risks={data.scoreSummary.scores.fragility.top_risks}
            summary="The tactical regime combines active volatility, credit, dollar, real-yield, liquidity, and confirmation signals."
            supports={data.scoreSummary.scores.market_weather.top_supports}
            title="Overall tactical regime"
          />
          <section className="score-grid" aria-label="Tactical scores">
            <ScoreCard score={data.scoreSummary.scores.market_weather} title="Market Weather" />
            <ScoreCard score={data.scoreSummary.scores.fragility} title="Fragility" />
          </section>
          {data.scoreHistory ? <DriverAttributionPanel history={data.scoreHistory} /> : null}
          <section className="panel" aria-label="Fragility shock-risk overlay">
            <div className="section-header">
              <div>
                <p className="eyebrow">Fragility overlay</p>
                <h3>{data.shockSnapshot.label}</h3>
                <p>Dedicated shock-risk detail is available on the Fragility page.</p>
              </div>
              <strong className="score-card__value">{formatNumber(data.shockSnapshot.score)}</strong>
            </div>
            <div className="metric-grid">
              <article className="candidate-source-row">
                <div>
                  <h4>Source gaps</h4>
                  <p>{shockSourceGaps.length} gated or unavailable source rows.</p>
                </div>
              </article>
              <article className="candidate-source-row">
                <div>
                  <h4>Mismatch warnings</h4>
                  <p>{shockMismatchWarnings.length} mismatch warning rows.</p>
                </div>
              </article>
            </div>
          </section>
          <div className="section-heading">
            <h3>Daily checklist</h3>
          </div>
          <SignalChecklist items={data.snapshot.checklist} />
          <CrossAssetConfirmationMatrix items={data.snapshot.confirmations} />
          <OptionsSentimentPanel items={candidateItems(data.catalog, data.status, optionCandidateIds)} />
          <EventRiskPanel items={candidateItems(data.catalog, data.status, eventCandidateIds)} />
          <section className="metric-grid" aria-label="Tactical metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
            {data.derived.map((series) => (
              <MetricCard catalogEntry={derivedCatalogEntry(series)} key={series.series_id} series={series} />
            ))}
          </section>
          <MultiSeriesChart
            series={toChartSeries(data.series)}
            title="VIX term-structure proxy"
            units="index"
          />
          <VixFuturesReadinessPanel items={candidateItems(data.catalog, data.status, vxCandidateIds)} />
          <DataGapPanel seriesIds={tacticalStatusIds} status={data.status} />
          <DataStatusTable seriesIds={tacticalStatusIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
