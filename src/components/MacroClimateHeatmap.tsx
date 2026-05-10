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

interface MacroClimateHeatmapProps {
  scoreSummary: ScoreSummaryFile;
}

export interface MacroClimateHeatmapPayload {
  bucketKeys: string[];
  axisLabels: string[];
  weights: number[];
  scores: number[];
  contributions: number[];
  /** Cells: [xIndex, yIndex, value]. y=0 is the Score row, y=1 is Weighted contribution. */
  cells: Array<[number, number, number]>;
  contributionAbsMax: number;
}

const ROW_LABELS = ["Score", "Weighted contribution"] as const;

function humaniseBucketKey(key: string): string {
  if (!key) return key;
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function buildMacroClimateHeatmapPayload(
  scoreSummary: ScoreSummaryFile
): MacroClimateHeatmapPayload {
  const macro = scoreSummary.scores?.macro_climate;
  const bucketScores = macro?.bucket_scores ?? {};
  const bucketWeights = macro?.bucket_weights ?? {};

  const finiteEntries = Object.entries(bucketScores).filter(
    ([, score]) => typeof score === "number" && Number.isFinite(score)
  ) as Array<[string, number]>;

  const enriched = finiteEntries.map(([key, score]) => {
    const weight =
      typeof bucketWeights[key] === "number" && Number.isFinite(bucketWeights[key])
        ? bucketWeights[key]
        : 0;
    const contribution = score * weight;
    return { key, score, weight, contribution };
  });

  // Sort by absolute weighted contribution descending, with deterministic tiebreaker.
  enriched.sort((a, b) => {
    const diff = Math.abs(b.contribution) - Math.abs(a.contribution);
    if (diff !== 0) return diff;
    return a.key.localeCompare(b.key);
  });

  const bucketKeys = enriched.map((e) => e.key);
  const axisLabels = enriched.map((e) => humaniseBucketKey(e.key));
  const weights = enriched.map((e) => e.weight);
  const scores = enriched.map((e) => e.score);
  const contributions = enriched.map((e) => e.contribution);

  const cells: Array<[number, number, number]> = [];
  enriched.forEach((entry, xIndex) => {
    cells.push([xIndex, 0, entry.score]);
    cells.push([xIndex, 1, entry.contribution]);
  });

  const contributionAbsMax = contributions.reduce(
    (max, c) => Math.max(max, Math.abs(c)),
    0
  );

  return {
    bucketKeys,
    axisLabels,
    weights,
    scores,
    contributions,
    cells,
    contributionAbsMax
  };
}

interface HeatmapTooltipParams {
  data: [number, number, number];
}

function buildOption(payload: MacroClimateHeatmapPayload) {
  const { axisLabels, weights, scores, contributions, cells, contributionAbsMax } = payload;
  const contributionRange = contributionAbsMax > 0 ? contributionAbsMax : 1;
  return {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 32, bottom: 88, left: 140 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (params: HeatmapTooltipParams) => {
        const [xIndex, yIndex] = params.data;
        const bucketLabel = axisLabels[xIndex] ?? "";
        const score = scores[xIndex];
        const weight = weights[xIndex] ?? 0;
        const contribution = contributions[xIndex];
        const rowLabel = ROW_LABELS[yIndex] ?? "";
        return `${bucketLabel} &middot; ${rowLabel}<br/>Score ${formatSignedScore(score)} &middot; weight ${weight.toFixed(2)}<br/>Weighted contribution ${formatSignedScore(contribution)}`;
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: axisLabels,
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
      data: ROW_LABELS,
      splitArea: { show: true }
    },
    visualMap: [
      {
        seriesIndex: 0,
        min: -100,
        max: 100,
        calculable: false,
        orient: "horizontal" as const,
        left: "center",
        bottom: 4,
        inRange: {
          color: [chartColors.warning, "#f0eee5", chartColors.support]
        },
        text: ["Support", "Risk"],
        textStyle: { color: chartColors.muted, fontSize: 11 }
      },
      {
        seriesIndex: 1,
        show: false,
        min: -contributionRange,
        max: contributionRange,
        calculable: false,
        inRange: {
          color: [chartColors.warning, "#f0eee5", chartColors.support]
        }
      }
    ],
    series: [
      {
        name: ROW_LABELS[0],
        type: "heatmap" as const,
        data: cells.filter(([, yIndex]) => yIndex === 0),
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: chartColors.grid } }
      },
      {
        name: ROW_LABELS[1],
        type: "heatmap" as const,
        data: cells.filter(([, yIndex]) => yIndex === 1),
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: chartColors.grid } }
      }
    ]
  };
}

export default function MacroClimateHeatmap({ scoreSummary }: MacroClimateHeatmapProps) {
  const payload = useMemo(
    () => buildMacroClimateHeatmapPayload(scoreSummary),
    [scoreSummary]
  );
  const option = useMemo(() => buildOption(payload), [payload]);

  if (payload.bucketKeys.length === 0) {
    return (
      <EChartPanel
        title="Macro Climate bucket contribution"
        description="Macro Climate buckets ranked by weighted contribution: red is risk pressure, green is support."
        state="empty"
        emptyMessage="No macro_climate bucket scores available in the current score summary."
      />
    );
  }

  return (
    <EChartPanel
      title="Macro Climate bucket contribution"
      description="Macro Climate buckets ranked by weighted contribution: red is risk pressure, green is support."
      state="ready"
      option={option}
      ariaLabel="Heatmap of Macro Climate bucket scores and weighted contributions, ranked by weighted contribution"
    />
  );
}
