import { useEffect, useMemo, useState } from "react";
import RouteDataFooter from "../components/RouteDataFooter";
import { loadMacroCalendar } from "../lib/data";
import { useT } from "../lib/i18n";
import type { MacroCalendarEvent, MacroCalendarFile, MacroEventImportance, MacroEventStatus } from "../lib/types";

// Importance keys map onto the i18n labels rendered in the section header,
// the empty-state copy, and the per-event "Importance" dd.
const IMPORTANCE_LABEL_KEYS: Record<MacroEventImportance, string> = {
  high: "calendar.impactHigh",
  medium: "calendar.impactMedium",
  low: "calendar.impactLow"
};

const IMPORTANCE_EMPTY_KEYS: Record<MacroEventImportance, string> = {
  high: "calendar.emptyHigh",
  medium: "calendar.emptyMedium",
  low: "calendar.emptyLow"
};

const STATUS_LABEL_KEYS: Record<MacroEventStatus, string> = {
  estimated: "calendar.statusEstimated",
  scheduled: "calendar.statusScheduled",
  source_link: "calendar.statusSourceLink"
};

const IMPORTANCE_GROUP_KEYS: readonly MacroEventImportance[] = [
  "high",
  "medium",
  "low"
];

function isMacroEventImportance(value: unknown): value is MacroEventImportance {
  return value === "high" || value === "medium" || value === "low";
}

function validateCalendar(calendar: MacroCalendarFile) {
  for (const event of calendar.events) {
    if (!isMacroEventImportance(event.importance)) {
      throw new Error(`Invalid macro calendar importance for ${event.id}.`);
    }
  }
}

function formatWhen(event: MacroCalendarEvent) {
  const parts = [event.date ?? "See source", event.time, event.timezone].filter(Boolean);
  return parts.join(" ");
}

export default function Calendar() {
  const { t } = useT();
  const [data, setData] = useState<MacroCalendarFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      try {
        const calendar = await loadMacroCalendar();
        validateCalendar(calendar);
        if (active) setData(calendar);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load macro calendar.");
      }
    }

    void loadCalendar();

    return () => {
      active = false;
    };
  }, []);

  const eventsByImportance = useMemo(() => {
    const groups: Record<MacroEventImportance, MacroCalendarEvent[]> = {
      high: [],
      low: [],
      medium: []
    };

    for (const event of data?.events ?? []) {
      groups[event.importance].push(event);
    }

    return groups;
  }, [data]);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{t("routes.calendarEyebrow")}</p>
        <h2>{t("routes.calendarHeading")}</h2>
        <p>{t("routes.calendarIntro")}</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          {t("chrome.dataErrorPrefix")}: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          {IMPORTANCE_GROUP_KEYS.map((groupKey) => {
            const events = eventsByImportance[groupKey];
            const groupLabel = t(IMPORTANCE_LABEL_KEYS[groupKey]);

            return (
              <section className="panel" key={groupKey}>
                <div className="section-header">
                  <div>
                    <p className="eyebrow">{t("calendar.importanceEyebrow")}</p>
                    <h3>{groupLabel}</h3>
                  </div>
                  <p>{events.length} {t("calendar.eventsCountSuffix")}</p>
                </div>
                {events.length > 0 ? (
                  <div className="calendar-list">
                    {events.map((event) => (
                      <article className="calendar-event" key={event.id}>
                        <div className="calendar-event__summary">
                          <div>
                            <p className="metric-source" lang="en">{event.source}</p>
                            <h4 lang="en">{event.title}</h4>
                          </div>
                          <span className="status-pill">{t(STATUS_LABEL_KEYS[event.status])}</span>
                        </div>
                        <p lang="en">{event.notes}</p>
                        <dl>
                          <div>
                            <dt>{t("calendar.catLabel")}</dt>
                            <dd lang="en">{event.category}</dd>
                          </div>
                          <div>
                            <dt>{t("calendar.whenLabel")}</dt>
                            <dd>{formatWhen(event)}</dd>
                          </div>
                          <div>
                            <dt>{t("calendar.importanceLabel")}</dt>
                            <dd>{groupLabel}</dd>
                          </div>
                          <div>
                            <dt>{t("calendar.sourceLabel")}</dt>
                            <dd>
                              <a
                                aria-label={`Source calendar for ${event.title} (${event.source})`}
                                href={event.source_url}
                                lang="en"
                              >
                                {event.source}
                              </a>
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>{t(IMPORTANCE_EMPTY_KEYS[groupKey])}</p>
                )}
              </section>
            );
          })}
          <RouteDataFooter />
        </div>
      ) : null}
    </main>
  );
}
