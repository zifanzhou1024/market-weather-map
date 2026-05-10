import type { ReactNode } from "react";
import type { RouteKey } from "../lib/types";

/**
 * Visual container that wraps the "data and sources" tail at the bottom of
 * every route.
 *
 * Layout (top-to-bottom):
 *   1. Visual separator — signals "below the analytical content."
 *   2. "Data and sources" heading (eyebrow style).
 *   3. Panels region — children render in source order so each route can compose
 *      its own DataGapPanel, DataStatusTable, source-gap readiness panels, and
 *      static-feed-freshness panels.
 *
 * The footer does not own the route-specific status/seriesIds — routes already
 * thread those into their existing DataGapPanel / DataStatusTable usages and
 * pass them in as children. The footer is the consistent chrome.
 *
 * Source-gated readiness panels MUST live inside this footer (never above) per
 * the source-gating rule in CLAUDE.md.
 */

export interface RouteDataFooterProps {
  route?: RouteKey;
  children?: ReactNode;
}

export default function RouteDataFooter({ route, children }: RouteDataFooterProps) {
  const ariaLabel = route ? `Data and sources for ${route}` : "Data and sources";

  return (
    <footer className="route-data-footer" aria-label={ariaLabel}>
      <hr className="route-data-footer__separator" aria-hidden="true" />
      <h3 className="route-data-footer__heading">Data and sources</h3>
      <div className="route-data-footer__panels">{children}</div>
    </footer>
  );
}
