import SignalList from "./SignalList";

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
  title = "What this page says"
}: InterpretationPanelProps) {
  const caveatItems = caveats ?? notes;

  return (
    <section className="panel interpretation-panel">
      <p className="eyebrow">{title}</p>
      <h3>{label}</h3>
      <p>{summary}</p>
      <div className="interpretation-grid">
        <SignalList emptyText="No support signals in this view." items={supports} title="Supports" />
        <SignalList emptyText="No risk signals in this view." items={risks} title="Risks" />
        <SignalList emptyText="No conflicting signals in this view." items={conflicts} title="Conflicts" />
        <SignalList emptyText="No caveats in this view." items={caveatItems} title="Caveats" />
      </div>
    </section>
  );
}
