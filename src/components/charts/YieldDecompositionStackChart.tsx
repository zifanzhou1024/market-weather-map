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
import type { RatesCurrentDecomposition } from "../../lib/types";

/**
 * Single-row horizontal stacked bar showing the current 10-year nominal yield
 * decomposed into its real-yield and breakeven components, both in percent.
 *
 * Real-yield and breakeven segments use the same colors as
 * YieldChangeWaterfallChart so the two charts read as a pair (waterfall =
 * changes, stack = current level). The total nominal yield is annotated via
 * a markPoint at the right edge of the stack, and the insight callout below
 * the title describes which component contributes the larger share.
 *
 * Tone is descriptive only.
 */

const REAL_COLOR = chartCategoricalPalette[4]; // earthy blue — matches waterfall
const BREAKEVEN_COLOR = chartCategoricalPalette[3]; // gold — matches waterfall
const ROW_LABEL = "10Y";

export interface YieldDecompositionStackChartProps {
  data: RatesCurrentDecomposition;
}

function describeDominantComponent(data: RatesCurrentDecomposition): string {
  const { nominal_10y_pct, real_yield_10y_pct, breakeven_10y_pct } = data;
  if (!Number.isFinite(nominal_10y_pct)) {
    return "Current 10-year decomposition is not currently active.";
  }
  const dominant =
    Math.abs(real_yield_10y_pct) > Math.abs(breakeven_10y_pct)
      ? "Real yield"
      : "Breakeven";
  const nominal = `${formatNumber(nominal_10y_pct, 2)}%`;
  const real = `${formatNumber(real_yield_10y_pct, 2)}%`;
  const be = `${formatNumber(breakeven_10y_pct, 2)}%`;
  return `Nominal 10Y of ${nominal} = real yield ${real} + breakeven ${be}. ${dominant} contributes the larger share.`;
}

function tooltipFormatter(data: RatesCurrentDecomposition) {
  return (raw: unknown): string => {
    const params = Array.isArray(raw)
      ? (raw as Array<{ seriesName: string; value: number; color?: string }>)
      : [];
    if (!params.length) return "";
    const rows = params.map((p) => {
      const dot = p.color ? `<span style="color:${p.color}">●</span> ` : "";
      return `${dot}${p.seriesName}: <strong>${formatNumber(p.value, 2)}%</strong>`;
    });
    return [
      `<strong>10Y decomposition</strong>`,
      ...rows,
      `Nominal total: <strong>${formatNumber(data.nominal_10y_pct, 2)}%</strong>`
    ].join("<br/>");
  };
}

export default function YieldDecompositionStackChart({
  data
}: YieldDecompositionStackChartProps) {
  const allFinite =
    Number.isFinite(data.nominal_10y_pct) &&
    Number.isFinite(data.real_yield_10y_pct) &&
    Number.isFinite(data.breakeven_10y_pct);

  if (!allFinite) {
    return (
      <InteractiveChartShell
        title="Yield decomposition (current)"
        ariaLabel="Current 10-year yield decomposition: real yield plus breakeven inflation equals nominal yield"
      >
        <EChartPanel
          title="Yield decomposition (current)"
          state="empty"
          emptyMessage="Current 10Y decomposition is not currently active."
          height={200}
        />
      </InteractiveChartShell>
    );
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 40, bottom: 28, left: 64, right: 88 },
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
      type: "value" as const,
      name: "Yield (%)",
      nameLocation: "middle" as const,
      nameGap: 22,
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: [ROW_LABEL]
    },
    series: [
      {
        name: "Real yield",
        type: "bar" as const,
        stack: "decomposition",
        barWidth: 28,
        itemStyle: { color: REAL_COLOR },
        emphasis: { focus: "series" as const },
        label: {
          show: true,
          position: "inside" as const,
          color: "#ffffff",
          fontSize: 11,
          fontWeight: "bold" as const,
          formatter: (p: { value: number }) => `${formatNumber(p.value, 2)}%`
        },
        data: [data.real_yield_10y_pct]
      },
      {
        name: "Breakeven",
        type: "bar" as const,
        stack: "decomposition",
        barWidth: 28,
        itemStyle: { color: BREAKEVEN_COLOR },
        emphasis: { focus: "series" as const },
        label: {
          show: true,
          position: "inside" as const,
          color: "#ffffff",
          fontSize: 11,
          fontWeight: "bold" as const,
          formatter: (p: { value: number }) => `${formatNumber(p.value, 2)}%`
        },
        markPoint: {
          symbol: "rect",
          symbolSize: [1, 1],
          // Nominal-total badge anchored at the right end of the bar.
          data: [
            {
              name: "Nominal",
              value: `Nominal ${formatNumber(data.nominal_10y_pct, 2)}%`,
              xAxis: data.nominal_10y_pct,
              yAxis: ROW_LABEL,
              itemStyle: { color: "rgba(0,0,0,0)" },
              label: {
                show: true,
                position: "right" as const,
                color: chartColors.text,
                fontSize: 11,
                fontWeight: "bold" as const,
                formatter: `Nominal ${formatNumber(data.nominal_10y_pct, 2)}%`
              }
            }
          ]
        },
        data: [data.breakeven_10y_pct]
      }
    ]
  };

  const insight = describeDominantComponent(data);

  return (
    <InteractiveChartShell
      title="Yield decomposition (current)"
      ariaLabel="Current 10-year yield decomposition: real yield plus breakeven inflation equals nominal yield"
      insight={insight}
    >
      <EChartPanel
        title="Yield decomposition (current)"
        description="Latest 10-year nominal yield decomposed into real-yield and breakeven inflation components, both in percent."
        state="ready"
        option={option}
        ariaLabel="Horizontal stacked bar showing real-yield and breakeven contributions that sum to the current 10-year nominal yield."
        height={200}
      />
    </InteractiveChartShell>
  );
}
