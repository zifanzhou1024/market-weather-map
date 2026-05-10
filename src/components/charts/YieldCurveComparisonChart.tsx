import EChartPanel from "../../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartCategoricalPalette,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../../charts/chartTheme";
import { formatNumber } from "../../charts/chartFormatters";
import InteractiveChartShell from "../InteractiveChartShell";
import type {
  RatesCurveSnapshotPoint,
  RatesCurveSnapshots,
  RatesCurveTenor
} from "../../lib/types";

/**
 * Comparison of the Treasury yield curve as it stands today versus three
 * historical snapshots (1M / 3M / 1Y ago). Tenors are categorical along the
 * x-axis in increasing maturity order: 2Y / 10Y / 20Y / 30Y.
 *
 * The four series are colored on an old-to-new gradient so the reader sees the
 * direction of travel at a glance. Older snapshots use lighter, cooler tones
 * (grey → neutral → dark green) while the current curve uses a warm red that
 * pops against the historical band. Stroke width also scales with recency.
 *
 * Tenors missing from any individual snapshot are sent into ECharts as
 * `null`, which the renderer treats as a line break — so a partial snapshot
 * (e.g. 20Y unavailable for the 1Y-ago curve) degrades gracefully without
 * dropping other series.
 *
 * Tone is descriptive only.
 */

const TENOR_ORDER: RatesCurveTenor[] = ["2Y", "10Y", "20Y", "30Y"];

interface VintageSpec {
  key: keyof RatesCurveSnapshots;
  label: string;
  color: string;
  width: number;
}

// Old → new. Stroke width and color both lean toward the latest snapshot to
// reinforce hierarchy without relying on color alone (accessibility hedge).
const VINTAGES: VintageSpec[] = [
  { key: "one_year_ago", label: "1Y ago", color: "#dce1d8", width: 1.4 },
  {
    key: "three_months_ago",
    label: "3M ago",
    color: chartColors.neutral,
    width: 1.6
  },
  {
    key: "one_month_ago",
    label: "1M ago",
    color: chartCategoricalPalette[0],
    width: 1.8
  },
  {
    key: "current",
    label: "Current",
    color: chartCategoricalPalette[2],
    width: 2.4
  }
];

export interface YieldCurveComparisonChartProps {
  data: RatesCurveSnapshots;
}

function tenorMap(points: RatesCurveSnapshotPoint[]): Map<RatesCurveTenor, number> {
  const map = new Map<RatesCurveTenor, number>();
  for (const point of points) {
    if (Number.isFinite(point.value)) {
      map.set(point.tenor as RatesCurveTenor, point.value);
    }
  }
  return map;
}

function buildSeriesData(
  snapshot: RatesCurveSnapshotPoint[]
): Array<number | null> {
  const map = tenorMap(snapshot);
  return TENOR_ORDER.map((tenor) => (map.has(tenor) ? (map.get(tenor) as number) : null));
}

function describeLargestMove(data: RatesCurveSnapshots): string {
  // Compare current vs 1Y ago across tenors to surface the most-moved point.
  const currentMap = tenorMap(data.current);
  const oneYearMap = tenorMap(data.one_year_ago);
  let bestTenor: RatesCurveTenor | null = null;
  let bestDelta = 0;
  for (const tenor of TENOR_ORDER) {
    const c = currentMap.get(tenor);
    const o = oneYearMap.get(tenor);
    if (typeof c !== "number" || typeof o !== "number") continue;
    const delta = c - o;
    if (Math.abs(delta) > Math.abs(bestDelta)) {
      bestTenor = tenor;
      bestDelta = delta;
    }
  }
  if (!bestTenor) {
    return "Treasury yield curve snapshots span the 2Y, 10Y, 20Y, and 30Y tenors.";
  }
  const bps = Math.round(bestDelta * 100);
  const direction = bps > 0 ? "higher" : bps < 0 ? "lower" : "flat vs.";
  return `Largest 1-year move at the ${bestTenor} tenor: ${Math.abs(bps)} bps ${direction} 1Y ago.`;
}

function tooltipFormatter(raw: unknown): string {
  const params = Array.isArray(raw)
    ? (raw as Array<{
        axisValueLabel: string;
        seriesName: string;
        value: number | null;
        color?: string;
      }>)
    : [];
  if (!params.length) return "";
  const tenor = params[0]?.axisValueLabel ?? "";
  const rows = params.map((p) => {
    const dot = p.color ? `<span style="color:${p.color}">●</span> ` : "";
    const valueStr =
      typeof p.value === "number" ? `${formatNumber(p.value, 2)}%` : "—";
    return `${dot}${p.seriesName}: <strong>${valueStr}</strong>`;
  });
  return [`<strong>${tenor}</strong>`, ...rows].join("<br/>");
}

export default function YieldCurveComparisonChart({
  data
}: YieldCurveComparisonChartProps) {
  const hasCurrent = data.current.length > 0;

  if (!hasCurrent) {
    return (
      <InteractiveChartShell
        title="Yield curve comparison"
        ariaLabel="Treasury yield curve comparison across 2Y, 10Y, 20Y, and 30Y tenors for current, 1-month ago, 3-months ago, and 1-year ago snapshots"
      >
        <EChartPanel
          title="Yield curve comparison"
          state="empty"
          emptyMessage="Treasury curve snapshots are not currently active."
          height={360}
        />
      </InteractiveChartShell>
    );
  }

  const series = VINTAGES.map((vintage) => ({
    name: vintage.label,
    type: "line" as const,
    showSymbol: true,
    symbolSize: vintage.key === "current" ? 7 : 5,
    lineStyle: { width: vintage.width, color: vintage.color },
    itemStyle: { color: vintage.color },
    // Caller-graceful skip: a missing tenor becomes a null point so ECharts
    // breaks the line at that x-position instead of dropping the whole series.
    connectNulls: false,
    data: buildSeriesData(data[vintage.key] as RatesCurveSnapshotPoint[])
  }));

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 56, bottom: 36 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: VINTAGES.map((v) => v.label),
      top: 8,
      textStyle: { color: chartTextStyle.color, fontSize: 11 }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      boundaryGap: false,
      data: [...TENOR_ORDER]
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      scale: true,
      name: "Yield (%)",
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    series
  };

  const insight = describeLargestMove(data);

  return (
    <InteractiveChartShell
      title="Yield curve comparison"
      ariaLabel="Treasury yield curve comparison across 2Y, 10Y, 20Y, and 30Y tenors for current, 1-month ago, 3-months ago, and 1-year ago snapshots"
      insight={insight}
    >
      <EChartPanel
        title="Yield curve comparison"
        description="Treasury yield curve today versus 1-month, 3-month, and 1-year-ago snapshots in percent."
        state="ready"
        option={option}
        ariaLabel="Line chart comparing 2Y, 10Y, 20Y, and 30Y Treasury yields across current and historical snapshots."
        height={360}
      />
    </InteractiveChartShell>
  );
}
