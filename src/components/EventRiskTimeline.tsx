import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import type { MacroCalendarFile } from "../lib/types";

interface EventRiskTimelineProps {
  calendar: MacroCalendarFile;
  /** Optional override for the cutoff date — defaults to today's UTC date. */
  today?: string;
  /** Maximum number of upcoming events to render. */
  limit?: number;
}

const DEFAULT_LIMIT = 10;

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RowEntry {
  title: string;
  date: string;
  daysAhead: number;
  importance: "high" | "medium" | "low";
  category: string;
  source: string;
}

interface BarParams {
  data: { value: number; daysAhead: number; importance: string };
  name: string;
}

function importanceColor(importance: "high" | "medium" | "low"): string {
  switch (importance) {
    case "high":
      return chartColors.warning;
    case "medium":
      return chartColors.missing;
    case "low":
    default:
      return chartColors.muted;
  }
}

export default function EventRiskTimeline({
  calendar,
  today = todayIsoUtc(),
  limit = DEFAULT_LIMIT
}: EventRiskTimelineProps) {
  const cutoff = new Date(`${today}T00:00:00Z`).getTime();
  const upcoming: RowEntry[] = (calendar.events ?? [])
    .filter((event) => typeof event.date === "string")
    .map((event) => {
      const date = event.date as string;
      const eventTime = new Date(`${date}T00:00:00Z`).getTime();
      const daysAhead = Math.round((eventTime - cutoff) / 86400000);
      return {
        title: event.title,
        date,
        daysAhead,
        importance: event.importance,
        category: event.category,
        source: event.source
      };
    })
    .filter((row) => row.daysAhead >= 0)
    .sort((a, b) => (a.daysAhead === b.daysAhead ? a.title.localeCompare(b.title) : a.daysAhead - b.daysAhead))
    .slice(0, limit);

  if (upcoming.length === 0) {
    return (
      <EChartPanel
        title="Event risk timeline"
        description="Upcoming high- and medium-importance macro events from the public calendar."
        state="empty"
        emptyMessage="No upcoming events in the current calendar window."
      />
    );
  }

  // Reverse for ECharts so the soonest event sits at the TOP of the y-axis.
  const ordered = [...upcoming].reverse();

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, left: 140, top: 16, bottom: 32 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (params: BarParams) => {
        const { daysAhead, importance } = params.data;
        const ahead = daysAhead === 0 ? "today" : `${daysAhead} day${daysAhead === 1 ? "" : "s"} ahead`;
        return `${params.name}<br/>${ahead} &middot; ${importance} importance`;
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "Days ahead",
      nameLocation: "middle" as const,
      nameGap: 24,
      min: 0
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: ordered.map((row) => row.title)
    },
    series: [
      {
        name: "Days ahead",
        type: "bar" as const,
        barWidth: 14,
        data: ordered.map((row) => ({
          value: row.daysAhead,
          daysAhead: row.daysAhead,
          importance: row.importance,
          itemStyle: { color: importanceColor(row.importance), borderRadius: 3 }
        }))
      }
    ]
  };

  return (
    <EChartPanel
      title="Event risk timeline"
      description={`${upcoming.length} upcoming event${upcoming.length === 1 ? "" : "s"} from the public macro calendar; high importance shown in red, medium in amber.`}
      state="ready"
      option={option}
      ariaLabel="Horizontal bar timeline of upcoming macro events ordered by date"
      height={Math.max(220, 28 * upcoming.length + 60)}
    />
  );
}
