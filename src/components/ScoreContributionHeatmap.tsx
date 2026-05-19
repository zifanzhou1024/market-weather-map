import { useMemo } from "react";
import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import { formatSignedScore } from "../charts/chartFormatters";
import type { ScoreSummaryFile } from "../lib/types";
import { useT } from "../lib/i18n";

interface ScoreContributionHeatmapProps {
  scoreSummary: ScoreSummaryFile;
}

const FAMILY_ORDER = [
  { key: "market_weather", label: "Market Weather" },
  { key: "macro_climate", label: "Macro Climate" },
  { key: "fragility", label: "Fragility" }
] as const;

interface HeatmapPayload {
  bucketKeys: string[];
  cells: Array<[number, number, number]>;
  weightByCell: Map<string, number>;
}

function cellKey(bucketIndex: number, familyIndex: number): string {
  return `${familyIndex}:${bucketIndex}`;
}

function buildHeatmap(scoreSummary: ScoreSummaryFile): HeatmapPayload {
  const seen = new Set<string>();
  const orderedBuckets: string[] = [];
  for (const { key } of FAMILY_ORDER) {
    const family = scoreSummary.scores[key as keyof ScoreSummaryFile["scores"]];
    if (!family) continue;
    for (const bucketKey of Object.keys(family.bucket_scores ?? {})) {
      if (!seen.has(bucketKey)) {
        seen.add(bucketKey);
        orderedBuckets.push(bucketKey);
      }
    }
  }

  const cells: Array<[number, number, number]> = [];
  const weightByCell = new Map<string, number>();
  FAMILY_ORDER.forEach(({ key }, familyIndex) => {
    const family = scoreSummary.scores[key as keyof ScoreSummaryFile["scores"]];
    if (!family) return;
    const buckets = family.bucket_scores ?? {};
    const weights = family.bucket_weights ?? {};
    orderedBuckets.forEach((bucketKey, bucketIndex) => {
      const score = buckets[bucketKey];
      if (typeof score !== "number" || !Number.isFinite(score)) return;
      cells.push([bucketIndex, familyIndex, score]);
      const weight = typeof weights[bucketKey] === "number" ? weights[bucketKey] : 0;
      weightByCell.set(cellKey(bucketIndex, familyIndex), weight);
    });
  });

  return { bucketKeys: orderedBuckets, cells, weightByCell };
}

interface HeatmapTooltipParams {
  data: [number, number, number];
}

function buildOption(payload: HeatmapPayload) {
  const { bucketKeys, cells, weightByCell } = payload;
  return {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 32, bottom: 64 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (params: HeatmapTooltipParams) => {
        const [bucketIndex, familyIndex, score] = params.data;
        const familyLabel = FAMILY_ORDER[familyIndex]?.label ?? "";
        const bucketLabel = bucketKeys[bucketIndex] ?? "";
        const weight = weightByCell.get(cellKey(bucketIndex, familyIndex)) ?? 0;
        const weightedContribution = score * weight;
        return `${familyLabel} &middot; ${bucketLabel}<br/>Score ${formatSignedScore(score)} &middot; weight ${weight.toFixed(2)}<br/>Weighted contribution ${formatSignedScore(weightedContribution)}`;
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: bucketKeys,
      axisLabel: {
        ...chartAxisDefaults.axisLabel,
        rotate: 45,
        interval: 0
      },
      splitArea: { show: true }
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: FAMILY_ORDER.map((entry) => entry.label),
      splitArea: { show: true }
    },
    visualMap: {
      min: -100,
      max: 100,
      calculable: false,
      orient: "horizontal" as const,
      left: "center",
      bottom: 4,
      inRange: {
        color: [chartColors.warning, "#f0eee5", chartColors.support]
      },
      textStyle: { color: chartColors.muted, fontSize: 11 }
    },
    series: [
      {
        type: "heatmap" as const,
        data: cells,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: chartColors.grid } }
      }
    ]
  };
}

export default function ScoreContributionHeatmap({ scoreSummary }: ScoreContributionHeatmapProps) {
  const { t } = useT();
  const payload = useMemo(() => buildHeatmap(scoreSummary), [scoreSummary]);

  if (payload.cells.length === 0) {
    return (
      <EChartPanel
        title={t("panels.scoreHeatmapTitle")}
        description={t("panels.scoreHeatmapDesc")}
        state="empty"
        emptyMessage={t("panels.scoreHeatmapEmpty")}
      />
    );
  }

  return (
    <EChartPanel
      title={t("panels.scoreHeatmapTitle")}
      description={t("panels.scoreHeatmapDesc")}
      state="ready"
      option={buildOption(payload)}
      ariaLabel="Heatmap of bucket scores per Market Weather, Macro Climate, and Fragility families"
    />
  );
}
