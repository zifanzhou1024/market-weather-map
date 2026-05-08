import { useEffect, useState } from "react";
import DriverAttributionPanel from "../components/DriverAttributionPanel";
import HistoricalRegimeReplayPanel from "../components/HistoricalRegimeReplayPanel";
import HowToReadPanel from "../components/HowToReadPanel";
import { loadRegimeReplay, loadScoreHistory } from "../lib/data";
import type { RegimeReplayFile, ScoreHistoryFile } from "../lib/types";

interface RouteState {
  replay: RegimeReplayFile;
  scoreHistory: ScoreHistoryFile;
}

export default function HistoricalRegimeReplay() {
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
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Research</p>
        <h2>Historical Regime Replay</h2>
        <p>
          Descriptive replay of prior real-yield, dollar, credit, and VIX-curve regimes, plus score
          attribution for what changed in the latest generated snapshot.
        </p>
      </section>
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
        </div>
      ) : null}
    </main>
  );
}
