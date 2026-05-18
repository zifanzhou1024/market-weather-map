import { useEffect, useState } from "react";
import CrossAssetConfirmationMatrix from "../CrossAssetConfirmationMatrix";
import FocusBlock from "../FocusBlock";
import PageInsightHero from "../PageInsightHero";
import RegimeInterpretationPanel from "../RegimeInterpretationPanel";
import RegimeQuadrantChart from "../RegimeQuadrantChart";
import RouteDataFooter from "../RouteDataFooter";
import YieldDecompositionChart from "../YieldDecompositionChart";
import { candidateDisplayLabel, candidateDisplayMessage } from "../../lib/candidateDisplay";
import { loadPageInsights, loadRegimeSnapshot, loadScoreSummary } from "../../lib/data";
import { directionLabel } from "../../lib/regime";
import type { DirectionState, PageInsightsFile, RegimeSnapshotFile, ScoreSummaryFile } from "../../lib/types";

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
    label: candidateDisplayLabel("vix_futures_curve", "VIX futures curve"),
    message: candidateDisplayMessage(
      "vix_futures_curve",
      "VX futures confirmation remains candidate-only; the active page uses VIX9D/VIX/VIX3M proxies."
    ),
    status: "not_implemented"
  },
  {
    id: "put_call_ratios",
    label: "Put/call ratios",
    message: "Options sentiment remains candidate-only until Cboe source review is complete.",
    status: "terms_review_needed"
  },
  {
    id: "move_index",
    label: candidateDisplayLabel("move_index", "MOVE"),
    message: candidateDisplayMessage("move_index", "Bond-volatility confirmation remains source-gated."),
    status: "candidate_gated"
  },
  {
    id: "skew_index",
    label: candidateDisplayLabel("skew_index", "SKEW"),
    message: candidateDisplayMessage("skew_index", "Equity tail-risk confirmation remains source-gated."),
    status: "not_implemented"
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

export default function RegimeTab() {
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
    <section data-testid="regime-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="regime_map" />
          {(() => {
            const section = pageInsights?.routes?.regime_map?.sections?.find(
              (s) => s.id === "regime_drivers"
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
          {/* SLOT:regime_primary_chart */}
          <RegimeQuadrantChart />
          <RegimeInterpretationPanel scoreSummary={data.scoreSummary} snapshot={data.snapshot} />
          <section className="metric-grid" aria-label="Regime direction cards">
            <DirectionCard direction={data.snapshot.regime.tips_direction} label="TIPS direction" />
            <DirectionCard direction={data.snapshot.regime.dollar_direction} label="Dollar direction" />
            <DirectionCard direction={data.snapshot.regime.nominal_yield_direction} label="Nominal-yield direction" />
          </section>
          <YieldDecompositionChart data={data.snapshot.yield_decomposition} />
          <RouteDataFooter route="regime_map">
            <CrossAssetConfirmationMatrix
              candidateItems={candidateConfirmationRows}
              items={data.snapshot.confirmations}
            />
          </RouteDataFooter>
        </div>
      ) : null}
    </section>
  );
}
