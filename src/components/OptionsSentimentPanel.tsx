import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";

interface OptionsSentimentPanelProps {
  items: CandidateSourceItem[];
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

export default function OptionsSentimentPanel({ items }: OptionsSentimentPanelProps) {
  return (
    <CandidateSourcePanel
      eyebrow="Candidate sources"
      items={sortCandidateItems(items)}
      summary="Source review required before options sentiment rows can publish active signals."
      title="Options sentiment"
    />
  );
}
