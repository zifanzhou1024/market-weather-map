import ChartStateBadge, { type ChartState } from "./ChartStateBadge";

/**
 * Compact callout for a chart's "current read" summary.
 *
 * Layout (top-to-bottom):
 *   header row: optional ChartStateBadge inline at the start
 *   message:    primary descriptive sentence
 *   caveat:     optional muted footnote (freshness, confidence, etc.)
 *
 * Tone reminder: messages and caveats must be descriptive — no advice,
 * targets, or buy/sell/short language (matches docs/LIMITATIONS.md).
 */

export interface InsightCalloutProps {
  state?: ChartState;
  message: string;
  caveat?: string;
}

export default function InsightCallout({ state, message, caveat }: InsightCalloutProps) {
  return (
    <div className="insight-callout">
      <div className="insight-callout__header">
        {state ? <ChartStateBadge state={state} /> : null}
        <p className="insight-callout__message">{message}</p>
      </div>
      {caveat ? <p className="insight-callout__caveat">{caveat}</p> : null}
    </div>
  );
}
