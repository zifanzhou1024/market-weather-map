import { formatStateLabel } from "../lib/regime";
import type { RegimeSnapshotFile } from "../lib/types";

const adviceTerms = /\b(buy|sell|short|long|entry|target|stop)\b/gi;

function removeAdviceTerms(value: string) {
  return value.replace(adviceTerms, "signal");
}

export default function CrossAssetConfirmationMatrix({
  items
}: {
  items: RegimeSnapshotFile["confirmations"];
}) {
  if (!items.length) {
    return (
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Cross asset</p>
            <h3>Confirmation matrix</h3>
          </div>
        </div>
        <p>No cross-asset confirmations are available.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Cross asset</p>
          <h3>Confirmation matrix</h3>
        </div>
        <p>{items.length} markets</p>
      </div>
      <div className="confirmation-matrix">
        {items.map((item) => (
          <article className="confirmation-matrix__item" key={item.id}>
            <div>
              <h4>{item.label}</h4>
              <p>{removeAdviceTerms(item.message)}</p>
            </div>
            <span className="status-pill status-partial">{formatStateLabel(item.status)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
