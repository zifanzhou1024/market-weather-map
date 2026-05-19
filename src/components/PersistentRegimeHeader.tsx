import { useEffect, useState } from "react";
import type { CockpitFile, CockpitCompositeScore } from "../lib/types";
import { useMode, setMode } from "../lib/mode";
import { useT } from "../lib/i18n";
import LanguageToggle from "./LanguageToggle";

interface Props {
  cockpit: CockpitFile | null;
}

const SCROLL_THIN_THRESHOLD_PX = 80;

function findFragility(scores: CockpitCompositeScore[]): CockpitCompositeScore | undefined {
  return scores.find((s) => s.id === "fragility");
}

export default function PersistentRegimeHeader({ cockpit }: Props) {
  const mode = useMode();
  const { t, tCategorical } = useT();
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
        aria-label={t("chrome.loading")}
      >
        <span className="persistent-regime-header__placeholder">— {t("chrome.loading")} —</span>
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
  // Piecewise translation lets "Tightening / risk-off" and "Easing / risk-on"
  // come through localized even when the exact phrase isn't in the table.
  const regimeText = tCategorical("regime", cockpit.regime.label);
  const otherModeLabel = otherMode === "brief" ? t("chrome.briefMode") : t("chrome.detailMode");

  return (
    <header
      className={`persistent-regime-header ${isThin ? "persistent-regime-header--thin" : ""}`.trim()}
      aria-label={t("regime.regimeLabel")}
    >
      <div className="persistent-regime-header__regime">
        <span
          className={`persistent-regime-header__dot ${toneClass}`}
          title={`${t("chrome.asOfPrefix")} ${cockpit.date}`}
          aria-hidden="true"
        />
        <span className="persistent-regime-header__regime-label">{regimeText}</span>
      </div>

      {risk !== null && (
        <div className="persistent-regime-header__risk" aria-label={t("regime.fragility")}>
          <span className="persistent-regime-header__risk-label">{t("regime.fragility")}</span>
          <span className="persistent-regime-header__risk-value">{risk}</span>
        </div>
      )}

      <div
        className="persistent-regime-header__date"
        title={`${t("chrome.asOfPrefix")} ${cockpit.date}`}
      >
        {t("chrome.asOfPrefix")} {cockpit.date}
      </div>

      <LanguageToggle />

      <button
        type="button"
        className="persistent-regime-header__mode-toggle"
        onClick={() => setMode(otherMode)}
        aria-label={t("chrome.switchTo", { vars: { mode: otherModeLabel } })}
      >
        {mode === "brief" ? t("chrome.briefMode") : t("chrome.detailMode")}
      </button>

      <button
        type="button"
        className="persistent-regime-header__shortcuts-button"
        onClick={() =>
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))
        }
        aria-label={t("chrome.keyboardShortcuts")}
        title={`${t("chrome.keyboardShortcuts")} (?)`}
      >
        ?
      </button>
    </header>
  );
}
