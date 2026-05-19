import type { ScoreHistoryFile } from "../lib/types";
import { useT } from "../lib/i18n";

interface Props {
  history: ScoreHistoryFile | null;
}

const MAX_ROWS = 6;

export default function WhatChangedColumn({ history }: Props) {
  const { t } = useT();
  if (history === null) {
    return (
      <section
        className="what-changed-column what-changed-column--loading"
        aria-busy="true"
      >
        <h3 className="what-changed-column__title">{t("sections.whatChanged")}</h3>
        <p className="what-changed-column__placeholder">
          {t("panels.whatChangedLoading")}
        </p>
      </section>
    );
  }

  const attribution = history.latest_attribution;
  const all = [
    ...attribution.market_weather.recent_changes,
    ...attribution.macro_climate.recent_changes,
    ...attribution.fragility.recent_changes
  ];

  // Dedupe while preserving order
  const seen = new Set<string>();
  const unique = all
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .slice(0, MAX_ROWS);

  return (
    <section
      className="what-changed-column"
      aria-label="What changed since last refresh"
    >
      <h3 className="what-changed-column__title">{t("sections.whatChanged")}</h3>
      {unique.length === 0 ? (
        <p className="what-changed-column__empty">
          {t("panels.whatChangedEmpty")}
        </p>
      ) : (
        <ul className="what-changed-column__list">
          {unique.map((line, i) => (
            <li key={`${i}:${line}`} className="what-changed-column__item">
              {line}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
