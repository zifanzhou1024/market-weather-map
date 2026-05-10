import { useEffect, useState } from "react";
import CrossAssetConfirmationMatrix from "../components/CrossAssetConfirmationMatrix";
import DataQualityBanner from "../components/DataQualityBanner";
import PageInsightHero from "../components/PageInsightHero";
import RegimeInterpretationPanel from "../components/RegimeInterpretationPanel";
import RegimeQuadrantChart from "../components/RegimeQuadrantChart";
import RouteDataFooter from "../components/RouteDataFooter";
import YieldDecompositionChart from "../components/YieldDecompositionChart";
import { loadRegimeSnapshot, loadScoreSummary } from "../lib/data";
import { directionLabel } from "../lib/regime";
import type { DirectionState, RegimeSnapshotFile, ScoreSummaryFile } from "../lib/types";

interface DirectionCardProps {
  label: string;
  direction: DirectionState;
}

interface RouteState {
  scoreSummary: ScoreSummaryFile;
  snapshot: RegimeSnapshotFile;
}

const candidateConfirmationRows = [
  {
    id: "gold_xau",
    label: "Gold / XAU",
    message: "Precious-metal confirmation remains source-gated.",
    status: "terms_review_needed"
  },
  {
    id: "long_duration_bonds",
    label: "Long-duration bonds",
    message: "Duration-bond confirmation remains display-only until source coverage is formalized.",
    status: "terms_review_needed"
  },
  {
    id: "vix_futures_curve",
    label: "VIX futures curve",
    message: "VX futures confirmation remains candidate-only; the active page uses VIX9D/VIX/VIX3M proxies.",
    status: "terms_review_needed"
  },
  {
    id: "put_call_ratios",
    label: "Put/call ratios",
    message: "Options sentiment remains candidate-only until Cboe source review is complete.",
    status: "terms_review_needed"
  },
  {
    id: "move_index",
    label: "MOVE",
    message: "Bond-volatility confirmation remains source-gated.",
    status: "terms_review_needed"
  },
  {
    id: "skew_index",
    label: "SKEW",
    message: "Equity tail-risk confirmation remains source-gated.",
    status: "terms_review_needed"
  },
  {
    id: "equity_breadth",
    label: "Equity breadth",
    message: "Breadth confirmation remains candidate-only until source governance approves it.",
    status: "terms_review_needed"
  },
  {
    id: "liquidity",
    label: "Liquidity",
    message: "Liquidity confirmation remains visible as a candidate row only if no active liquidity confirmation exists.",
    status: "terms_review_needed"
  }
];

function DirectionCard({ label, direction }: DirectionCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-card__header">
        <p className="metric-source">Regime input</p>
        <h3>{label}</h3>
      </div>
      <div className="metric-value">
        <strong>{directionLabel(direction)}</strong>
      </div>
    </article>
  );
}

export default function RegimeMap() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRegimeMap() {
      try {
        const [snapshot, scoreSummary] = await Promise.all([loadRegimeSnapshot(), loadScoreSummary()]);
        if (active) setData({ scoreSummary, snapshot });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load regime map.");
      }
    }

    void loadRegimeMap();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Regime map</p>
        <h2>TIPS x Dollar Regime Map</h2>
        <p>Current dollar, real-yield, nominal-yield, and cross-asset regime context.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="regime_map" />
          {/* SLOT:regime_primary_chart */}
          <DataQualityBanner dataQuality={data.scoreSummary.data_quality} />
          <RegimeInterpretationPanel scoreSummary={data.scoreSummary} snapshot={data.snapshot} />
          <section className="metric-grid" aria-label="Regime direction cards">
            <DirectionCard direction={data.snapshot.regime.tips_direction} label="TIPS direction" />
            <DirectionCard direction={data.snapshot.regime.dollar_direction} label="Dollar direction" />
            <DirectionCard direction={data.snapshot.regime.nominal_yield_direction} label="Nominal-yield direction" />
          </section>
          <RegimeQuadrantChart trail={data.snapshot.quadrant_trail} />
          <YieldDecompositionChart data={data.snapshot.yield_decomposition} />
          <RouteDataFooter route="regime_map">
            <CrossAssetConfirmationMatrix
              candidateItems={candidateConfirmationRows}
              items={data.snapshot.confirmations}
            />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
