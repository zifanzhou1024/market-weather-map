import CandidateSourcePanel, { normalizeCandidateStatus, type CandidateSourceItem } from "./CandidateSourcePanel";
import type { MacroCalendarEvent, MacroCalendarFile, MacroEventStatus } from "../lib/types";

const eventRiskItems: CandidateSourceItem[] = [
  {
    id: "event_cpi",
    label: "CPI",
    note: "Release-calendar candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_fomc",
    label: "FOMC",
    note: "Meeting-calendar candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_payrolls",
    label: "payrolls",
    note: "Labor-release candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_treasury_auction",
    label: "Treasury auctions",
    note: "Auction-calendar candidate pending source readiness review.",
    status: "source_review_required"
  },
  {
    id: "event_opex",
    label: "OPEX",
    note: "Options-expiration calendar candidate pending source readiness review.",
    status: "source_review_required"
  }
];

interface EventRiskPanelProps {
  calendar?: MacroCalendarFile;
  items?: CandidateSourceItem[];
}

const eventStatusLabels: Record<MacroEventStatus, string> = {
  estimated: "Estimated",
  scheduled: "Scheduled",
  source_link: "Source link"
};

function statusClassName(status: string) {
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_");
  return normalized ? `status-${normalized}` : "status-source_review_required";
}

function formatWhen(event: MacroCalendarEvent) {
  return [event.date ?? "See source", event.time, event.timezone].filter(Boolean).join(" ");
}

export default function EventRiskPanel({ calendar, items = eventRiskItems }: EventRiskPanelProps) {
  if (!calendar) {
    return (
      <CandidateSourcePanel
        eyebrow="Candidate sources"
        items={items}
        summary="Source-gated calendar rows only; this panel does not publish event predictions."
        title="Event risk"
      />
    );
  }

  return (
    <section className="panel event-risk-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Official source-linked calendar context</p>
          <h3>Event risk</h3>
          <p>
            Static official calendar context is descriptive release context only and does not affect active scores,
            regime labels, checklist states, or confidence.
          </p>
        </div>
        <span className="status-pill status-not_scored">Not scored</span>
      </div>
      <div className="calendar-list calendar-list--compact">
        {calendar.events.map((event) => (
          <article className="calendar-event" key={event.id}>
            <div className="calendar-event__summary">
              <div>
                <p className="metric-source">{event.source}</p>
                <h4>{event.title}</h4>
              </div>
              <span className="status-pill">{eventStatusLabels[event.status]}</span>
            </div>
            <p>{event.notes}</p>
            <dl>
              <div>
                <dt>When</dt>
                <dd>{formatWhen(event)}</dd>
              </div>
              <div>
                <dt>Importance</dt>
                <dd>{event.importance}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>
                  <a href={event.source_url}>{event.source}</a>
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      {items.length > 0 ? (
        <div className="candidate-source-list event-risk-candidate-list" role="list">
          {items.map((item) => (
            <article className="candidate-source-row" key={item.id} role="listitem">
              <div>
                <h4>{item.label}</h4>
                <p>{item.note}</p>
              </div>
              <span className={`status-pill ${statusClassName(item.status)}`}>
                {normalizeCandidateStatus(item.status)}
              </span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
