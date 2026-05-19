import { useMemo } from "react";
import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import { formatNumber, formatSignedScore } from "../charts/chartFormatters";
import type { ShockRiskSignal } from "../lib/types";
import { useT } from "../lib/i18n";

interface ShockRiskContributionChartProps {
  activeSignals: ShockRiskSignal[];
}

interface BarDatum {
  value: number;
  itemStyle: { color: string };
  score: number;
  signalValue: number | null;
  change: number | null;
  label: string;
}

interface TooltipParams {
  data: BarDatum;
}

function colorForScore(score: number): string {
  if (score > 0) return chartColors.warning;
  if (score < 0) return chartColors.support;
  return chartColors.muted;
}

function safeScore(score: number | null): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return score;
}

function buildSortedRows(
  signals: ShockRiskSignal[],
  labelFor: (label: string) => string,
): BarDatum[] {
  return (
    signals
      .slice()
      .map<BarDatum>((signal) => {
        const score = safeScore(signal.score);
        return {
          value: score,
          itemStyle: { color: colorForScore(score) },
          score,
          signalValue: signal.value,
          change: signal.change,
          label: labelFor(signal.label)
        };
      })
      // ECharts horizontal bars draw with the first y-category at the bottom; sort
      // ascending so the largest |score| ends up at the top of the y-axis.
      .sort((a, b) => Math.abs(a.score) - Math.abs(b.score))
  );
}

export default function ShockRiskContributionChart({
  activeSignals
}: ShockRiskContributionChartProps) {
  const { t, tDriver } = useT();
  const rows = useMemo(
    () => buildSortedRows(activeSignals, (label) => tDriver(label)),
    // tDriver is a stable per-locale function but not memoized itself —
    // depending on activeSignals plus tDriver identity is acceptable since
    // the cost is tiny and re-rendering on locale change is the desired
    // behavior.
    [activeSignals, tDriver],
  );

  if (activeSignals.length === 0) {
    return (
      <EChartPanel
        title={t("panels.activeShockRiskTitle")}
        description={t("panels.activeShockRiskDesc")}
        state="empty"
        emptyMessage={t("panels.noVisibleSignals")}
      />
    );
  }

  const height = Math.max(220, 32 * activeSignals.length + 80);

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, left: 120 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (params: TooltipParams) => {
        const { label, score, signalValue, change } = params.data;
        const valueText = signalValue == null ? "—" : formatNumber(signalValue, 2);
        const changeText = change == null ? "—" : formatSignedScore(change, 2);
        return `${label}<br/>Score ${formatSignedScore(score)}<br/>Value ${valueText}<br/>1m change ${changeText}`;
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      scale: true
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: rows.map((row) => row.label)
    },
    series: [
      {
        type: "bar" as const,
        data: rows
      }
    ]
  };

  return (
    <EChartPanel
      title={t("panels.activeShockRiskTitle")}
      description={t("panels.activeShockRiskDesc")}
      state="ready"
      option={option}
      ariaLabel="Horizontal bar chart of active shock-risk signal contributions, sorted by magnitude"
      height={height}
    />
  );
}
