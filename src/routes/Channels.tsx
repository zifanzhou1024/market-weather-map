import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { useSearchParams } from "react-router-dom";
import ChannelTabs, { isChannelTabId, type ChannelTabId } from "../components/channels/ChannelTabs";
import { useT } from "../lib/i18n";

const TAB_COMPONENTS: Record<ChannelTabId, LazyExoticComponent<ComponentType>> = {
  volatility: lazy(() => import("../components/channels/VolatilityTab")),
  rates: lazy(() => import("../components/channels/RatesTab")),
  liquidity: lazy(() => import("../components/channels/LiquidityTab")),
  credit: lazy(() => import("../components/channels/CreditTab")),
  dollar: lazy(() => import("../components/channels/DollarTab")),
  commodities: lazy(() => import("../components/channels/CommoditiesTab")),
  growth: lazy(() => import("../components/channels/GrowthTab")),
  housing: lazy(() => import("../components/channels/HousingTab")),
  inflation: lazy(() => import("../components/channels/InflationTab")),
  positioning: lazy(() => import("../components/channels/PositioningTab")),
};

export default function Channels() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ChannelTabId = isChannelTabId(rawTab) ? rawTab : "volatility";
  const Body = TAB_COMPONENTS[activeTab];

  return (
    <main className="page-shell channels">
      <section className="page-heading">
        <p className="eyebrow" lang="en">Detail Channels</p>
        <h2>{t("routes.channelsHeading")}</h2>
        <p lang="en">Per-asset-class detail views of the underlying data feeding the cockpit.</p>
      </section>
      <ChannelTabs />
      <Suspense fallback={<div className="channels__loading">Loading channel…</div>}>
        <Body />
      </Suspense>
    </main>
  );
}
