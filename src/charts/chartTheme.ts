/**
 * Shared chart tokens for the ECharts wrapper. Aligned with the project's
 * earthy palette in src/styles.css so charts sit cleanly with the rest of the
 * UI. Callers compose ECharts options using these constants rather than
 * inlining colour strings, so a future palette change rolls through every
 * chart without per-call edits.
 */

export const chartColors = {
  warning: "#b04a3a",
  support: "#3a7d5b",
  missing: "#c08b32",
  neutral: "#607066",
  primary: "#31483a",
  axis: "#b0b8b0",
  grid: "#e0e3dc",
  text: "#233029",
  muted: "#607066"
} as const;

export const chartCategoricalPalette = [
  "#31483a",
  "#3a7d5b",
  "#b04a3a",
  "#c08b32",
  "#31516b",
  "#7a5b92",
  "#2f6f73",
  "#b76f2b"
] as const;

export const chartTextStyle = {
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 12,
  color: chartColors.text
} as const;

export const chartGridDefaults = {
  left: 48,
  right: 24,
  top: 24,
  bottom: 28,
  containLabel: true
} as const;

export const chartAxisDefaults = {
  axisLine: { lineStyle: { color: chartColors.axis } },
  axisLabel: { color: chartColors.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: chartColors.grid, type: "dashed" } }
} as const;

export const chartTooltipDefaults = {
  backgroundColor: "rgba(255, 254, 249, 0.96)",
  borderColor: chartColors.grid,
  borderWidth: 1,
  textStyle: { color: chartColors.text, fontSize: 12 }
} as const;
