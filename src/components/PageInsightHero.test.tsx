import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PageInsightHero from "./PageInsightHero";
import type { PageInsightsFile, RouteInsight, SignalRef } from "../lib/types";

vi.mock("../lib/data", () => ({
  loadPageInsights: vi.fn()
}));

import { loadPageInsights } from "../lib/data";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return container;
}

async function flushPromises(container: HTMLElement, expectedText: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.textContent?.includes(expectedText)) return;
  }
  expect(container.textContent).toContain(expectedText);
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function mkSignalRef(overrides: Partial<SignalRef> = {}): SignalRef {
  return {
    id: overrides.id ?? "vix-curve-stress",
    label: overrides.label ?? "VIX curve stress",
    message: overrides.message ?? "VIX9D above VIX, inverted near-term.",
    why_it_matters:
      overrides.why_it_matters ?? "Near-term implied volatility above the 30-day.",
    severity: overrides.severity ?? 65,
    freshness_status: overrides.freshness_status ?? "ok",
    confidence: overrides.confidence ?? 0.8,
    source_status: overrides.source_status ?? "free_public"
  };
}

function mkRouteInsight(overrides: Partial<RouteInsight> = {}): RouteInsight {
  return {
    title: overrides.title ?? "Rates and policy read",
    state: overrides.state ?? "risk",
    primary_warning: overrides.primary_warning,
    primary_support: overrides.primary_support,
    why_it_matters:
      overrides.why_it_matters ??
      "Real yields anchor valuation while breakevens read inflation compensation.",
    confidence: overrides.confidence ?? 0.72,
    freshness_notes: overrides.freshness_notes ?? []
  };
}

function mkPageInsights(routes: PageInsightsFile["routes"]): PageInsightsFile {
  return {
    generated_at_utc: "2026-05-09T15:32:54Z",
    date: "2026-05-09",
    method_version: "test-1",
    routes
  };
}

describe("PageInsightHero", () => {
  it("renders the title, state badge, why-it-matters, and generated-at when data is present", async () => {
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights({
        rates: mkRouteInsight({
          title: "Rates and policy read",
          state: "risk",
          why_it_matters: "Real yields anchor valuation; breakevens read inflation."
        })
      })
    );

    const container = render(<PageInsightHero route="rates" />);
    await flushPromises(container, "Rates and policy read");

    expect(container.querySelector(".page-insight-hero")).not.toBeNull();
    expect(container.textContent).toContain("Rates and policy read");
    expect(container.querySelector(".chart-state-badge--risk")).not.toBeNull();
    expect(container.textContent).toContain("Real yields anchor valuation");
    expect(container.textContent).toContain("2026-05-09");
  });

  it("renders primary_warning and primary_support side-by-side via DriverBarList", async () => {
    const warning = mkSignalRef({ id: "w-1", label: "HY OAS widening" });
    const support = mkSignalRef({
      id: "s-1",
      label: "Net liquidity rising",
      severity: 40
    });
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights({
        credit: mkRouteInsight({
          title: "Credit pressure read",
          state: "mixed",
          primary_warning: warning,
          primary_support: support
        })
      })
    );

    const container = render(<PageInsightHero route="credit" />);
    await flushPromises(container, "Credit pressure read");

    expect(container.textContent).toContain("HY OAS widening");
    expect(container.textContent).toContain("Net liquidity rising");
    const driverRows = container.querySelectorAll(".driver-bar-list__row");
    expect(driverRows.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a minimal heading-only stub when loadPageInsights resolves null", async () => {
    vi.mocked(loadPageInsights).mockResolvedValue(null);

    const container = render(<PageInsightHero route="rates" />);
    await flushPromises(container, "Current read unavailable");

    expect(container.querySelector(".page-insight-hero--fallback")).not.toBeNull();
    expect(container.textContent).toContain("Current read unavailable");
    expect(container.textContent).toContain("see data status below");
  });

  it("falls back when the routes map exists but the route key is missing", async () => {
    vi.mocked(loadPageInsights).mockResolvedValue(mkPageInsights({}));

    const container = render(<PageInsightHero route="volatility" />);
    await flushPromises(container, "Current read unavailable");

    expect(container.querySelector(".page-insight-hero--fallback")).not.toBeNull();
  });

  it("state badge matches the route insight state field", async () => {
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights({
        liquidity: mkRouteInsight({ state: "support" })
      })
    );

    const container = render(<PageInsightHero route="liquidity" />);
    await flushPromises(container, "Rates and policy read");

    expect(container.querySelector(".chart-state-badge--support")).not.toBeNull();
    expect(container.querySelector(".chart-state-badge--risk")).toBeNull();
  });

  it("renders freshness_notes as a caveat when present", async () => {
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights({
        rates: mkRouteInsight({
          freshness_notes: ["us10y is stale (3d).", "real_yield_10y is stale (2d)."]
        })
      })
    );

    const container = render(<PageInsightHero route="rates" />);
    await flushPromises(container, "Rates and policy read");

    expect(container.textContent).toContain("us10y is stale");
    expect(container.textContent).toContain("real_yield_10y is stale");
  });

  it("renders confidence in the caveat block", async () => {
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights({
        rates: mkRouteInsight({ confidence: 0.42 })
      })
    );

    const container = render(<PageInsightHero route="rates" />);
    await flushPromises(container, "Rates and policy read");

    expect(container.textContent).toMatch(/Confidence.*0\.42|42%/);
  });

  it("omits primary slots that are source-gated upstream (fixture without primary_*)", async () => {
    // be-data-agent excludes source-gated signals from primary_warning/primary_support.
    // The hero must therefore render gracefully when those slots are absent and never
    // try to surface a `terms_review_needed` SignalRef in a primary slot.
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights({
        rates: mkRouteInsight({
          primary_warning: undefined,
          primary_support: undefined,
          why_it_matters: "All primary slots are empty — only context shows."
        })
      })
    );

    const container = render(<PageInsightHero route="rates" />);
    await flushPromises(container, "Rates and policy read");

    expect(container.textContent).toContain("All primary slots are empty");
    // No driver bars should render when both primary slots are absent.
    expect(container.querySelectorAll(".driver-bar-list__row").length).toBe(0);
  });

  it("does not render source-gated signals even if a caller hand-feeds them in (defensive)", async () => {
    // Upstream guarantee: be-data-agent strips source-gated SignalRefs from
    // primary_warning / primary_support. As a belt-and-suspenders safeguard,
    // the hero should silently drop any SignalRef whose source_status is not
    // `free_public` so a future regression in the data layer cannot surface
    // gated content in the hero.
    const gatedWarning = mkSignalRef({
      id: "gated",
      label: "MOVE index spike (gated)",
      source_status: "terms_review_needed"
    });
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights({
        volatility: mkRouteInsight({
          primary_warning: gatedWarning,
          primary_support: undefined
        })
      })
    );

    const container = render(<PageInsightHero route="volatility" />);
    await flushPromises(container, "Rates and policy read");

    expect(container.textContent).not.toContain("MOVE index spike");
  });
});
