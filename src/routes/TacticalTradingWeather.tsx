import { useEffect, useState } from "react";
import type { CandidateSourceItem } from "../components/CandidateSourcePanel";
import CreditPulsePanel from "../components/CreditPulsePanel";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import DollarRealYieldPressurePanel from "../components/DollarRealYieldPressurePanel";
import EventRiskPanel from "../components/EventRiskPanel";
import HorizonScoreHeader from "../components/HorizonScoreHeader";
import LiquidityPulsePanel from "../components/LiquidityPulsePanel";
import type { MultiSeriesChartSeries } from "../components/MultiSeriesChart";
import OptionsSentimentPanel from "../components/OptionsSentimentPanel";
import SignalChecklist from "../components/SignalChecklist";
import VixFuturesReadinessPanel from "../components/VixFuturesReadinessPanel";
import VolatilityTermStructurePanel from "../components/VolatilityTermStructurePanel";
import { scoreLabel } from "../lib/horizon";
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
  scoreSummary: ScoreSummaryFile;
  series: TimeSeriesFile[];
  snapshot: RegimeSnapshotFile;
  status: DataStatusFile;
}

const chartColors = ["#2f6f73", "#31516b", "#b76f2b", "#7a5b92"];

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

function findSeries(series: TimeSeriesFile[], seriesId: string) {
  return series.find((item) => item.series_id === seriesId);
}

function findDerived(derived: DerivedSeriesFile[], seriesId: string) {
  return derived.find((item) => item.series_id === seriesId);
}

function driverLabel(driver: RegimeSnapshotFile["regime"]["yield_driver"]) {
  return driver.replace(/_/g, " ");
}

export default function TacticalTradingWeather() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTacticalTradingWeather() {
      try {
        const [catalog, status, scoreSummary, snapshot] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          loadScoreSummary(),
          loadRegimeSnapshot()
        ]);
        const [series, derived] = await Promise.all([
          loadRouteSeries(tacticalSeriesIds, catalog, status),
          loadRouteDerivedSeries(tacticalDerivedIds, catalog, status, {
            allowMissing: new Set(tacticalDerivedIds)
          })
        ]);
        if (active) {
          setData({ catalog, derived, scoreSummary, series, snapshot, status });
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
          <HorizonScoreHeader
            eyebrow="Short-term"
            facts={[
              { label: "Regime", value: data.snapshot.regime.label },
              { label: "Market weather", value: scoreLabel(data.scoreSummary.scores.market_weather) },
              { label: "Fragility", value: scoreLabel(data.scoreSummary.scores.fragility) },
              { label: "Yield driver", value: driverLabel(data.snapshot.regime.yield_driver) }
            ]}
            risks={data.scoreSummary.scores.fragility.top_risks}
            score={data.scoreSummary.scores.market_weather}
            secondaryScore={data.scoreSummary.scores.fragility}
            summary="The current tactical read combines active volatility, credit, dollar, real-yield, liquidity, and confirmation signals."
            supports={data.scoreSummary.scores.market_weather.top_supports}
            title="Current Tactical Read"
          />
          <div className="section-heading">
            <h3>Daily checklist</h3>
          </div>
          <SignalChecklist items={data.snapshot.checklist} />
          <VolatilityTermStructurePanel
            chartSeries={toChartSeries(data.series)}
            vix={findSeries(data.series, "vix")}
            vix3m={findSeries(data.series, "vix3m")}
            vix9d={findSeries(data.series, "vix9d")}
          />
          <CreditPulsePanel
            catalog={data.catalog}
            highYieldOas={findSeries(data.series, "high_yield_oas")}
            hyMinusIgOas={findDerived(data.derived, "hy_minus_ig_oas")}
          />
          <DollarRealYieldPressurePanel
            broadDollar={findSeries(data.series, "broad_dollar")}
            catalog={data.catalog}
            realYield10y={findSeries(data.series, "real_yield_10y")}
            snapshot={data.snapshot}
          />
          <LiquidityPulsePanel catalog={data.catalog} netLiquidity={findDerived(data.derived, "net_liquidity")} />
          <OptionsSentimentPanel items={candidateItems(data.catalog, data.status, optionCandidateIds)} />
          <EventRiskPanel items={candidateItems(data.catalog, data.status, eventCandidateIds)} />
          <VixFuturesReadinessPanel items={candidateItems(data.catalog, data.status, vxCandidateIds)} />
          <DataGapPanel seriesIds={tacticalStatusIds} status={data.status} />
          <DataStatusTable seriesIds={tacticalStatusIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
