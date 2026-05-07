import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";
import { formatNumber } from "../lib/formatters";
import type { TimeSeriesFile } from "../lib/types";

interface OptionsSentimentPanelProps {
  items: CandidateSourceItem[];
  activeSeries?: TimeSeriesFile[];
}

const orderedMatchers = [
  /spx\/spxw|spxw/,
  /\bspx\b/,
  /index/,
  /equity/,
  /\bvix\b/,
  /\betp\b/,
  /total/
];

function orderRank(item: CandidateSourceItem) {
  const searchable = `${item.id} ${item.label}`.toLowerCase();
  const rank = orderedMatchers.findIndex((matcher) => matcher.test(searchable));
  return rank === -1 ? orderedMatchers.length : rank;
}

function sortCandidateItems(items: CandidateSourceItem[]) {
  return [...items].sort((left, right) => {
    const rankDifference = orderRank(left) - orderRank(right);
    if (rankDifference !== 0) return rankDifference;
    return left.label.localeCompare(right.label);
  });
}

function fallbackLabel(seriesId: string) {
  return seriesId
    .replace(/^put_call_/, "")
    .replace(/_/g, " ")
    .toUpperCase();
}

function activeSeriesItem(series: TimeSeriesFile, candidatesById: Map<string, CandidateSourceItem>) {
  const latestObservation = series.observations[series.observations.length - 1];
  const latestValue = series.summary?.latest_value ?? latestObservation?.value;
  const latestDate = series.summary?.latest_date ?? latestObservation?.date;
  const units = series.units || "ratio";

  return {
    id: series.series_id,
    label: candidatesById.get(series.series_id)?.label ?? fallbackLabel(series.series_id),
    note: `Latest ${units} ${formatNumber(latestValue)} on ${latestDate ?? "N/A"}.`,
    status: "active_data"
  };
}

function uniqueActiveSeries(activeSeries: TimeSeriesFile[]) {
  const seenIds = new Set<string>();
  return activeSeries.filter((series) => {
    if (seenIds.has(series.series_id)) return false;
    seenIds.add(series.series_id);
    return true;
  });
}

export default function OptionsSentimentPanel({ items, activeSeries = [] }: OptionsSentimentPanelProps) {
  const candidatesById = new Map(items.map((item) => [item.id, item]));
  const activeOptionsSeries = uniqueActiveSeries(activeSeries);
  const activeItems = activeOptionsSeries.map((series) => activeSeriesItem(series, candidatesById));
  const activeIds = new Set(activeOptionsSeries.map((series) => series.series_id));
  const combinedItems = sortCandidateItems([
    ...activeItems,
    ...items.filter((item) => !activeIds.has(item.id))
  ]);

  return (
    <CandidateSourcePanel
      eyebrow="Candidate sources"
      emptyText="No active options sentiment candidate rows are configured."
      items={combinedItems}
      summary="Source review required before options sentiment rows can publish active signals."
      title="Options sentiment"
    />
  );
}
