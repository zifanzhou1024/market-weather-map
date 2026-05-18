import { useSearchParams } from "react-router-dom";

export const CHANNEL_TAB_IDS = [
  "volatility", "rates", "liquidity", "credit", "dollar",
  "commodities", "growth", "housing", "inflation", "positioning",
] as const;

export type ChannelTabId = typeof CHANNEL_TAB_IDS[number];

const TAB_LABELS: Record<ChannelTabId, string> = {
  volatility: "Volatility",
  rates: "Rates",
  liquidity: "Liquidity",
  credit: "Credit",
  dollar: "Dollar",
  commodities: "Commodities",
  growth: "Growth",
  housing: "Housing",
  inflation: "Inflation",
  positioning: "Positioning",
};

export function isChannelTabId(value: string | null | undefined): value is ChannelTabId {
  return value != null && (CHANNEL_TAB_IDS as readonly string[]).includes(value);
}

export default function ChannelTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ChannelTabId = isChannelTabId(rawTab) ? rawTab : "volatility";

  return (
    <nav className="channel-tabs" aria-label="Channels">
      {CHANNEL_TAB_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className={`channel-tab ${id === activeTab ? "channel-tab--active" : ""}`.trim()}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set("tab", id);
            setSearchParams(next, { replace: false });
          }}
          aria-current={id === activeTab ? "page" : undefined}
        >
          {TAB_LABELS[id]}
        </button>
      ))}
    </nav>
  );
}
