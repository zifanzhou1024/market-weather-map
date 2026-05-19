import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { useSearchParams } from "react-router-dom";
import HistoryTabs, { isHistoryTabId, type HistoryTabId } from "../components/history/HistoryTabs";
import { useT } from "../lib/i18n";

const TAB_COMPONENTS: Record<HistoryTabId, LazyExoticComponent<ComponentType>> = {
  regime: lazy(() => import("../components/history/RegimeTab")),
  replay: lazy(() => import("../components/history/ReplayTab")),
};

export default function History() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: HistoryTabId = isHistoryTabId(rawTab) ? rawTab : "regime";
  const Body = TAB_COMPONENTS[activeTab];

  return (
    <main className="page-shell history">
      <section className="page-heading">
        <p className="eyebrow">{t("routes.historyEyebrow")}</p>
        <h2>{t("routes.historyHeading")}</h2>
        <p>{t("routes.historyIntro")}</p>
      </section>
      <HistoryTabs />
      <Suspense fallback={<div className="channels__loading">{t("routes.historyLoading")}</div>}>
        <Body />
      </Suspense>
    </main>
  );
}
