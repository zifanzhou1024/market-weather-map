import { useMemo, useState } from "react";
import EChartPanel from "../../charts/EChartPanel";
import { buildTimeWindow, type RangePreset } from "../../charts/buildTimeWindow";
import {
  chartAxisDefaults,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../../charts/chartTheme";
import InteractiveChartShell from "../InteractiveChartShell";
import type { Observation, TimeSeriesFile } from "../../lib/types";

/**
 * Hero growth/labor/recession-risk percentile strip for the Growth route.
 *
 * One ECharts heatmap rendered as a 9-row by N-month grid where each cell
 * carries a `percentile_252d` value (0..100). Rows are 9 macro metrics; the
 * x-axis is the last N month-ends (filtered by the range preset).
 *
 * Inverted percentile semantics: for metrics where a higher underlying value
 * means MORE risk (Sahm rule, Initial claims, Unemployment rate), the cell
 * displays `100 - percentile_252d` so that red consistently reads as risk
 * across the strip. The raw percentile is still surfaced in the tooltip so
 * the reader can reconcile the visual mapping with the underlying data.
 *
 * Weekly inputs (initial_claims) are resampled to month-end last value before
 * grouping into cells.
 *
 * Tone: descriptive only. No buy/sell/short/target/stop/recommend/forecast.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";
const RANGE_DISABLED_REASON = "Monthly data needs at least one year to read.";

const VISUAL_MAP_COLORS = [
  "#3a7d5b", // support green (low percentile = less risk)
  "#d9d2c4", // neutral
  "#b04a3a"  // warning red (high percentile = elevated risk)
];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

export interface GrowthLaborMatrixHeroProps {
  sahmRule: TimeSeriesFile;
  initialClaims: TimeSeriesFile;
  unemploymentRate: TimeSeriesFile;
  nonfarmPayrolls: TimeSeriesFile;
  durableGoodsOrders: TimeSeriesFile;
  realRetailSales: TimeSeriesFile;
  industrialProduction: TimeSeriesFile;
  cfnai3mAvg: TimeSeriesFile;
  cfnai: TimeSeriesFile;
}

interface MetricRow {
  label: string;
  /** Rows where a higher underlying value reads as MORE risk. The display
   *  percentile is inverted to keep red == risk across the strip. */
  invertPercentile: boolean;
  observations: Observation[];
}

// Spec ordering top -> bottom. ECharts category yAxis renders data[0] at the
// bottom by default, so we'll feed it the REVERSED list and document that
// reversal at the call site below.
const SPEC_ROWS_TOP_TO_BOTTOM = [
  "Sahm rule",
  "Initial claims",
  "Unemployment rate",
  "Nonfarm payrolls",
  "Durable goods orders",
  "Real retail sales",
  "Industrial production",
  "CFNAI 3M avg",
  "CFNAI"
] as const;

const INVERTED_ROWS: ReadonlySet<string> = new Set([
  "Sahm rule",
  "Initial claims",
  "Unemployment rate"
]);

/**
 * Resample an arbitrarily-cadenced observation set into one observation per
 * month-end, keeping the LAST observation of each calendar month. Used for
 * weekly initial_claims so it slots cleanly into the monthly grid.
 */
function resampleToMonthEnd(obs: Observation[]): Observation[] {
  if (obs.length === 0) return [];
  const byMonth = new Map<string, Observation>();
  // Sort ascending so the last observation per month wins.
  const sorted = [...obs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const o of sorted) {
    const key = o.date.slice(0, 7); // YYYY-MM
    byMonth.set(key, o);
  }
  // Reassign the date to the last day of the month for deterministic alignment.
  return Array.from(byMonth.entries()).map(([key, observation]) => {
    const [year, month] = key.split("-").map((s) => Number.parseInt(s, 10));
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { ...observation, date: lastDay };
  });
}

function formatMmmYy(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const month = MONTH_LABELS[date.getUTCMonth()];
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${month} ${yy}`;
}

interface TooltipParam {
  data: [number, number, number];
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export default function GrowthLaborMatrixHero({
  sahmRule,
  initialClaims,
  unemploymentRate,
  nonfarmPayrolls,
  durableGoodsOrders,
  realRetailSales,
  industrialProduction,
  cfnai3mAvg,
  cfnai
}: GrowthLaborMatrixHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  // Resample claims to monthly and assemble the canonical row list. Each row
  // is paired with the metric label, an inversion flag, and the resampled
  // monthly observations.
  const rows: MetricRow[] = useMemo(() => {
    const claimsMonthly = resampleToMonthEnd(initialClaims.observations);
    return [
      { label: "Sahm rule", invertPercentile: true, observations: sahmRule.observations },
      { label: "Initial claims", invertPercentile: true, observations: claimsMonthly },
      {
        label: "Unemployment rate",
        invertPercentile: true,
        observations: unemploymentRate.observations
      },
      {
        label: "Nonfarm payrolls",
        invertPercentile: false,
        observations: nonfarmPayrolls.observations
      },
      {
        label: "Durable goods orders",
        invertPercentile: false,
        observations: durableGoodsOrders.observations
      },
      {
        label: "Real retail sales",
        invertPercentile: false,
        observations: realRetailSales.observations
      },
      {
        label: "Industrial production",
        invertPercentile: false,
        observations: industrialProduction.observations
      },
      { label: "CFNAI 3M avg", invertPercentile: false, observations: cfnai3mAvg.observations },
      { label: "CFNAI", invertPercentile: false, observations: cfnai.observations }
    ];
  }, [
    cfnai.observations,
    cfnai3mAvg.observations,
    durableGoodsOrders.observations,
    industrialProduction.observations,
    initialClaims.observations,
    nonfarmPayrolls.observations,
    realRetailSales.observations,
    sahmRule.observations,
    unemploymentRate.observations
  ]);

  const noData = rows.every((r) => r.observations.length === 0);

  // Determine the column set: union of all month-end dates from every row,
  // filtered by the range preset (against the latest date across rows).
  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      for (const o of row.observations) {
        set.add(o.date.slice(0, 7)); // month key
      }
    }
    const months = Array.from(set).sort();
    if (months.length === 0) return [] as string[];
    // Compute cutoff months for the range preset based on the latest month.
    const cutoffMonths = range === "All" ? months.length : range === "3Y" ? 36 : 12;
    return months.slice(-Math.min(cutoffMonths, months.length));
  }, [range, rows]);

  // Build a lookup of row label -> Map<YYYY-MM, percentile>. This lets us
  // construct heatmap cells aligned to the column set.
  const rowPercentileByMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const m = new Map<string, number>();
      // We trust the buildTimeWindow guarantee but apply it for parity with
      // other heroes; cells outside the active column window are filtered out
      // at render time via the `allDates` slice.
      const filtered = buildTimeWindow(row.observations, range);
      for (const o of filtered) {
        if (
          o.percentile_252d === null ||
          o.percentile_252d === undefined ||
          !Number.isFinite(o.percentile_252d)
        ) {
          continue;
        }
        const monthKey = o.date.slice(0, 7);
        const raw = clampPct(o.percentile_252d);
        const displayed = row.invertPercentile ? 100 - raw : raw;
        m.set(monthKey, displayed);
      }
      map.set(row.label, m);
    }
    return map;
  }, [range, rows]);

  if (noData) {
    return (
      <InteractiveChartShell
        title="Growth, labor, and recession-risk percentile strip"
        ariaLabel="Heatmap strip of growth, labor, and recession-risk percentile_252d values by metric and month"
      >
        <EChartPanel
          title="Growth, labor, and recession-risk percentile strip"
          state="empty"
          emptyMessage="Growth and labor history is not currently active."
          height={420}
        />
      </InteractiveChartShell>
    );
  }

  // ECharts category yAxis renders data[0] at the bottom; reverse the spec
  // top-to-bottom ordering when feeding the axis so the rendered grid reads
  // top-down per the spec.
  const yAxisLabels = [...SPEC_ROWS_TOP_TO_BOTTOM].reverse();
  // The cell y-index used in series data must match yAxis.data ordering.
  const yIndexByLabel = new Map<string, number>(
    yAxisLabels.map((label, idx) => [label, idx])
  );

  const xAxisLabels = allDates.map((monthKey) => {
    const [year, month] = monthKey.split("-").map((s) => Number.parseInt(s, 10));
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return formatMmmYy(lastDay);
  });

  // Build the cell list aligned to (xIndex, yIndex, displayedPercentile).
  const cells: Array<[number, number, number]> = [];
  // We need raw percentiles for the tooltip too — keep a parallel map indexed
  // by (xIndex, yIndex).
  const rawByCellKey = new Map<string, number>();

  for (const row of rows) {
    const yIdx = yIndexByLabel.get(row.label);
    if (yIdx === undefined) continue;
    const monthMap = rowPercentileByMonth.get(row.label) ?? new Map<string, number>();
    allDates.forEach((monthKey, xIdx) => {
      const displayed = monthMap.get(monthKey);
      if (displayed === undefined) return;
      cells.push([xIdx, yIdx, displayed]);
      const raw = row.invertPercentile ? 100 - displayed : displayed;
      rawByCellKey.set(`${xIdx}:${yIdx}`, raw);
    });
  }

  const tooltipFormatter = (raw: unknown): string => {
    const params = raw as TooltipParam;
    if (!params || !Array.isArray(params.data)) return "";
    const [xIdx, yIdx] = params.data;
    const metric = yAxisLabels[yIdx] ?? "";
    const monthKey = allDates[xIdx] ?? "";
    const rawPct = rawByCellKey.get(`${xIdx}:${yIdx}`);
    const rawPctText = rawPct !== undefined ? `${rawPct.toFixed(0)}%` : "—";
    const lines = [
      `<strong>${metric}</strong>`,
      `Month: ${monthKey}`,
      `1-year percentile: ${rawPctText}`
    ];
    if (INVERTED_ROWS.has(metric)) {
      lines.push("(higher value of underlying metric maps to redder cell)");
    }
    return lines.join("<br/>");
  };

  // Summary callout for the latest column.
  const latestColumnKey = allDates[allDates.length - 1] ?? "";
  const latestColumnLabel = xAxisLabels[xAxisLabels.length - 1] ?? "";
  let elevatedCount = 0;
  let supportiveCount = 0;
  rows.forEach((row) => {
    const monthMap = rowPercentileByMonth.get(row.label);
    const displayed = monthMap?.get(latestColumnKey);
    if (displayed === undefined) return;
    if (displayed >= 70) elevatedCount += 1;
    else if (displayed <= 30) supportiveCount += 1;
  });

  const insight = latestColumnKey
    ? `Each row is a single macro metric over recent months. Cells colored by the 1-year percentile of each observation: red is elevated risk, green is supportive. Initial claims, the Sahm rule, and the unemployment rate are inverted so that higher values consistently read as redder. Latest column (${latestColumnLabel}): ${elevatedCount} metrics elevated, ${supportiveCount} supportive.`
    : "Each row is a single macro metric over recent months. Cells colored by the 1-year percentile of each observation: red is elevated risk, green is supportive.";

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 24, bottom: 92, left: 140 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: tooltipFormatter
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: xAxisLabels,
      axisLabel: {
        ...chartAxisDefaults.axisLabel,
        rotate: 35,
        interval: 0
      },
      splitArea: { show: true }
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: yAxisLabels,
      splitArea: { show: true }
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: false,
      orient: "horizontal" as const,
      left: "center",
      bottom: 8,
      inRange: { color: VISUAL_MAP_COLORS },
      text: ["Elevated", "Supportive"],
      textStyle: { color: chartColors.muted, fontSize: 11 }
    },
    series: [
      {
        name: "Growth, labor, recession-risk strip",
        type: "heatmap" as const,
        data: cells,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: chartColors.grid } }
      }
    ]
  };

  return (
    <InteractiveChartShell
      title="Growth, labor, and recession-risk percentile strip"
      ariaLabel="Heatmap strip of growth, labor, and recession-risk percentile_252d values by metric and month"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      rangeDisabledReason={RANGE_DISABLED_REASON}
      insight={insight}
    >
      <EChartPanel
        title="Growth, labor, and recession-risk percentile strip"
        description="Each cell is a single metric-month 1-year percentile. Red is elevated risk, green is supportive. Sahm rule, initial claims, and the unemployment rate are inverted so that higher underlying values consistently read as redder."
        state="ready"
        option={option}
        ariaLabel="Heatmap of 9 growth, labor, and recession-risk metrics over recent months, with each cell colored by its 1-year percentile."
        height={420}
      />
    </InteractiveChartShell>
  );
}
