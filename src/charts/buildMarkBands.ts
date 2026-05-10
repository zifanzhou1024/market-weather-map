/**
 * ECharts `markArea.data` builder for threshold bands.
 *
 * ECharts expects `markArea.data` to be an array of 2-tuples where each tuple
 * is a pair of corner objects describing the rectangle. For a horizontal band
 * across the y-axis we set the y range on the two corners; ECharts paints
 * across the full visible x-axis automatically.
 *
 * Open-ended bands (missing `min` or `max`) use `-Infinity` / `+Infinity`,
 * which ECharts clamps to the chart's data range — this gives chart builders
 * a clean way to say "stress is anything above 20" without hard-coding the
 * top of the y-axis.
 */

export type ThresholdBand = {
  label: string;
  min?: number;
  max?: number;
  color: string;
};

type MarkAreaCorner = {
  name?: string;
  yAxis: number;
  itemStyle?: { color: string };
};

export type MarkAreaBand = [MarkAreaCorner, MarkAreaCorner];

export function buildMarkBands(bands: ThresholdBand[]): MarkAreaBand[] {
  return bands.map((band) => {
    const lower: MarkAreaCorner = {
      name: band.label,
      yAxis: band.min ?? -Infinity,
      itemStyle: { color: band.color }
    };
    const upper: MarkAreaCorner = {
      yAxis: band.max ?? Infinity
    };
    return [lower, upper];
  });
}
