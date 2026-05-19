import { formatStateLabel } from "../lib/regime";
import type { RegimeSnapshotFile } from "../lib/types";
import { useT } from "../lib/i18n";

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

type DisplayConfirmationItem = ConfirmationItem & { candidateOnly?: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConfirmationItem(value: unknown): value is ConfirmationItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.message === "string" &&
    typeof value.status === "string"
  );
}

function statusClassName(item: DisplayConfirmationItem) {
  return item.candidateOnly ? `status-${normalizeConfirmationKey(item.status)}` : "status-partial";
}

export default function CrossAssetConfirmationMatrix({
  candidateItems = [],
  items
}: {
  candidateItems?: CandidateConfirmationItem[];
  items: RegimeSnapshotFile["confirmations"];
}) {
  const { t, tCategorical } = useT();
  const activeItems = items.filter(isConfirmationItem);
  const activeIds = new Set(activeItems.map((item) => normalizeConfirmationKey(item.id)));
  const activeLabels = new Set(activeItems.map((item) => normalizeConfirmationKey(item.label)));
  const dedupedCandidates = candidateItems.filter(isConfirmationItem).filter((item) => {
    const id = normalizeConfirmationKey(item.id);
    const label = normalizeConfirmationKey(item.label);
    return !activeIds.has(id) && !activeLabels.has(label);
  });
  const displayItems: DisplayConfirmationItem[] = [
    ...activeItems,
    ...dedupedCandidates.map((item) => ({ ...item, candidateOnly: true }))
  ];

  if (!displayItems.length) {
    return (
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">{t("sections.crossAsset")}</p>
            <h3>{t("sections.confirmationMatrix")}</h3>
          </div>
        </div>
        <p>{t("panels.confirmationMatrixEmpty")}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.crossAsset")}</p>
          <h3>{t("sections.confirmationMatrix")}</h3>
        </div>
        <p>{t("panels.confirmationMatrixCount", { vars: { count: activeItems.length } })}</p>
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
            <span className={`status-pill ${statusClassName(item)}`}>
              {tCategorical("confirmation", formatConfirmationStatus(item.status))}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
