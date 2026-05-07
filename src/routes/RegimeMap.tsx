import { useEffect, useState } from "react";
import CrossAssetConfirmationMatrix from "../components/CrossAssetConfirmationMatrix";
import RegimeQuadrantChart from "../components/RegimeQuadrantChart";
import YieldDecompositionChart from "../components/YieldDecompositionChart";
import { loadRegimeSnapshot } from "../lib/data";
import { directionLabel, yieldDriverLabel } from "../lib/regime";
import type { DirectionState, RegimeSnapshotFile } from "../lib/types";

interface DirectionCardProps {
  label: string;
  direction: DirectionState;
}

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
  const [snapshot, setSnapshot] = useState<RegimeSnapshotFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRegimeMap() {
      try {
        const regimeSnapshot = await loadRegimeSnapshot();
        if (active) setSnapshot(regimeSnapshot);
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
      {snapshot ? (
        <div className="route-stack">
          <section className="panel interpretation-panel">
            <p className="eyebrow">Current quadrant</p>
            <h3>{snapshot.regime.label}</h3>
            <p>Yield driver: {yieldDriverLabel(snapshot.regime.yield_driver)}</p>
          </section>
          <section className="metric-grid" aria-label="Regime direction cards">
            <DirectionCard direction={snapshot.regime.tips_direction} label="TIPS direction" />
            <DirectionCard direction={snapshot.regime.dollar_direction} label="Dollar direction" />
            <DirectionCard direction={snapshot.regime.nominal_yield_direction} label="Nominal-yield direction" />
          </section>
          <RegimeQuadrantChart trail={snapshot.quadrant_trail} />
          <YieldDecompositionChart data={snapshot.yield_decomposition} />
          <CrossAssetConfirmationMatrix items={snapshot.confirmations} />
        </div>
      ) : null}
    </main>
  );
}
