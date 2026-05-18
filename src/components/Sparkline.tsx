interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Lightweight inline-SVG sparkline used by cockpit cells.
 *
 * Design notes:
 * - No animation, no runtime dependency — pure SVG so it renders instantly
 *   and stays cheap on the static GitHub Pages build.
 * - Stroke uses `currentColor`, so the parent cockpit cell controls tone
 *   (risk / support / calm) via CSS color.
 * - Renders nothing for fewer than two points: a single-point "line" would
 *   be misleading.
 * - Marked `aria-hidden` because the sparkline is a decorative supplement
 *   to the numeric value already announced by the cell.
 */
export default function Sparkline({
  points,
  width = 60,
  height = 24,
  className,
}: SparklineProps) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const polyPoints = points
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(" ");
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={polyPoints}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
