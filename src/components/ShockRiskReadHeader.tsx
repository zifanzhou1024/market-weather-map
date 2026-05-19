import { formatNumber } from "../lib/formatters";
import type {
  DataStatusFile,
  ScoreSummaryFile,
  SeriesCatalogEntry,
  ShockRiskSnapshotFile
} from "../lib/types";
import SignalList from "./SignalList";
import { useT } from "../lib/i18n";

interface ShockRiskReadHeaderProps {
  catalog?: SeriesCatalogEntry[];
  scoreSummary: ScoreSummaryFile;
  shockSnapshot: ShockRiskSnapshotFile;
  status?: DataStatusFile;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function hasUsableLabel(value: unknown): value is { label: string } {
  if (!value || typeof value !== "object") return false;
  const row = value as { label?: unknown };
  return typeof row.label === "string" && row.label.trim().length > 0;
}

export default function ShockRiskReadHeader({ scoreSummary, shockSnapshot }: ShockRiskReadHeaderProps) {
  const { t, tCategorical, tDriver } = useT();
  const activeSignals = safeArray<unknown>(shockSnapshot.active_signals).filter(hasUsableLabel);
  const sourceGaps = safeArray<unknown>(shockSnapshot.source_gaps).filter(hasUsableLabel);
  const mismatchWarnings = safeArray<ShockRiskSnapshotFile["mismatch_warnings"][number]>(
    shockSnapshot.mismatch_warnings
  );
  const shockLabel = tCategorical("compositeReading", shockSnapshot.label);
  const fragilityLabel = tCategorical("compositeReading", scoreSummary.scores.fragility.label);

  return (
    <section className="panel interpretation-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.currentShockRiskRead")}</p>
          <h3>{shockLabel}</h3>
          <p>
            {t("narrative.fragilityScoreHint", {
              vars: {
                value: formatNumber(scoreSummary.scores.fragility.score),
                label: fragilityLabel,
              },
            })}
          </p>
        </div>
        <strong className="score-card__value">{formatNumber(shockSnapshot.score)}</strong>
      </div>
      <div className="interpretation-grid">
        <SignalList
          emptyText={t("narrative.emptyActiveStressChannels")}
          items={activeSignals.map((signal) => tDriver(signal.label))}
          title={t("sections.activeStressChannels")}
        />
        <SignalList
          emptyText={t("narrative.emptyCandidateStressChannels")}
          items={sourceGaps.map((gap) => tDriver(gap.label))}
          title={t("sections.candidateStressChannels")}
        />
        <section>
          <h4>{t("sections.mismatchWarnings")}</h4>
          <p className="score-note">{t("panels.shockRiskMismatchCount", { vars: { count: mismatchWarnings.length } })}</p>
        </section>
        <section>
          <h4>{t("sections.sourceGaps")}</h4>
          <p className="score-note">{t("panels.shockRiskSourceGapsCountShort", { vars: { count: sourceGaps.length } })}</p>
        </section>
      </div>
    </section>
  );
}
