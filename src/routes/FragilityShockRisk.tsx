import { useEffect, useState } from "react";
import BondVolatilityProxyChart from "../components/BondVolatilityProxyChart";
import CandidateDiagnosticPanel from "../components/CandidateDiagnosticPanel";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import HiddenStressMismatchPanel from "../components/HiddenStressMismatchPanel";
import HiddenStressSummary from "../components/HiddenStressSummary";
import InterpretationPanel from "../components/InterpretationPanel";
import MismatchWarningPanel from "../components/MismatchWarningPanel";
import PageInsightHero from "../components/PageInsightHero";
import RouteDataFooter from "../components/RouteDataFooter";
import RouteScoreStrip from "../components/RouteScoreStrip";
import ScoreCard from "../components/ScoreCard";
import ShockRiskContributionChart from "../components/ShockRiskContributionChart";
import ShockRiskDashboard from "../components/ShockRiskDashboard";
import ShockRiskReadHeader from "../components/ShockRiskReadHeader";
import TailRiskPanel from "../components/TailRiskPanel";
import TailRiskReadinessMatrix from "../components/TailRiskReadinessMatrix";
import VixVvixHiddenStressPanel from "../components/VixVvixHiddenStressPanel";
import {
  loadCatalog,
  loadCockpit,
  loadDataStatus,
  loadRegimeSnapshot,
  loadScoreSummary,
  loadShockRiskSnapshot
} from "../lib/data";
import { useT } from "../lib/i18n";
import { useMode } from "../lib/mode";
import { sanitizeShockRiskSnapshot } from "../lib/shockRisk";
import { loadRouteDerivedSeries } from "./routeSeries";
import type {
  CockpitFile,
  DataStatusFile,
  DerivedSeriesFile,
  RegimeSnapshotFile,
  ScoreSummaryFile,
  ShockRiskSnapshotFile,
  SeriesCatalogEntry
} from "../lib/types";

const fragilityStatusIds = [
  "move_index",
  "skew_index",
  "vix",
  "vix_vix3m_ratio",
  "hy_minus_ig_oas",
  "broad_dollar",
  "real_yield_10y",
  "net_liquidity"
];
const fragilityDiagnosticIds = ["bond_volatility_proxy"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  cockpit: CockpitFile | null;
  diagnosticSeries: DerivedSeriesFile[];
  scoreSummary: ScoreSummaryFile;
  shockSnapshot: ShockRiskSnapshotFile;
  snapshot: RegimeSnapshotFile;
  status: DataStatusFile;
}

export default function FragilityShockRisk() {
  const { t } = useT();
  const mode = useMode();
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFragilityShockRisk() {
      try {
        const [scoreSummary, snapshot, shockSnapshot, status, catalog, cockpit] = await Promise.all([
          loadScoreSummary(),
          loadRegimeSnapshot(),
          loadShockRiskSnapshot(),
          loadDataStatus(),
          loadCatalog(),
          loadCockpit().catch(() => null)
        ]);
        const diagnosticSeries = await loadRouteDerivedSeries(fragilityDiagnosticIds, catalog, status, {
          allowMissing: new Set(fragilityDiagnosticIds)
        });
        if (active) {
          setData({
            catalog,
            cockpit,
            diagnosticSeries,
            scoreSummary,
            shockSnapshot: sanitizeShockRiskSnapshot(shockSnapshot),
            snapshot,
            status
          });
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load fragility shock risk.");
        }
      }
    }

    void loadFragilityShockRisk();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow" lang="en">Fragility</p>
        <h2>{t("routes.fragilityHeading")}</h2>
        <p lang="en">Current fragility score, shock-risk pressure, tail-risk source readiness, and data gaps.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          {(() => {
            const fragility = data.cockpit?.composite_scores.find(
              (score) => score.id === "fragility"
            );
            return fragility ? <RouteScoreStrip composite={fragility} mode={mode} /> : null;
          })()}
          <ShockRiskReadHeader
            catalog={data.catalog}
            scoreSummary={data.scoreSummary}
            shockSnapshot={data.shockSnapshot}
            status={data.status}
          />
          <PageInsightHero route="fragility" />
          {/* SLOT:fragility_primary_chart */}
          <ShockRiskContributionChart activeSignals={data.shockSnapshot.active_signals} />
          <HiddenStressMismatchPanel warnings={data.shockSnapshot.mismatch_warnings} />
          <BondVolatilityProxyChart
            series={data.diagnosticSeries.find((entry) => entry.series_id === "bond_volatility_proxy")}
          />
          <TailRiskReadinessMatrix status={data.status} />
          {/* SLOT:fragility_pre_metrics_slot */}
          <VixVvixHiddenStressPanel />
          <HiddenStressSummary shockSnapshot={data.shockSnapshot} />
          <InterpretationPanel
            caveats={data.scoreSummary.scores.fragility.missing_or_stale_notes}
            label={data.snapshot.regime.label}
            risks={data.scoreSummary.scores.fragility.top_risks}
            summary="Fragility combines observed cross-asset stress with source readiness for gated tail-risk inputs."
            supports={data.scoreSummary.scores.fragility.top_supports}
            title="Fragility context"
          />
          <section className="score-grid" aria-label="Fragility score">
            <ScoreCard score={data.scoreSummary.scores.fragility} title="Fragility" />
          </section>
          <ShockRiskDashboard snapshot={data.shockSnapshot} />
          <RouteDataFooter route="fragility">
            <CandidateDiagnosticPanel
              catalog={data.catalog}
              diagnosticIds={fragilityDiagnosticIds}
              eyebrow="Generated diagnostics"
              series={data.diagnosticSeries}
              status={data.status}
              summary="This public realized-yield-volatility proxy is generated from static Treasury-yield data for context only; it is not ICE MOVE."
              title="Public bond-volatility diagnostic"
            />
            <TailRiskPanel catalog={data.catalog} snapshot={data.shockSnapshot} status={data.status} />
            <MismatchWarningPanel warnings={data.shockSnapshot.mismatch_warnings} />
            <DataGapPanel seriesIds={fragilityStatusIds} status={data.status} />
            <DataStatusTable seriesIds={fragilityStatusIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
