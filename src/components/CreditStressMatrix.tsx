import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import { formatSignedScore } from "../charts/chartFormatters";
import type { TimeSeriesFile } from "../lib/types";
import { useT } from "../lib/i18n";

interface CreditStressMatrixProps {
  highYieldOas?: TimeSeriesFile;
  investmentGradeOas?: TimeSeriesFile;
  bbbOas?: TimeSeriesFile;
}

const HORIZONS = [
  { label: "1D", lookback: 1 },
  { label: "1W", lookback: 5 },
  { label: "1M", lookback: 21 }
] as const;

function changeOverLookback(series: TimeSeriesFile | undefined, lookback: number): number | null {
  if (!series) return null;
  const observations = series.observations;
  if (observations.length === 0) return null;
  const latest = observations[observations.length - 1];
  if (typeof latest.value !== "number" || !Number.isFinite(latest.value)) return null;
  const prior = observations[observations.length - 1 - lookback];
  if (!prior || typeof prior.value !== "number" || !Number.isFinite(prior.value)) return null;
  return latest.value - prior.value;
}

interface RowEntry {
  label: string;
  series?: TimeSeriesFile;
}

interface HeatmapTooltipParams {
  data: [number, number, number];
}

export default function CreditStressMatrix({
  highYieldOas,
  investmentGradeOas,
  bbbOas
}: CreditStressMatrixProps) {
  const { t } = useT();
  const rows: RowEntry[] = [
    { label: "HY OAS", series: highYieldOas },
    { label: "IG OAS", series: investmentGradeOas },
    { label: "BBB OAS", series: bbbOas }
  ];

  if (rows.every((row) => row.series === undefined)) {
    return (
      <EChartPanel
        title={t("sections.creditStressMatrix")}
        description={t("panels.creditStressMatrixDesc")}
        state="empty"
        emptyMessage={t("panels.creditStressMatrixEmpty")}
      />
    );
  }

  const cells: Array<[number, number, number]> = [];
  rows.forEach((row, rowIndex) => {
    HORIZONS.forEach((horizon, horizonIndex) => {
      const change = changeOverLookback(row.series, horizon.lookback);
      cells.push([horizonIndex, rowIndex, change ?? 0]);
    });
  });

  const finiteValues = cells
    .map((cell) => cell[2])
    .filter((value) => Number.isFinite(value) && value !== 0);
  const absMax = finiteValues.length === 0 ? 1 : Math.max(...finiteValues.map(Math.abs));

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 24, bottom: 64 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (params: HeatmapTooltipParams) => {
        const [x, y, value] = params.data;
        const horizon = HORIZONS[x]?.label ?? "";
        const row = rows[y]?.label ?? "";
        return `${row} &middot; ${horizon}<br/>Change ${formatSignedScore(value, 2)}`;
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: HORIZONS.map((h) => h.label),
      splitArea: { show: true }
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: rows.map((row) => row.label),
      splitArea: { show: true }
    },
    visualMap: {
      min: -absMax,
      max: absMax,
      calculable: false,
      orient: "horizontal" as const,
      left: "center",
      bottom: 4,
      inRange: { color: [chartColors.support, "#f0eee5", chartColors.warning] },
      textStyle: { color: chartColors.muted, fontSize: 11 }
    },
    series: [
      {
        name: "Credit spread change",
        type: "heatmap" as const,
        data: cells,
        label: {
          show: true,
          formatter: (params: HeatmapTooltipParams) => {
            const value = params.data[2];
            return Number.isFinite(value) ? formatSignedScore(value, 2) : "—";
          },
          fontSize: 11,
          color: chartColors.text
        }
      }
    ]
  };

  return (
    <EChartPanel
      title={t("sections.creditStressMatrix")}
      description={t("panels.creditStressMatrixDesc")}
      state="ready"
      option={option}
      ariaLabel="Heatmap of credit OAS changes across HY, IG, and BBB segments by 1D, 1W, and 1M horizons"
      height={220}
    />
  );
}
