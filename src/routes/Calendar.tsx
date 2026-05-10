import { useEffect, useMemo, useState } from "react";
import RouteDataFooter from "../components/RouteDataFooter";
import { loadMacroCalendar } from "../lib/data";
import type { MacroCalendarEvent, MacroCalendarFile, MacroEventImportance, MacroEventStatus } from "../lib/types";

const importanceGroups: Array<{ key: MacroEventImportance; label: string }> = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" }
];

const statusLabels: Record<MacroEventStatus, string> = {
  estimated: "Estimated",
  scheduled: "Scheduled",
  source_link: "Source link"
};

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
        <p className="eyebrow">Event risk</p>
        <h2>Macro Calendar</h2>
        <p>Descriptive release and policy-event context from official public source pages.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          {importanceGroups.map((group) => {
            const events = eventsByImportance[group.key];

            return (
              <section className="panel" key={group.key}>
                <div className="section-header">
                  <div>
                    <p className="eyebrow">Importance</p>
                    <h3>{group.label}</h3>
                  </div>
                  <p>{events.length} events</p>
                </div>
                {events.length > 0 ? (
                  <div className="calendar-list">
                    {events.map((event) => (
                      <article className="calendar-event" key={event.id}>
                        <div className="calendar-event__summary">
                          <div>
                            <p className="metric-source">{event.source}</p>
                            <h4>{event.title}</h4>
                          </div>
                          <span className="status-pill">{statusLabels[event.status]}</span>
                        </div>
                        <p>{event.notes}</p>
                        <dl>
                          <div>
                            <dt>Category</dt>
                            <dd>{event.category}</dd>
                          </div>
                          <div>
                            <dt>When</dt>
                            <dd>{formatWhen(event)}</dd>
                          </div>
                          <div>
                            <dt>Importance</dt>
                            <dd>{group.label}</dd>
                          </div>
                          <div>
                            <dt>Source</dt>
                            <dd>
                              <a
                                aria-label={`Source calendar for ${event.title} (${event.source})`}
                                href={event.source_url}
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
                  <p>No {group.label.toLowerCase()} importance events in this file.</p>
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
