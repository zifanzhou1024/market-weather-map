import { useEffect, useState } from "react";
import ConfidenceBreakdown from "../components/ConfidenceBreakdown";
import DataGapPanel from "../components/DataGapPanel";
import DataQualityBanner from "../components/DataQualityBanner";
import DataStatusTable from "../components/DataStatusTable";
import DriverAttributionPanel from "../components/DriverAttributionPanel";
import HorizonImpactMatrix from "../components/HorizonImpactMatrix";
import HowToReadPanel from "../components/HowToReadPanel";
import InterpretationPanel from "../components/InterpretationPanel";
import MarketBriefHeader from "../components/MarketBriefHeader";
import MarketCockpit from "../components/MarketCockpit";
import MetricCard from "../components/MetricCard";
import MissingSignalPanel from "../components/MissingSignalPanel";
import OverviewDecisionCard from "../components/OverviewDecisionCard";
import RouteDataFooter from "../components/RouteDataFooter";
import ScoreCard from "../components/ScoreCard";
import ScoreContributionHeatmap from "../components/ScoreContributionHeatmap";
import SignalList from "../components/SignalList";
import TopSignalList from "../components/TopSignalList";
import {
  loadCatalog,
  loadCockpit,
  loadDataStatus,
  loadDerivedSeries,
  loadRegimeSnapshot,
  loadScoreHistory,
  loadScoreSummary,
  loadShockRiskSnapshot,
  loadSeries,
  loadSignalPriority
} from "../lib/data";
import { countSourceGaps, firstText, scoreLabel } from "../lib/horizon";
import { useMode } from "../lib/mode";
import type {
  CockpitFile,
  ConfidenceBreakdownData,
  DataStatusFile,
  DerivedSeriesFile,
  RegimeSnapshotFile,
  ScoreHistoryFile,
  ScoreSummaryFile,
  SeriesCatalogEntry,
  ShockRiskSnapshotFile,
  SignalPriorityFile,
  TimeSeriesFile
} from "../lib/types";

const overviewSeriesIds = [
  "vix",
  "us10y",
  "net_liquidity",
  "financial_stress",
  "wti_crude",
  "cftc_sp500_lev_money_net"
];

interface OverviewState {
  catalog: SeriesCatalogEntry[];
  cockpit: CockpitFile | null;
  regimeSnapshot: RegimeSnapshotFile;
  scoreHistory: ScoreHistoryFile | null;
  scoreSummary: ScoreSummaryFile;
  shockSnapshot: ShockRiskSnapshotFile;
  signalPriority: SignalPriorityFile | null;
  status: DataStatusFile;
  series: Array<TimeSeriesFile | DerivedSeriesFile>;
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
    units: series.units,
    access_status: "free_public_active",
    terms_status: "ok",
    score_status: "active",
    active_scoring_allowed: true,
    public_redistribution_allowed: true,
    requires_secret: false
  };
}

function catalogEntryForSeries(
  catalog: SeriesCatalogEntry[],
  series: TimeSeriesFile | DerivedSeriesFile
): SeriesCatalogEntry | undefined {
  const catalogEntry = catalog.find((entry) => entry.id === series.series_id);
  if (catalogEntry) return catalogEntry;
  if (series.series_id === "net_liquidity" && "method" in series) return netLiquidityCatalogEntry(series);
  return undefined;
}

function safeStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function safeConfidenceValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeDataQuality(value: unknown): ConfidenceBreakdownData {
  if (!value || typeof value !== "object") {
    return {
      coverage_confidence: 0,
      freshness_confidence: 0,
      model_confidence: 0,
      source_confidence: 0,
      overall_confidence: 0,
      reasons: []
    };
  }

  const dataQuality = value as Partial<ConfidenceBreakdownData>;
  return {
    coverage_confidence: safeConfidenceValue(dataQuality.coverage_confidence),
    freshness_confidence: safeConfidenceValue(dataQuality.freshness_confidence),
    model_confidence: safeConfidenceValue(dataQuality.model_confidence),
    source_confidence: safeConfidenceValue(dataQuality.source_confidence),
    overall_confidence: safeConfidenceValue(dataQuality.overall_confidence),
    reasons: safeStringList(dataQuality.reasons)
  };
}

function safeLabel(value: unknown, fallback = "unknown") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function fragilityPhrase(value: unknown) {
  const label = safeLabel(value).toLowerCase();
  return label.includes("fragility") ? label : `${label} fragility`;
}

export default function Overview() {
  const [data, setData] = useState<OverviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mode = useMode();

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const [
          catalog,
          scoreSummary,
          scoreHistory,
          status,
          regimeSnapshot,
          shockSnapshot,
          signalPriority,
          cockpit,
          series
        ] = await Promise.all([
          loadCatalog(),
          loadScoreSummary(),
          loadScoreHistory().catch(() => null),
          loadDataStatus(),
          loadRegimeSnapshot(),
          loadShockRiskSnapshot(),
          loadSignalPriority().catch(() => null),
          loadCockpit().catch(() => null),
          Promise.all(
            overviewSeriesIds.map((seriesId) =>
              seriesId === "net_liquidity" ? loadDerivedSeries(seriesId) : loadSeries(seriesId)
            )
          )
        ]);

        if (active)
          setData({
            catalog,
            cockpit,
            regimeSnapshot,
            scoreHistory,
            scoreSummary,
            shockSnapshot,
            signalPriority,
            status,
            series
          });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load market data.");
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Market weather</p>
        <h2>Overview</h2>
        <p>Cross-asset conditions summarized from static JSON generated by GitHub Actions.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <>
          <MarketCockpit data={data.cockpit} mode={mode} />
          {(() => {
            const { scoreSummary } = data;
            const market = scoreSummary.scores.market_weather;
            const macro = scoreSummary.scores.macro_climate;
            const fragility = scoreSummary.scores.fragility;
            const dataQuality = safeDataQuality(scoreSummary.data_quality);
            const recentChanges = safeStringList(market.recent_changes)
              .concat(safeStringList(macro.recent_changes))
              .concat(safeStringList(fragility.recent_changes));
            const topSupports = safeStringList(market.top_supports)
              .concat(safeStringList(macro.top_supports))
              .concat(safeStringList(fragility.top_supports))
              .slice(0, 6);
            const topRisks = safeStringList(market.top_risks)
              .concat(safeStringList(macro.top_risks))
              .concat(safeStringList(fragility.top_risks))
              .slice(0, 6);
            const conflictingSignals = safeStringList(scoreSummary.conflicting_signals);

            return (
              <>
                {data.signalPriority ? (
                  <MarketBriefHeader
                    overallRead={data.signalPriority.overall_read}
                    date={data.signalPriority.date}
                  />
                ) : null}
                {data.signalPriority ? (
                  <section
                    className="signal-priority-grid signal-priority-grid--two-column"
                    aria-label="Top active warnings and supports"
                  >
                    <TopSignalList
                      title="Top Active Warnings"
                      emptyText="No top active warnings in the current snapshot."
                      variant="warning"
                      signals={data.signalPriority.top_warnings}
                    />
                    <TopSignalList
                      title="Top Active Supports"
                      emptyText="No top active supports in the current snapshot."
                      variant="support"
                      signals={data.signalPriority.top_supports}
                    />
                  </section>
                ) : null}
                <ScoreContributionHeatmap scoreSummary={scoreSummary} />
                {data.signalPriority ? (
                  <MissingSignalPanel signals={data.signalPriority.missing_high_value_signals} />
                ) : null}
                <HowToReadPanel description="Market Weather, Macro Climate, and Fragility are separate descriptive scores for observed conditions. They summarize public-data context for comparing current market and macro inputs." />
                <DataQualityBanner dataQuality={scoreSummary.data_quality} />
                <section className="decision-grid" aria-label="Decision views">
                  <OverviewDecisionCard
                    horizon="1 day to 4 weeks"
                    label={scoreLabel(market)}
                    risk={firstText(market.top_risks, "No top short-term risk in the current summary.")}
                    sourceGapCount={countSourceGaps(data.shockSnapshot.source_gaps)}
                    support={firstText(market.top_supports, "No top short-term support in the current summary.")}
                    title="Short-Term Market Reaction"
                    to="/short-term"
                  />
                  <OverviewDecisionCard
                    horizon="3 months to several years"
                    label={scoreLabel(macro)}
                    risk={firstText(macro.top_risks, "No top long-term risk in the current summary.")}
                    support={firstText(macro.top_supports, "No top long-term support in the current summary.")}
                    title="Long-Term Macro / Allocation Climate"
                    to="/long-term"
                  />
                  <OverviewDecisionCard
                    horizon="Shock-risk overlay"
                    label={`${data.shockSnapshot.label} ${data.shockSnapshot.score.toFixed(1)}`}
                    risk={firstText(fragility.top_risks, "No top fragility risk in the current summary.")}
                    sourceGapCount={countSourceGaps(data.shockSnapshot.source_gaps)}
                    support={firstText(fragility.top_supports, "No top fragility support in the current summary.")}
                    title="Fragility / Shock Risk"
                    to="/fragility"
                  />
                  <OverviewDecisionCard
                    horizon="Cross-asset regime"
                    label={data.regimeSnapshot.regime.label}
                    risk={firstText(conflictingSignals, "No conflicts in the current score summary.")}
                    support={`Yield driver: ${data.regimeSnapshot.regime.yield_driver}`}
                    title="TIPS x Dollar Regime Map"
                    to="/regime-map"
                  />
                </section>
                <div className="decision-impact-labels" aria-label="Horizon impact labels">
                  <span>Short-Term Impact</span>
                  <span>Long-Term Impact</span>
                </div>
                <HorizonImpactMatrix />
                <section className="score-grid" aria-label="Overview scores">
                  <ScoreCard score={scoreSummary.scores.market_weather} title="Market Weather" />
                  <ScoreCard score={scoreSummary.scores.macro_climate} title="Macro Climate" />
                  <ScoreCard score={scoreSummary.scores.fragility} title="Fragility" />
                </section>
                {data.scoreHistory ? <DriverAttributionPanel history={data.scoreHistory} /> : null}
                <InterpretationPanel
                  conflicts={conflictingSignals}
                  label={`${safeLabel(market.label)} market weather, ${safeLabel(macro.label)} macro climate, ${fragilityPhrase(fragility.label)}`}
                  notes={dataQuality.reasons}
                  risks={topRisks}
                  summary="The overview combines the three descriptive scores with source freshness and coverage notes so stale or missing inputs remain visible beside the headline read."
                  supports={topSupports}
                  title="Current regime read"
                />
                <section className="detail-grid overview-detail-grid">
                  <SignalList
                    emptyText="No recent changes in the current score summary."
                    items={recentChanges}
                    title="Recent changes"
                  />
                  <SignalList
                    emptyText="No conflicting signals in the current score summary."
                    items={conflictingSignals}
                    title="Conflicting signals"
                  />
                </section>
                <ConfidenceBreakdown dataQuality={dataQuality} />
              </>
            );
          })()}
          <section className="metric-grid" aria-label="Overview metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={catalogEntryForSeries(data.catalog, series)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          <RouteDataFooter>
            <DataGapPanel status={data.status} />
            <DataStatusTable seriesIds={overviewSeriesIds} status={data.status} />
          </RouteDataFooter>
        </>
      ) : null}
    </main>
  );
}
