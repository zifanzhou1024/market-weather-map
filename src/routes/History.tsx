import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { useSearchParams } from "react-router-dom";
import HistoryTabs, { isHistoryTabId, type HistoryTabId } from "../components/history/HistoryTabs";

const TAB_COMPONENTS: Record<HistoryTabId, LazyExoticComponent<ComponentType>> = {
  regime: lazy(() => import("../components/history/RegimeTab")),
  replay: lazy(() => import("../components/history/ReplayTab")),
};

export default function History() {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: HistoryTabId = isHistoryTabId(rawTab) ? rawTab : "regime";
  const Body = TAB_COMPONENTS[activeTab];

  return (
    <main className="page-shell history">
      <section className="page-heading">
        <p className="eyebrow">Cross-asset history</p>
        <h2>History</h2>
        <p>Regime quadrant trail + descriptive analogues of prior real-yield / dollar / credit / VIX-curve patterns.</p>
      </section>
      <HistoryTabs />
      <Suspense fallback={<div className="channels__loading">Loading…</div>}>
        <Body />
      </Suspense>
    </main>
  );
}
