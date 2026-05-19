import { useEffect, useState } from "react";
import ContextBlock from "../components/ContextBlock";
import DataGapPanel from "../components/DataGapPanel";
import DataQualityBanner from "../components/DataQualityBanner";
import DataStatusTable from "../components/DataStatusTable";
import DriverAttributionPanel from "../components/DriverAttributionPanel";
import HorizonImpactMatrix from "../components/HorizonImpactMatrix";
import MarketCockpit from "../components/MarketCockpit";
import MissingSignalPanel from "../components/MissingSignalPanel";
import RouteDataFooter from "../components/RouteDataFooter";
import ScoreContributionHeatmap from "../components/ScoreContributionHeatmap";
import TodaysNotable from "../components/TodaysNotable";
import {
  loadCockpit,
  loadDataStatus,
  loadScoreHistory,
  loadScoreSummary,
  loadSignalPriority
} from "../lib/data";
import { useT } from "../lib/i18n";
import { useMode } from "../lib/mode";
import type {
  CockpitFile,
  DataStatusFile,
  ScoreHistoryFile,
  ScoreSummaryFile,
  SignalPriorityFile
} from "../lib/types";

/**
 * Series ids preserved from the pre-demote Overview so the data-status footer
 * keeps the same row set after the duplicate-panel cleanup. The cockpit reads
 * its own data file; these ids only gate which rows render in DataStatusTable.
 */
const overviewSeriesIds = [
  "vix",
  "us10y",
  "net_liquidity",
  "financial_stress",
  "wti_crude",
  "cftc_sp500_lev_money_net"
];

interface OverviewState {
  cockpit: CockpitFile | null;
  scoreSummary: ScoreSummaryFile | null;
  scoreHistory: ScoreHistoryFile | null;
  signalPriority: SignalPriorityFile | null;
  status: DataStatusFile | null;
}

export default function Overview() {
  const { t } = useT();
  const mode = useMode();
  const [data, setData] = useState<OverviewState>({
    cockpit: null,
    scoreSummary: null,
    scoreHistory: null,
    signalPriority: null,
    status: null
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      loadCockpit().catch(() => null),
      loadScoreSummary().catch(() => null),
      loadScoreHistory().catch(() => null),
      loadSignalPriority().catch(() => null),
      loadDataStatus().catch(() => null)
    ])
      .then(([cockpit, scoreSummary, scoreHistory, signalPriority, status]) => {
        if (!active) return;
        setData({ cockpit, scoreSummary, scoreHistory, signalPriority, status });
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load market data.");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{t("routes.marketWeatherEyebrow")}</p>
        <h2>{t("routes.overviewHeading")}</h2>
        <p>{t("routes.overviewIntro")}</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          {t("chrome.dataErrorPrefix")}: {error}
        </p>
      ) : null}

      <MarketCockpit data={data.cockpit} mode={mode} />

      {mode === "detail" ? (
        <TodaysNotable signals={data.signalPriority} history={data.scoreHistory} />
      ) : null}

      {mode === "detail" ? (
        <ContextBlock label={t("sections.scoreContextLabel")}>
          {data.scoreSummary ? <ScoreContributionHeatmap scoreSummary={data.scoreSummary} /> : null}
          {data.scoreHistory ? <DriverAttributionPanel history={data.scoreHistory} /> : null}
          {data.signalPriority ? (
            <MissingSignalPanel signals={data.signalPriority.missing_high_value_signals} />
          ) : null}
          <HorizonImpactMatrix />
        </ContextBlock>
      ) : null}

      {data.status ? (
        <RouteDataFooter>
          {data.scoreSummary ? <DataQualityBanner dataQuality={data.scoreSummary.data_quality} /> : null}
          <DataGapPanel status={data.status} />
          <DataStatusTable seriesIds={overviewSeriesIds} status={data.status} />
        </RouteDataFooter>
      ) : null}
    </main>
  );
}
