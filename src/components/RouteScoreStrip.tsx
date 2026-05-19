import type { CockpitCompositeScore } from "../lib/types";
import type { Mode } from "../lib/mode";
import Sparkline from "./Sparkline";
import PercentileBand from "./PercentileBand";
import { useT } from "../lib/i18n";

const COMPOSITE_SIGNAL_KEYS: Record<CockpitCompositeScore["id"], string> = {
  market_weather: "marketWeather",
  macro_climate: "macroClimate",
  fragility: "fragility",
};

interface Props {
  composite: CockpitCompositeScore;
  mode: Mode;
}

function formatValue(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(1);
}

function formatDelta(d: number | null): string | null {
  if (d === null) return null;
  // Hide near-zero deltas (e.g., "+0.04" still renders; "-0.001" rounds to "-0.0" → hide)
  if (Math.abs(d) < 0.05) return null;
  const prefix = d >= 0 ? "+" : "";
  return `${prefix}${d.toFixed(1)}`;
}

export default function RouteScoreStrip({ composite, mode }: Props) {
  const { t, tCategorical } = useT();
  const value = formatValue(composite.value);
  const delta = formatDelta(composite.delta_7d);
  const sigKey = COMPOSITE_SIGNAL_KEYS[composite.id];
  const displayLabel = sigKey ? t(`signals.${sigKey}`) : composite.label;
  const regimeLabel = tCategorical("compositeReading", composite.regime_label);

  return (
    <section
      className="route-score-strip"
      aria-label={`${composite.label}: ${value} (${composite.regime_label})`}
    >
      <header className="route-score-strip__header">
        <span className="route-score-strip__eyebrow">{displayLabel}</span>
      </header>

      <div className="route-score-strip__primary">
        <span className="route-score-strip__value">{value}</span>
        <span className="route-score-strip__regime">{regimeLabel}</span>
      </div>

      <Sparkline
        points={composite.sparkline_90d}
        width={180}
        height={32}
        className="route-score-strip__spark"
      />

      <PercentileBand
        percentile={composite.percentile_5y}
        direction={composite.direction}
        windowDays={composite.percentile_window_days ?? undefined}
        width={180}
      />

      {mode === "detail" && delta !== null && (
        <p className="route-score-strip__delta">Δ7d {delta}</p>
      )}
    </section>
  );
}
