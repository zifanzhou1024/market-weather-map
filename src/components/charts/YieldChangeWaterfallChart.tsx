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
  RatesDashboardFile,
  RatesYieldChangeWindowKey,
  RatesYieldDriver
} from "../../lib/types";

/**
 * Diagnostic waterfall of 10-year nominal yield changes per window
 * (1M / 3M / 6M / 1Y), decomposed into real-yield and breakeven contributions
 * in basis points.
 *
 * Each column stacks the real-yield bps and breakeven bps for that window, so
 * positive and negative contributions render in the same column. The nominal
 * total annotation above the stack uses the actual `nominal_10y_bps` value
 * from the dashboard — not the algebraic sum of the two segments — because
 * the upstream computation derives them independently and small rounding
 * differences can accumulate.
 *
 * The `driver` field highlights which contribution dominated the move:
 *   - `real_yield` → real-yield bar full opacity, breakeven dimmed.
 *   - `breakeven` → breakeven full opacity, real-yield dimmed.
 *   - `balanced` → both at full opacity, tooltip carries a "balanced" tag.
 *
 * Tone is descriptive only. No advice, no forecast, no buy/sell language.
 */

const WINDOW_ORDER: RatesYieldChangeWindowKey[] = ["1M", "3M", "6M", "1Y"];

const REAL_COLOR = chartCategoricalPalette[4]; // earthy blue, used in YieldDecompositionStackChart too
const BREAKEVEN_COLOR = chartCategoricalPalette[3]; // gold/burnt-orange
const DIMMED_OPACITY = 0.45;

const DRIVER_LABEL: Record<RatesYieldDriver, string> = {
  real_yield: "real-yield led",
  breakeven: "breakeven led",
  balanced: "balanced"
};

export interface YieldChangeWaterfallChartProps {
  data: RatesDashboardFile["yield_change_windows"];
}

interface BarDatum {
  value: number;
  itemStyle: { color: string; opacity: number };
}

function buildBarDatum(value: number, color: string, dim: boolean): BarDatum {
  return {
    value,
    itemStyle: {
      color,
      opacity: dim ? DIMMED_OPACITY : 1
    }
  };
}

function isMissingWindow(w: RatesDashboardFile["yield_change_windows"][RatesYieldChangeWindowKey]) {
  return (
    !Number.isFinite(w.nominal_10y_bps) &&
    !Number.isFinite(w.real_yield_10y_bps) &&
    !Number.isFinite(w.breakeven_10y_bps)
  );
}

function formatBps(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 0)} bps`;
}

function describeLargestDriver(
  data: RatesDashboardFile["yield_change_windows"]
): string {
  // Pick the window with the largest absolute nominal move so the insight
  // line points the reader at the most informative column. Falls back to a
  // generic description if no finite values exist.
  let bestKey: RatesYieldChangeWindowKey | null = null;
  let bestMagnitude = -Infinity;
  for (const key of WINDOW_ORDER) {
    const value = data[key].nominal_10y_bps;
    if (!Number.isFinite(value)) continue;
    if (Math.abs(value) > bestMagnitude) {
      bestMagnitude = Math.abs(value);
      bestKey = key;
    }
  }
  if (!bestKey) {
    return "Yield-change windows are not currently active.";
  }
  const w = data[bestKey];
  return `Largest 10Y nominal change is over ${bestKey} (${formatBps(w.nominal_10y_bps)}); driver: ${DRIVER_LABEL[w.driver]}.`;
}

function tooltipFormatter(data: RatesDashboardFile["yield_change_windows"]) {
  return (raw: unknown): string => {
    const params = Array.isArray(raw) ? raw : [raw];
    const first = params[0] as { axisValueLabel?: string; name?: string } | undefined;
    const key = (first?.axisValueLabel ?? first?.name) as
      | RatesYieldChangeWindowKey
      | undefined;
    if (!key || !data[key]) return "";
    const w = data[key];
    return [
      `<strong>${key} change</strong>`,
      `Real yield: ${formatBps(w.real_yield_10y_bps)}`,
      `Breakeven: ${formatBps(w.breakeven_10y_bps)}`,
      `Nominal total: ${formatBps(w.nominal_10y_bps)}`,
      `Driver: ${DRIVER_LABEL[w.driver]}`
    ].join("<br/>");
  };
}

export default function YieldChangeWaterfallChart({
  data
}: YieldChangeWaterfallChartProps) {
  const activeWindows = WINDOW_ORDER.filter((key) => !isMissingWindow(data[key]));

  if (activeWindows.length === 0) {
    return (
      <InteractiveChartShell
        title="Yield change waterfall"
        ariaLabel="10-year yield change waterfall over 1-month, 3-month, 6-month, and 1-year windows, in basis points"
      >
        <EChartPanel
          title="Yield change waterfall"
          state="empty"
          emptyMessage="Yield-change windows are not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  const realData: BarDatum[] = WINDOW_ORDER.map((key) => {
    const w = data[key];
    const value = Number.isFinite(w.real_yield_10y_bps) ? w.real_yield_10y_bps : 0;
    const dim = w.driver === "breakeven";
    return buildBarDatum(value, REAL_COLOR, dim);
  });

  const breakevenData: BarDatum[] = WINDOW_ORDER.map((key) => {
    const w = data[key];
    const value = Number.isFinite(w.breakeven_10y_bps) ? w.breakeven_10y_bps : 0;
    const dim = w.driver === "real_yield";
    return buildBarDatum(value, BREAKEVEN_COLOR, dim);
  });

  // Transparent helper series used purely to host the per-window nominal-total
  // label. We push the helper bars near zero (value 0) so they don't add to
  // the visible stack; the label `position: "top"` calculation uses the
  // formatter result string positioned at the top of the column area via
  // the bar's offset. To keep the label visually above the actual stacked
  // bars, we read the highest-positive bar tip from the real+breakeven sum
  // and use that as the helper value, with a fully transparent fill.
  const totalLabelData = WINDOW_ORDER.map((key) => {
    const w = data[key];
    const realVal = Number.isFinite(w.real_yield_10y_bps) ? w.real_yield_10y_bps : 0;
    const beVal = Number.isFinite(w.breakeven_10y_bps) ? w.breakeven_10y_bps : 0;
    // Sum of positive contributions = top of the stack (negatives sit below 0).
    const top = Math.max(realVal, 0) + Math.max(beVal, 0);
    return {
      value: top,
      itemStyle: { color: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)" }
    };
  });

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 56, bottom: 36 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      axisPointer: { type: "shadow" as const },
      formatter: tooltipFormatter(data)
    },
    legend: {
      data: ["Real yield", "Breakeven"],
      top: 8,
      textStyle: { color: chartTextStyle.color, fontSize: 11 }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: [...WINDOW_ORDER]
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "bps",
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    series: [
      {
        name: "Real yield",
        type: "bar" as const,
        stack: "yield_change",
        emphasis: { focus: "series" as const },
        data: realData
      },
      {
        name: "Breakeven",
        type: "bar" as const,
        stack: "yield_change",
        emphasis: { focus: "series" as const },
        data: breakevenData
      },
      {
        name: "Nominal total",
        type: "bar" as const,
        // Helper series — invisible, used to host one label per column.
        barGap: "-100%",
        barWidth: 0,
        silent: true,
        data: totalLabelData,
        label: {
          show: true,
          position: "top" as const,
          color: chartColors.text,
          fontSize: 11,
          fontWeight: "bold" as const,
          formatter: (p: { dataIndex: number }) => {
            const key = WINDOW_ORDER[p.dataIndex];
            const w = data[key];
            return formatBps(w.nominal_10y_bps);
          }
        }
      }
    ]
  };

  const insight = describeLargestDriver(data);

  return (
    <InteractiveChartShell
      title="Yield change waterfall"
      ariaLabel="10-year yield change waterfall over 1-month, 3-month, 6-month, and 1-year windows, in basis points"
      insight={insight}
    >
      <EChartPanel
        title="Yield change waterfall"
        description="10-year nominal yield change decomposed into real-yield and breakeven contributions in basis points."
        state="ready"
        option={option}
        ariaLabel="Stacked bar of 10-year yield changes in basis points across 1-month, 3-month, 6-month, and 1-year windows."
        height={380}
      />
    </InteractiveChartShell>
  );
}
