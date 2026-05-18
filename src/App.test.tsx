import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;

// Top-level routes are React.lazy() in App.tsx — the destination component
// resolves via a dynamic import (microtask) plus an act-flushed render pass.
// Mirrors the 50×5ms = 250ms budget used by Channels.test.tsx and
// History.test.tsx so slow CI workers and ECharts-heavy chunks still have
// time to settle before the test asserts.
async function flushLazyRoutes() {
  for (let i = 0; i < 50; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

function renderAt(path: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );
  });

  return container;
}

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("App routing", () => {
  it("renders the shared layout when /credit redirects into the Channels shell", async () => {
    // PR5 Task 5.4: /credit redirects to /channels?tab=credit. The synchronous
    // render path only resolves the shell (the channel-tab body is lazy and
    // resolves after Suspense). We verify layout chrome + the Channels page
    // heading + that the Credit tab button is the active tab.
    //
    // Top-level routes are now lazy in App.tsx, so Channels does not paint
    // until its dynamic import settles. Flush the lazy budget after the
    // redirect before asserting on the Channels shell + NavLink active state
    // — the NavLink active class is recomputed on the same pass as the lazy
    // resolution, so the assertion has to follow flushLazyRoutes().
    const container = renderAt("/credit");
    await flushLazyRoutes();

    expect(container.querySelector("h1")?.textContent).toBe("Market Weather Map");
    expect(container.querySelector(".eyebrow")?.textContent).toBe("Delayed public data");
    expect(container.querySelector("h2")?.textContent).toBe("Channels");
    const activeTab = container.querySelector('.channel-tabs button[aria-current="page"]');
    expect(activeTab?.textContent).toBe("Credit");
    // PR5 Task 5.5: the legacy /credit nav pill has been removed in the nav
    // consolidation. After the redirect to /channels, the "Channels" pill in
    // the new flat 7-pill nav carries the .active class.
    const channelsLink = Array.from(container.querySelectorAll(".site-nav .nav-link")).find(
      (a) => a.textContent?.trim() === "Channels"
    );
    expect(channelsLink?.classList.contains("active")).toBe(true);
  });

  it("primary navigation exposes the consolidated 7-pill bar plus the More disclosure", () => {
    const container = renderAt("/methodology");

    // Top-level pills: 6 NavLinks + the "More" disclosure summary.
    const directPills = container.querySelectorAll(
      ".site-nav > .nav-link, .site-nav > details > summary.nav-link"
    );
    const labels = Array.from(directPills).map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      "Overview",
      "Short-Term",
      "Long-Term",
      "Fragility",
      "Channels",
      "History",
      "More"
    ]);

    // Surviving direct hrefs in the visible bar.
    expect(container.querySelector('a[href="/short-term"]')?.textContent).toBe("Short-Term");
    expect(container.querySelector('a[href="/short-term"]')?.getAttribute("aria-label")).toBe(
      "Short-Term Market Reaction"
    );
    expect(container.querySelector('a[href="/long-term"]')?.textContent).toBe("Long-Term");
    expect(container.querySelector('a[href="/long-term"]')?.getAttribute("aria-label")).toBe(
      "Long-Term Macro / Allocation Climate"
    );

    // Legacy detail-route pills (commodities, positioning, replay, etc.) were
    // removed in PR5 Task 5.5 — they live behind /channels now.
    expect(container.querySelector('a[href="/commodities"]')).toBeNull();
    expect(container.querySelector('a[href="/sentiment"]')).toBeNull();
    expect(container.querySelector('a[href="/replay"]')).toBeNull();
    expect(container.querySelector('a[href="/tactical"]')).toBeNull();
    expect(container.querySelector('a[href="/macro-climate"]')).toBeNull();

    // Diff + Calendar + Methodology now sit inside the More disclosure;
    // Diff is the newest addition and ranks first.
    const moreDetails = container.querySelector(".site-nav__more");
    expect(moreDetails?.tagName.toLowerCase()).toBe("details");
    const moreLinks = Array.from(moreDetails?.querySelectorAll("a") ?? []).map((a) =>
      a.textContent?.trim()
    );
    expect(moreLinks).toEqual(["Diff", "Calendar", "Methodology"]);
  });

  it("redirects unknown routes to the overview", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={["/unknown"]}>
          <App />
        </MemoryRouter>
      );
    });

    expect(container.querySelector("h2")?.textContent).toBe("Overview");
  });
});
