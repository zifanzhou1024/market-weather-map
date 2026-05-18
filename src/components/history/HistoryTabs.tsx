import { useSearchParams } from "react-router-dom";

export const HISTORY_TAB_IDS = ["regime", "replay"] as const;

export type HistoryTabId = typeof HISTORY_TAB_IDS[number];

const TAB_LABELS: Record<HistoryTabId, string> = {
  regime: "Regime Map",
  replay: "Historical Replay",
};

export function isHistoryTabId(value: string | null | undefined): value is HistoryTabId {
  return value != null && (HISTORY_TAB_IDS as readonly string[]).includes(value);
}

export default function HistoryTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: HistoryTabId = isHistoryTabId(rawTab) ? rawTab : "regime";

  return (
    <nav className="history-tabs channel-tabs" aria-label="History">
      {HISTORY_TAB_IDS.map((id) => (
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
