import { useEffect, useState } from "react";
import DriverAttributionPanel from "../DriverAttributionPanel";
import HistoricalRegimeReplayPanel from "../HistoricalRegimeReplayPanel";
import HowToReadPanel from "../HowToReadPanel";
import RouteDataFooter from "../RouteDataFooter";
import { loadRegimeReplay, loadScoreHistory } from "../../lib/data";
import type { RegimeReplayFile, ScoreHistoryFile } from "../../lib/types";

interface RouteState {
  replay: RegimeReplayFile;
  scoreHistory: ScoreHistoryFile;
}

export default function ReplayTab() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReplay() {
      try {
        const [replay, scoreHistory] = await Promise.all([loadRegimeReplay(), loadScoreHistory()]);
        if (active) setData({ replay, scoreHistory });
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load historical regime replay.");
        }
      }
    }

    void loadReplay();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section data-testid="replay-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <HowToReadPanel description="Replay matches are historical context from static public-data artifacts. They do not produce recommendations, projections, or personalized investment guidance." />
          <DriverAttributionPanel history={data.scoreHistory} />
          <HistoricalRegimeReplayPanel replay={data.replay} />
          <RouteDataFooter />
        </div>
      ) : null}
    </section>
  );
}
