import { useEffect, useState } from "react";
import ChartStateBadge, { type ChartState } from "./ChartStateBadge";
import DriverBarList, { type Driver } from "./DriverBarList";
import { loadPageInsights } from "../lib/data";
import type {
  PageInsightsFile,
  RouteInsight,
  RouteInsightState,
  RouteKey,
  SignalRef
} from "../lib/types";
import { useT } from "../lib/i18n";

/**
 * First-glance interpretive hero for single-domain routes.
 *
 * Reads `loadPageInsights()` and looks up `routes[route]`. Renders, top-to-bottom:
 *   - Title row: route title + ChartStateBadge inline + generated-at timestamp right.
 *   - Drivers grid: primary warning + primary support side-by-side via DriverBarList.
 *   - Why-it-matters paragraph (descriptive, no advice).
 *   - Caveat row: freshness notes + confidence.
 *
 * Fallback (loadPageInsights returns null, or routes[route] missing):
 *   minimal heading-only stub with "Current read unavailable — see data status below."
 *
 * Source-gating defensive guard: even if a caller hand-feeds a non-`free_public`
 * SignalRef into `primary_warning` / `primary_support` (be-data-agent should not,
 * but defense in depth), the hero silently drops it.
 */

export interface PageInsightHeroProps {
  route: RouteKey;
}

const ROUTE_INSIGHT_STATE_TO_BADGE: Record<RouteInsightState, ChartState> = {
  risk: "risk",
  support: "support",
  mixed: "mixed",
  calm: "calm",
  watch: "watch",
  // The `unknown` route state has no badge counterpart; render as `mixed`
  // (neutral pill) so the badge does not disappear when state is missing.
  unknown: "mixed"
};

function signalRefToDriver(
  ref: SignalRef,
  direction: "risk" | "support"
): Driver | null {
  // Defensive: never surface source-gated entries in primary slots.
  if (ref.source_status !== "free_public") return null;
  return {
    id: ref.id,
    label: ref.label,
    priority: ref.severity,
    direction,
    why_it_matters: ref.why_it_matters,
    freshness_status: ref.freshness_status,
    confidence: ref.confidence
  };
}

function formatConfidence(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(2);
}

interface ResolvedInsight {
  insight: RouteInsight;
  generatedAt: string;
  date: string;
}

function resolveInsight(
  file: PageInsightsFile | null,
  route: RouteKey
): ResolvedInsight | null {
  if (!file) return null;
  const insight = file.routes[route];
  if (!insight) return null;
  return { insight, generatedAt: file.generated_at_utc, date: file.date };
}

function FallbackHero() {
  const { t } = useT();
  return (
    <section
      className="page-insight-hero page-insight-hero--fallback"
      aria-label="Page insight (unavailable)"
    >
      <h3 className="page-insight-hero__title">{t("panels.pageInsightUnavailable")}</h3>
      <p className="page-insight-hero__caveat">
        {t("panels.pageInsightUnavailableBody")}
      </p>
    </section>
  );
}

export default function PageInsightHero({ route }: PageInsightHeroProps) {
  const { t, tDriver, tNarrative, locale } = useT();
  const [file, setFile] = useState<PageInsightsFile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadPageInsights()
      .then((result) => {
        if (!active) return;
        setFile(result);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setFile(null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return null;

  const resolved = resolveInsight(file, route);
  if (!resolved) return <FallbackHero />;

  const { insight, date } = resolved;
  const badgeState = ROUTE_INSIGHT_STATE_TO_BADGE[insight.state] ?? "mixed";

  const drivers: Driver[] = [];
  if (insight.primary_warning) {
    const warningDriver = signalRefToDriver(insight.primary_warning, "risk");
    if (warningDriver) drivers.push(warningDriver);
  }
  if (insight.primary_support) {
    const supportDriver = signalRefToDriver(insight.primary_support, "support");
    if (supportDriver) drivers.push(supportDriver);
  }

  const freshnessNotes = insight.freshness_notes ?? [];
  const hasCaveat = freshnessNotes.length > 0 || Number.isFinite(insight.confidence);

  const translatedTitle = tDriver(insight.title);
  const whyNarr = tNarrative(insight.why_it_matters);
  // Translate driver labels in the Driver[] array so DriverBarList renders zh.
  const localizedDrivers: Driver[] = drivers.map((d) => ({ ...d, label: tDriver(d.label) }));

  return (
    <section className="page-insight-hero" aria-label={`${insight.title} hero`}>
      <div className="page-insight-hero__title-row">
        <div className="page-insight-hero__title-group">
          <h3 className="page-insight-hero__title">{translatedTitle}</h3>
          <ChartStateBadge state={badgeState} />
        </div>
        <p className="page-insight-hero__generated-at">{t("narrative.asOf")} {date}</p>
      </div>
      {localizedDrivers.length > 0 ? (
        <div className="page-insight-hero__drivers" role="group" aria-label="Primary drivers">
          {insight.primary_warning && localizedDrivers.some((d) => d.direction === "risk") ? (
            <div className="page-insight-hero__driver-slot page-insight-hero__driver-slot--warning">
              <p className="page-insight-hero__driver-eyebrow">{t("sections.primaryWarning")}</p>
              <DriverBarList
                items={localizedDrivers.filter((d) => d.direction === "risk")}
                max={1}
              />
            </div>
          ) : null}
          {insight.primary_support && localizedDrivers.some((d) => d.direction === "support") ? (
            <div className="page-insight-hero__driver-slot page-insight-hero__driver-slot--support">
              <p className="page-insight-hero__driver-eyebrow">{t("sections.primarySupport")}</p>
              <DriverBarList
                items={localizedDrivers.filter((d) => d.direction === "support")}
                max={1}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {insight.why_it_matters ? (
        <p
          className="page-insight-hero__why"
          lang={locale === "zh" && !whyNarr.matched ? "en" : undefined}
        >
          {whyNarr.text}
        </p>
      ) : null}
      {hasCaveat ? (
        <div className="page-insight-hero__caveat">
          {Number.isFinite(insight.confidence) ? (
            <span className="page-insight-hero__confidence">
              {t("narrative.confidenceWithValue", { vars: { value: formatConfidence(insight.confidence) } })}
            </span>
          ) : null}
          {freshnessNotes.length > 0 ? (
            <ul className="page-insight-hero__freshness">
              {freshnessNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
