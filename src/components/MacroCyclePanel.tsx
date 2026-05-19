import { formatNumber } from "../lib/formatters";
import SignalList from "./SignalList";
import { useT } from "../lib/i18n";

interface MacroCyclePanelProps {
  caveat: string;
  label: string;
  risks: readonly string[];
  score: number | null | undefined;
  supports: readonly string[];
  title: string;
}

export default function MacroCyclePanel({
  caveat,
  label,
  risks,
  score,
  supports,
  title
}: MacroCyclePanelProps) {
  const { t, tCategorical } = useT();
  const localizedTitle = tCategorical("bucket", title);
  const localizedLabel = tCategorical("bucketReading", label);
  return (
    <article className="macro-cycle-panel">
      <div className="macro-cycle-panel__header">
        <div>
          <p className="eyebrow">{t("sections.cycleRead")}</p>
          <h3>{localizedTitle}</h3>
        </div>
        <div className="macro-cycle-panel__score" aria-label={`${title} score`}>
          <strong>{formatNumber(score)}</strong>
          <span>{localizedLabel}</span>
        </div>
      </div>

      <div className="macro-cycle-panel__signals">
        <SignalList emptyText={t("narrative.emptySupports")} items={[...supports]} title={t("narrative.supports")} />
        <SignalList emptyText={t("narrative.emptyRisks")} items={[...risks]} title={t("narrative.risks")} />
      </div>

      <p className="macro-cycle-panel__caveat">{caveat}</p>
    </article>
  );
}
