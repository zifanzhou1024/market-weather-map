import { formatStateLabel } from "../lib/regime";
import type { RegimeSnapshotFile } from "../lib/types";

const adviceTerms = /\b(buy|sell|short|long|entry|target|stop)\b/gi;

function removeAdviceTerms(value: string) {
  return value.replace(adviceTerms, "signal");
}

type ConfirmationItem = RegimeSnapshotFile["confirmations"][number];

interface CandidateConfirmationItem {
  id: string;
  label: string;
  message: string;
  status: string;
}

function normalizeConfirmationKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function formatConfirmationStatus(value: string) {
  return value === "terms_review_needed" ? "Terms review needed" : formatStateLabel(value);
}

function statusClassName(item: ConfirmationItem & { candidateOnly?: boolean }) {
  return item.candidateOnly ? `status-${normalizeConfirmationKey(item.status)}` : "status-partial";
}

export default function CrossAssetConfirmationMatrix({
  candidateItems = [],
  items
}: {
  candidateItems?: CandidateConfirmationItem[];
  items: RegimeSnapshotFile["confirmations"];
}) {
  const activeIds = new Set(items.map((item) => normalizeConfirmationKey(item.id)));
  const activeLabels = new Set(items.map((item) => normalizeConfirmationKey(item.label)));
  const dedupedCandidates = candidateItems.filter((item) => {
    const id = normalizeConfirmationKey(item.id);
    const label = normalizeConfirmationKey(item.label);
    return !activeIds.has(id) && !activeLabels.has(label);
  });
  const displayItems: Array<ConfirmationItem & { candidateOnly?: boolean }> = [
    ...items,
    ...dedupedCandidates.map((item) => ({ ...item, candidateOnly: true }))
  ];

  if (!displayItems.length) {
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
        {displayItems.map((item) => (
          <article
            className={`confirmation-matrix__item${item.candidateOnly ? " candidate-only" : ""}`}
            key={item.id}
          >
            <div>
              <h4>{item.label}</h4>
              <p>{removeAdviceTerms(item.message)}</p>
            </div>
            <span className={`status-pill ${statusClassName(item)}`}>{formatConfirmationStatus(item.status)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
