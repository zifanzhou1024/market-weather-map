import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsType } from "echarts/core";

/**
 * Register the chart types and components every panel in this project relies
 * on. Using `echarts/core` modular imports plus `CanvasRenderer` keeps the
 * bundle smaller than `import * as echarts from "echarts"` while still giving
 * line, bar, heatmap, and the headline components without per-call
 * registration.
 */
echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  DataZoomComponent,
  VisualMapComponent,
  CanvasRenderer
]);

export type EChartPanelState = "loading" | "error" | "empty" | "ready";

export interface EChartPanelProps {
  title: string;
  description?: string;
  state: EChartPanelState;
  option?: Parameters<EChartsType["setOption"]>[0];
  errorMessage?: string;
  emptyMessage?: string;
  ariaLabel?: string;
  height?: number;
}

const DEFAULT_HEIGHT = 280;

export default function EChartPanel({
  title,
  description,
  state,
  option,
  errorMessage = "Unable to render chart.",
  emptyMessage = "No data available for this chart.",
  ariaLabel,
  height = DEFAULT_HEIGHT
}: EChartPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (state !== "ready") {
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(el);
    }
    if (option) {
      instanceRef.current.setOption(option);
    }
  }, [state, option]);

  useEffect(
    () => () => {
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    },
    []
  );

  return (
    <section className="echart-panel">
      <header className="echart-panel-header">
        <h3 className="echart-panel-title">{title}</h3>
        {description ? <p className="echart-panel-description">{description}</p> : null}
      </header>
      <div className="echart-panel-body" style={{ height }}>
        {state === "loading" ? (
          <div
            data-state="loading"
            aria-busy="true"
            className="echart-panel-state echart-panel-state--loading"
          >
            <span>Loading chart…</span>
          </div>
        ) : null}
        {state === "error" ? (
          <div
            data-state="error"
            role="alert"
            className="echart-panel-state echart-panel-state--error"
          >
            <span>{errorMessage}</span>
          </div>
        ) : null}
        {state === "empty" ? (
          <div data-state="empty" className="echart-panel-state echart-panel-state--empty">
            <span>{emptyMessage}</span>
          </div>
        ) : null}
        {state === "ready" ? (
          <div
            ref={containerRef}
            data-state="ready"
            role="img"
            aria-label={ariaLabel ?? title}
            className="echart-panel-canvas"
            style={{ height: "100%", width: "100%" }}
          />
        ) : null}
      </div>
    </section>
  );
}
