import { formatStateLabel } from "../lib/regime";
import type { RegimeSnapshotFile } from "../lib/types";

export default function SignalChecklist({ items }: { items: RegimeSnapshotFile["checklist"] }) {
  if (!items.length) {
    return (
      <section className="panel signal-checklist">
        <div className="section-header">
          <div>
            <p className="eyebrow">Signals</p>
            <h3>Signal checklist</h3>
          </div>
        </div>
        <p>No regime checklist signals are available.</p>
      </section>
    );
  }

  return (
    <section className="panel signal-checklist">
      <div className="section-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h3>Signal checklist</h3>
        </div>
        <p>{items.length} checks</p>
      </div>
      <div className="signal-checklist__rows">
        {items.map((item) => (
          <div className="signal-checklist__row" key={item.id}>
            <div>
              <h4>{item.label}</h4>
              <p>{item.message}</p>
            </div>
            <span className="status-pill status-partial">{formatStateLabel(item.state)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
