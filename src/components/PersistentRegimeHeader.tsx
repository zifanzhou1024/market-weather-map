import { useEffect, useState } from "react";
import type { CockpitFile, CockpitCompositeScore } from "../lib/types";
import { useMode, setMode } from "../lib/mode";

interface Props {
  cockpit: CockpitFile | null;
}

const SCROLL_THIN_THRESHOLD_PX = 80;

function findFragility(scores: CockpitCompositeScore[]): CockpitCompositeScore | undefined {
  return scores.find((s) => s.id === "fragility");
}

export default function PersistentRegimeHeader({ cockpit }: Props) {
  const mode = useMode();
  const [isThin, setIsThin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setIsThin(window.scrollY > SCROLL_THIN_THRESHOLD_PX);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (cockpit === null) {
    return (
      <header
        className="persistent-regime-header persistent-regime-header--loading"
        aria-busy="true"
        aria-label="Loading regime read"
      >
        <span className="persistent-regime-header__placeholder">— loading market regime —</span>
      </header>
    );
  }

  const fragility = findFragility(cockpit.composite_scores);
  const risk =
    fragility?.value !== null && fragility?.value !== undefined
      ? fragility.value.toFixed(1)
      : null;
  const toneClass = `persistent-regime-header__dot--${cockpit.regime.tone}`;
  const otherMode = mode === "brief" ? "detail" : "brief";

  return (
    <header
      className={`persistent-regime-header ${isThin ? "persistent-regime-header--thin" : ""}`.trim()}
      aria-label="Current market regime"
    >
      <div className="persistent-regime-header__regime">
        <span
          className={`persistent-regime-header__dot ${toneClass}`}
          title={`As of ${cockpit.date}`}
          aria-hidden="true"
        />
        <span className="persistent-regime-header__regime-label">{cockpit.regime.label}</span>
      </div>

      {risk !== null && (
        <div className="persistent-regime-header__risk" aria-label="Fragility composite score">
          <span className="persistent-regime-header__risk-label">Fragility</span>
          <span className="persistent-regime-header__risk-value">{risk}</span>
        </div>
      )}

      <div className="persistent-regime-header__date" title={`Data as of ${cockpit.date}`}>
        As of {cockpit.date}
      </div>

      <button
        type="button"
        className="persistent-regime-header__mode-toggle"
        onClick={() => setMode(otherMode)}
        aria-label={`Switch to ${otherMode} mode (currently ${mode})`}
      >
        {mode === "brief" ? "Brief" : "Detail"}
      </button>
    </header>
  );
}
