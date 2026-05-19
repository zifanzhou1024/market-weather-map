import SignalList from "./SignalList";
import { useT } from "../lib/i18n";

interface InterpretationPanelProps {
  caveats?: string[];
  conflicts?: string[];
  label: string;
  notes?: string[];
  risks?: string[];
  summary: string;
  supports?: string[];
  title?: string;
}

export default function InterpretationPanel({
  caveats,
  conflicts = [],
  label,
  notes = [],
  risks = [],
  summary,
  supports = [],
  title
}: InterpretationPanelProps) {
  const { t, tCategorical } = useT();
  const caveatItems = caveats ?? notes;
  const resolvedTitle = title ?? t("sections.whatThisPageSays");
  // Label may be a Python-emitted regime / bucket / read string. Run it
  // through the categorical lookup so multi-token phrases localize.
  const displayLabel = tCategorical("regime", label);

  return (
    <section className="panel interpretation-panel">
      <p className="eyebrow">{resolvedTitle}</p>
      <h3>{displayLabel}</h3>
      <p>{summary}</p>
      <div className="interpretation-grid">
        <SignalList emptyText={t("narrative.emptySupports")} items={supports} title={t("narrative.supports")} />
        <SignalList emptyText={t("narrative.emptyRisks")} items={risks} title={t("narrative.risks")} />
        <SignalList emptyText={t("narrative.emptyConflicts")} items={conflicts} title={t("narrative.conflicts")} />
        <SignalList emptyText={t("narrative.emptyCaveats")} items={caveatItems} title={t("narrative.caveats")} />
      </div>
    </section>
  );
}
