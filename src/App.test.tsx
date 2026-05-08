import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;

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
  it("renders the shared layout and credit route copy", () => {
    const container = renderAt("/credit");

    expect(container.querySelector("h1")?.textContent).toBe("Market Weather Map");
    expect(container.querySelector(".eyebrow")?.textContent).toBe("Delayed public data");
    expect(container.querySelector("h2")?.textContent).toBe("Credit & Banking");
    expect(container.textContent).toContain("Credit spreads, financial stress, banking system liquidity, lending, and deposits.");
    expect(container.querySelector('a[href="/credit"]')?.className).toContain("active");
  });

  it("primary navigation exposes commodities, positioning, and decision views", () => {
    const container = renderAt("/methodology");

    expect(container.textContent).toContain("Primary Views");
    expect(container.textContent).toContain("Data Library");
    expect(container.textContent).toContain("Reference");
    expect(container.querySelector('a[href="/commodities"]')?.textContent).toBe("Commodities");
    expect(container.querySelector('a[href="/sentiment"]')?.textContent).toBe("Positioning");
    expect(container.querySelector('a[href="/short-term"]')?.textContent).toBe("Short-Term");
    expect(container.querySelector('a[href="/short-term"]')?.getAttribute("aria-label")).toBe(
      "Short-Term Market Reaction"
    );
    expect(container.querySelector('a[href="/long-term"]')?.textContent).toBe("Long-Term");
    expect(container.querySelector('a[href="/long-term"]')?.getAttribute("aria-label")).toBe(
      "Long-Term Macro / Allocation Climate"
    );
    expect(container.querySelector('a[href="/tactical"]')).toBeNull();
    expect(container.querySelector('a[href="/macro-climate"]')).toBeNull();
    expect(container.querySelector('a[href="/regime-map"]')?.textContent).toBe("Regime Map");
    expect(container.querySelector('a[href="/replay"]')?.textContent).toBe("Replay");
    expect(container.querySelector('a[href="/replay"]')?.getAttribute("aria-label")).toBe(
      "Historical Regime Replay"
    );
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
