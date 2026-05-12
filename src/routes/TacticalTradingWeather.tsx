import { useEffect, useState } from "react";
import type { CandidateSourceItem } from "../components/CandidateSourcePanel";
import CreditPulsePanel from "../components/CreditPulsePanel";
import CreditStressMatrix from "../components/CreditStressMatrix";
import DataGapPanel from "../components/DataGapPanel";
import DataQualityBanner from "../components/DataQualityBanner";
import DataStatusTable from "../components/DataStatusTable";
import DollarRealYieldPressurePanel from "../components/DollarRealYieldPressurePanel";
import EventRiskPanel from "../components/EventRiskPanel";
import EventRiskTimeline from "../components/EventRiskTimeline";
import FocusBlock from "../components/FocusBlock";
import HorizonScoreHeader from "../components/HorizonScoreHeader";
import LiquidityDollarPressureChart from "../components/LiquidityDollarPressureChart";
import LiquidityPulsePanel from "../components/LiquidityPulsePanel";
import type { MultiSeriesChartSeries } from "../components/MultiSeriesChart";
import OptionsSentimentPanel from "../components/OptionsSentimentPanel";
import RatesPressureChart from "../components/RatesPressureChart";
import RouteDataFooter from "../components/RouteDataFooter";
import SignalChecklist from "../components/SignalChecklist";
import TopSignalList from "../components/TopSignalList";
import VixCurveTermStructureChart from "../components/charts/VixCurveTermStructureChart";
import VixFuturesReadinessPanel from "../components/VixFuturesReadinessPanel";
import VolatilityHiddenStressChart from "../components/charts/VolatilityHiddenStressChart";
import VolatilityTermStructurePanel from "../components/VolatilityTermStructurePanel";
import { applyCandidateDisplayOverride } from "../lib/candidateDisplay";
import { scoreLabel } from "../lib/horizon";
import {
  loadCatalog,
  loadDataStatus,
  loadMacroCalendar,
  loadPageInsights,
  loadRegimeSnapshot,
  loadScoreSummary,
  loadSignalPriority,
  loadVolatilityDashboard
} from "../lib/data";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  MacroCalendarFile,
  PageInsightsFile,
  RegimeSnapshotFile,
  ScoreSummaryFile,
  SeriesCatalogEntry,
  SignalPriorityFile,
  TimeSeriesFile,
  VolatilityDashboardFile
} from "../lib/types";
import { loadRouteDerivedSeries, loadRouteSeries } from "./routeSeries";

const tacticalSeriesIds = [
  "vix",
  "vix9d",
  "vix3m",
  "vvix",
  "high_yield_oas",
  "investment_grade_oas",
  "bbb_oas",
  "broad_dollar",
  "real_yield_10y",
  "us2y",
  "us10y",
  "us30y",
  "breakeven_10y"
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
const eventCandidateIds = ["event_opex"];
const tacticalStatusIds = [
  ...tacticalSeriesIds,
  ...tacticalDerivedIds,
  ...optionCandidateIds,
  ...eventCandidateIds,
  ...vxCandidateIds
];

interface RouteState {
  calendar: MacroCalendarFile;
  catalog: SeriesCatalogEntry[];
  derived: DerivedSeriesFile[];
  scoreSummary: ScoreSummaryFile;
  series: TimeSeriesFile[];
  signalPriority: SignalPriorityFile | null;
  snapshot: RegimeSnapshotFile;
  status: DataStatusFile;
  volDashboard: VolatilityDashboardFile | null;
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

    return applyCandidateDisplayOverride({
      id,
      label: entry?.name ?? id,
      note: statusRow?.message ?? entry?.notes ?? "Source review required.",
      status: statusRow?.status ?? fallbackCandidateStatus(entry)
    });
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

    async function loadTacticalTradingWeather() {
      try {
        const [catalog, status, scoreSummary, snapshot, signalPriority, calendar, volDashboard] =
          await Promise.all([
            loadCatalog(),
            loadDataStatus(),
            loadScoreSummary(),
            loadRegimeSnapshot(),
            loadSignalPriority().catch(() => null),
            loadMacroCalendar(),
            loadVolatilityDashboard()
          ]);
        const [series, derived] = await Promise.all([
          loadRouteSeries(tacticalSeriesIds, catalog, status),
          loadRouteDerivedSeries(tacticalDerivedIds, catalog, status, {
            allowMissing: new Set(tacticalDerivedIds)
          })
        ]);
        if (active) {
          setData({
            calendar,
            catalog,
            derived,
            scoreSummary,
            series,
            signalPriority,
            snapshot,
            status,
            volDashboard
          });
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
          <DataQualityBanner dataQuality={data.scoreSummary.data_quality} />
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
          {data.signalPriority ? (
            <section
              className="signal-priority-grid"
              aria-label="Tactical top active warnings, supports, and missing high-value signals"
            >
              <TopSignalList
                title="Top Active Warnings"
                emptyText="No top active tactical warnings in the current snapshot."
                variant="warning"
                signals={data.signalPriority.top_warnings}
              />
              <TopSignalList
                title="Top Active Supports"
                emptyText="No top active tactical supports in the current snapshot."
                variant="support"
                signals={data.signalPriority.top_supports}
              />
              <TopSignalList
                title="Missing High-Value Signals"
                emptyText="All high-value tactical signals have an active source."
                variant="missing"
                signals={data.signalPriority.missing_high_value_signals}
              />
            </section>
          ) : null}
          {(() => {
            const section = pageInsights?.routes?.tactical?.sections?.find(
              (s) => s.id === "tactical_stress_board"
            );
            return section ? (
              <FocusBlock
                variant="section"
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
          <section
            className="tactical-charts"
            aria-label="Short-term tactical charts: volatility, rates, credit, liquidity, dollar, and event risk"
          >
            {/* SLOT:tactical_vol_curve_slot */}
            {data.volDashboard ? (
              <VixCurveTermStructureChart
                compact
                data={data.volDashboard.latest_curve}
                thresholds={data.volDashboard.thresholds}
              />
            ) : null}
            {/* /SLOT:tactical_vol_curve_slot */}
            {/* SLOT:tactical_vol_complex_slot */}
            {data.volDashboard ? (
              <VolatilityHiddenStressChart
                compact
                data={data.volDashboard.hidden_stress}
                thresholds={data.volDashboard.thresholds}
              />
            ) : null}
            {/* /SLOT:tactical_vol_complex_slot */}
            <CreditStressMatrix
              highYieldOas={findSeries(data.series, "high_yield_oas")}
              investmentGradeOas={findSeries(data.series, "investment_grade_oas")}
              bbbOas={findSeries(data.series, "bbb_oas")}
            />
            <RatesPressureChart
              us2y={findSeries(data.series, "us2y")}
              us10y={findSeries(data.series, "us10y")}
              realYield10y={findSeries(data.series, "real_yield_10y")}
              breakeven10y={findSeries(data.series, "breakeven_10y")}
            />
            <LiquidityDollarPressureChart
              broadDollar={findSeries(data.series, "broad_dollar")}
              realYield10y={findSeries(data.series, "real_yield_10y")}
            />
            <EventRiskTimeline calendar={data.calendar} />
          </section>
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
          <RouteDataFooter>
            <OptionsSentimentPanel items={candidateItems(data.catalog, data.status, optionCandidateIds)} />
            <EventRiskPanel
              calendar={data.calendar}
              items={candidateItems(data.catalog, data.status, ["event_opex"])}
            />
            <VixFuturesReadinessPanel items={candidateItems(data.catalog, data.status, vxCandidateIds)} />
            <DataGapPanel seriesIds={tacticalStatusIds} status={data.status} />
            <DataStatusTable seriesIds={tacticalStatusIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
