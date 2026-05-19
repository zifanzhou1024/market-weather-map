import type { ReactNode } from "react";
import type { ExternalResearchLink } from "../lib/externalResearchLinks";
import ExternalResearchLinks from "./ExternalResearchLinks";
import { useT } from "../lib/i18n";

export interface CandidateSourceItem {
  id: string;
  label: string;
  status: string;
  note: string;
  links?: readonly ExternalResearchLink[];
}

interface CandidateSourcePanelProps {
  title: string;
  eyebrow?: string;
  summary?: string;
  items: CandidateSourceItem[];
  emptyText?: string;
  footer?: ReactNode;
}

export function normalizeCandidateStatus(status: string | undefined) {
  if (!status) return "Source review required";
  const normalized = status.trim().replace(/[_-]+/g, " ");
  if (!normalized) return "Source review required";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function statusClassName(status: string) {
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_");
  return normalized ? `status-${normalized}` : "status-source_review_required";
}

export default function CandidateSourcePanel({
  title,
  eyebrow,
  summary,
  items,
  emptyText,
  footer
}: CandidateSourcePanelProps) {
  const { t, tCategorical } = useT();
  const resolvedEmpty = emptyText ?? t("panels.candidateSourceEmpty");
  return (
    <section className="panel candidate-source-panel">
      <div className="section-header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
          {summary ? <p>{summary}</p> : null}
        </div>
      </div>
      {items.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {items.map((item) => (
            <article className="candidate-source-row" key={item.id} role="listitem">
              <div>
                <h4>{item.label}</h4>
                <p>{item.note}</p>
                <ExternalResearchLinks
                  className="candidate-source-links"
                  id={item.id}
                  label={item.label}
                  links={item.links}
                />
              </div>
              <span className={`status-pill ${statusClassName(item.status)}`}>
                {tCategorical("status", normalizeCandidateStatus(item.status))}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">{resolvedEmpty}</p>
      )}
      {footer}
    </section>
  );
}
